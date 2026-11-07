import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { couponRedemptions } from "@/lib/server/coupons";

type Ctx = { params: Promise<{ id: string }> };

/** GET — who used this coupon, on which booking, how much it saved. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin("coupons.manage");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, "NOT_FOUND", "Coupon not found");
  return ok({ redemptions: await couponRedemptions(id) });
});
