import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { listUserBookings } from "@/lib/server/booking/train-booking";

export const GET = route(async () => {
  const u = await requireUser();
  return ok({ bookings: await listUserBookings(u.uid) });
});
