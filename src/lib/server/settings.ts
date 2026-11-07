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
  service_train: { label: "Trains service", default: "on", max: 3, public: true },
  service_flight: { label: "Flights service", default: "on", max: 3, public: true },
  service_bus: { label: "Buses service", default: "on", max: 3, public: true },
  service_hotel: { label: "Hotels service", default: "on", max: 3, public: true },
  service_package: { label: "Packages service", default: "on", max: 3, public: true },
  train_live: { label: "Train live running status", default: "on", max: 3, public: true },
  train_api: { label: "Live train data (RailCore)", default: "on", max: 3, public: false },
  max_saved_passengers: { label: "Max saved passengers per account", default: "20", max: 3, public: true },
  max_passengers_per_booking: { label: "Max passengers per train booking", default: "6", max: 1, public: true },
  train_daily_credit_cap: { label: "RailCore daily credit cap", default: process.env.RK_DAILY_CREDIT_CAP || "80", max: 6, public: false },
  train_dev_single_result: { label: "Dev: show only 1 train in search results", default: "on", max: 3, public: false },
  // ---- Train charges (amounts in rupees, percentages as numbers) ----
  train_pg_fee_pct: { label: "Payment gateway fee %", default: "2", max: 6, public: true },
  train_pg_gst_pct: { label: "GST % on gateway fee", default: "18", max: 5, public: true },
  train_irctc_fee_nonac_upi: { label: "IRCTC fee · non-AC · UPI (per ticket)", default: "10", max: 7, public: true },
  train_irctc_fee_nonac_card: { label: "IRCTC fee · non-AC · Card/NetBanking (per ticket)", default: "15", max: 7, public: true },
  train_irctc_fee_ac_upi: { label: "IRCTC fee · AC · UPI (per ticket)", default: "20", max: 7, public: true },
  train_irctc_fee_ac_card: { label: "IRCTC fee · AC · Card/NetBanking (per ticket)", default: "30", max: 7, public: true },
  train_irctc_gst_pct: { label: "GST % on IRCTC fee", default: "18", max: 5, public: true },
  train_agent_fee: { label: "SKYO agent service fee (per passenger)", default: "20", max: 7, public: true },
  train_agent_gst_pct: { label: "GST % on agent fee", default: "0", max: 5, public: true },
  train_insurance: { label: "Travel insurance", default: "on", max: 3, public: true },
  train_insurance_fee: { label: "Insurance premium (per passenger)", default: "5", max: 7, public: true },
} as const;

export type SettingKey = keyof typeof SETTING_DEFS;
export const isSettingKey = (k: string): k is SettingKey => Object.prototype.hasOwnProperty.call(SETTING_DEFS, k);

let cache: { at: number; map: Record<string, string> } | null = null;
const TTL = 5_000; // admin changes go live within ~5 s on every instance

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
    service_train: string;
    service_flight: string;
    service_bus: string;
    service_hotel: string;
    service_package: string;
    train_live: string;
    max_saved_passengers: string;
    max_passengers_per_booking: string;
    train_pg_fee_pct: string;
    train_pg_gst_pct: string;
    train_irctc_fee_nonac_upi: string;
    train_irctc_fee_nonac_card: string;
    train_irctc_fee_ac_upi: string;
    train_irctc_fee_ac_card: string;
    train_irctc_gst_pct: string;
    train_agent_fee: string;
    train_agent_gst_pct: string;
    train_insurance: string;
    train_insurance_fee: string;
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
