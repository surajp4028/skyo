import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { exec, queryOne } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { adminKey, deleteObject, getObject, putObject, sniffImage } from "@/lib/server/storage";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

const MAX_BYTES = 2 * 1024 * 1024;
const currentKey = async (id: number) => (await decrypt((await queryOne<{ k: string | null }>("SELECT avatar_key_enc k FROM admins WHERE id = ?", [id]))?.k ?? null)) || null;

/** GET — the signed-in agent's photo (private S3). */
export const GET = route(async () => {
  const a = await requireAdmin();
  const key = await currentKey(a.id);
  const obj = key ? await getObject(key) : null;
  if (!obj) throw new ApiError(404, "NOT_FOUND", "No profile photo");
  return new Response(Buffer.from(obj.body), { headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" } });
});

/** POST multipart { file } — jpg / png / webp ≤ 2 MB → admins/ADM<id>/profile_<4 digits>.<ext> */
export const POST = route(async (req: NextRequest) => {
  const a = await requireAdmin();
  const rl = await rateLimit(`admin:avatar:${a.id}`, 10, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many uploads. Try again later.", { retryAfter: rl.retryAfter });
  if (Number(req.headers.get("content-length") || 0) > MAX_BYTES + 64 * 1024) throw new ApiError(413, "TOO_LARGE", "Photo must be 2 MB or smaller.");
  let file: File | null = null;
  try {
    const f = (await req.formData()).get("file");
    file = f instanceof File ? f : null;
  } catch {
    throw new ApiError(400, "BAD_UPLOAD", "Upload a photo file.");
  }
  if (!file || file.size === 0) throw new ApiError(400, "BAD_UPLOAD", "Upload a photo file.");
  if (file.size > MAX_BYTES) throw new ApiError(413, "TOO_LARGE", "Photo must be 2 MB or smaller.");
  const bytes = new Uint8Array(await file.arrayBuffer());
  const kind = sniffImage(bytes);
  if (!kind) throw new ApiError(415, "UNSUPPORTED", "Use a JPG, PNG or WebP image.");
  const key = adminKey(a.id, `profile_${crypto.randomInt(1000, 10000)}.${kind.ext}`);
  const old = await currentKey(a.id);
  await putObject(key, bytes, kind.type);
  await exec("UPDATE admins SET avatar_key_enc = ?, avatar_updated_at = UTC_TIMESTAMP() WHERE id = ?", [await encrypt(key), a.id]);
  if (old && old !== key) await deleteObject(old);
  await audit({ actorType: "admin", actorId: a.id, action: "admin.avatar_updated", targetType: "admin", targetId: String(a.id), ip: getClientIp(req.headers) });
  return ok({ avatar: `/api/admin/profile/avatar?v=${Date.now()}` });
});

export const DELETE = route(async (req: NextRequest) => {
  const a = await requireAdmin();
  const old = await currentKey(a.id);
  await exec("UPDATE admins SET avatar_key_enc = NULL, avatar_updated_at = UTC_TIMESTAMP() WHERE id = ?", [a.id]);
  if (old) await deleteObject(old);
  await audit({ actorType: "admin", actorId: a.id, action: "admin.avatar_removed", targetType: "admin", targetId: String(a.id), ip: getClientIp(req.headers) });
  return ok({ avatar: null });
});
