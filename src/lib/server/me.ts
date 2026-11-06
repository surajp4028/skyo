import "server-only";
import { queryOne } from "./db";

/** Public-safe profile of the signed-in customer (masked contact details only). */
export async function loadMe(userId: number) {
  const u = await queryOne<{ uid: string; name: string | null; email_masked: string | null; phone_masked: string | null; email_verified_at: Date | null; phone_verified_at: Date | null; created_at: Date }>(
    "SELECT uid, name, email_masked, phone_masked, email_verified_at, phone_verified_at, created_at FROM users WHERE id = ?",
    [userId],
  );
  if (!u) return null;
  return {
    uid: u.uid,
    name: u.name,
    email: u.email_masked,
    phone: u.phone_masked ? `+91 ${u.phone_masked}` : null,
    emailVerified: !!u.email_verified_at,
    phoneVerified: !!u.phone_verified_at,
    memberSince: u.created_at,
  };
}
export type Me = NonNullable<Awaited<ReturnType<typeof loadMe>>>;
