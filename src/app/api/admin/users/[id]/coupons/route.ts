import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { adminListCoupons } from "@/lib/server/coupons";

type Ctx = { params: Promise<{ id: string }> };

/** GET — coupons this customer can see (general + personal), with how many times they used each. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin("coupons.manage");
  const id = Number((await params).id);
  const u = await queryOne<{ uid: string }>("SELECT uid FROM users WHERE id = ?", [id]);
  if (!u) throw new ApiError(404, "NOT_FOUND", "User not found");
  return ok({ uid: u.uid, coupons: await adminListCoupons({ userUid: u.uid }) });
});
