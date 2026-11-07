import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { listUserBookings } from "@/lib/server/booking/train-booking";
import { SERVICE_KEYS } from "@/lib/services";

/** GET /api/account/bookings?service=train|flight|bus|hotel|package — the customer's own trips. */
export const GET = route(async (req: NextRequest) => {
  const u = await requireUser();
  const s = req.nextUrl.searchParams.get("service") || "";
  const service = (SERVICE_KEYS as readonly string[]).includes(s) ? s : "";
  return ok({ bookings: await listUserBookings(u.uid, service) });
});
