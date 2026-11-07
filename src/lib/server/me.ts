import "server-only";
import { queryOne } from "./db";
import { decrypt } from "./crypto";

/** The signed-in customer's own profile — full values (they own the data). */
export async function loadMe(userId: number) {
  const u = await queryOne<{ uid: string; name_enc: string | null; email_enc: string | null; phone_enc: string | null; email_verified_at: Date | null; phone_verified_at: Date | null; created_at: Date; avatar_key_enc: string | null; avatar_updated_at: Date | null }>(
    "SELECT uid, name_enc, email_enc, phone_enc, email_verified_at, phone_verified_at, created_at, avatar_key_enc, avatar_updated_at FROM users WHERE id = ?",
    [userId],
  );
  if (!u) return null;
  const [name, email, phone] = await Promise.all([decrypt(u.name_enc), decrypt(u.email_enc), decrypt(u.phone_enc)]);
  return {
    uid: u.uid,
    name: name || null,
    email: email || null,
    phone: phone ? `+91 ${phone}` : null,
    emailVerified: !!u.email_verified_at,
    phoneVerified: !!u.phone_verified_at,
    memberSince: u.created_at,
    avatar: u.avatar_key_enc ? `/api/account/avatar?v=${u.avatar_updated_at ? new Date(u.avatar_updated_at).getTime() : 0}` : null,
  };
}
export type Me = NonNullable<Awaited<ReturnType<typeof loadMe>>>;
