import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { getClientIp } from "@/lib/server/request";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/server/validators";
import { blindIndex } from "@/lib/server/crypto";
import { findUserBy } from "@/lib/server/users";
import { getSetting } from "@/lib/server/settings";

const schema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), value: emailSchema, name: nameSchema.optional() }),
  z.object({ channel: z.literal("phone"), value: phoneSchema, name: nameSchema.optional() }),
]);

/** Registration: send OTP to email (step 1) or phone (step 2). */
export const POST = route(async (req: NextRequest) => {
  if ((await getSetting("user_signup")) !== "on") throw new ApiError(403, "SIGNUP_CLOSED", "New sign-ups are paused right now.");
  const body = await readJson(req, schema);
  if (await findUserBy(body.channel, blindIndex(body.channel, body.value))) {
    throw new ApiError(409, "ALREADY_REGISTERED", `This ${body.channel === "email" ? "email" : "mobile number"} is already registered. Please log in instead.`, { field: "value" });
  }
  const out = await issueOtp({
    channel: body.channel,
    value: body.value,
    purpose: body.channel === "email" ? "register_email" : "register_phone",
    ip: getClientIp(req.headers),
    name: body.name,
  });
  return ok(out);
});
