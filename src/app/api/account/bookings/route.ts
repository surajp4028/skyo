import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { listUserBookings } from "@/lib/server/booking/train-booking";
import { SERVICE_KEYS } from "@/lib/services";
import { listUserPackageBookings } from "@/lib/server/package-bookings";

/** GET /api/account/bookings?service=train|flight|bus|hotel|package — the customer's own trips. */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const s = req.nextUrl.searchParams.get("service") || "";
  const service = (SERVICE_KEYS as readonly string[]).includes(s) ? s : "";
  if (service === "package") return ok({ bookings: await listUserPackageBookings(u.uid) });
  if (!service) {
    const [other, packages] = await Promise.all([listUserBookings(u.uid), listUserPackageBookings(u.uid)]);
    return ok({ bookings: [...other, ...packages].sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime()).slice(0,100) });
  }
  return ok({ bookings: await listUserBookings(u.uid, service) });
});
