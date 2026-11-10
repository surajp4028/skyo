/** Client-safe PNR shapes (mirrors PnrView in lib/server/train/pnr.ts). */
export type PnrBerth = { status: string; coach: string | null; berth: number | null; berthCode: string | null; text: string };
export type PnrView = {
  pnr: string;
  train: { number: string; name: string };
  journey: {
    date: string | null; dateText: string | null; arrival: string | null; arrivalText: string | null; cls: string | null; quota: string | null;
    from: { code: string; name: string } | null; to: { code: string; name: string } | null; boarding: { code: string; name: string } | null; distanceKm: number | null;
  };
  chart: { prepared: boolean; text: string };
  booking: { fare: number | null; ticketFare: number | null; date: string | null };
  passengers: { n: number; booking: PnrBerth; current: PnrBerth }[];
};
export type PnrResponse = { data: PnrView; fetchedAt: string; cached: boolean; stale: boolean; nextRefreshAt: string; note?: string; loggedIn: boolean };
export type SavedPnr = { pnr: string; data: PnrView | null; fetchedAt: string | null; nextRefreshAt: string | null };

export const groupPnr = (v: string) => (v.length > 3 ? `${v.slice(0, 3)}-${v.slice(3)}` : v);

export function statusTone(s: string) {
  const v = s.toUpperCase();
  if (v.startsWith("CNF") || v === "CONFIRMED") return { chip: "bg-emerald-50 text-emerald-700 ring-emerald-200", dot: "bg-emerald-500", label: "Confirmed" };
  if (v.startsWith("RAC")) return { chip: "bg-amber-50 text-amber-700 ring-amber-200", dot: "bg-amber-500", label: "RAC" };
  if (v.includes("WL")) return { chip: "bg-rose-50 text-rose-700 ring-rose-200", dot: "bg-rose-500", label: "Waitlisted" };
  if (v.startsWith("CAN")) return { chip: "bg-slate-100 text-slate-600 ring-slate-200", dot: "bg-slate-400", label: "Cancelled" };
  return { chip: "bg-sky-50 text-sky-700 ring-sky-200", dot: "bg-sky-500", label: v };
}
