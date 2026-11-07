import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { bookingForUser } from "@/lib/server/booking/train-booking";
import { decrypt } from "@/lib/server/crypto";
import { queryOne } from "@/lib/server/db";

type Ctx = { params: Promise<{ ref: string }> };

/** Booking status for the owner (polled after payment). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const u = await requireUser();
  const b = await bookingForUser((await params).ref, u.uid);
  const pnr = await queryOne<{ pnr_enc: string | null }>("SELECT pnr_enc FROM bookings WHERE id = ?", [b.id]);
  return ok({
    booking: {
      ref: b.booking_ref, status: b.status, paymentStatus: b.payment_status, ticketStatus: b.ticket_status, amount: b.amount_paise / 100,
      pnr: (await decrypt(pnr?.pnr_enc)) || null, details: b.details,
    },
  });
});
