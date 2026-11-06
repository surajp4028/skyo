import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";

export const GET = route(async () => {
  const a = await requireAdmin();
  return ok({ admin: { id: a.id, name: a.name, email: a.email, role: a.role, permissions: a.permissions } });
});
