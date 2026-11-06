import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { issueOtp } from "@/lib/server/otp";
import { getClientIp } from "@/lib/server/request";
import { blindIndex } from "@/lib/server/crypto";
import { queryOne } from "@/lib/server/db";
import { emailSchema, phoneSchema } from "@/lib/server/validators";

const schema = z.discriminatedUnion("channel", [
  z.object({ channel: z.literal("email"), value: emailSchema }),
  z.object({ channel: z.literal("phone"), value: phoneSchema }),
]);

/** Add / change email or mobile: OTP goes to the NEW address; it must not belong to anyone else. */
export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(req, schema);
  const col = body.channel === "email" ? "email_bidx" : "phone_bidx";
  const bidx = blindIndex(body.channel, body.value);
  const owner = await queryOne<{ id: number }>(`SELECT id FROM users WHERE ${col} = ?`, [bidx]);
  if (owner?.id === u.id) throw new ApiError(400, "SAME_VALUE", `This is already your ${body.channel === "email" ? "email" : "mobile number"}.`, { field: "value" });
  if (owner) throw new ApiError(409, "IN_USE", `This ${body.channel === "email" ? "email" : "mobile number"} is already linked to another account.`, { field: "value" });
  const out = await issueOtp({
    channel: body.channel,
    value: body.value,
    purpose: body.channel === "email" ? "change_email" : "change_phone",
    ip: getClientIp(req.headers),
    subjectUserId: u.id,
  });
  return ok(out);
});
