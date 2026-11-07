"use client";
import { CreditCard, Landmark, Smartphone, Wallet } from "lucide-react";
import { payLabel, type PayInfo } from "@/lib/payment-method";
import { cn } from "@/lib/utils";

/** Card network marks drawn in CSS/SVG (no third-party logos loaded). */
function NetworkMark({ network }: { network: string | null }) {
  const n = (network || "").toLowerCase();
  if (n.includes("master"))
    return (
      <span className="relative inline-flex h-4 w-6 shrink-0 items-center" aria-label="Mastercard">
        <span className="absolute left-0 h-4 w-4 rounded-full bg-[#eb001b]" />
        <span className="absolute left-2 h-4 w-4 rounded-full bg-[#f79e1b] mix-blend-multiply" />
      </span>
    );
  if (n.includes("visa")) return <span className="inline-flex h-4 shrink-0 items-center rounded-[3px] bg-[#1a1f71] px-1 text-[8px] font-black italic tracking-tight text-white" aria-label="Visa">VISA</span>;
  if (n.includes("rupay")) return <span className="inline-flex h-4 shrink-0 items-center rounded-[3px] bg-gradient-to-r from-[#097a44] to-[#f37021] px-1 text-[8px] font-black text-white" aria-label="RuPay">RuPay</span>;
  if (n.includes("amex") || n.includes("american")) return <span className="inline-flex h-4 shrink-0 items-center rounded-[3px] bg-[#2e77bb] px-1 text-[8px] font-black text-white">AMEX</span>;
  return <CreditCard className="h-4 w-4 shrink-0 text-muted" />;
}

export function PayBadge({ info, className }: { info: PayInfo | null | undefined; className?: string }) {
  if (!info) return <span className="text-[11px] text-muted">—</span>;
  const icon =
    info.method === "card" ? <NetworkMark network={info.network} /> :
    info.method === "upi" ? <span className="inline-flex h-4 shrink-0 items-center rounded-[3px] bg-gradient-to-r from-[#097939] to-[#ed752e] px-1 text-[8px] font-black text-white">UPI</span> :
    info.method === "netbanking" ? <Landmark className="h-4 w-4 shrink-0 text-sky-600" /> :
    info.method === "wallet" ? <Wallet className="h-4 w-4 shrink-0 text-violet-600" /> : <Smartphone className="h-4 w-4 shrink-0 text-muted" />;
  return (
    <span className={cn("inline-flex max-w-[190px] items-center gap-1.5 whitespace-nowrap text-[11px] font-semibold text-ink/80", className)} title={payLabel(info)}>
      {icon}
      <span className="truncate">{info.method === "upi" ? info.vpa || "UPI" : payLabel(info).replace(/^(Mastercard|Visa|RuPay|Card) · /i, "")}</span>
      {info.international && <span className="rounded bg-amber-100 px-1 text-[9px] font-bold text-amber-700">INTL</span>}
    </span>
  );
}
