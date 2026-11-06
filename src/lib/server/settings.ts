import "server-only";
import { query, exec } from "./db";
import { env } from "./env";

/**
 * Admin-managed settings. Secrets NEVER live here (they stay in .env / Secrets Manager).
 * Every key must be declared below — unknown keys are rejected by the API.
 */
export const SETTING_DEFS = {
  site_name: { label: "Website name", default: env.appNameDefault, max: 40, public: true },
  site_tagline: { label: "Tagline", default: "Trains, flights, buses, hotels & holidays — one tap away.", max: 120, public: true },
  support_email: { label: "Support email", default: "support@skyo.in", max: 120, public: true },
  support_phone: { label: "Support phone", default: "+91 90000 00000", max: 20, public: true },
  maintenance_mode: { label: "Maintenance banner", default: "off", max: 3, public: true },
  maintenance_message: { label: "Maintenance message", default: "We are upgrading SKYO. Some services may be slow.", max: 200, public: true },
  user_signup: { label: "Allow new user sign-ups", default: "on", max: 3, public: false },
  ip_geolocation: { label: "IP geolocation for sessions", default: "on", max: 3, public: false },
  otp_resend_seconds: { label: "OTP resend cooldown (s)", default: "45", max: 4, public: false },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export const isSettingKey = (k: string): k is SettingKey => Object.prototype.hasOwnProperty.call(SETTING_DEFS, k);

let cache: { at: number; map: Record<string, string> } | null = null;
const TTL = 15_000;

async function load(): Promise<Record<string, string>> {
  if (cache && Date.now() - cache.at < TTL) return cache.map;
  const map: Record<string, string> = {};
  for (const [k, d] of Object.entries(SETTING_DEFS)) map[k] = d.default;
  try {
    const rows = await query<{ setting_key: string; setting_value: string | null }>(
      "SELECT setting_key, setting_value FROM app_settings",
    );
    for (const r of rows) if (isSettingKey(r.setting_key) && r.setting_value !== null) map[r.setting_key] = r.setting_value;
  } catch (e) {
    console.error("[settings] load failed", (e as Error).message);
  }
  cache = { at: Date.now(), map };
  return map;
}

export async function getSetting(key: SettingKey): Promise<string> {
  return (await load())[key];
}

export async function getAllSettings(): Promise<Record<SettingKey, string>> {
  return (await load()) as Record<SettingKey, string>;
}

export async function getPublicSettings() {
  const all = await load();
  const out: Record<string, string> = {};
  for (const [k, d] of Object.entries(SETTING_DEFS)) if (d.public) out[k] = all[k];
  return out as {
    site_name: string;
    site_tagline: string;
    support_email: string;
    support_phone: string;
    maintenance_mode: string;
    maintenance_message: string;
  };
}

export async function setSettings(values: Partial<Record<SettingKey, string>>, adminId: number) {
  for (const [k, v] of Object.entries(values)) {
    if (!isSettingKey(k) || typeof v !== "string") continue;
    await exec(
      "INSERT INTO app_settings (setting_key, setting_value, updated_by) VALUES (?, ?, ?) " +
        "ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value), updated_by = VALUES(updated_by)",
      [k, v.slice(0, SETTING_DEFS[k].max), adminId],
    );
  }
  cache = null;
}
