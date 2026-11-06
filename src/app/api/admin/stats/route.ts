import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { dashboardStats } from "@/lib/server/admin/queries";

export const GET = route(async () => {
  await requireAdmin("dashboard.view");
  return ok({ stats: await dashboardStats() });
});
