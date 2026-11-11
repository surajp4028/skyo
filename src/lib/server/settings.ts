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
  // ---- PNR status (RailKit) ----
  pnr_status: { label: "PNR status page", default: "on", max: 3, public: true },
  pnr_api: { label: "Live PNR data (RailKit)", default: "on", max: 3, public: false },
  pnr_monthly_cap: { label: "RailKit monthly request cap", default: "100", max: 6, public: false },
  pnr_quota_reset_day: { label: "RailKit plan renews on day", default: "1", max: 2, public: false },
  pnr_cache_min: { label: "PNR cache before chart (minutes)", default: "30", max: 4, public: false },
  pnr_user_daily: { label: "Fresh PNR lookups per user per day", default: "10", max: 3, public: false },
  pnr_guest_daily: { label: "Fresh PNR lookups per visitor (not logged in) per day", default: "2", max: 3, public: false },
  pnr_log_retention_days: { label: "Keep PNR responses for (days)", default: "30", max: 3, public: false },
  max_saved_passengers: { label: "Max saved passengers per account", default: "20", max: 3, public: true },
  max_passengers_per_booking: { label: "Max passengers per train booking", default: "6", max: 1, public: true },
  train_daily_credit_cap: { label: "RailCore daily credit cap", default: process.env.RK_DAILY_CREDIT_CAP || "80", max: 6, public: false },
  gst_input_mode: { label: "GST details: fetch / manual / both", default: "both", max: 6, public: true },
  max_coupons: { label: "Max coupons", default: "20", max: 4, public: false },
  train_alt_seats: { label: "Alternate seat finder (book from / change seat)", default: "on", max: 3, public: true },
  train_alt_limit: { label: "Alternate seat: limit checks (per search / per visitor per day)", default: "off", max: 3, public: true },
  train_alt_auto: { label: "Alternate seat: background checks per search", default: "2", max: 2, public: true },
  train_alt_guests: { label: "Alternate seat: also for visitors who aren't logged in", default: "on", max: 3, public: true },
  train_alt_guest_daily: { label: "Alternate seat: checks per visitor (not logged in) per day", default: "6", max: 3, public: false },
  train_alt_min_chance: { label: "Alternate seat: also show options with at least this % chance", default: "85", max: 3, public: false },
  train_alt_max_checks: { label: "Alternate seat: availability checks per tap", default: "6", max: 2, public: false },
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
  // ---- Flights: aviationstack budget (free plan = 100 requests / month) ----
  flight_api: { label: "Live flight data (aviationstack)", default: "on", max: 3, public: false },
  flight_dev_single_result: { label: "Dev: show only 1 flight in search results", default: "on", max: 3, public: false },
  flight_monthly_cap: { label: "aviationstack requests per month (cap)", default: "95", max: 6, public: false },
  flight_cache_hours: { label: "Route schedule cache (hours)", default: "168", max: 5, public: false },
  flight_pages_per_route: { label: "Pages fetched per route (100 flights each)", default: "1", max: 1, public: false },
  flight_connections: { label: "One-stop connections from cached routes", default: "on", max: 3, public: true },
  flight_connection_fetch: { label: "Hubs fetched live for connections (2 requests each)", default: "0", max: 1, public: false },
  flight_live: { label: "Live flight tracking", default: "on", max: 3, public: true },
  flight_live_cache_min: { label: "Live status cache (minutes)", default: "15", max: 4, public: false },
  max_passengers_per_flight: { label: "Max travellers per flight booking", default: "9", max: 1, public: true },
  // ---- Flight fare model (₹ / %) ----
  flight_base_fare: { label: "Base fare (₹)", default: "1450", max: 7, public: false },
  flight_per_km: { label: "Per km (₹)", default: "2.6", max: 6, public: false },
  flight_fullservice_pct: { label: "Full-service airline premium %", default: "12", max: 5, public: false },
  flight_business_mult: { label: "Business cabin multiplier", default: "3.2", max: 5, public: false },
  flight_intl_mult: { label: "International multiplier", default: "1.6", max: 5, public: false },
  flight_lastminute_pct: { label: "Last-minute surge % (≤ 1 day)", default: "45", max: 5, public: false },
  flight_peak_pct: { label: "Peak-hour premium % (6–10 am, 5–9 pm)", default: "8", max: 5, public: false },
  flight_connection_discount_pct: { label: "Connection discount %", default: "10", max: 5, public: false },
  flight_airport_fee: { label: "Airport fees per traveller · domestic (₹)", default: "460", max: 7, public: true },
  flight_airport_fee_intl: { label: "Airport fees per traveller · international (₹)", default: "1250", max: 7, public: true },
  flight_gst_eco_pct: { label: "GST % on economy airfare", default: "5", max: 5, public: true },
  flight_gst_biz_pct: { label: "GST % on business airfare", default: "12", max: 5, public: true },
  // ---- Flight seats & fees ----
  flight_seat_fee_window: { label: "Window seat (₹)", default: "250", max: 6, public: true },
  flight_seat_fee_aisle: { label: "Aisle seat (₹)", default: "200", max: 6, public: true },
  flight_seat_fee_middle: { label: "Middle seat (₹)", default: "0", max: 6, public: true },
  flight_seat_fee_xl: { label: "Extra legroom / exit row (₹)", default: "650", max: 6, public: true },
  flight_seat_fee_front: { label: "Front rows 1–5 (₹)", default: "350", max: 6, public: true },
  flight_agent_fee: { label: "SKYO service fee per traveller (₹)", default: "149", max: 7, public: true },
  flight_agent_gst_pct: { label: "GST % on service fee", default: "18", max: 5, public: true },
  flight_insurance: { label: "Travel insurance", default: "on", max: 3, public: true },
  flight_insurance_fee: { label: "Insurance premium per traveller (₹)", default: "99", max: 7, public: true },
  flight_pg_fee_pct: { label: "Payment gateway fee %", default: "2", max: 6, public: true },
  flight_pg_gst_pct: { label: "GST % on gateway fee", default: "18", max: 5, public: true },
  flight_log_retention_days: { label: "Keep aviationstack responses (days)", default: "30", max: 4, public: false },
  flight_log_keep_days: { label: "Keep aviationstack request history (days)", default: "365", max: 4, public: false },
  flight_quota_reset_day: { label: "aviationstack plan renews on day of month", default: "1", max: 2, public: false },
  flight_airport_board: { label: "Airport live board", default: "on", max: 3, public: true },
  flight_board_cache_min: { label: "Airport board cache (minutes)", default: "30", max: 4, public: false },
  flight_passport_mode: { label: "International passports: at booking or add later", default: "later", max: 7, public: true },
  flight_child_discount_pct: { label: "Child (2–11) discount on base fare %", default: "10", max: 5, public: true },
  flight_infant_fee: { label: "Infant (under 2, on lap) fee (₹)", default: "1500", max: 7, public: true },
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
    pnr_status: string;
    train_alt_seats: string;
    train_alt_auto: string;
    train_alt_limit: string;
    train_alt_guests: string;
    max_saved_passengers: string;
    max_passengers_per_booking: string;
    gst_input_mode: string;
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
    flight_connections: string;
    flight_live: string;
    max_passengers_per_flight: string;
    flight_airport_fee: string;
    flight_airport_fee_intl: string;
    flight_gst_eco_pct: string;
    flight_gst_biz_pct: string;
    flight_seat_fee_window: string;
    flight_seat_fee_aisle: string;
    flight_seat_fee_middle: string;
    flight_seat_fee_xl: string;
    flight_seat_fee_front: string;
    flight_agent_fee: string;
    flight_agent_gst_pct: string;
    flight_insurance: string;
    flight_insurance_fee: string;
    flight_pg_fee_pct: string;
    flight_pg_gst_pct: string;
    flight_child_discount_pct: string;
    flight_infant_fee: string;
    flight_passport_mode: string;
    flight_airport_board: string;
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
