import "server-only";
import { exec, queryOne, sqlDate } from "./db";
import { blindIndex, decrypt, encrypt, newUid, randomToken, sha256 } from "./crypto";
import { ApiError } from "./http";
import { maskEmail, maskPhone } from "./validators";

export const CONSENT_VERSION = "2026-11";

type UserRow = { id: number; uid: string; status: "active" | "inactive" | "blocked" };

export async function findUserBy(channel: "email" | "phone", bidx: string) {
  return queryOne<UserRow>(`SELECT id, uid, status FROM users WHERE ${channel === "email" ? "email_bidx" : "phone_bidx"} = ?`, [bidx]);
}

export function assertActive(u: UserRow) {
  if (u.status !== "active") {
    throw new ApiError(403, "ACCOUNT_" + u.status.toUpperCase(), "Your account is not active. Please contact support.");
  }
}

export async function createUser(input: {
  name?: string | null;
  email?: string | null;
  phone?: string | null;
  emailVerified?: boolean;
  phoneVerified?: boolean;
  method: "register" | "otp_login";
  consent: boolean;
  ip: string;
}): Promise<UserRow> {
  const now = sqlDate();
  const uid = newUid();
  try {
    const res = await exec(
      `INSERT INTO users (uid, name, email_enc, email_bidx, email_masked, email_verified_at,
                          phone_enc, phone_bidx, phone_masked, phone_verified_at,
                          signup_method, consent_at, consent_version, signup_ip)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        uid,
        input.name ?? null,
        input.email ? await encrypt(input.email) : null,
        input.email ? blindIndex("email", input.email) : null,
        input.email ? maskEmail(input.email) : null,
        input.email && input.emailVerified ? now : null,
        input.phone ? await encrypt(input.phone) : null,
        input.phone ? blindIndex("phone", input.phone) : null,
        input.phone ? maskPhone(input.phone) : null,
        input.phone && input.phoneVerified ? now : null,
        input.method,
        input.consent ? now : null,
        input.consent ? CONSENT_VERSION : null,
        input.ip,
      ],
    );
    return { id: res.insertId, uid, status: "active" };
  } catch (e) {
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") {
      throw new ApiError(409, "ALREADY_REGISTERED", "An account with these details already exists. Please log in.");
    }
    throw e;
  }
}

/* ---------- Registration verification tickets (proof of OTP success) ---------- */

export async function issueTicket(channel: "email" | "phone", value: string) {
  const ticket = randomToken(24);
  await exec(
    "INSERT INTO verification_tickets (ticket_hash, channel, identifier_enc, identifier_bidx, created_at, expires_at) VALUES (?,?,?,?,UTC_TIMESTAMP(), UTC_TIMESTAMP() + INTERVAL 20 MINUTE)",
    [sha256(ticket), channel, await encrypt(value), blindIndex(channel, value)],
  );
  return ticket;
}

export async function consumeTicket(ticket: string, channel: "email" | "phone") {
  const row = await queryOne<{ id: number; identifier_enc: string }>(
    "SELECT id, identifier_enc FROM verification_tickets WHERE ticket_hash = ? AND channel = ? AND used_at IS NULL AND expires_at > UTC_TIMESTAMP()",
    [sha256(ticket), channel],
  );
  if (!row) throw new ApiError(400, "TICKET_INVALID", `Your ${channel} verification expired. Please verify it again.`);
  const upd = await exec("UPDATE verification_tickets SET used_at = UTC_TIMESTAMP() WHERE id = ? AND used_at IS NULL", [row.id]);
  if (upd.affectedRows !== 1) throw new ApiError(400, "TICKET_INVALID", "Verification already used.");
  return decrypt(row.identifier_enc);
}
