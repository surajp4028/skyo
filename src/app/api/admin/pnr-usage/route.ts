import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { pnrUsage, runPnrMaintenance } from "@/lib/server/train/pnr";

/** Admin: RailKit PNR request meter + recent calls (PNR shown as last 4 digits only). */
export const GET = route(async () => {
  await requireAdmin("bookings.train");
  return ok({ usage: await pnrUsage() });
});

/** Admin: run the retention clean-up now. */
export const POST = route(async () => {
  await requireAdmin("bookings.train");
  return ok({ result: await runPnrMaintenance(true) });
});
