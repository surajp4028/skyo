import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listBookings } from "@/lib/server/admin/queries";
import { SERVICES } from "@/lib/permissions";

type Ctx = { params: Promise<{ service: string }> };

export const GET = route<Ctx>(async (req, { params }) => {
  const { service } = await params;
  const svc = SERVICES.find((s) => s.key === service);
  if (!svc) throw new ApiError(404, "NOT_FOUND", "Unknown service");
  await requireAdmin(svc.perm);
  return ok(await listBookings(svc.key, req.nextUrl.searchParams));
});
