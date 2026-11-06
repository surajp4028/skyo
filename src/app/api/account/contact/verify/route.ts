import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { verifyOtp } from "@/lib/server/otp";
import { getClientInfo } from "@/lib/server/request";
import { exec } from "@/lib/server/db";
import { encrypt } from "@/lib/server/crypto";
import { audit } from "@/lib/server/audit";
import { loadMe } from "@/lib/server/me";
import { challengeSchema, otpSchema } from "@/lib/server/validators";

export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(req, z.object({ challengeId: challengeSchema, code: otpSchema }));
  const info = getClientInfo(req.headers);
  const v = await verifyOtp(body.challengeId, body.code, ["change_email", "change_phone"], info.ip);
  if (v.subjectUserId !== u.id) throw new ApiError(403, "OTP_INVALID", "This code was not issued for your account.");

  const isEmail = v.channel === "email";
  try {
    await exec(
      `UPDATE users SET ${isEmail ? "email_enc = ?, email_bidx = ?, email_verified_at = UTC_TIMESTAMP()" : "phone_enc = ?, phone_bidx = ?, phone_verified_at = UTC_TIMESTAMP()"} WHERE id = ?`,
      [await encrypt(v.value), v.bidx, u.id],
    );
  } catch (e) {
    // unique index re-checks at write time (race with another sign-up)
    if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "IN_USE", "This is already linked to another account.");
    throw e;
  }
  await audit({ actorType: "user", actorId: u.id, action: isEmail ? "user.email_changed" : "user.phone_changed", ip: info.ip, userAgent: info.userAgent });
  return ok({ user: await loadMe(u.id) });
});
