/**
 * Train booking charges — ONE pure function used by the server (authoritative, creates the
 * Razorpay order) and by the booking sheet (preview only). All money is integer paise.
 *
 *   ticket fare              fare (incl./excl. food) × passengers
 *   IRCTC convenience fee    per TICKET, by AC / non-AC and UPI / Card-NetBanking  + GST
 *   SKYO agent service fee   per passenger                                         + GST
 *   travel insurance         per passenger (optional, admin can switch off)
 *   coupon discount          percent / fixed on fare, service fee or total; or "zero service fee"
 *   payment gateway charges  % of everything above (after discount)                 + GST on that fee
 */
export type PayMode = "upi" | "card";
export const AC_CLASSES = new Set(["1A", "2A", "3A", "3E", "CC", "EC", "EA", "EV"]);

export type ChargeSettings = {
  train_pg_fee_pct: string; train_pg_gst_pct: string;
  train_irctc_fee_nonac_upi: string; train_irctc_fee_nonac_card: string;
  train_irctc_fee_ac_upi: string; train_irctc_fee_ac_card: string; train_irctc_gst_pct: string;
  train_agent_fee: string; train_agent_gst_pct: string;
  train_insurance: string; train_insurance_fee: string;
};

export type ChargeLine = { key: string; label: string; paise: number; note?: string };
/** A coupon as the engine needs it. value = percent (0–100) or ₹ amount. */
export type CouponRule = {
  code: string; type: "percent" | "fixed" | "zero_service"; value: number;
  applyOn: "base_fare" | "service_fee" | "total"; maxDiscount?: number | null; minOrder?: number | null;
};
export type ChargeBreakdown = {
  payMode: PayMode; ac: boolean; count: number; perPassengerFarePaise: number; insurance: boolean;
  lines: ChargeLine[]; totalPaise: number;
  coupon?: { code: string; type: CouponRule["type"]; applyOn: CouponRule["applyOn"]; value: number; discountPaise: number } | null;
  /** Set when a coupon was passed but couldn't apply (e.g. below minimum order). */
  couponError?: string;
};

export const couponLabel = (c: Pick<CouponRule, "type" | "value" | "applyOn" | "maxDiscount">) =>
  c.type === "zero_service"
    ? "Zero SKYO service fee"
    : `${c.type === "percent" ? `${+c.value}%` : `₹${+c.value}`} off ${c.applyOn === "base_fare" ? "ticket fare" : c.applyOn === "service_fee" ? "service fee" : "total"}${c.type === "percent" && c.maxDiscount ? ` (up to ₹${+c.maxDiscount})` : ""}`;

const num = (v: string | undefined, max: number) => {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.min(n, max) : 0;
};
const rupeesToPaise = (v: string | undefined) => Math.round(num(v, 9999) * 100);
const pctOf = (paise: number, pct: string | undefined) => Math.round((paise * num(pct, 100)) / 100);

export const insuranceOffered = (s: Pick<ChargeSettings, "train_insurance" | "train_insurance_fee">) => s.train_insurance === "on" && rupeesToPaise(s.train_insurance_fee) > 0;

export function trainCharges(
  s: ChargeSettings,
  p: { perPassengerFare: number; count: number; cls: string; payMode: PayMode; insurance: boolean; coupon?: CouponRule | null },
): ChargeBreakdown {
  const ac = AC_CLASSES.has(p.cls);
  const count = Math.max(0, Math.floor(p.count));
  const perPax = Math.round(p.perPassengerFare * 100);
  const lines: ChargeLine[] = [];
  const add = (key: string, label: string, paise: number, note?: string) => paise > 0 && lines.push({ key, label, paise, note });

  add("fare", "Ticket fare", perPax * count, `₹${(perPax / 100).toFixed(2)} × ${count}`);

  const irctc = rupeesToPaise(ac ? (p.payMode === "upi" ? s.train_irctc_fee_ac_upi : s.train_irctc_fee_ac_card) : p.payMode === "upi" ? s.train_irctc_fee_nonac_upi : s.train_irctc_fee_nonac_card);
  add("irctc_fee", "IRCTC convenience fee", count ? irctc : 0, `${ac ? "AC" : "Non-AC"} · ${p.payMode === "upi" ? "UPI" : "Card / NetBanking"} · per ticket`);
  add("irctc_gst", `GST on IRCTC fee (${num(s.train_irctc_gst_pct, 100)}%)`, count ? pctOf(irctc, s.train_irctc_gst_pct) : 0);

  const agent = rupeesToPaise(s.train_agent_fee) * count;
  add("agent_fee", "SKYO service fee", agent, `₹${(rupeesToPaise(s.train_agent_fee) / 100).toFixed(2)} × ${count}`);
  add("agent_gst", `GST on service fee (${num(s.train_agent_gst_pct, 100)}%)`, pctOf(agent, s.train_agent_gst_pct));

  const insured = p.insurance && insuranceOffered(s);
  add("insurance", "Travel insurance", insured ? rupeesToPaise(s.train_insurance_fee) * count : 0, `₹${(rupeesToPaise(s.train_insurance_fee) / 100).toFixed(2)} × ${count}`);

  // ---- coupon (before gateway charges, so the gateway % is on what the customer actually pays)
  let couponInfo: ChargeBreakdown["coupon"] = null;
  let couponError: string | undefined;
  if (p.coupon && count > 0) {
    const c = p.coupon;
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
  const pg = pctOf(subtotal, s.train_pg_fee_pct);
  add("pg_fee", `Payment gateway charges (${num(s.train_pg_fee_pct, 100)}%)`, pg);
  add("pg_gst", `GST on gateway charges (${num(s.train_pg_gst_pct, 100)}%)`, pctOf(pg, s.train_pg_gst_pct));

  return { payMode: p.payMode, ac, count, perPassengerFarePaise: perPax, insurance: insured, lines, totalPaise: lines.reduce((a, l) => a + l.paise, 0), coupon: couponInfo, couponError };
}
