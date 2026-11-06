import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { issueOtp } from "@/lib/server/otp";
import { getClientIp } from "@/lib/server/request";
import { parseIdentifier } from "@/lib/server/validators";

/** Step 1 of passwordless login: one field (email OR phone) → OTP. */
export const POST = route(async (req: NextRequest) => {
  const body = await readJson(req, z.object({ identifier: z.string().min(3).max(190) }));
  const id = parseIdentifier(body.identifier);
  if (!id) throw new ApiError(422, "VALIDATION", "Enter a valid email or 10-digit mobile number", { field: "identifier" });
  // Same response whether or not an account exists (prevents account enumeration).
  const out = await issueOtp({ channel: id.channel, value: id.value, purpose: "login", ip: getClientIp(req.headers) });
  return ok({ ...out, channel: id.channel });
});
