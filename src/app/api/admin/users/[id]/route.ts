import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin, revokeAllUserSessions } from "@/lib/server/session";
import { getUserDetail } from "@/lib/server/admin/queries";
import { getBilling, getUserGst } from "@/lib/server/gst";
import { can } from "@/lib/permissions";
import { exec } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ id: string }> };
const parseId = (s: string) => {
  const n = Number(s);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "BAD_ID", "Invalid id");
  return n;
};

export const GET = route<Ctx>(async (req, { params }) => {
  const a = await requireAdmin("users.view");
  const id = parseId((await params).id);
  const full = can(a, "users.contact");
  const d = await getUserDetail(id, full);
  if (!d) throw new ApiError(404, "NOT_FOUND", "Customer not found");
  await audit({ actorType: "admin", actorId: a.id, action: "pii.view_user", targetType: "user", targetId: d.user.uid, ip: getClientIp(req.headers) });
  const [gst, billing] = await Promise.all([getUserGst(id), getBilling(id)]);
  return ok({
    ...d, full, gst,
    // state is always shown; street address / pincode only with the "full contact" permission
    billing: billing ? { state: billing.state, pincode: full ? billing.pincode : billing.pincode ? "••••••" : null, address: full ? billing.address : billing.address ? "Hidden" : null } : null,
  });
});

export const PATCH = route<Ctx>(async (req, { params }) => {
  const a = await requireAdmin("users.manage");
  const id = parseId((await params).id);
  const body = await readJson(req, z.object({ status: z.enum(["active", "inactive", "blocked"]) }));
  const r = await exec("UPDATE users SET status = ? WHERE id = ?", [body.status, id]);
  if (!r.affectedRows) throw new ApiError(404, "NOT_FOUND", "Customer not found");
  if (body.status !== "active") await revokeAllUserSessions(id, `admin_${body.status}`);
  await audit({ actorType: "admin", actorId: a.id, action: "user.status_change", targetType: "user", targetId: id, ip: getClientIp(req.headers), meta: { status: body.status } });
  return ok({});
});
