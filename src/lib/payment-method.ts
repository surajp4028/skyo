/** Compact view of a Razorpay payment's instrument — safe for admin UI (no full card / VPA). */
export type PayInfo = {
  method: string | null; network: string | null; last4: string | null; cardType: string | null; issuer: string | null;
  vpa: string | null; bank: string | null; wallet: string | null; international: boolean; feePaise: number | null; taxPaise: number | null; authCode: string | null;
};

type RzpLike = {
  method?: string; international?: boolean; fee?: number; tax?: number; bank?: string | null; wallet?: string | null; vpa?: string | null;
  card?: { network?: string; last4?: string; type?: string; issuer?: string } | null; acquirer_data?: { auth_code?: string } | null;
};

const maskVpa = (v: string) => {
  const [u, h] = v.split("@");
  return h ? `${u.slice(0, 2)}•••@${h}` : `${v.slice(0, 2)}•••`;
};

export function payInfo(p: RzpLike | null | undefined): PayInfo | null {
  if (!p || !p.method) return null;
  return {
    method: p.method, network: p.card?.network ?? null, last4: p.card?.last4 ?? null, cardType: p.card?.type ?? null, issuer: p.card?.issuer ?? null,
    vpa: p.vpa ? maskVpa(p.vpa) : null, bank: p.bank ?? null, wallet: p.wallet ?? null, international: !!p.international,
    feePaise: typeof p.fee === "number" ? p.fee : null, taxPaise: typeof p.tax === "number" ? p.tax : null, authCode: p.acquirer_data?.auth_code ?? null,
  };
}

/** "Mastercard •••• 5449 · credit", "UPI · ab•••@okhdfc", "Netbanking · HDFC" */
export function payLabel(i: PayInfo) {
  if (i.method === "card") return [i.network || "Card", i.last4 ? `•••• ${i.last4}` : null, i.cardType].filter(Boolean).join(" · ");
  if (i.method === "upi") return ["UPI", i.vpa].filter(Boolean).join(" · ");
  if (i.method === "netbanking") return ["Netbanking", i.bank].filter(Boolean).join(" · ");
  if (i.method === "wallet") return ["Wallet", i.wallet].filter(Boolean).join(" · ");
  return i.method || "—";
}
