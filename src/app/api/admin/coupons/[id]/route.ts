import type { NextRequest } from "next/server";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { couponInput, couponParams } from "@/lib/server/admin/coupon-schema";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (p: Ctx["params"]) => {
  const id = Number((await p).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, "NOT_FOUND", "Coupon not found");
  return id;
};

/** PUT — edit a coupon. Default coupons keep their code. */
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const a = await requireAdmin("coupons.manage");
  const id = await idOf(params);
  const cur = await queryOne<{ code: string; is_default: number }>("SELECT code, is_default FROM coupons WHERE id = ?", [id]);
  if (!cur) throw new ApiError(404, "NOT_FOUND", "Coupon not found");
  const c = await readJson(req, couponInput);
  if (cur.is_default && c.code !== cur.code) throw new ApiError(409, "DEFAULT_CODE", "Default coupons keep their code.");
  if (c.userUid && !(await queryOne("SELECT id FROM users WHERE uid = ?", [c.userUid]))) throw new ApiError(422, "VALIDATION", "No customer with that SKYO ID.", { field: "userUid" });
  try {
    await exec(
      `UPDATE coupons SET code=?, title=?, discount_type=?, value=?, apply_on=?, max_discount=?, min_order=?, service=?, per_user_limit=?, total_limit=?, user_uid=?, status=?, starts_at=?, expires_at=? WHERE id = ?`,
      [...couponParams(c), id],
    );
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "DUPLICATE", "A coupon with this code already exists.", { field: "code" });
    throw e;
  }
  await audit({ actorType: "admin", actorId: a.id, action: "coupon.updated", targetType: "coupon", targetId: c.code, ip: getClientIp(req.headers), meta: { status: c.status } });
  return ok({});
});

/** DELETE — only coupons that were never used and aren't defaults (otherwise pause them). */
export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const a = await requireAdmin("coupons.manage");
  const id = await idOf(params);
  const cur = await queryOne<{ code: string; is_default: number; n: number }>(
    "SELECT c.code, c.is_default, (SELECT COUNT(*) FROM coupon_redemptions r WHERE r.coupon_id = c.id) n FROM coupons c WHERE c.id = ?",
    [id],
  );
  if (!cur) throw new ApiError(404, "NOT_FOUND", "Coupon not found");
  if (cur.is_default) throw new ApiError(409, "DEFAULT_COUPON", "Default coupons can't be deleted — pause them instead.");
  if (Number(cur.n) > 0) throw new ApiError(409, "COUPON_USED", "This coupon has been used, so it's kept for records — pause it instead.");
  await exec("DELETE FROM coupons WHERE id = ?", [id]);
  await audit({ actorType: "admin", actorId: a.id, action: "coupon.deleted", targetType: "coupon", targetId: cur.code, ip: getClientIp(req.headers) });
  return ok({});
});
