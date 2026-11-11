"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ArrowUpRight, ChevronLeft, ChevronRight, Cloud, Eye, Loader2, RefreshCw, Smartphone, Ticket, TrainFront, X } from "lucide-react";
import { errMsg } from "@/lib/client/api";
import { useSite } from "@/lib/client/providers";
import { refreshPnr, removePnr, useSavedPnrs } from "@/lib/client/pnr-store";
import { isPnrOn } from "@/lib/services";
import { groupPnr, statusTone, type PnrView, type SavedPnr } from "@/lib/train/pnr-types";
import { cn } from "@/lib/utils";

const fmtDay = (iso: string | null) =>
  iso ? new Date(`${iso}:00+05:30`).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short" }) : null;
const fmtTime = (iso: string | null) => (iso ? iso.slice(11, 16) : null);
const ago = (iso: string, now: number) => {
  const m = Math.round((now - new Date(iso).getTime()) / 60000);
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : m < 1440 ? `${Math.round(m / 60)} h ago` : `${Math.round(m / 1440)} d ago`;
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: false });

/** One colour for the whole ticket: all confirmed → green, any waitlist → rose, any RAC → amber. */
function overall(v: PnrView | null) {
  const s = (v?.passengers || []).map((p) => p.current.status.toUpperCase());
  if (!v || s.length === 0) return { bar: "from-slate-300 to-slate-400", text: v ? "No passenger details" : "Not checked yet", tone: "text-muted" };
  const cnf = s.filter((x) => x.startsWith("CNF")).length;
  if (s.every((x) => x.startsWith("CAN"))) return { bar: "from-slate-300 to-slate-500", text: "Cancelled", tone: "text-slate-600" };
  if (cnf === s.length) return { bar: "from-emerald-400 to-teal-500", text: s.length === 1 ? "Confirmed" : "All confirmed", tone: "text-emerald-700" };
  if (s.some((x) => x.includes("WL"))) return { bar: "from-rose-400 to-orange-400", text: `${cnf} of ${s.length} confirmed`, tone: "text-rose-700" };
  return { bar: "from-amber-300 to-orange-400", text: `${cnf} of ${s.length} confirmed`, tone: "text-amber-700" };
}

// real cut-out notches on both sides of the ticket, lined up with the perforation (band 64px + route 92px)
const NOTCH_Y = 156;
const notchMask: CSSProperties = {
  WebkitMaskImage: `radial-gradient(circle 10px at 0 ${NOTCH_Y}px, transparent 9.5px, #000 10px), radial-gradient(circle 10px at 100% ${NOTCH_Y}px, transparent 9.5px, #000 10px)`,
  WebkitMaskComposite: "source-in",
  maskImage: `radial-gradient(circle 10px at 0 ${NOTCH_Y}px, transparent 9.5px, #000 10px), radial-gradient(circle 10px at 100% ${NOTCH_Y}px, transparent 9.5px, #000 10px)`,
  maskComposite: "intersect",
};

/**
 * "Your PNRs" — boarding-pass previews of PNRs this person has checked. Renders nothing until they've checked one.
 * `onOpen` (PNR page) shows the full status in place; without it (home) a ticket links to /trains/pnr#<pnr>.
 */
