export type PackagePricingType = "per_person" | "per_couple";
export type PackageStatus = "draft" | "published" | "archived";
export type PackageCoupon = { code: string; discountType: "percentage" | "flat"; discountValue: number; isActive: boolean; validFrom?: string | null; validUntil?: string | null; minGuests?: number | null; maxDiscount?: number | null };
export type PackageDay = { dayNumber: number; title: string; description: string; activityDetails: string[]; time?: string };
/** A fixed departure set by the admin. Dates are IST calendar dates, times are "HH:mm". `price` overrides the offer price for this date. */
export type PackageDeparture = { id: string; startDate: string; startTime: string; endDate: string; endTime: string; seats: number; price?: number | null; status: "open" | "closed"; note?: string };
export type PackageTripInfo = { origin?: string; reportingPoint?: string; returnPoint?: string; travelMode?: string; mealPlan?: string };
/** "daysBefore or more days before departure → deductionPct % of the trip price is kept". */
export type CancellationRule = { daysBefore: number; deductionPct: number };
export type PackageStay = { hotelName: string; starRating: number; roomType: string; amenities: string[]; city?: string };
export type TourPackage = {
  id: number; slug: string; title: string; shortDescription: string; detailedDescription: string;
  durationDays: number; durationNights: number; destinations: string[]; categories: string[]; itinerary: PackageDay[]; accommodations: PackageStay[];
  departures: PackageDeparture[]; tripInfo: PackageTripInfo | null; cancellationRules: CancellationRule[];
  originalPrice: number; discountedPrice: number; pricingType: PackagePricingType; upfrontTokenAmount: number;
  coverPhoto: string; images: string[]; videoLink: string | null; inclusions: string[]; exclusions: string[];
  coupons: PackageCoupon[]; cancellationPolicy: string; priceNotes: string | null;
  supportContact: { name?: string; email?: string; phone?: string } | null; status: PackageStatus; featured: boolean;
  createdAt?: string; updatedAt?: string;
};

export function packageQuote(pkg: Pick<TourPackage, "originalPrice" | "discountedPrice" | "pricingType" | "upfrontTokenAmount" | "coupons">, guests: number, code = "", at = new Date()) {
  const units = pkg.pricingType === "per_couple" ? Math.ceil(guests / 2) : guests;
  const original = pkg.originalPrice * units;
  const subtotal = pkg.discountedPrice * units;
  const coupon = code ? pkg.coupons.find((c) => c.isActive && c.code.toUpperCase() === code.trim().toUpperCase()) : undefined;
  if (code && !coupon) return { valid: false, error: "That code is not valid for this package." } as const;
  if (coupon?.validFrom && new Date(coupon.validFrom) > at) return { valid: false, error: "This coupon is not active yet." } as const;
  if (coupon?.validUntil && new Date(coupon.validUntil).getTime() < at.getTime()) return { valid: false, error: "This coupon has expired." } as const;
  if (coupon?.minGuests && guests < coupon.minGuests) return { valid: false, error: `Book for at least ${coupon.minGuests} guests to use this coupon.` } as const;
  const rawDiscount = coupon ? (coupon.discountType === "percentage" ? Math.round((subtotal * coupon.discountValue) / 100) : coupon.discountValue) : 0;
  const discount = Math.min(subtotal, coupon?.maxDiscount ? Math.min(rawDiscount, coupon.maxDiscount) : rawDiscount);
  const total = Math.max(0, subtotal - discount);
  const upfront = Math.min(total, pkg.upfrontTokenAmount || total);
  return { valid: true, units, original, subtotal, discount, total, upfront, remaining: total - upfront, couponCode: coupon?.code ?? null } as const;
}

// ------------------------------------------------------------------ departures & cancellation

const DAY = 86_400_000;
/** Today's date in IST as "YYYY-MM-DD". */
export const todayIST = (at = new Date()) => new Date(at.getTime() + 330 * 60_000).toISOString().slice(0, 10);
const dayNum = (d: string) => Math.round(Date.parse(`${d}T00:00:00Z`) / DAY);
export const addDays = (d: string, n: number) => new Date(Date.parse(`${d}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);
export const daysBetween = (from: string, to: string) => dayNum(to) - dayNum(from);

/** Departures a traveller can still book (open, starting after today), soonest first. */
export function upcomingDepartures(pkg: Pick<TourPackage, "departures">, at = new Date()) {
  const today = todayIST(at);
  return [...(pkg.departures || [])].filter((d) => d.status === "open" && d.startDate > today).sort((a, b) => a.startDate.localeCompare(b.startDate));
}

/** The package with this departure's price applied (for quotes). */
export function withDeparturePrice<T extends Pick<TourPackage, "originalPrice" | "discountedPrice">>(pkg: T, dep: Pick<PackageDeparture, "price"> | null | undefined): T {
  if (!dep?.price) return pkg;
  return { ...pkg, discountedPrice: dep.price, originalPrice: Math.max(pkg.originalPrice, dep.price) };
}

/** Rules sorted from the earliest cancellation (most days before) to the last. */
export const sortedRules = (rules: CancellationRule[]) => [...(rules || [])].sort((a, b) => b.daysBefore - a.daysBefore);

/** Deduction that applies if cancelled on `on` for a trip starting `startDate`. */
export function cancellationAt(rules: CancellationRule[], startDate: string, on = todayIST()) {
  const left = daysBetween(on, startDate);
  const list = sortedRules(rules);
  if (!list.length) return null;
  const rule = list.find((r) => left >= r.daysBefore) ?? { daysBefore: 0, deductionPct: 100 };
  return { daysLeft: left, deductionPct: Math.min(100, Math.max(0, rule.deductionPct)), rule };
}

/** Each slab as a date window for one departure ("cancel on or before 14 Apr → 10%"). */
export function cancellationWindows(rules: CancellationRule[], startDate: string) {
  const list = sortedRules(rules);
  return list.map((r, i) => {
    const lastDay = addDays(startDate, -r.daysBefore); // cancelling on/before this date (and after the previous slab) → this deduction
    const prev = list[i - 1];
    const fromDay = prev ? addDays(startDate, -prev.daysBefore + 1) : null;
    return { ...r, fromDate: fromDay, toDate: r.daysBefore === 0 ? startDate : lastDay, upTo: prev ? prev.daysBefore - 1 : null };
  });
}
