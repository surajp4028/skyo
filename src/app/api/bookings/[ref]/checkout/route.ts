import { ApiError, ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { bookingForUser, checkoutOptions } from "@/lib/server/booking/train-booking";
import { getPublicSettings } from "@/lib/server/settings";

type Ctx = { params: Promise<{ ref: string }> };

/** Re-open checkout for a pending booking while its hold is valid (same order, same amount). */
export const GET = route<Ctx>(async (_req, { params }) => {
  const u = await requireUser();
  const b = await bookingForUser((await params).ref, u.uid);
  if (b.payment_status === "paid") throw new ApiError(409, "ALREADY_PAID", "This booking is already paid.");
  if (b.status !== "pending") throw new ApiError(410, "BOOKING_CLOSED", "This booking was cancelled. Please search again.");
  if (!b.pay_order_id || !b.hold_expires_at || new Date(b.hold_expires_at).getTime() < Date.now()) throw new ApiError(410, "HOLD_EXPIRED", "This booking hold has expired. Please search again.");
  const site = await getPublicSettings();
  return ok({ bookingRef: b.booking_ref, checkout: checkoutOptions(b.booking_ref, b.pay_order_id, b.amount_paise, b.details, site.site_name, b.hold_expires_at) });
});
