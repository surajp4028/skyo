import { ApiError, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { getObject } from "@/lib/server/storage";

type Ctx = { params: Promise<{ id: string }> };

/** GET — a customer's profile photo for agents with users.view (private S3 object, streamed). */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin("users.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, "NOT_FOUND", "Not found");
  const r = await queryOne<{ avatar_key_enc: string | null }>("SELECT avatar_key_enc FROM users WHERE id = ?", [id]);
  const key = (await decrypt(r?.avatar_key_enc ?? null)) || null;
  const obj = key ? await getObject(key) : null;
  if (!obj) throw new ApiError(404, "NOT_FOUND", "No profile photo");
  return new Response(Buffer.from(obj.body), {
    headers: { "Content-Type": obj.contentType, "Cache-Control": "private, max-age=300", "X-Content-Type-Options": "nosniff" },
  });
});