export function SavedPnrs({ onOpen, activePnr, tone = "light", className }: { onOpen?: (pnr: string) => void; activePnr?: string | null; tone?: "light" | "sky"; className?: string }) {
  const site = useSite();
  const { items, ready, loggedIn } = useSavedPnrs();
  const [now, setNow] = useState(() => Date.now());
  const rail = useRef<HTMLDivElement>(null);
  const [edges, setEdges] = useState({ left: false, right: false });
  useEffect(() => {
    const i = setInterval(() => setNow(Date.now()), 30_000);
    return () => clearInterval(i);
  }, []);
  const measure = () => {
    const el = rail.current;
    if (el) setEdges({ left: el.scrollLeft > 4, right: el.scrollLeft + el.clientWidth < el.scrollWidth - 4 });
  };
  useEffect(() => {
    const t = setTimeout(measure, 50);
    window.addEventListener("resize", measure);
    return () => (clearTimeout(t), window.removeEventListener("resize", measure));
  }, [items.length]);

  if (!isPnrOn(site) || !ready || items.length === 0) return null;
  const onSky = tone === "sky";
  const scroll = (dir: number) => rail.current?.scrollBy({ left: dir * 320, behavior: "smooth" });

  return (
    <motion.section
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(className, onSky && "rounded-[30px] border border-white/30 bg-white/10 p-4 shadow-[0_30px_80px_-40px_rgba(3,25,80,0.8)] backdrop-blur-xl md:p-5")}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span className={cn("flex h-11 w-11 items-center justify-center rounded-2xl shadow-lg", onSky ? "bg-white text-[#0057ff]" : "bg-gradient-to-br from-iris to-[#0057ff] text-white")}>
            <Ticket className="h-5 w-5" />
          </span>
          <div>
            <div className="flex items-center gap-2">
              <h2 className={cn("text-lg font-extrabold tracking-tight md:text-xl", onSky ? "text-white" : "text-ink")}>Your PNRs</h2>
              <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-bold", onSky ? "bg-white/20 text-white" : "bg-surface text-ink")}>{items.length}</span>
            </div>
            <div className={cn("flex items-center gap-1.5 text-xs font-medium", onSky ? "text-white/80" : "text-muted")}>
              {loggedIn ? <Cloud className="h-3.5 w-3.5" /> : <Smartphone className="h-3.5 w-3.5" />}
              {loggedIn ? (
                "Saved to your account · on every device"
              ) : (
                <span>
                  Saved on this device · <Link href="/login?next=%2Ftrains%2Fpnr" className={cn("font-bold underline", onSky ? "text-white" : "text-ink")}>log in</Link> to keep them everywhere
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {!onOpen && (
            <Link href="/trains/pnr" className="flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand shadow-soft ring-1 ring-line hover:bg-brand hover:text-white">
              Check another PNR <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          )}
          {items.length > 1 && (
            <div className="hidden gap-1.5 sm:flex">
              {[-1, 1].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => scroll(d)}
                  disabled={d < 0 ? !edges.left : !edges.right}
                  aria-label={d < 0 ? "Previous tickets" : "More tickets"}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full transition disabled:opacity-35",
                    onSky ? "bg-white/20 text-white hover:bg-white hover:text-[#0057ff]" : "bg-white text-ink shadow-soft ring-1 ring-line hover:bg-ink hover:text-white",
                  )}
                >
                  {d < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      <div
        ref={rail}
        onScroll={measure}
        className={cn(
          "no-scrollbar -mx-1 mt-4 flex snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-1 pb-14 pt-3 -mb-10",
          edges.right && !edges.left && "[mask-image:linear-gradient(to_right,black_85%,transparent)]",
          edges.left && edges.right && "[mask-image:linear-gradient(to_right,transparent,black_8%,black_88%,transparent)]",
          edges.left && !edges.right && "[mask-image:linear-gradient(to_left,black_85%,transparent)]",
        )}
      >
        <AnimatePresence initial={false}>
          {items.map((it, i) => (
            <TicketCard key={it.pnr} it={it} i={i} now={now} onOpen={onOpen} active={activePnr === it.pnr} />
          ))}
        </AnimatePresence>
      </div>
    </motion.section>
  );
}

function TicketCard({ it, i, now, onOpen, active }: { it: SavedPnr; i: number; now: number; onOpen?: (pnr: string) => void; active: boolean }) {
  const [busy, setBusy] = useState(false);
  const v = it.data;
  const o = overall(v);
  const due = !it.nextRefreshAt || now >= new Date(it.nextRefreshAt).getTime();
  const pax = v?.passengers || [];

  const refresh = async () => {
    setBusy(true);
    try {
      const r = await refreshPnr(it.pnr);
      toast.success(r.cached ? "This is still the latest status" : "PNR status updated", { description: r.note });
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  const remove = async () => {
    try {
      await removePnr(it.pnr);
      toast.success(`PNR ${groupPnr(it.pnr)} removed`);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };

  const body = (
    <div className="flex h-full flex-col">
      {/* band — 64px */}
      <div className="relative h-16 overflow-hidden bg-ink px-4 text-white">
        <div aria-hidden className="bg-grid absolute inset-0 opacity-40" />
        <div aria-hidden className={cn("absolute inset-y-0 left-0 w-1.5 bg-gradient-to-b", o.bar)} />
        <div className="relative flex h-full items-center gap-2.5 pr-16">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand to-brand-2 shadow-[0_8px_20px_-8px_rgba(255,90,31,0.9)]"><TrainFront className="h-4 w-4" /></span>
          <div className="min-w-0">
            <div className="font-mono text-[10px] font-bold tracking-[0.2em] text-white/55">PNR {groupPnr(it.pnr)}</div>
            <div className="truncate text-sm font-extrabold">{v ? `${v.train.number} · ${v.train.name || "Train"}` : "Status not fetched yet"}</div>
          </div>
        </div>
      </div>

      {/* route — 92px */}
      <div className="flex h-[92px] flex-col justify-center px-5">
        {v ? (
          <>
            <div className="grid grid-cols-[auto_1fr_auto] items-center gap-3">
              <div>
                <div className="text-2xl font-black leading-none tracking-tight text-ink">{v.journey.from?.code || "—"}</div>
                <div className="mt-1 font-mono text-[11px] font-bold text-ink/70">{fmtTime(v.journey.date) || "--:--"}</div>
              </div>
              <div className="relative">
                <div className="border-t-2 border-dashed border-line" />
                <span className="absolute left-1/2 top-1/2 flex h-6 w-6 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-[#0057ff]/10 text-[#0057ff] ring-4 ring-white">
                  <TrainFront className="h-3.5 w-3.5" />
                </span>
              </div>
              <div className="text-right">
                <div className="text-2xl font-black leading-none tracking-tight text-ink">{v.journey.to?.code || "—"}</div>
                <div className="mt-1 font-mono text-[11px] font-bold text-ink/70">{fmtTime(v.journey.arrival) || "--:--"}</div>
              </div>
            </div>
            <div className="mt-2 flex items-center justify-between gap-2 text-[11px] font-semibold text-muted">
              <span className="truncate">{fmtDay(v.journey.date) || v.journey.dateText || ""}</span>
              <span className="shrink-0 rounded-md bg-surface px-1.5 py-0.5 font-bold text-ink">{v.journey.cls}{v.journey.quota ? ` · ${v.journey.quota}` : ""}</span>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-3 text-xs font-medium text-muted">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-surface"><RefreshCw className="h-4 w-4" /></span>
            Tap refresh to get the current status.
          </div>
        )}
      </div>

      {/* perforation — sits on the cut-outs at NOTCH_Y */}
      <div aria-hidden className="relative h-0">
        <span className="absolute inset-x-4 top-0 border-t-2 border-dashed border-line" />
      </div>

      {/* status */}
      <div className="flex-1 px-5 pb-4 pt-4">
        <div className="flex items-center justify-between gap-2">
          <span className={cn("text-sm font-extrabold", o.tone)}>{o.text}</span>
          {v && (
            <span className={cn("flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold", v.chart.prepared ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700")}>
              <span className={cn("h-1.5 w-1.5 rounded-full", v.chart.prepared ? "bg-emerald-500" : "animate-pulse bg-amber-500")} />
              {v.chart.prepared ? "Chart prepared" : "Chart pending"}
            </span>
          )}
        </div>
        {pax.length > 0 && (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {pax.slice(0, 4).map((p) => {
              const t = statusTone(p.current.status);
              return (
                <span key={p.n} className={cn("flex items-center gap-1 rounded-lg px-2 py-1 font-mono text-[11px] font-bold ring-1", t.chip)}>
                  <span className="text-[9px] opacity-60">P{p.n}</span>
                  {p.current.coach ? `${p.current.coach}/${p.current.berth ?? "—"}` : p.current.status + (p.current.berth && !/\d/.test(p.current.status) ? ` ${p.current.berth}` : "")}
                </span>
              );
            })}
            {pax.length > 4 && <span className="rounded-lg bg-surface px-2 py-1 text-[11px] font-bold text-muted">+{pax.length - 4}</span>}
          </div>
        )}
      </div>

      {/* footer */}
      <div className="flex items-center justify-between border-t border-line bg-surface/70 px-5 py-2 text-[10.5px] font-semibold text-muted">
        <span>{it.fetchedAt ? `Updated ${ago(it.fetchedAt, now)}` : "Not checked yet"}</span>
        <span className={cn(due && "text-emerald-600")}>{due ? "Refresh ready" : `Next refresh ${clock(it.nextRefreshAt!)}`}</span>
      </div>
    </div>
  );

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 16, scale: 0.97 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, transition: { duration: 0.2 } }}
      transition={{ delay: Math.min(i, 4) * 0.05 }}
      className="relative w-[280px] shrink-0 snap-start sm:w-[312px]"
    >
      <div
        style={notchMask}
        className={cn(
          "group relative h-full overflow-hidden rounded-[24px] bg-white shadow-[0_24px_50px_-26px_rgba(10,15,31,0.6)] transition duration-300 hover:-translate-y-1",
          active ? "ring-[3px] ring-amber-300" : "ring-1 ring-black/5",
        )}
      >
        {onOpen ? (
          <button type="button" onClick={() => onOpen(it.pnr)} className="block h-full w-full text-left" aria-label={`Show PNR ${it.pnr}`}>{body}</button>
        ) : (
          <Link href={`/trains/pnr#${it.pnr}`} className="block h-full" aria-label={`Open PNR ${it.pnr}`}>{body}</Link>
        )}
        {/* actions sit outside the link so they don't open the ticket */}
        <div className="absolute right-3 top-3.5 z-10 flex gap-1.5">
          <button
            type="button"
            onClick={refresh}
            disabled={busy || !due}
            title={due ? "Refresh status" : `A fresh status is available after ${clock(it.nextRefreshAt!)}`}
            aria-label="Refresh PNR status"
            className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-white hover:text-ink disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-white/15 disabled:hover:text-white"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
          </button>
          <button type="button" onClick={remove} title="Remove from your PNRs" aria-label={`Remove PNR ${it.pnr}`} className="flex h-8 w-8 items-center justify-center rounded-full bg-white/15 text-white ring-1 ring-white/20 backdrop-blur transition hover:bg-rose-500 hover:ring-rose-400">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {active && (
        <span className="absolute -top-2 left-5 z-20 flex items-center gap-1 rounded-full bg-amber-300 px-2 py-0.5 text-[10px] font-extrabold text-ink shadow">
          <Eye className="h-3 w-3" /> Showing below
        </span>
      )}
    </motion.div>
  );
}
