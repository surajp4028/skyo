import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";

type Ctx = { params: Promise<{ id: string }> };

export const PATCH = route<Ctx>(async (req, { params }) => {
  const a = await requireAdmin("users.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) throw new ApiError(400, "BAD_ID", "Invalid id");
  const body = await readJson(req, z.object({ status: z.enum(["new", "in_progress", "closed"]) }));
  const r = await exec("UPDATE contact_messages SET status = ?, handled_by = ? WHERE id = ?", [body.status, a.id, id]);
  if (!r.affectedRows) throw new ApiError(404, "NOT_FOUND", "Message not found");
  await audit({ actorType: "admin", actorId: a.id, action: "contact.status", targetType: "contact", targetId: id, meta: { status: body.status } });
  return ok({});
});
