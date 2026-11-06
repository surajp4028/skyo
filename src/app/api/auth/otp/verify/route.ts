import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { verifyOtp } from "@/lib/server/otp";
import { getClientInfo, lookupLocation } from "@/lib/server/request";
import { createUserSession } from "@/lib/server/session";
import { assertActive, createUser, findUserBy } from "@/lib/server/users";
import { challengeSchema, otpSchema } from "@/lib/server/validators";
import { getSetting } from "@/lib/server/settings";
import { exec } from "@/lib/server/db";
import { audit } from "@/lib/server/audit";
import { loadMe } from "@/lib/server/me";

/** Step 2: verify OTP → log in, or auto-create the account on first login. */
export const POST = route(async (req: NextRequest) => {
  const body = await readJson(req, z.object({ challengeId: challengeSchema, code: otpSchema }));
  const info = getClientInfo(req.headers);
  const v = await verifyOtp(body.challengeId, body.code, ["login"], info.ip);

  let user = await findUserBy(v.channel, v.bidx);
  let isNew = false;
  if (!user) {
    if ((await getSetting("user_signup")) !== "on") throw new ApiError(403, "SIGNUP_CLOSED", "New sign-ups are paused right now.");
    user = await createUser({
      email: v.channel === "email" ? v.value : null,
      phone: v.channel === "phone" ? v.value : null,
      emailVerified: v.channel === "email",
      phoneVerified: v.channel === "phone",
      method: "otp_login",
      consent: true, // login screen states that continuing accepts Terms & Privacy Policy
      ip: info.ip,
    });
    isNew = true;
  } else {
    assertActive(user);
    const col = v.channel === "email" ? "email_verified_at" : "phone_verified_at";
    await exec(`UPDATE users SET ${col} = COALESCE(${col}, UTC_TIMESTAMP()) WHERE id = ?`, [user.id]);
  }

  const location = await lookupLocation(info.ip, req.headers);
  const session = await createUserSession(user.id, { ...info, location }, `otp_${v.channel}`);
  await audit({ actorType: "user", actorId: user.id, action: isNew ? "user.signup_otp" : "user.login", ip: info.ip, userAgent: info.userAgent, meta: { channel: v.channel } });

  return ok({
    isNew,
    user: await loadMe(user.id),
    // Native apps (X-Skyo-Client: android|ios) receive a bearer token; web uses the HttpOnly cookie only.
    ...(info.client !== "web" ? { token: session.token, expiresAt: session.expiresAt } : {}),
  });
});
