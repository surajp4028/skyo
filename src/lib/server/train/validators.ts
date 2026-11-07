import "server-only";
import { z } from "zod";

/** Input contracts mirroring RailCore's own validation — invalid input never reaches (or bills) the upstream. */
export const stationCode = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{1,6}$/, "Invalid station code");
export const trainNumber = z.string().trim().toUpperCase().regex(/^[0-9A-Z]{4,6}$/, "Invalid train number");
export const classCode = z.enum(["1A", "2A", "3A", "3E", "CC", "EC", "SL", "2S", "GS", "GEN", "SLR", "PC", "HP", "GEN_RSVD", "FC"]);
export const quota = z.enum(["GN", "TQ", "PT", "LD", "SS", "HP", "DP", "HO", "YU", "FT"]).default("GN");

/** Today's date in IST as YYYY-MM-DD. */
export function istToday(offsetDays = 0): string {
  const d = new Date(Date.now() + 5.5 * 3600_000 + offsetDays * 86400_000);
  return d.toISOString().slice(0, 10);
}

/** Journey dates: ARP window is 60 days; allow a few days back for live-status of running trains. */
export const journeyDate = (opts: { pastDays?: number; futureDays?: number } = {}) =>
  z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD")
    .refine((d) => d >= istToday(-(opts.pastDays ?? 0)) && d <= istToday(opts.futureDays ?? 120), "Date is outside the allowed window");

export const searchQuery = z.string().trim().min(2, "Type at least 2 characters").max(80);

export function parseQuery<T extends z.ZodRawShape>(sp: URLSearchParams, shape: T) {
  const obj: Record<string, string | undefined> = {};
  for (const k of Object.keys(shape)) obj[k] = sp.get(k) ?? undefined;
  return z.object(shape).safeParse(obj);
}
