import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { dashboardStats } from "@/lib/server/admin/queries";
import { can } from "@/lib/permissions";

export const GET = route(async () => {
  const a = await requireAdmin("dashboard.view");
  return ok({ stats: await dashboardStats(can(a, "users.contact")) });
});
