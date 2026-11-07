import crypto from "node:crypto";
import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { rateLimit } from "@/lib/server/ratelimit";
import { exec, queryOne } from "@/lib/server/db";
import { decrypt, encrypt } from "@/lib/server/crypto";
import { deleteObject, getObject, putObject, sniffImage, userKey } from "@/lib/server/storage";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

const MAX_BYTES = 2 * 1024 * 1024;

const currentKey = async (userId: number) => {
  const r = await queryOne<{ avatar_key_enc: string | null }>("SELECT avatar_key_enc FROM users WHERE id = ?", [userId]);
  return (await decrypt(r?.avatar_key_enc ?? null)) || null;
};

/** GET — the signed-in customer's own profile photo (private S3 object, streamed). */
export const GET = route(async () => {
  const u = await requireUser();
  const key = await currentKey(u.id);
  const obj = key ? await getObject(key) : null;
  if (!obj) throw new ApiError(404, "NOT_FOUND", "No profile photo");
  return new Response(Buffer.from(obj.body), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff", "Content-Disposition": "inline" },
  });
});

/** POST multipart/form-data { file } — jpg / png / webp up to 2 MB → <SKYO ID>/profile_<4 digits>.<ext> */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const rl = await rateLimit(`avatar:${u.id}`, 10, 3600);
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

  const key = userKey(u.uid, `profile_${crypto.randomInt(1000, 10000)}.${kind.ext}`);
  const old = await currentKey(u.id);
  await putObject(key, bytes, kind.type);
  await exec("UPDATE users SET avatar_key_enc = ?, avatar_updated_at = UTC_TIMESTAMP() WHERE id = ?", [await encrypt(key), u.id]);
  if (old && old !== key) await deleteObject(old);
  await audit({ actorType: "user", actorId: u.id, action: "profile.avatar_updated", targetType: "user", targetId: u.uid, ip: getClientIp(req.headers), meta: { bytes: bytes.length, type: kind.type } });
  return ok({ avatar: `/api/account/avatar?v=${Date.now()}` });
});

/** DELETE — remove the profile photo. */
export const DELETE = route(async (req: NextRequest) => {
  const u = await requireUser();
  const old = await currentKey(u.id);
  await exec("UPDATE users SET avatar_key_enc = NULL, avatar_updated_at = UTC_TIMESTAMP() WHERE id = ?", [u.id]);
  if (old) await deleteObject(old);
  await audit({ actorType: "user", actorId: u.id, action: "profile.avatar_removed", targetType: "user", targetId: u.uid, ip: getClientIp(req.headers) });
  return ok({ avatar: null });
});
