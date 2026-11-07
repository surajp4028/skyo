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
/** ₹ amount with up to 2 decimals, 0 – 9999. */
const rupees = z.string().trim().regex(/^\d{1,4}(\.\d{1,2})?$/, "Amount in ₹ (e.g. 20 or 12.50)");
/** Percentage 0 – 100 with up to 2 decimals. */
const pct = z.string().trim().regex(/^\d{1,3}(\.\d{1,2})?$/, "Percent (e.g. 2 or 1.75)").refine((v) => +v <= 100, "0 – 100");
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
  train_api: onOff.optional(),
  service_train: onOff.optional(),
  service_flight: onOff.optional(),
  service_bus: onOff.optional(),
  service_hotel: onOff.optional(),
  service_package: onOff.optional(),
  train_live: onOff.optional(),
  max_saved_passengers: z.string().regex(/^\d{1,2}$/).refine((v) => +v >= 1 && +v <= 50, "1–50").optional(),
  max_passengers_per_booking: z.string().regex(/^[1-6]$/, "1–6 (IRCTC allows up to 6)").optional(),
  train_daily_credit_cap: z.string().regex(/^\d{1,6}$/, "Whole number").optional(),
  train_dev_single_result: onOff.optional(),
  gst_input_mode: z.enum(["fetch", "manual", "both"]).optional(),
  max_coupons: z.string().regex(/^\d{1,4}$/).refine((v) => +v >= 1 && +v <= 1000, "1 – 1000").optional(),
  train_pg_fee_pct: pct.optional(),
  train_pg_gst_pct: pct.optional(),
  train_irctc_fee_nonac_upi: rupees.optional(),
  train_irctc_fee_nonac_card: rupees.optional(),
  train_irctc_fee_ac_upi: rupees.optional(),
  train_irctc_fee_ac_card: rupees.optional(),
  train_irctc_gst_pct: pct.optional(),
  train_agent_fee: rupees.optional(),
  train_agent_gst_pct: pct.optional(),
  train_insurance: onOff.optional(),
  train_insurance_fee: rupees.optional(),
});

export const PUT = route(async (req: NextRequest) => {
  const a = await requireAdmin("settings.manage");
  const body = await readJson(req, schema);
  await setSettings(body as Partial<Record<SettingKey, string>>, a.id);
  await audit({ actorType: "admin", actorId: a.id, action: "settings.update", ip: getClientIp(req.headers), meta: { keys: Object.keys(body) } });
  return ok({ settings: await getAllSettings() });
});
