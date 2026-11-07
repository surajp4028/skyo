import type { NextRequest } from "next/server";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { getSetting } from "@/lib/server/settings";
import { adminListCoupons } from "@/lib/server/coupons";
import { couponInput, couponParams } from "@/lib/server/admin/coupon-schema";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/** GET — every coupon with used / reserved / remaining counts. */
export const GET = route(async () => {
  await requireAdmin("coupons.manage");
  const coupons = await adminListCoupons();
  return ok({ coupons, max: Number(await getSetting("max_coupons")) || 20 });
});

/** POST — create a coupon (general, or personal when userUid is set). Capped by the "Max coupons" setting. */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin("coupons.manage");
  const c = await readJson(req, couponInput);
  const max = Number(await getSetting("max_coupons")) || 20;
  const n = (await queryOne<{ n: number }>("SELECT COUNT(*) n FROM coupons"))?.n ?? 0;
  if (Number(n) >= max) throw new ApiError(409, "COUPON_LIMIT", `You can have up to ${max} coupons. Delete an unused one or raise the limit in Settings → Coupons.`);
  if (c.userUid && !(await queryOne("SELECT id FROM users WHERE uid = ?", [c.userUid]))) throw new ApiError(422, "VALIDATION", "No customer with that SKYO ID.", { field: "userUid" });
  try {
    const r = await exec(
      `INSERT INTO coupons (code, title, discount_type, value, apply_on, max_discount, min_order, service, per_user_limit, total_limit, user_uid, status, starts_at, expires_at, created_by)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [...couponParams(c), a.id],
    );
    await audit({ actorType: "admin", actorId: a.id, action: "coupon.created", targetType: "coupon", targetId: c.code, ip: getClientIp(req.headers), meta: { type: c.type, value: c.value, user: c.userUid ?? null } });
    return ok({ id: r.insertId });
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "DUPLICATE", "A coupon with this code already exists.", { field: "code" });
    throw e;
  }
});
