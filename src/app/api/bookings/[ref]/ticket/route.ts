import type { NextRequest } from "next/server";
import { ApiError, route } from "@/lib/server/http";
import { getSessionAdmin, getSessionUser } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { can } from "@/lib/permissions";
import { ticketPdf } from "@/lib/server/booking/ticket-pdf";
import type { TrainBookingDetails } from "@/lib/server/booking/train-booking";

type Ctx = { params: Promise<{ ref: string }> };

/** E-ticket PDF — owner, or an agent with train-bookings access. */
export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const ref = (await params).ref;
  const b = await queryOne<{ user_uid: string; booking_ref: string; status: string; ticket_status: string; amount_paise: number; pay_payment_id: string | null; details_enc: string; paid_at: Date | null; created_at: Date }>(
    "SELECT user_uid, booking_ref, status, ticket_status, amount_paise, pay_payment_id, details_enc, paid_at, created_at FROM bookings WHERE booking_ref = ?",
    [ref],
  );
  const user = await getSessionUser();
  const admin = user ? null : await getSessionAdmin();
  if (!b || (!(user && user.uid === b.user_uid) && !(admin && can(admin, "bookings.train")))) throw new ApiError(404, "NOT_FOUND", "Ticket not found");
  if (b.ticket_status !== "issued") throw new ApiError(409, "NO_TICKET", "The ticket hasn't been issued yet.");
  const d = JSON.parse(await decrypt(b.details_enc)) as TrainBookingDetails;
  const pdf = await ticketPdf({ ref: b.booking_ref, uid: b.user_uid, details: d, amount: b.amount_paise / 100, paymentId: b.pay_payment_id, paidAt: b.paid_at });
  return new Response(new Uint8Array(pdf), {
    headers: { "Content-Type": "application/pdf", "Content-Disposition": `attachment; filename="SKYO-eTicket-${b.booking_ref}.pdf"`, "Cache-Control": "no-store" },
  });
});
