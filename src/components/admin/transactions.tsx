"use client";
import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { AnimatePresence, motion } from "motion/react";
import { ArrowDownLeft, ArrowUpRight, ChevronDown, Copy, CreditCard, IndianRupee, CheckCircle2, Clock, XCircle } from "lucide-react";
import { toast } from "sonner";
import { useFetch } from "./use-fetch";
import { useDebounced } from "./users";
import { Badge, Card, PageHeader, Pager, SearchBox, Select, StatCard, Toolbar, usePage } from "./ui";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";

type Log = {
  id: number; booking_ref: string | null; provider: string; direction: string; action: string; http_status: number | null; outcome: string;
  external_id: string | null; event_id: string | null; amount_paise: number | null; latency_ms: number | null; request: string | null; response: string | null; created_at: string;
};

export const PROVIDER_TONE: Record<string, string> = { razorpay: "bg-[#0c2451] text-white", tripgic: "bg-violet-600 text-white", skyo: "bg-brand text-white" };
export const fmtTs = (d: string) => {
  const x = new Date(d);
  return x.toLocaleString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) + "." + String(x.getMilliseconds()).padStart(3, "0");
};
export const pretty = (s: string | null) => {
  if (!s) return "—";
  try {
    return JSON.stringify(JSON.parse(s), null, 2);
  } catch {
    return s;
  }
};

export function TransactionsLog() {
  const initialQ = useSearchParams().get("q") || "";
  const [q, setQ] = useState(initialQ);
  const [provider, setProvider] = useState("");
  const [outcome, setOutcome] = useState("");
  const dq = useDebounced(q);
  const [page, setPage] = usePage(`${dq}|${provider}|${outcome}`);
  const [open, setOpen] = useState<number | null>(null);
  const { data, loading } = useFetch<{ logs: Log[]; total: number; page: number; size: number; summary: { collectedPaise: number; paid: number; pending: number; failed: number } }>(
    `/api/admin/transactions?${new URLSearchParams({ q: dq, provider, outcome, page: String(page) })}`,
  );
  return (
    <>
      <PageHeader icon={<CreditCard />} title="Transactions" sub="Every request we sent to and received from Razorpay and Tripgic — exact payloads, responses, status codes and timings. Stored encrypted." />
      <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Collected" value={data ? formatINR(data.summary.collectedPaise) : "—"} icon={<IndianRupee />} tone="mint" />
        <StatCard label="Paid bookings" value={data?.summary.paid ?? "—"} icon={<CheckCircle2 />} tone="sky" />
        <StatCard label="Awaiting payment" value={data?.summary.pending ?? "—"} icon={<Clock />} tone="iris" />
        <StatCard label="Failed" value={data?.summary.failed ?? "—"} icon={<XCircle />} />
      </div>
      <Card>
        <Toolbar>
          <SearchBox value={q} onChange={setQ} placeholder="Booking ref (SKT…), order_… or pay_… id" />
          <Select value={provider} onChange={setProvider} options={[["", "All providers"], ["razorpay", "Razorpay"], ["tripgic", "Tripgic"], ["skyo", "SKYO internal"]]} />
          <Select value={outcome} onChange={setOutcome} options={[["", "All outcomes"], ["ok", "Success"], ["error", "Errors"]]} />
          <span className="ml-auto text-xs text-muted">{data ? `${data.total} entries` : ""}</span>
        </Toolbar>
        <div className="divide-y divide-line">
          {loading && !data && <div className="p-10 text-center text-sm text-muted">Loading…</div>}
          {data?.logs.length === 0 && <div className="p-12 text-center text-sm text-muted">No transactions yet.</div>}
          {data?.logs.map((l) => (
            <div key={l.id}>
              <button onClick={() => setOpen(open === l.id ? null : l.id)} className="grid w-full grid-cols-[28px_minmax(0,1fr)_auto] items-center gap-3 px-4 py-3 text-left transition hover:bg-surface/60 md:grid-cols-[28px_150px_minmax(0,1fr)_120px_90px_150px_20px]">
                <span className={cn("flex h-7 w-7 items-center justify-center rounded-lg", l.direction === "outbound" ? "bg-sky-50 text-sky-600" : "bg-emerald-50 text-emerald-600")} title={l.direction}>
                  {l.direction === "outbound" ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownLeft className="h-4 w-4" />}
                </span>
                <span className="hidden font-mono text-[11px] text-muted md:block">{fmtTs(l.created_at)}</span>
                <span className="min-w-0">
                  <span className="flex items-center gap-2">
                    <span className={cn("rounded-md px-1.5 py-0.5 text-[10px] font-extrabold uppercase", PROVIDER_TONE[l.provider])}>{l.provider}</span>
                    <span className="truncate font-mono text-[13px] font-bold">{l.action}</span>
                  </span>
                  <span className="mt-0.5 block truncate font-mono text-[11px] text-muted">{l.booking_ref ?? "—"}{l.external_id ? ` · ${l.external_id}` : ""}</span>
                </span>
                <span className="hidden text-right text-[13px] font-bold tabular-nums md:block">{l.amount_paise != null ? formatINR(l.amount_paise) : ""}</span>
                <span className="hidden md:block"><Badge tone={l.outcome === "ok" ? "active" : "failed"}>{l.http_status ?? "—"}</Badge></span>
                <span className="hidden text-right text-[11px] text-muted md:block">{l.latency_ms != null ? `${l.latency_ms} ms` : ""}</span>
                <ChevronDown className={cn("h-4 w-4 text-muted transition", open === l.id && "rotate-180")} />
              </button>
              <AnimatePresence>
                {open === l.id && (
                  <motion.div initial={{ height: 0 }} animate={{ height: "auto" }} exit={{ height: 0 }} className="overflow-hidden bg-surface/50">
                    <div className="grid gap-3 p-4 lg:grid-cols-2">
                      <Json title={l.direction === "outbound" ? "Request sent" : "Received"} body={pretty(l.request)} />
                      <Json title={l.direction === "outbound" ? "Response received" : "Our result"} body={pretty(l.response)} />
                      <div className="flex flex-wrap gap-x-5 gap-y-1 text-[11px] text-muted lg:col-span-2">
                        <span>Time: <b className="text-ink">{new Date(l.created_at).toISOString()}</b></span>
                        {l.event_id && <span>Event id: <b className="font-mono text-ink">{l.event_id}</b></span>}
                        <span>Direction: <b className="text-ink">{l.direction}</b></span>
                        <span>HTTP: <b className="text-ink">{l.http_status ?? "—"}</b></span>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          ))}
        </div>
        {data && <Pager page={data.page} size={data.size} total={data.total} onPage={setPage} />}
      </Card>
    </>
  );
}

export function Json({ title, body }: { title: string; body: string }) {
  return (
    <div className="min-w-0 overflow-hidden rounded-xl border border-line bg-white">
      <div className="flex items-center justify-between border-b border-line px-3 py-2 text-xs font-bold">
        {title}
        <button onClick={() => navigator.clipboard?.writeText(body).then(() => toast.success("Copied"))} className="rounded p-1 text-muted hover:bg-surface hover:text-ink" aria-label="Copy"><Copy className="h-3.5 w-3.5" /></button>
      </div>
      <pre className="max-h-80 overflow-auto p-3 font-mono text-[11px] leading-relaxed text-ink/80">{body}</pre>
    </div>
  );
}
