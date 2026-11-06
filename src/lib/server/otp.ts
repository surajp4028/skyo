import "server-only";
import crypto from "node:crypto";
import { exec, queryOne, sqlDate } from "./db";
import { env } from "./env";
import { ApiError } from "./http";
import { blindIndex, decrypt, encrypt, hashOtp, randomOtp, safeEqualHex } from "./crypto";
import { rateLimit } from "./ratelimit";
import { getSetting } from "./settings";
import { sendEmailTemplate, sendOtpSms } from "./notify";
import { maskEmail, maskPhone } from "./validators";

export type OtpPurpose = "login" | "register_email" | "register_phone";
export type Channel = "email" | "phone";

/**
 * Issue a 6-digit OTP.
 *  - per identifier: 5 sends / 15 min, plus resend cooldown
 *  - per IP: 20 sends / 15 min
 *  - previous open challenges for the same identifier+purpose are invalidated
 *  - only an HMAC of the code is stored; max 5 verify attempts; single use
 */
export async function issueOtp(opts: { channel: Channel; value: string; purpose: OtpPurpose; ip: string; name?: string }) {
  const bidx = blindIndex(opts.channel, opts.value);

  const ipRl = await rateLimit(`otp:ip:${opts.ip}`, 20, 900);
  if (!ipRl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many OTP requests. Please wait and try again.", { retryAfter: ipRl.retryAfter });

  const cooldown = Math.max(20, parseInt(await getSetting("otp_resend_seconds"), 10) || 45);
  const last = await queryOne<{ age: number }>(
    "SELECT TIMESTAMPDIFF(SECOND, created_at, UTC_TIMESTAMP()) AS age FROM otp_challenges WHERE identifier_bidx = ? AND purpose = ? ORDER BY id DESC LIMIT 1",
    [bidx, opts.purpose],
  );
  if (last && last.age < cooldown) {
    throw new ApiError(429, "COOLDOWN", `Please wait ${cooldown - last.age}s before requesting a new code.`, {
      retryAfter: cooldown - last.age,
    });
  }

  const idRl = await rateLimit(`otp:id:${bidx}`, 5, 900);
  if (!idRl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many codes requested for this account. Try again later.", { retryAfter: idRl.retryAfter });

  await exec(
    "UPDATE otp_challenges SET consumed_at = UTC_TIMESTAMP() WHERE identifier_bidx = ? AND purpose = ? AND consumed_at IS NULL",
    [bidx, opts.purpose],
  );

  const challengeId = crypto.randomBytes(16).toString("hex");
  const code = randomOtp();
  const now = new Date();
  await exec(
    "INSERT INTO otp_challenges (challenge_id, channel, purpose, identifier_bidx, identifier_enc, code_hash, ip, created_at, expires_at) VALUES (?,?,?,?,?,?,?,?,?)",
    [
      challengeId,
      opts.channel,
      opts.purpose,
      bidx,
      await encrypt(opts.value),
      hashOtp(challengeId, code),
      opts.ip,
      sqlDate(now),
      sqlDate(new Date(now.getTime() + env.otpTtlSeconds * 1000)),
    ],
  );

  let delivered = false;
  if (env.otpDryRun) {
    // no provider call
  } else if (opts.channel === "email") {
    delivered = await sendEmailTemplate(opts.value, opts.name || "", opts.purpose === "login" ? "verify_otp" : "register_otp", {
      OTP: code,
      NAME: opts.name || "Traveller",
    });
  } else {
    delivered = await sendOtpSms(opts.value, code);
  }

  if (env.otpDevEcho || env.otpDryRun) {
    console.log(`\n[DEV OTP] ${opts.channel}:${opts.channel === "email" ? maskEmail(opts.value) : maskPhone(opts.value)} purpose=${opts.purpose} code=${code}\n`);
    delivered = true; // allow local testing even if provider rejects
  }
  if (!delivered) {
    await exec("UPDATE otp_challenges SET consumed_at = UTC_TIMESTAMP() WHERE challenge_id = ?", [challengeId]);
    throw new ApiError(502, "DELIVERY_FAILED", `We couldn't send the code to your ${opts.channel}. Please try again.`);
  }

  return {
    challengeId,
    expiresIn: env.otpTtlSeconds,
    resendIn: cooldown,
    sentTo: opts.channel === "email" ? maskEmail(opts.value) : `+91 ${maskPhone(opts.value)}`,
  };
}

/** Verify + consume. Returns the decrypted identifier on success. */
export async function verifyOtp(challengeId: string, code: string, purposes: OtpPurpose[], ip: string) {
  const ipRl = await rateLimit(`otpv:ip:${ip}`, 40, 900);
  if (!ipRl.ok) throw new ApiError(429, "RATE_LIMITED", "Too many attempts. Please wait and try again.", { retryAfter: ipRl.retryAfter });

  const row = await queryOne<{
    channel: Channel;
    purpose: OtpPurpose;
    identifier_bidx: string;
    identifier_enc: string;
    code_hash: string;
    attempts: number;
    max_attempts: number;
    expired: number;
    consumed_at: Date | null;
  }>(
    "SELECT channel, purpose, identifier_bidx, identifier_enc, code_hash, attempts, max_attempts, (expires_at < UTC_TIMESTAMP()) AS expired, consumed_at FROM otp_challenges WHERE challenge_id = ?",
    [challengeId],
  );
  if (!row || !purposes.includes(row.purpose)) throw new ApiError(400, "OTP_INVALID", "This code is invalid. Request a new one.");
  if (row.consumed_at) throw new ApiError(400, "OTP_USED", "This code has already been used or replaced. Request a new one.");
  if (row.expired) throw new ApiError(400, "OTP_EXPIRED", "This code has expired. Request a new one.");
  if (row.attempts >= row.max_attempts) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");

  // Atomic attempt increment (guards against parallel brute force)
  const inc = await exec(
    "UPDATE otp_challenges SET attempts = attempts + 1 WHERE challenge_id = ? AND attempts < max_attempts AND consumed_at IS NULL",
    [challengeId],
  );
  if (inc.affectedRows !== 1) throw new ApiError(429, "OTP_LOCKED", "Too many wrong attempts. Request a new code.");

  if (!safeEqualHex(hashOtp(challengeId, code), row.code_hash)) {
    const left = row.max_attempts - row.attempts - 1;
    throw new ApiError(400, "OTP_WRONG", left > 0 ? `Incorrect code. ${left} attempt${left === 1 ? "" : "s"} left.` : "Incorrect code. Request a new one.", {
      attemptsLeft: left,
    });
  }

  const consumed = await exec(
    "UPDATE otp_challenges SET consumed_at = UTC_TIMESTAMP() WHERE challenge_id = ? AND consumed_at IS NULL",
    [challengeId],
  );
  if (consumed.affectedRows !== 1) throw new ApiError(400, "OTP_USED", "This code has already been used.");

  return { channel: row.channel, purpose: row.purpose, bidx: row.identifier_bidx, value: await decrypt(row.identifier_enc) };
}
