"use client";
import { useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Brush, Loader2, RefreshCw, Ticket } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { useFetch } from "./use-fetch";
import { Card } from "./ui";
import { cn, timeAgo } from "@/lib/utils";

type Usage = {
  configured: boolean; periodStart: string; used: number; cap: number; today: number; errors: number; avgMs: number | null; people: number; cached: number;
  recent: { id: number; pnr_last4: string; http_status: number | null; error_code: string | null; billable: boolean; latency_ms: number | null; user_id: number | null; created_at: string }[];
};

/** RailKit PNR meter: requests this billing month vs the cap, today's count and the recent calls (PNR masked). */
export function PnrUsage({ compact }: { compact?: boolean }) {
  const { data, reload } = useFetch<{ usage: Usage }>("/api/admin/pnr-usage");
  const [cleaning, setCleaning] = useState(false);
  const u = data?.usage;
  const pct = u && u.cap > 0 ? Math.min(100, (u.used / u.cap) * 100) : 0;
  const R = 40;
  const C = 2 * Math.PI * R;

  const clean = async () => {
    setCleaning(true);
    try {
      const r = await api<{ result: { responsesCleared: number; callsDeleted: number; cacheDeleted: number } }>("/api/admin/pnr-usage", { method: "POST" });
      toast.success(`Cleaned: ${r.result.responsesCleared} responses, ${r.result.cacheDeleted} cached PNRs, ${r.result.callsDeleted} old calls`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setCleaning(false);
    }
  };

  return (
    <Card className={cn("relative overflow-hidden p-5", compact && "p-4")}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-violet-400/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold"><Ticket className="h-4 w-4 text-violet-600" /> RailKit PNR requests</div>
          <div className="text-xs text-muted">
            {u ? `Since ${new Date(u.periodStart.replace(" ", "T") + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" })} · ${u.cached} PNRs cached` : "…"}
            {u && !u.configured && <span className="font-bold text-red-600"> · RAILKIT key missing</span>}
          </div>
        </div>
        <div className="flex gap-1.5">
          <button onClick={reload} className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-surface"><RefreshCw className="h-3 w-3" /> Reload</button>
          {!compact && (
            <button onClick={clean} disabled={cleaning} title="Clears responses older than the retention days" className="flex items-center gap-1 rounded-full border border-line px-2.5 py-1 text-[11px] font-bold text-ink hover:bg-surface disabled:opacity-60">
              {cleaning ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brush className="h-3 w-3" />} Clean up
            </button>
          )}
        </div>
      </div>
      {u && u.cap > 0 && u.used >= u.cap * 0.8 && (
        <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {u.used >= u.cap ? "Monthly cap reached — travellers see saved statuses only until the plan renews." : `${u.used} of ${u.cap} lookups used. Lower the per-person limits or raise the cap if your RailKit plan allows.`}
        </div>
      )}
      <div className="relative mt-4 flex flex-wrap items-center gap-5">
        <div className="relative h-24 w-24 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#eef0f6" strokeWidth="10" />
            <motion.circle cx="50" cy="50" r={R} fill="none" strokeLinecap="round" strokeWidth="10" stroke="url(#pnr-g)" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - (pct / 100) * C }} transition={{ duration: 1.1, ease: "easeOut" }} />
            <defs><linearGradient id="pnr-g" x1="0" x2="1"><stop offset="0" stopColor="#7c3aed" /><stop offset="1" stopColor="#0057ff" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-3 flex flex-col items-center justify-center text-center">
            <div className="text-xl font-black text-ink">{u?.used ?? "…"}</div>
            <div className="text-[10px] font-bold text-muted">of {u?.cap ?? "…"}</div>
          </div>
        </div>
        <div className="grid flex-1 grid-cols-2 gap-2 sm:grid-cols-4">
          {[
            ["Today", u?.today],
            ["People", u?.people],
            ["Errors", u?.errors],
            ["Avg time", u?.avgMs != null ? `${(u.avgMs / 1000).toFixed(1)}s` : "—"],
          ].map(([l, v]) => (
            <div key={l as string} className="rounded-xl bg-surface px-3 py-2">
              <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{l}</div>
              <div className="text-lg font-extrabold text-ink">{v ?? "…"}</div>
            </div>
          ))}
        </div>
      </div>
      {!compact && u && (
        <div className="relative mt-4 max-h-64 overflow-auto rounded-xl ring-1 ring-line">
          <table className="w-full text-left text-xs">
            <thead className="sticky top-0 bg-surface text-[10px] uppercase tracking-wider text-muted">
              <tr><th className="px-3 py-2">PNR</th><th className="px-3 py-2">Result</th><th className="px-3 py-2">Billed</th><th className="px-3 py-2">Time</th><th className="px-3 py-2">Who</th><th className="px-3 py-2">When</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {u.recent.length === 0 && <tr><td colSpan={6} className="px-3 py-4 text-center text-muted">No PNR lookups yet.</td></tr>}
              {u.recent.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2 font-mono font-bold">••••••{r.pnr_last4}</td>
                  <td className="px-3 py-2">{r.error_code ? <span className="font-semibold text-red-600" title={r.error_code}>{r.http_status ?? "—"} · {r.error_code.slice(0, 36)}</span> : <span className="font-semibold text-emerald-600">{r.http_status ?? 200} OK</span>}</td>
                  <td className="px-3 py-2">{r.billable ? "Yes" : "No"}</td>
                  <td className="px-3 py-2">{r.latency_ms != null ? `${r.latency_ms} ms` : "—"}</td>
                  <td className="px-3 py-2">{r.user_id ? `User #${r.user_id}` : "Visitor"}</td>
                  <td className="px-3 py-2 text-muted">{timeAgo(r.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Card>
  );
}
