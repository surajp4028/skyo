import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export const img = (id: string, w = 1200, h?: number) =>
  `https://images.unsplash.com/photo-${id}?auto=format&fit=crop&q=80&w=${w}${h ? `&h=${h}` : ""}`;

export const IMAGES = {
  taj: "1524492412937-b28074a5d7da",
  tajArch: "1548013146-72479768bada",
  goa: "1512343879784-a960bf40e7f2",
  jaipur: "1477587458883-47145ed94245",
  kerala: "1602216056096-3b40cc0c9944",
  keralaBoat: "1506461883276-594a12b11cf3",
  delhi: "1587474260584-136574528ed5",
  mumbai: "1570168007204-dfb528c6958f",
  plane: "1436491865332-7a61a109cc05",
  train: "1474487548417-781cb71495f3",
  bus: "1544620347-c4fd4a3d5957",
  resort: "1566073771259-6a8506099945",
  lake: "1501785888041-af3ef285b470",
  roadtrip: "1469854523086-cc02fe5d8800",
  beach: "1507525428034-b723cf961d3e",
  flatlay: "1488646953014-85cb44e25828",
  manali: "1626621341517-bbf3d9990a23",
  kashmir: "1595815771614-ade9d652a65d",
  forest: "1609920658906-8223bd289001",
  hotelRoom: "1590490360182-c33d57733427",
  resortNight: "1542314831-068cd1dbfeeb",
  halong: "1528127269322-539801943592",
} as const;

export const formatINR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

export function timeAgo(d: string | Date | null | undefined) {
  if (!d) return "—";
  const t = new Date(d).getTime();
  const s = Math.round((Date.now() - t) / 1000);
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 86400 * 30) return `${Math.floor(s / 86400)}d ago`;
  return new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export const fmtDateTime = (d: string | Date | null | undefined) =>
  d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : "—";

/**
 * "12 Jun 2026". Calendar dates ("2026-06-12" or a DATE column at UTC midnight) are shown as-is;
 * real timestamps are shown in IST.
 */
export function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  const s = typeof d === "string" ? d : d.toISOString();
  const dateOnly = /^\d{4}-\d{2}-\d{2}(T00:00:00(\.000)?Z)?$/.test(s);
  const dt = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? `${s}T00:00:00Z` : s);
  if (Number.isNaN(dt.getTime())) return String(d);
  return dt.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: dateOnly ? "UTC" : "Asia/Kolkata" });
}
