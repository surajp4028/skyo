import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listAdminPackageBookings } from "@/lib/server/package-bookings";

export const GET=route(async()=>{await requireAdmin("bookings.package");return ok({bookings:await listAdminPackageBookings()});});
