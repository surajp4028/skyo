import "server-only";
import { PDFDocument, StandardFonts, rgb, degrees } from "pdf-lib";
import type { TrainBookingDetails } from "./train-booking";

/** SAMPLE e-ticket (Tripgic mock). Clearly watermarked as not valid for travel. */
export async function ticketPdf(t: { ref: string; uid: string; details: TrainBookingDetails; amount: number; paymentId: string | null; paidAt: Date | null }) {
  const d = t.details;
  const doc = await PDFDocument.create();
  doc.setTitle(`SKYO e-Ticket ${t.ref}`);
  doc.setAuthor("SKYO");
  const page = doc.addPage([595, 842]);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const reg = await doc.embedFont(StandardFonts.Helvetica);
  const ink = rgb(0.04, 0.06, 0.12);
  const muted = rgb(0.42, 0.45, 0.5);
  const blue = rgb(0, 0.34, 1);
  const W = 595;
  const text = (s: string, x: number, y: number, size = 10, f = reg, c = ink) => page.drawText(s.replace(/[^\x20-\x7E₹]/g, "").replace("₹", "Rs."), { x, y, size, font: f, color: c });

  // header band
  page.drawRectangle({ x: 0, y: 762, width: W, height: 80, color: blue });
  text("SKYO", 36, 805, 24, bold, rgb(1, 1, 1));
  text("Electronic Reservation Slip (ERS)", 36, 784, 10, reg, rgb(0.9, 0.95, 1));
  text(`PNR ${d.ticket?.pnr ?? "-"}`, 400, 805, 16, bold, rgb(1, 1, 1));
  text(`Booking ${t.ref}`, 400, 786, 10, reg, rgb(0.9, 0.95, 1));

  // watermark
  page.drawText("SAMPLE - NOT VALID FOR TRAVEL", { x: 62, y: 260, size: 32, font: bold, color: rgb(1, 0.35, 0.12), opacity: 0.12, rotate: degrees(30) });

  let y = 730;
  text(`${d.train.number}  ${d.train.name}`, 36, y, 15, bold);
  y -= 22;
  text(`${d.from}  ->  ${d.to}`, 36, y, 13, bold, blue);
  text(`Journey date: ${d.date}`, 330, y, 11);
  y -= 18;
  text(`Class: ${d.cls}   Quota: ${d.quota}   Food: ${d.food ? "Included" : "Not opted"}`, 36, y, 10, reg, muted);
  text(`Chart: ${d.ticket?.chartStatus ?? "-"}`, 330, y, 10, reg, muted);

  // passengers table
  y -= 34;
  page.drawRectangle({ x: 30, y: y - 6, width: W - 60, height: 22, color: rgb(0.95, 0.96, 0.98) });
  ["#", "Name", "Age", "Gender", "Booking status", "Coach / Berth"].forEach((h, i) => text(h, [40, 64, 230, 270, 330, 450][i], y, 9, bold, muted));
  y -= 22;
  (d.ticket?.allocations || []).forEach((a, i) => {
    text(String(i + 1), 40, y, 10);
    text(a.name, 64, y, 10, bold);
    text(String(a.age), 230, y, 10);
    text(a.gender === "M" ? "Male" : a.gender === "F" ? "Female" : "Transgender", 270, y, 10);
    text(a.status, 330, y, 10, bold, a.status === "CNF" ? rgb(0.05, 0.6, 0.35) : rgb(0.9, 0.45, 0.1));
    text(a.coach ? `${a.coach} / ${a.berth} ${a.berthType ?? ""}` : "-", 450, y, 10);
    y -= 20;
  });

  // fare + payment
  y -= 14;
  page.drawLine({ start: { x: 30, y }, end: { x: W - 30, y }, thickness: 0.6, color: rgb(0.88, 0.89, 0.93) });
  y -= 22;
  text("Fare details", 36, y, 11, bold);
  y -= 18;
  text(`Fare per passenger: Rs. ${d.pricing.perPassenger.toFixed(2)}${d.food ? `  (incl. catering Rs. ${d.pricing.catering.toFixed(2)})` : ""}`, 36, y, 10);
  y -= 16;
  text(`Passengers: ${d.pricing.count}`, 36, y, 10);
  y -= 18;
  text(`Total paid: Rs. ${t.amount.toFixed(2)}`, 36, y, 12, bold);
  y -= 26;
  text(`Payment ID: ${t.paymentId ?? "-"}   Paid at: ${t.paidAt ? new Date(t.paidAt).toISOString().replace("T", " ").slice(0, 19) + " UTC" : "-"}`, 36, y, 9, reg, muted);
  y -= 14;
  text(`Ticket no: ${d.ticket?.ticketNo ?? "-"}   Issued via: ${d.ticket?.provider ?? "-"}   SKYO ID: ${t.uid}`, 36, y, 9, reg, muted);

  // footer
  page.drawRectangle({ x: 30, y: 60, width: W - 60, height: 70, color: rgb(1, 0.96, 0.93) });
  text("This is a SAMPLE ticket generated in test mode (Tripgic mock). It is NOT valid for travel.", 42, 108, 9, bold, rgb(0.8, 0.3, 0.05));
  text("Carry a valid photo ID during the journey. Verify train status before travel. Live data by RailCore.", 42, 92, 8.5, reg, muted);
  text("SKYO is not affiliated with IRCTC / Indian Railways.", 42, 78, 8.5, reg, muted);
  return doc.save();
}
