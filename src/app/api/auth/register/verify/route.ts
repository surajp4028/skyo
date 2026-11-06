import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { verifyOtp } from "@/lib/server/otp";
import { getClientIp } from "@/lib/server/request";
import { issueTicket } from "@/lib/server/users";
import { challengeSchema, otpSchema } from "@/lib/server/validators";

/** Registration: verify an OTP → short-lived verification ticket (20 min). */
export const POST = route(async (req: NextRequest) => {
  const body = await readJson(req, z.object({ challengeId: challengeSchema, code: otpSchema }));
  const v = await verifyOtp(body.challengeId, body.code, ["register_email", "register_phone"], getClientIp(req.headers));
  return ok({ channel: v.channel, ticket: await issueTicket(v.channel, v.value) });
});
