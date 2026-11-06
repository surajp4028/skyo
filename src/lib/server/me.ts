import "server-only";
import { queryOne } from "./db";
import { decrypt } from "./crypto";

/** The signed-in customer's own profile — full values (they own the data). */
export async function loadMe(userId: number) {
  const u = await queryOne<{ uid: string; name_enc: string | null; email_enc: string | null; phone_enc: string | null; email_verified_at: Date | null; phone_verified_at: Date | null; created_at: Date }>(
    "SELECT uid, name_enc, email_enc, phone_enc, email_verified_at, phone_verified_at, created_at FROM users WHERE id = ?",
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
  };
}
export type Me = NonNullable<Awaited<ReturnType<typeof loadMe>>>;
