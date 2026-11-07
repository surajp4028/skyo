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
import { couponLabel, finishCharges, numSetting as num, pctOf, rupeesToPaise, type ChargeLine, type CouponApplied, type CouponRule, type PayMode } from "@/lib/charges-core";
export { couponLabel, type ChargeLine, type CouponRule, type PayMode };
export const AC_CLASSES = new Set(["1A", "2A", "3A", "3E", "CC", "EC", "EA", "EV"]);

export type ChargeSettings = {
  train_pg_fee_pct: string; train_pg_gst_pct: string;
  train_irctc_fee_nonac_upi: string; train_irctc_fee_nonac_card: string;
  train_irctc_fee_ac_upi: string; train_irctc_fee_ac_card: string; train_irctc_gst_pct: string;
  train_agent_fee: string; train_agent_gst_pct: string;
  train_insurance: string; train_insurance_fee: string;
};

export type ChargeBreakdown = {
  payMode: PayMode; ac: boolean; count: number; perPassengerFarePaise: number; insurance: boolean;
  lines: ChargeLine[]; totalPaise: number;
  coupon?: CouponApplied | null;
  /** Set when a coupon was passed but couldn't apply (e.g. below minimum order). */
  couponError?: string;
};

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

  const fin = finishCharges(lines, count, p.coupon, { pct: s.train_pg_fee_pct, gstPct: s.train_pg_gst_pct });
  return { payMode: p.payMode, ac, count, perPassengerFarePaise: perPax, insurance: insured, lines: fin.lines, totalPaise: fin.totalPaise, coupon: fin.coupon, couponError: fin.couponError };
}
