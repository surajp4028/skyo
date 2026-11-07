/** Client-safe train helpers (labels, colours, time maths). */
import type { ClassCode, RunningDay, SeatStatus } from "@/lib/server/train/types";

export type { ClassCode, RunningDay, SeatStatus };

export const CLASS_NAMES: Record<string, string> = {
  "1A": "First AC", "2A": "AC 2 Tier", "3A": "AC 3 Tier", "3E": "AC 3 Economy", CC: "AC Chair Car", EC: "Executive Chair Car",
  SL: "Sleeper", "2S": "Second Sitting", FC: "First Class", GN: "General", GEN: "General", GS: "General",
};

export const QUOTAS = [
  { code: "GN", label: "General" },
  { code: "TQ", label: "Tatkal" },
  { code: "PT", label: "Premium Tatkal" },
  { code: "LD", label: "Ladies" },
  { code: "SS", label: "Senior Citizen" },
] as const;
export const quotaLabel = (q: string) => QUOTAS.find((x) => x.code === q)?.label || q;

export const DAYS: RunningDay[] = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];

export function statusTone(status?: string) {
  switch (status) {
    case "AVAILABLE":
      return { text: "text-emerald-600", bg: "bg-emerald-50", ring: "ring-emerald-200", dot: "bg-emerald-500", label: "Available" };
    case "RAC":
      return { text: "text-amber-600", bg: "bg-amber-50", ring: "ring-amber-200", dot: "bg-amber-500", label: "RAC" };
    case "WAITLIST":
      return { text: "text-orange-600", bg: "bg-orange-50", ring: "ring-orange-200", dot: "bg-orange-500", label: "Waitlist" };
    case "REGRET":
    case "NOT_AVAILABLE":
    case "TRAIN_CANCELLED":
      return { text: "text-red-600", bg: "bg-red-50", ring: "ring-red-200", dot: "bg-red-500", label: "Not available" };
    case "TRAIN_DEPARTED":
      return { text: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-200", dot: "bg-slate-400", label: "Departed" };
    default:
      return { text: "text-slate-500", bg: "bg-slate-50", ring: "ring-slate-200", dot: "bg-slate-300", label: "Tap to check" };
  }
}

export const prettyType = (t?: string | null) =>
  (t || "").replace(/_/g, " ").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace("Mail Express", "Mail / Express") || "Express";

export const titleCase = (s?: string | null) => (s || "").toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase()).replace(/\bJn\b\.?/i, "Jn");

export function fmtDuration(min?: number | null) {
  if (!min && min !== 0) return "—";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return `${h}h ${String(m).padStart(2, "0")}m`;
}

export const toMinutes = (hhmm?: string | null) => {
  if (!hhmm) return null;
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + (m || 0);
};

/** Day offset of arrival relative to departure for a segment. */
export function arrivalDayOffset(dep: string, durationMin: number) {
  const d = toMinutes(dep) ?? 0;
  return Math.floor((d + durationMin) / 1440);
}

export function slotOf(hhmm: string): "early" | "morning" | "afternoon" | "night" {
  const m = toMinutes(hhmm) ?? 0;
  if (m < 360) return "early";
  if (m < 720) return "morning";
  if (m < 1080) return "afternoon";
  return "night";
}

export const fmtINR = (n?: number | null) => (n || n === 0 ? `₹${Math.round(n).toLocaleString("en-IN")}` : "—");
/** Exact money: whole rupees stay clean (₹1,310), otherwise two decimals (₹1,410.21). */
export const fmtMoney = (n?: number | null) =>
  n || n === 0 ? `₹${n.toLocaleString("en-IN", { minimumFractionDigits: Number.isInteger(Math.round(n * 100) / 100) ? 0 : 2, maximumFractionDigits: 2 })}` : "—";

export function fmtClock(iso?: string | null) {
  if (!iso) return "—";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso.slice(11, 16) : d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" });
}

export function istISO(offsetDays = 0) {
  const d = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

export function addDaysISO(iso: string, n: number) {
  const [y, m, d] = iso.split("-").map(Number);
  const t = new Date(Date.UTC(y, m - 1, d + n));
  return t.toISOString().slice(0, 10);
}

export const weekdayOf = (iso: string): RunningDay => DAYS[(new Date(iso + "T00:00:00Z").getUTCDay() + 6) % 7];
export const prettyDate = (iso: string, opts: Intl.DateTimeFormatOptions = { weekday: "short", day: "numeric", month: "short" }) =>
  new Date(iso + "T00:00:00Z").toLocaleDateString("en-IN", { ...opts, timeZone: "UTC" });
