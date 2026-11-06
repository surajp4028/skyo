import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { getClientInfo, lookupLocation } from "@/lib/server/request";
import { createUserSession } from "@/lib/server/session";
import { consumeTicket, createUser } from "@/lib/server/users";
import { nameSchema } from "@/lib/server/validators";
import { audit } from "@/lib/server/audit";
import { sendEmailTemplate } from "@/lib/server/notify";
import { loadMe } from "@/lib/server/me";

/** Registration final step: name + verified email ticket + verified phone ticket → account + session. */
export const POST = route(async (req: NextRequest) => {
  const body = await readJson(
    req,
    z.object({
      name: nameSchema,
      emailTicket: z.string().min(20).max(64),
      phoneTicket: z.string().min(20).max(64),
      consent: z.literal(true, { message: "Please accept the Terms & Privacy Policy" }),
    }),
  );
  const info = getClientInfo(req.headers);
  const email = await consumeTicket(body.emailTicket, "email");
  const phone = await consumeTicket(body.phoneTicket, "phone");
  const user = await createUser({ name: body.name, email, phone, emailVerified: true, phoneVerified: true, method: "register", consent: true, ip: info.ip });

  const location = await lookupLocation(info.ip, req.headers);
  const session = await createUserSession(user.id, { ...info, location }, "register");
  await audit({ actorType: "user", actorId: user.id, action: "user.register", ip: info.ip, userAgent: info.userAgent });
  void sendEmailTemplate(email, body.name, "welcome", { NAME: body.name, PHONE: phone });

  return ok({ user: await loadMe(user.id), ...(info.client !== "web" ? { token: session.token, expiresAt: session.expiresAt } : {}) });
});
