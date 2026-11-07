import "server-only";
import { exec, queryOne } from "../db";
import { decrypt, encrypt } from "../crypto";
import { getObject, putObject, storageConfigured, userKey } from "../storage";
import { logProvider } from "../payments/log";
import { sendBookingSms, sendResendEmail } from "../notify";
import { getSetting } from "../settings";
import { ticketPdf } from "./ticket-pdf";
import type { TrainBookingDetails } from "./train-booking";

type Row = { booking_ref: string; user_uid: string; ticket_status: string; amount_paise: number; pay_payment_id: string | null; paid_at: Date | null; details_enc: string; ticket_key_enc: string | null };

const load = (ref: string) =>
  queryOne<Row>("SELECT booking_ref, user_uid, ticket_status, amount_paise, pay_payment_id, paid_at, details_enc, ticket_key_enc FROM bookings WHERE booking_ref = ?", [ref]);

/** S3 key for a train ticket: <SKYO ID>/train/<booking ref>_<journey YYYYMMDD>.pdf */
export const ticketKey = (uid: string, ref: string, date: string) => userKey(uid, "train", `${ref}_${date.replace(/-/g, "")}.pdf`);

async function render(b: Row) {
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const pdf = await ticketPdf({ ref: b.booking_ref, uid: b.user_uid, details: d, amount: b.amount_paise / 100, paymentId: b.pay_payment_id, paidAt: b.paid_at });
  return { pdf, d };
}

/** Generates the PDF and stores it in S3 (once). Returns the bytes. */
async function storeTicket(b: Row) {
  const { pdf, d } = await render(b);
  if (!storageConfigured()) return { pdf, d, key: null };
  const key = ticketKey(b.user_uid, b.booking_ref, d.date);
  const started = Date.now();
  try {
    await putObject(key, pdf, "application/pdf");
    await exec("UPDATE bookings SET ticket_key_enc = ? WHERE booking_ref = ?", [await encrypt(key), b.booking_ref]);
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "storage.ticket_upload", outcome: "ok", latencyMs: Date.now() - started, request: { key, bytes: pdf.length }, response: { stored: true } });
    return { pdf, d, key };
  } catch (e) {
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "storage.ticket_upload", outcome: "error", latencyMs: Date.now() - started, request: { key, bytes: pdf.length }, response: { error: (e as Error).name, message: (e as Error).message } });
    return { pdf, d, key: null };
  }
}

/** Ticket bytes for download: S3 first, otherwise generate (and store) now. */
export async function ticketFile(ref: string): Promise<Uint8Array | null> {
  const b = await load(ref);
  if (!b || b.ticket_status !== "issued") return null;
  const key = await decrypt(b.ticket_key_enc);
  if (key) {
    const obj = await getObject(key).catch(() => null);
    if (obj) return obj.body;
  }
  return (await storeTicket(b)).pdf;
}

/** After a ticket is issued: PDF → S3, then SMS + email to the customer. Every step is logged. */
export async function afterTicketIssued(ref: string) {
  const b = await load(ref);
  if (!b || b.ticket_status !== "issued") return;
  const { pdf, d } = await storeTicket(b);
  const site = await getSetting("site_name");
  const pnr = d.ticket?.pnr ?? "-";
  const amount = `Rs.${(b.amount_paise / 100).toFixed(2)}`;
  const statusLine = (d.ticket?.allocations || []).map((a) => `${a.name}: ${a.status}${a.coach ? ` ${a.coach}/${a.berth}` : ""}`).join(", ");

  const phone = (d.contact.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10) {
    const text = `${site}: Booking ${b.booking_ref} confirmed. PNR ${pnr}, train ${d.train.number} ${d.from}-${d.to} on ${d.date}. Paid ${amount}. E-ticket in My trips.`;
    const r = await sendBookingSms(phone, { ref: b.booking_ref, pnr, amount, text });
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.sms", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  }

  if (d.contact.email) {
    const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
    const rows = (d.ticket?.allocations || []).map((a) => `<tr><td style="padding:6px 10px">${esc(a.name)}</td><td style="padding:6px 10px">${esc(a.status)}${a.coach ? ` · ${esc(a.coach)}/${a.berth}` : ""}</td></tr>`).join("");
    const html = `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0a0f1f">
      <div style="background:#0057ff;color:#fff;padding:18px 22px;border-radius:12px 12px 0 0"><b style="font-size:20px">${esc(site)}</b><div>Booking confirmed · PNR ${esc(pnr)}</div></div>
      <div style="border:1px solid #e6e8ef;border-top:0;padding:20px 22px;border-radius:0 0 12px 12px">
        <p>Hi ${esc(d.contact.name || "Traveller")}, your train ticket is booked.</p>
        <p><b>${esc(d.train.number)} ${esc(d.train.name)}</b><br>${esc(d.from)} → ${esc(d.to)} · ${esc(d.date)} · ${esc(d.cls)}</p>
        <table style="border-collapse:collapse;width:100%;background:#f6f7fb;border-radius:8px">${rows}</table>
        <p>Total paid: <b>${esc(amount)}</b> · Booking ref ${esc(b.booking_ref)}</p>
        <p style="color:#6b7280;font-size:12px">Your e-ticket PDF is attached and always available in My trips. This is a test-mode sample ticket.</p>
      </div></div>`;
    const r = await sendResendEmail({
      to: d.contact.email,
      subject: `${site} · Ticket confirmed · PNR ${pnr}`,
      html,
      text: `Booking ${b.booking_ref} confirmed. PNR ${pnr}. ${d.train.number} ${d.from}-${d.to} on ${d.date}. ${statusLine}. Paid ${amount}.`,
      attachments: [{ filename: `${site}-eTicket-${b.booking_ref}.pdf`, content: pdf }],
    });
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.email", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  }
}
