import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { getAllSettings, SETTING_DEFS, setSettings, type SettingKey } from "@/lib/server/settings";
import { encryptionMode } from "@/lib/server/crypto";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { env } from "@/lib/server/env";

export const GET = route(async () => {
  await requireAdmin("settings.manage");
  return ok({
    settings: await getAllSettings(),
    defs: Object.fromEntries(Object.entries(SETTING_DEFS).map(([k, d]) => [k, { label: d.label, max: d.max }])),
    system: {
      encryption: encryptionMode(),
      email: env.zepto.apiKey ? "ZeptoMail configured" : "Not configured",
      sms: env.sms.apiKey ? "Fast2SMS configured" : "Not configured",
      otpTtl: env.otpTtlSeconds,
      userSessionDays: env.userSessionDays,
      adminIdleMinutes: env.adminIdleMinutes,
    },
  });
});

const onOff = z.enum(["on", "off"]);
const schema = z.object({
  site_name: z.string().trim().min(2).max(40).regex(/^[\p{L}\p{N} .&'-]+$/u, "Use letters, numbers, spaces, . & ' -").optional(),
  site_tagline: z.string().trim().max(120).optional(),
  support_email: z.string().trim().email().max(120).optional(),
  support_phone: z.string().trim().regex(/^[+\d ()-]{6,20}$/, "Invalid phone").optional(),
  maintenance_mode: onOff.optional(),
  maintenance_message: z.string().trim().max(200).optional(),
  user_signup: onOff.optional(),
  ip_geolocation: onOff.optional(),
  otp_resend_seconds: z.string().regex(/^\d{2,3}$/).refine((v) => +v >= 20 && +v <= 300, "20–300 seconds").optional(),
});

export const PUT = route(async (req: NextRequest) => {
  const a = await requireAdmin("settings.manage");
  const body = await readJson(req, schema);
  await setSettings(body as Partial<Record<SettingKey, string>>, a.id);
  await audit({ actorType: "admin", actorId: a.id, action: "settings.update", ip: getClientIp(req.headers), meta: { keys: Object.keys(body) } });
  return ok({ settings: await getAllSettings() });
});
