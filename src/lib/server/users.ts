import "server-only";
import { exec, queryOne, sqlDate } from "./db";
import { bidxOpt, blindIndex, decrypt, encOpt, encrypt, newSkyoId, randomToken, sha256 } from "./crypto";
import { ApiError } from "./http";

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

/** Creates a customer with a fresh SKYO######## id. All personal fields are KMS-encrypted. */
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
  const enc = {
    name: await encOpt(input.name),
    email: await encOpt(input.email),
    phone: await encOpt(input.phone),
    ip: await encOpt(input.ip),
  };
  for (let attempt = 0; attempt < 6; attempt++) {
    const uid = newSkyoId();
    try {
      const res = await exec(
        `INSERT INTO users (uid, name_enc, name_bidx, email_enc, email_bidx, email_verified_at,
                            phone_enc, phone_bidx, phone_verified_at, signup_method, consent_at, consent_version, signup_ip_enc)
         VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`,
        [
          uid,
          enc.name,
          bidxOpt("name", input.name),
          enc.email,
          bidxOpt("email", input.email),
          input.email && input.emailVerified ? now : null,
          enc.phone,
          bidxOpt("phone", input.phone),
          input.phone && input.phoneVerified ? now : null,
          input.method,
          input.consent ? now : null,
          input.consent ? CONSENT_VERSION : null,
          enc.ip,
        ],
      );
      return { id: res.insertId, uid, status: "active" };
    } catch (e) {
      const err = e as { code?: string; message?: string };
      if (err.code === "ER_DUP_ENTRY" && err.message?.includes("uq_users_uid")) continue; // id collision → retry
      if (err.code === "ER_DUP_ENTRY") throw new ApiError(409, "ALREADY_REGISTERED", "An account with these details already exists. Please log in.");
      throw e;
    }
  }
  throw new ApiError(500, "ID_EXHAUSTED", "Could not allocate an account id. Please retry.");
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
