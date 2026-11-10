"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { toast } from "sonner";
import { AlertTriangle, Brush, Database, Eye, Loader2, Plane, RefreshCw, Trash2, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { useFetch } from "./use-fetch";
import { Card } from "./ui";
import { useAdmin } from "./admin-context";
import { cn, fmtDateTime, timeAgo } from "@/lib/utils";

type Usage = {
  plan: string; configured: boolean; enabled: boolean; devSingle: boolean; cacheHours: number; used: number; cap: number; planQuota: number | null; errors: number; avgMs: number | null; periodStart: string; retentionDays: number;
  byReason: { reason: string | null; calls: number }[];
  recent: { id: number; endpoint: string; params: string; http_status: number; error_code: string | null; billable: number; result_count: number; result_total: number | null; latency_ms: number; reason: string | null; created_at: string }[];
  routes: { dep_iata: string; arr_iata: string; flights: number; upstream_total: number | null; pages: number; source_date: string | null; searches: number; fetched_at: string; last_search_at: string | null }[];
};
const REASON: Record<string, string> = { search: "New route searched", connection: "Connection hub", explore: "Connection search", board: "Airport board", track: "Live tracking", admin_refresh: "Admin refresh", setup_test: "Setup test", booking: "Booking" };

/** aviationstack meter (requests this month vs cap), why each request was spent, cached routes and the call ledger. */
export function FlightUsage({ compact }: { compact?: boolean }) {
  const admin = useAdmin();
  const { data, reload } = useFetch<Usage>("/api/admin/flight-usage");
  const [busy, setBusy] = useState<string | null>(null);
  const [view, setView] = useState<number | null>(null);
  const [now] = useState(() => Date.now());
  const pct = data ? Math.min(100, (data.used / Math.max(1, data.planQuota ?? data.cap)) * 100) : 0;
  const R = 42;
  const C = 2 * Math.PI * R;
  const manage = admin.can("settings.manage");

  const act = async (from: string, to: string, action: "refresh" | "drop") => {
    if (action === "refresh" && !confirm(`Refresh ${from} → ${to} now? This uses 1 aviationstack request.`)) return;
    setBusy(`${from}${to}${action}`);
    try {
      const r = await api<{ flights?: number }>("/api/admin/flight-usage/refresh", { body: { from, to, action } });
      toast.success(action === "drop" ? `${from} → ${to} removed from cache` : `${from} → ${to}: ${r.flights} flights cached`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const limit = data ? Math.min(data.cap, data.planQuota ?? data.cap) : 0;
  const warn = data ? data.used >= limit * 0.8 : false;
  const cleanup = async () => {
    setBusy("cleanup");
    try {
      const r = await api<{ result: { responsesCleared: number; callsDeleted: number; statusCacheDeleted: number; seatHoldsReleased: number; emptyRoutesDropped: number } }>("/api/admin/flight-usage/maintenance", { method: "POST" });
      const x = r.result;
      toast.success(`Cleaned: ${x.responsesCleared} old responses, ${x.callsDeleted} old requests, ${x.statusCacheDeleted} status caches, ${x.seatHoldsReleased} seat holds, ${x.emptyRoutesDropped} empty routes`);
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const flipDev = async () => {
    if (!data) return;
    try {
      await api("/api/admin/settings", { method: "PUT", body: { flight_dev_single_result: data.devSingle ? "off" : "on" } });
      toast.success(data.devSingle ? "Search now shows all flights" : "Search limited to 1 flight (dev)");
      reload();
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  return (
    <Card className={cn("relative overflow-hidden p-5", compact && "p-4")}>
      <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-sky/15 blur-3xl" />
      <div className="relative flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-extrabold"><Plane className="h-4 w-4 text-[#0057ff]" /> aviationstack requests</div>
          <div className="text-xs text-muted">Flight schedules & live status · {data ? `${data.plan} plan · since ${new Date(data.periodStart.replace(" ", "T") + "Z").toLocaleDateString("en-IN", { day: "numeric", month: "short" })}` : "…"} {data && !data.enabled && <span className="font-bold text-red-600">· paused</span>} {data && !data.configured && <span className="font-bold text-red-600">· AVIATION_KEY missing</span>}</div>
        </div>
        {manage && data && (
          <button onClick={flipDev} title="Dev setting: limit flight search to 1 result" className={cn("flex items-center gap-2 rounded-full border px-2.5 py-1 text-[11px] font-bold transition", data.devSingle ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700")}>
            <span className={cn("relative h-4 w-7 rounded-full transition", data.devSingle ? "bg-amber-400" : "bg-emerald-500")}><span className={cn("absolute top-0.5 h-3 w-3 rounded-full bg-white transition-all", data.devSingle ? "left-0.5" : "left-3.5")} /></span>
            {data.devSingle ? "Search: 1 flight (dev)" : "Search: all flights"}
          </button>
        )}
      </div>
      {warn && data && (
        <div className="relative mt-3 flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {data.used >= limit ? "Monthly limit reached — new routes and live tracking are paused; cached routes keep working." : `${data.used} of ${limit} requests used this period. Turn connections/live tracking down, or upgrade the aviationstack plan.`}
        </div>
      )}
      <div className="relative mt-4 flex flex-wrap items-center gap-5">
        <div className="relative h-28 w-28 shrink-0">
          <svg viewBox="0 0 100 100" className="h-full w-full -rotate-90">
            <circle cx="50" cy="50" r={R} fill="none" stroke="#eef0f6" strokeWidth="10" />
            <motion.circle cx="50" cy="50" r={R} fill="none" strokeLinecap="round" strokeWidth="10" stroke="url(#fly-g)" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - (pct / 100) * C }} transition={{ duration: 1.1, ease: "easeOut" }} />
            <defs><linearGradient id="fly-g" x1="0" x2="1"><stop offset="0" stopColor="#0057ff" /><stop offset="1" stopColor="#38bdf8" /></linearGradient></defs>
          </svg>
          <div className="absolute inset-[14px] flex flex-col items-center justify-center text-center">
            <span className="text-xl font-extrabold leading-none tabular-nums">{data?.used ?? "—"}</span>
            <span className="mt-1 text-[9px] font-bold uppercase leading-tight tracking-wide text-muted">of {data?.planQuota ?? data?.cap ?? "—"}<br />this month</span>
          </div>
        </div>
        <div className="grid min-w-[220px] flex-1 grid-cols-2 gap-2 text-xs">
          <Mini label="Cap (setting)" value={data?.cap ?? "—"} />
          <Mini label="Left before cap" value={data ? Math.max(0, data.cap - data.used) : "—"} />
          <Mini label="Cached routes" value={data?.routes.length ?? "—"} />
          <Mini label="Errors (free)" value={data?.errors ?? "—"} />
        </div>
        {!compact && data && data.byReason.length > 0 && (
          <div className="min-w-[200px] flex-1 space-y-1.5">
            {data.byReason.map((r) => (
              <div key={r.reason || "-"}>
                <div className="flex justify-between text-[11px] font-semibold"><span>{REASON[r.reason || ""] || r.reason}</span><span className="text-muted">{r.calls}</span></div>
                <div className="mt-0.5 h-1.5 overflow-hidden rounded-full bg-surface"><motion.div initial={{ width: 0 }} animate={{ width: `${(r.calls / Math.max(1, data.used)) * 100}%` }} className="h-full rounded-full bg-gradient-to-r from-[#0057ff] to-sky-400" /></div>
              </div>
            ))}
          </div>
        )}
      </div>

      {!compact && data && (
        <div className="relative mt-6 grid gap-5 xl:grid-cols-2">
          <div>
            <div className="mb-2 flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wider text-muted"><Database className="h-3.5 w-3.5" /> Cached routes · {data.cacheHours} h</span>
              {manage && <button onClick={cleanup} disabled={!!busy} title={`Clears responses older than ${data.retentionDays} days, stale caches and dead seat holds`} className="flex items-center gap-1 rounded-lg border border-line px-2 py-1 text-[11px] font-bold text-muted hover:bg-surface hover:text-ink">{busy === "cleanup" ? <Loader2 className="h-3 w-3 animate-spin" /> : <Brush className="h-3 w-3" />} Clean up old data</button>}
            </div>
            <div className="max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-3 py-2">Route</th><th className="px-3 py-2">Flights</th><th className="px-3 py-2">Searches</th><th className="px-3 py-2">Fetched</th><th className="px-3 py-2" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.routes.length === 0 && <tr><td colSpan={5} className="px-3 py-6 text-center text-muted">No routes cached yet — the first search on a route fetches it.</td></tr>}
                  {data.routes.map((r) => {
                    const age = (now - new Date(r.fetched_at).getTime()) / 3600_000;
                    return (
                      <tr key={r.dep_iata + r.arr_iata}>
                        <td className="px-3 py-2 font-mono font-bold">{r.dep_iata} → {r.arr_iata}</td>
                        <td className="px-3 py-2">{r.flights}{r.upstream_total ? <span className="text-muted"> / {r.upstream_total} rows</span> : null}</td>
                        <td className="px-3 py-2">{r.searches}</td>
                        <td className={cn("px-3 py-2", age > data.cacheHours ? "font-bold text-amber-600" : "text-muted")}>{timeAgo(r.fetched_at)}</td>
                        <td className="whitespace-nowrap px-3 py-2 text-right">
                          {manage && (
                            <>
                              <button onClick={() => act(r.dep_iata, r.arr_iata, "refresh")} disabled={!!busy} title="Refresh now (1 request)" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-[#0057ff]">{busy === `${r.dep_iata}${r.arr_iata}refresh` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}</button>
                              <button onClick={() => act(r.dep_iata, r.arr_iata, "drop")} disabled={!!busy} title="Remove from cache" className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-3.5 w-3.5" /></button>
                            </>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
          <div>
            <div className="mb-2 text-xs font-extrabold uppercase tracking-wider text-muted">Recent requests</div>
            <div className="max-h-72 overflow-auto rounded-xl border border-line">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-3 py-2">When</th><th className="px-3 py-2">Request</th><th className="px-3 py-2">Result</th><th className="px-3 py-2" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {data.recent.map((c) => (
                    <tr key={c.id}>
                      <td className="whitespace-nowrap px-3 py-2 text-muted" title={fmtDateTime(c.created_at)}>{timeAgo(c.created_at)}</td>
                      <td className="px-3 py-2"><div className="font-mono font-bold">/{c.endpoint}</div><div className="max-w-[220px] truncate font-mono text-[10px] text-muted">{c.params}</div><div className="text-[10px] text-muted">{REASON[c.reason || ""] || c.reason}</div></td>
                      <td className="px-3 py-2">{c.billable ? <span className="font-bold text-emerald-700">{c.http_status} · {c.result_count} rows</span> : <span className="font-bold text-red-600">{c.error_code || c.http_status} · not billed</span>}<div className="text-[10px] text-muted">{c.latency_ms} ms</div></td>
                      <td className="px-3 py-2 text-right">{admin.can("payments.view") && <button onClick={() => setView(c.id)} title="Full response" className="rounded-lg p-1.5 text-muted hover:bg-surface hover:text-ink"><Eye className="h-3.5 w-3.5" /></button>}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
      {view && <CallViewer id={view} onClose={() => setView(null)} />}
    </Card>
  );
}

function CallViewer({ id, onClose }: { id: number; onClose: () => void }) {
  const { data } = useFetch<{ call: { request: string; response: unknown; http_status: number; created_at: string } }>(`/api/admin/flight-usage/calls/${id}`);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-ink/50" onClick={onClose} />
      <div className="relative flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-lift">
        <div className="flex items-center justify-between border-b border-line px-5 py-3"><div className="font-extrabold">aviationstack call #{id}</div><button onClick={onClose} aria-label="Close"><X className="h-5 w-5" /></button></div>
        <div className="min-h-0 flex-1 overflow-auto p-5">
          {!data ? <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted" /> : (
            <>
              <div className="mb-2 font-mono text-xs font-bold">{data.call.request}</div>
              <pre className="whitespace-pre-wrap break-all rounded-xl bg-[#0b1020] p-4 font-mono text-[11px] leading-relaxed text-sky-100">{JSON.stringify(data.call.response, null, 2)}</pre>
            </>
          )}
        </div>
      </div>
    </div>,
    document.body,
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface/80 p-2.5">
      <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 text-base font-extrabold tabular-nums text-ink">{value}</div>
    </div>
  );
}
