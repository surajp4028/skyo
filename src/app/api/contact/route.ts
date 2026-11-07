import type { NextRequest } from "next/server";
import crypto from "node:crypto";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { exec } from "@/lib/server/db";
import { encOpt, encrypt } from "@/lib/server/crypto";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { getSessionUser } from "@/lib/server/session";
import { emailSchema, nameSchema, phoneSchema } from "@/lib/server/validators";
import { audit } from "@/lib/server/audit";

/** Public contact form → encrypted inbox. 5 messages / hour / IP. */
export const POST = route(async (req: NextRequest) => {
  const ip = getClientIp(req.headers);
  const rl = await rateLimit(`contact:${ip}`, 5, 3600);
  if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "You've sent a few messages already. Please try again later.", { retryAfter: rl.retryAfter });
  const body = await readJson(
    req,
    z.object({
      name: nameSchema,
      email: emailSchema,
      phone: z.union([phoneSchema, z.literal("")]).optional(),
      topic: z.enum(["booking", "refund", "account", "partnership", "grievance", "other"]),
      message: z.string().trim().min(10, "Please write at least 10 characters").max(2000, "Keep it under 2000 characters"),
      website: z.string().max(0).optional(), // honeypot — bots fill it
    }),
  );
  const user = await getSessionUser();
  const ref = "SKY" + crypto.randomInt(1_000_000, 10_000_000).toString();
  await exec(
    "INSERT INTO contact_messages (ref, topic, name_enc, email_enc, phone_enc, message_enc, user_id, ip_enc) VALUES (?,?,?,?,?,?,?,?)",
    [ref, body.topic, await encrypt(body.name), await encrypt(body.email), await encOpt(body.phone || null), await encrypt(body.message), user?.id ?? null, await encOpt(ip)],
  );
  await audit({ actorType: user ? "user" : "system", actorId: user?.id ?? null, action: "contact.message", targetType: "contact", targetId: ref, ip });
  return ok({ ref });
});
