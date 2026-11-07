/**
 * Shared tail of every price breakdown (trains, flights, …): coupon discount, then payment
 * gateway charges + GST on them. Pure and isomorphic — the server uses it to create the
 * Razorpay order, the booking sheet only to preview. All money is integer paise.
 */
export type PayMode = "upi" | "card";
export type ChargeLine = { key: string; label: string; paise: number; note?: string };
/** A coupon as the engine needs it. value = percent (0–100) or ₹ amount. */
export type CouponRule = {
  code: string; type: "percent" | "fixed" | "zero_service"; value: number;
  applyOn: "base_fare" | "service_fee" | "total"; maxDiscount?: number | null; minOrder?: number | null;
};
export type CouponApplied = { code: string; type: CouponRule["type"]; applyOn: CouponRule["applyOn"]; value: number; discountPaise: number };

export const couponLabel = (c: Pick<CouponRule, "type" | "value" | "applyOn" | "maxDiscount">) =>
  c.type === "zero_service"
    ? "Zero SKYO service fee"
    : `${c.type === "percent" ? `${+c.value}%` : `₹${+c.value}`} off ${c.applyOn === "base_fare" ? "ticket fare" : c.applyOn === "service_fee" ? "service fee" : "total"}${c.type === "percent" && c.maxDiscount ? ` (up to ₹${+c.maxDiscount})` : ""}`;

export const numSetting = (v: string | undefined, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
export const rupeesToPaise = (v: string | undefined, max = 9999) => Math.round(numSetting(v, max) * 100);
export const pctOf = (paise: number, pct: string | undefined) => Math.round((paise * numSetting(pct, 100)) / 100);

/**
 * Adds the coupon line (before gateway charges, so the gateway % is on what the customer actually pays)
 * and the gateway + GST lines. Fare lines use key "fare", the SKYO fee "agent_fee"/"agent_gst".
 */
export function finishCharges(lines: ChargeLine[], count: number, coupon: CouponRule | null | undefined, pg: { pct: string; gstPct: string }) {
  const add = (key: string, label: string, paise: number, note?: string) => paise > 0 && lines.push({ key, label, paise, note });
  let couponInfo: CouponApplied | null = null;
  let couponError: string | undefined;
  if (coupon && count > 0) {
    const c = coupon;
    const sum = (...keys: string[]) => lines.filter((l) => keys.includes(l.key)).reduce((a, l) => a + l.paise, 0);
    const before = lines.reduce((a, l) => a + l.paise, 0);
    if (c.minOrder && before < Math.round(c.minOrder * 100)) {
      couponError = `${c.code} needs a minimum booking of ₹${+c.minOrder}.`;
    } else {
      const target = c.type === "zero_service" ? sum("agent_fee", "agent_gst") : c.applyOn === "base_fare" ? sum("fare") : c.applyOn === "service_fee" ? sum("agent_fee", "agent_gst") : before;
      let d = c.type === "zero_service" ? target : c.type === "percent" ? Math.round((target * Math.min(100, Math.max(0, c.value))) / 100) : Math.round(c.value * 100);
      if (c.type === "percent" && c.maxDiscount) d = Math.min(d, Math.round(c.maxDiscount * 100));
      d = Math.max(0, Math.min(d, target, before - 100)); // never below ₹1 payable
      if (d > 0) {
        lines.push({ key: "coupon", label: `Coupon ${c.code}`, paise: -d, note: couponLabel(c) });
        couponInfo = { code: c.code, type: c.type, applyOn: c.applyOn, value: c.value, discountPaise: d };
      } else couponError = `${c.code} doesn't reduce this booking.`;
    }
  }
  const subtotal = lines.reduce((a, l) => a + l.paise, 0);
  const fee = pctOf(subtotal, pg.pct);
  add("pg_fee", `Payment gateway charges (${numSetting(pg.pct, 100)}%)`, fee);
  add("pg_gst", `GST on gateway charges (${numSetting(pg.gstPct, 100)}%)`, pctOf(fee, pg.gstPct));
  return { lines, totalPaise: lines.reduce((a, l) => a + l.paise, 0), coupon: couponInfo, couponError };
}
