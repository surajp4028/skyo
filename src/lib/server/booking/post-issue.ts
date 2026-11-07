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
  const pdf = await ticketPdf({ ref: b.booking_ref, uid: b.user_uid, details: d, amount: b.amount_paise / 100, paymentId: b.pay_payment_id, paidAt: b.paid_at, site: await getSetting("site_name") });
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

/** The real ticket from Tripgic/IRCTC → <SKYO ID>/train/<ref>_<date>_irctc.pdf, key kept in booking details. */
async function storeProviderTicket(b: Row, pdf: Buffer) {
  if (!storageConfigured() || pdf.subarray(0, 4).toString() !== "%PDF") return;
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const key = userKey(b.user_uid, "train", `${b.booking_ref}_${d.date.replace(/-/g, "")}_irctc.pdf`);
  try {
    await putObject(key, pdf, "application/pdf");
    if (d.ticket) d.ticket.providerPdfKey = key;
    await exec("UPDATE bookings SET details_enc = ? WHERE booking_ref = ?", [await encrypt(JSON.stringify(d)), b.booking_ref]);
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "storage.provider_ticket", outcome: "ok", request: { key, bytes: pdf.length }, response: { stored: true } });
  } catch (e) {
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "storage.provider_ticket", outcome: "error", request: { key, bytes: pdf.length }, response: { error: (e as Error).message } });
  }
}

/** The provider (IRCTC) ticket from S3, if one was received. */
export async function providerTicketFile(ref: string): Promise<Uint8Array | null> {
  const b = await load(ref);
  if (!b || b.ticket_status !== "issued") return null;
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  if (!d.ticket?.providerPdfKey) return null;
  return (await getObject(d.ticket.providerPdfKey).catch(() => null))?.body ?? null;
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
export async function afterTicketIssued(ref: string, providerPdf?: Buffer | null) {
  const b = await load(ref);
  if (!b || b.ticket_status !== "issued") return;
  if (providerPdf?.length) await storeProviderTicket(b, providerPdf);
  const { pdf, d } = await storeTicket(b);
  await notifyCustomer(b, d, pdf);
}

/** Admin "Resend SMS / email" — same messages again, with the stored PDF. */
export async function resendNotifications(ref: string) {
  const b = await load(ref);
  if (!b || b.ticket_status !== "issued") throw new Error("Ticket not issued");
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const pdf = (await ticketFile(ref)) ?? (await render(b)).pdf;
  await notifyCustomer(b, d, pdf);
}

async function notifyCustomer(b: Row, d: TrainBookingDetails, pdf: Uint8Array) {
  const site = await getSetting("site_name");
  const pnr = d.ticket?.pnr ?? "-";
  const amount = `Rs.${(b.amount_paise / 100).toFixed(2)}`;
  const statusLine = (d.ticket?.allocations || []).map((a) => `${a.name}: ${a.status}${a.coach ? ` ${a.coach}/${a.berth}` : ""}`).join(", ");

  const phone = (d.contact.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10) {
    const text = `${site}: Booking ${b.booking_ref} confirmed. PNR ${pnr}, train ${d.train.number} ${d.from}-${d.to} on ${d.date}. Paid ${amount}. E-ticket in My trips.`;
    const r = await sendBookingSms(phone, { ref: b.booking_ref, pnr, amount, text });
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.sms", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  } else {
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.sms", outcome: "error", request: null, response: { skipped: "No mobile number on the booking" } });
  }

  const email = d.contact.email || d.notifyEmail || null;
  if (email) {
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
      to: email,
      subject: `${site} · Ticket confirmed · PNR ${pnr}`,
      html,
      text: `Booking ${b.booking_ref} confirmed. PNR ${pnr}. ${d.train.number} ${d.from}-${d.to} on ${d.date}. ${statusLine}. Paid ${amount}.`,
      attachments: [{ filename: `${site}-eTicket-${b.booking_ref}.pdf`, content: pdf }],
    });
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.email", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  } else {
    await logProvider({ bookingRef: b.booking_ref, provider: "skyo", direction: "outbound", action: "notify.email", outcome: "error", request: null, response: { skipped: "No email on the account or booking" } });
  }
}

/** Ticket couldn't be issued → tell the customer the money is being refunded (email always, SMS only without a DLT template). */
export async function notifyFailure(ref: string) {
  const b = await load(ref);
  if (!b) return;
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const site = await getSetting("site_name");
  const amount = `Rs.${(b.amount_paise / 100).toFixed(2)}`;
  const text = `${site}: Sorry, booking ${ref} (${d.train.number} ${d.from}-${d.to}, ${d.date}) could not be ticketed. ${amount} is being refunded to your source account in 5-7 working days.`;
  const phone = (d.contact.phone || "").replace(/\D/g, "").slice(-10);
  if (phone.length === 10 && !(process.env.FAST2SMS_BOOKING_TEMPLATE_ID || "").trim()) {
    const r = await sendBookingSms(phone, { ref, pnr: "-", amount, text });
    await logProvider({ bookingRef: ref, provider: "skyo", direction: "outbound", action: "notify.sms_failure", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  }
  const email = d.contact.email || d.notifyEmail || null;
  if (email) {
    const r = await sendResendEmail({
      to: email,
      subject: `${site} · Booking ${ref} not confirmed — refund started`,
      html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;color:#0a0f1f"><h2 style="margin:0 0 8px">We couldn't confirm your ticket</h2><p>${text.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`)}</p><p style="color:#6b7280;font-size:12px">You can follow the refund in My account → Transactions.</p></div>`,
      text,
    });
    await logProvider({ bookingRef: ref, provider: "skyo", direction: "outbound", action: "notify.email_failure", httpStatus: r.status, outcome: r.ok ? "ok" : "error", request: r.request, response: r.response });
  }
}
