"use client";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import { ChevronDown, Copy, Download, ExternalLink, FileText, Loader2, RefreshCw, ShieldPlus, X } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { Badge } from "./ui";
import { fmtTs, Json, pretty, PROVIDER_TONE } from "./transactions";
import { cn } from "@/lib/utils";

type Line = { key: string; label: string; paise: number; note?: string };
type Detail = {
  booking: {
    ref: string; service: string; status: string; paymentStatus: string; ticketStatus: string; amountPaise: number; payProvider: string | null; orderId: string | null; paymentId: string | null;
    paidAt: string | null; issuedAt: string | null; holdExpiresAt: string | null; createdAt: string; updatedAt: string; travelDate: string | null; travellers: number; pnr: string | null; providerRef: string | null;
    ticketKey: string | null; ticketStored: boolean;
  };
  user: { id: number; uid: string; name: string | null };
  contact: { name: string | null; email: string | null; phone: string | null; masked: boolean };
  details: {
    train?: { number: string; name: string }; from?: string; to?: string; date?: string; cls?: string; quota?: string; food?: boolean;
    passengers?: { name: string; age: number; gender: string; berth?: string | null; nationality?: string }[];
    pricing?: { baseFare: number; catering: number; perPassenger: number; count: number; total: number };
    charges?: { lines: Line[]; totalPaise: number; payMode: string; ac: boolean };
    payMode?: string; insurance?: { opted: boolean; perPassenger: number; total: number; status: string };
    availability?: { status: string; text: string; checkedAt: string | null };
    ticket?: { pnr: string; ticketNo?: string; chartStatus?: string; provider?: string; issuedAt?: string; allocations: { name: string; age?: number; gender?: string; status: string; coach?: string; berth?: number; berthType?: string }[] };
    failure?: string; methodMismatch?: { priced: string; paidWith: string };
  };
  attempts: { id: number; paymentId: string | null; status: string; method: string | null; amount: number | null; errorCode: string | null; error: string | null; verified: boolean; source: string; at: string; updatedAt: string; data: unknown }[] | null;
  logs: { id: number; provider: string; direction: string; action: string; http_status: number | null; outcome: string; external_id: string | null; event_id: string | null; amount_paise: number | null; latency_ms: number | null; request: string | null; response: string | null; created_at: string }[] | null;
};

const inr = (paise: number) => "₹" + (paise / 100).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const dt = (d: string | null | undefined) => (d ? new Date(d).toLocaleString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false }) : "—");
const GENDER: Record<string, string> = { M: "Male", F: "Female", T: "Transgender" };

/** Right-side panel with every detail of one booking — fetched fresh when opened. */
export function BookingDrawer({ service, bookingRef, onClose, onChanged }: { service: string; bookingRef: string | null; onClose: () => void; onChanged?: () => void }) {
  const [data, setData] = useState<{ ref: string; d?: Detail; error?: string } | null>(null);
  const [tick, setTick] = useState(0);
  const [busy, setBusy] = useState(false);
  const [openLog, setOpenLog] = useState<number | null>(null);

  useEffect(() => {
    if (!bookingRef) return;
    let alive = true;
    api<Detail>(`/api/admin/bookings/${service}/${bookingRef}`)
      .then((d) => alive && setData({ ref: bookingRef, d }))
      .catch((e) => alive && setData({ ref: bookingRef, error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [service, bookingRef, tick]);
  useEffect(() => {
    const k = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", k);
    return () => document.removeEventListener("keydown", k);
  }, [onClose]);

  const reconcile = async () => {
    setBusy(true);
    try {
      const r = await api<{ payments: unknown[]; confirmedNow: boolean }>(`/api/admin/bookings/${service}/${bookingRef}/reconcile`, { method: "POST" });
      toast.success(r.confirmedNow ? "Captured payment found — booking confirmed" : `Razorpay has ${r.payments.length} payment(s) on this order — synced`);
      setTick((x) => x + 1);
      onChanged?.();
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  // Nothing to render on the server / while closed (portals need document.body).
  if (!bookingRef || typeof document === "undefined") return null;
  const loading = !data || data.ref !== bookingRef;
  const x = data?.d;
  const d = x?.details;

  return createPortal(
    <AnimatePresence>
      {bookingRef && (
        <motion.div className="fixed inset-0 z-[90] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
          <motion.aside initial={{ x: 40 }} animate={{ x: 0 }} exit={{ x: 40 }} transition={{ type: "spring", stiffness: 360, damping: 34 }} className="relative flex h-full w-full max-w-2xl flex-col bg-white shadow-2xl">
            <header className="flex items-start justify-between gap-3 border-b border-line px-6 py-4">
              <div>
                <div className="font-mono text-xs font-bold text-muted">{bookingRef}</div>
                <h2 className="text-lg font-extrabold">{d?.train ? `${d.train.number} ${d.train.name}` : "Booking"}</h2>
                {x && <div className="mt-1 flex flex-wrap gap-1.5"><Badge>{x.booking.status}</Badge><Badge>{`payment: ${x.booking.paymentStatus}`}</Badge><Badge>{`ticket: ${x.booking.ticketStatus.replace("_", " ")}`}</Badge></div>}
              </div>
              <div className="flex items-center gap-2">
                {x?.booking.orderId && service === "train" && (
                  <button onClick={reconcile} disabled={busy} title="Ask Razorpay for every payment on this order and sync" className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold hover:bg-surface disabled:opacity-60">
                    {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />} Re-check with Razorpay
                  </button>
                )}
                <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"><X className="h-5 w-5" /></button>
              </div>
            </header>

            <div className="min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
              {loading ? (
                <div className="flex h-40 items-center justify-center text-muted"><Loader2 className="h-6 w-6 animate-spin" /></div>
              ) : data?.error ? (
                <p className="rounded-xl bg-red-50 p-4 text-sm font-semibold text-red-700">{data.error}</p>
              ) : x && d ? (
                <>
                  {d.failure && <p className="rounded-xl bg-red-50 p-3 text-xs font-semibold text-red-700">Ticketing failed: {d.failure}</p>}
                  {d.methodMismatch && <p className="rounded-xl bg-amber-50 p-3 text-xs font-semibold text-amber-800">Priced for {d.methodMismatch.priced.toUpperCase()} but paid with {d.methodMismatch.paidWith}. IRCTC fee may differ.</p>}

                  <Block title="Customer">
                    <Grid rows={[
                      ["SKYO ID", <Link key="u" href={`/admin/users/${x.user.id}`} className="font-mono font-bold text-brand hover:underline">{x.user.uid}</Link>],
                      ["Name", x.contact.name || x.user.name || "—"],
                      ["Phone", x.contact.phone || "—"],
                      ["Email", x.contact.email || "—"],
                    ]} />
                    {x.contact.masked && <p className="mt-2 text-[11px] text-muted">Contact details masked — needs the “See full email / phone” permission.</p>}
                  </Block>

                  <Block title="Journey">
                    <Grid rows={[
                      ["Route", `${d.from} → ${d.to}`],
                      ["Journey date", d.date || "—"],
                      ["Class / quota", `${d.cls} · ${d.quota}`],
                      ["Food", d.food ? "Included" : "Not opted"],
                      ["Availability at booking", d.availability ? `${d.availability.text} (${d.availability.status})` : "—"],
                      ["Booked at", dt(x.booking.createdAt)],
                      ["Paid at", dt(x.booking.paidAt)],
                      ["Ticket issued at", dt(x.booking.issuedAt)],
                    ]} />
                  </Block>

                  <Block title={`Passengers (${d.passengers?.length ?? x.booking.travellers})`}>
                    <div className="overflow-hidden rounded-xl border border-line">
                      <table className="w-full text-xs">
                        <thead className="bg-surface text-left text-[10px] uppercase tracking-wider text-muted"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Age</th><th className="px-3 py-2">Gender</th><th className="px-3 py-2">Pref.</th><th className="px-3 py-2">Status</th><th className="px-3 py-2">Coach / berth</th></tr></thead>
                        <tbody className="divide-y divide-line">
                          {(d.passengers || []).map((p, i) => {
                            const a = d.ticket?.allocations?.[i];
                            return (
                              <tr key={i}>
                                <td className="px-3 py-2 text-muted">{i + 1}</td>
                                <td className="px-3 py-2 font-bold">{p.name}</td>
                                <td className="px-3 py-2">{p.age}</td>
                                <td className="px-3 py-2">{GENDER[p.gender] || p.gender}</td>
                                <td className="px-3 py-2">{p.berth || "—"}</td>
                                <td className={cn("px-3 py-2 font-extrabold", a?.status === "CNF" ? "text-emerald-600" : a ? "text-orange-600" : "text-muted")}>{a?.status || "—"}</td>
                                <td className="px-3 py-2">{a?.coach ? `${a.coach} / ${a.berth} ${a.berthType ?? ""}` : "—"}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </Block>

                  <Block title="Charges">
                    {d.charges ? (
                      <ul className="space-y-1 text-sm">
                        {d.charges.lines.map((l) => (
                          <li key={l.key} className="flex justify-between gap-3"><span className="text-muted">{l.label}{l.note ? <span className="ml-1 text-[11px]">({l.note})</span> : null}</span><span className="font-semibold tabular-nums">{inr(l.paise)}</span></li>
                        ))}
                        <li className="flex justify-between border-t border-line pt-1.5 font-extrabold"><span>Total · {d.charges.payMode === "upi" ? "UPI" : "Card / NetBanking"} · {d.charges.ac ? "AC" : "non-AC"}</span><span>{inr(d.charges.totalPaise)}</span></li>
                      </ul>
                    ) : (
                      <p className="text-sm">Total {inr(x.booking.amountPaise)} <span className="text-xs text-muted">(booked before the fee breakdown existed)</span></p>
                    )}
                    <div className="mt-3 flex items-center gap-2 rounded-xl bg-surface px-3 py-2 text-xs">
                      <ShieldPlus className={cn("h-4 w-4", d.insurance?.opted ? "text-mint" : "text-muted")} />
                      {d.insurance?.opted ? <span><b>Insurance opted</b> · {inr(Math.round(d.insurance.total * 100))} ({inr(Math.round(d.insurance.perPassenger * 100))} × {d.pricing?.count}) · status: {d.insurance.status.replace("_", " ")}</span> : <span>No insurance</span>}
                    </div>
                  </Block>

                  <Block title="Ticket">
                    <Grid rows={[
                      ["PNR", x.booking.pnr ? <span key="p" className="font-mono font-bold">{x.booking.pnr}</span> : "—"],
                      ["Ticket no.", d.ticket?.ticketNo || x.booking.providerRef || "—"],
                      ["Issued via", d.ticket?.provider || "—"],
                      ["Chart", d.ticket?.chartStatus || "—"],
                      ["Stored in S3", x.booking.ticketKey ? <span key="k" className="break-all font-mono text-[11px]">{x.booking.ticketKey}</span> : "Not yet (generated on first download)"],
                    ]} />
                    {x.booking.ticketStatus === "issued" && (
                      <div className="mt-3 flex gap-2">
                        <a href={`/api/bookings/${x.booking.ref}/ticket?view=1`} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-lg bg-ink px-3 py-1.5 text-xs font-bold text-white"><FileText className="h-3.5 w-3.5" /> View PDF</a>
                        <a href={`/api/bookings/${x.booking.ref}/ticket`} className="flex items-center gap-1.5 rounded-lg border border-line px-3 py-1.5 text-xs font-bold"><Download className="h-3.5 w-3.5" /> Download</a>
                      </div>
                    )}
                  </Block>

                  <Block title="Payment">
                    <Grid rows={[
                      ["Gateway", x.booking.payProvider || "—"],
                      ["Order ID", x.booking.orderId ? <CopyText key="o" v={x.booking.orderId} /> : "—"],
                      ["Payment ID", x.booking.paymentId ? <CopyText key="pi" v={x.booking.paymentId} /> : "—"],
                      ["Amount", inr(x.booking.amountPaise)],
                      ["Hold until", dt(x.booking.holdExpiresAt)],
                    ]} />
                    {x.attempts && (
                      <div className="mt-3 space-y-2">
                        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">Attempts ({x.attempts.length})</div>
                        {x.attempts.length === 0 && <p className="text-xs text-muted">None recorded. Use “Re-check with Razorpay” to sync.</p>}
                        {x.attempts.map((a) => (
                          <details key={a.id} className="rounded-xl border border-line">
                            <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-3 py-2 text-xs">
                              <span className={cn("rounded px-1.5 py-0.5 font-bold", a.status === "captured" ? "bg-emerald-50 text-emerald-700" : a.status === "failed" ? "bg-red-50 text-red-700" : "bg-surface")}>{a.status}</span>
                              <span className="font-mono">{a.paymentId}</span>
                              <span className="text-muted">{a.method || "—"} · {a.amount != null ? inr(a.amount) : "—"}</span>
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold", a.verified ? "bg-mint/10 text-mint" : "bg-amber-50 text-amber-700")}>{a.verified ? `verified · ${a.source}` : "browser-reported"}</span>
                              <span className="ml-auto text-muted">{fmtTs(a.at)}</span>
                            </summary>
                            {a.error && <p className="px-3 text-xs font-semibold text-red-600">{a.errorCode}: {a.error}</p>}
                            <div className="p-3"><Json title="Razorpay payment object (latest)" body={JSON.stringify(a.data, null, 2)} /></div>
                          </details>
                        ))}
                      </div>
                    )}
                  </Block>

                  {x.logs && (
                    <Block title={`Request / response log (${x.logs.length})`} action={<Link href={`/admin/transactions?q=${x.booking.ref}`} className="flex items-center gap-1 text-xs font-bold text-brand">Open in Transactions <ExternalLink className="h-3 w-3" /></Link>}>
                      <ol className="space-y-1.5">
                        {x.logs.map((l) => (
                          <li key={l.id} className="rounded-xl border border-line">
                            <button onClick={() => setOpenLog(openLog === l.id ? null : l.id)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left text-xs">
                              <span className="w-[150px] shrink-0 font-mono text-[11px] text-muted">{fmtTs(l.created_at)}</span>
                              <span className={cn("rounded px-1.5 py-0.5 text-[10px] font-bold uppercase", PROVIDER_TONE[l.provider])}>{l.provider}</span>
                              <span className="font-mono font-bold">{l.action}</span>
                              <span className={cn("ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold", l.outcome === "ok" ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>{l.http_status ?? "—"}</span>
                              {l.latency_ms != null && <span className="text-[11px] text-muted">{l.latency_ms} ms</span>}
                              <ChevronDown className={cn("h-3.5 w-3.5 text-muted transition", openLog === l.id && "rotate-180")} />
                            </button>
                            {openLog === l.id && (
                              <div className="grid gap-2 p-3 pt-0 lg:grid-cols-2">
                                <Json title="Request sent / received" body={pretty(l.request)} />
                                <Json title="Response" body={pretty(l.response)} />
                              </div>
                            )}
                          </li>
                        ))}
                      </ol>
                    </Block>
                  )}
                </>
              ) : null}
            </div>
          </motion.aside>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}

function Block({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section>
      <div className="mb-2 flex items-center justify-between"><h3 className="text-xs font-extrabold uppercase tracking-wider text-ink/70">{title}</h3>{action}</div>
      {children}
    </section>
  );
}
function Grid({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[150px_1fr] gap-x-4 gap-y-1.5 rounded-xl bg-surface p-3 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents"><dt className="text-xs text-muted">{k}</dt><dd className="min-w-0 font-medium">{v}</dd></div>
      ))}
    </dl>
  );
}
function CopyText({ v }: { v: string }) {
  return (
    <button onClick={() => navigator.clipboard?.writeText(v).then(() => toast.success("Copied"))} className="inline-flex items-center gap-1 font-mono text-xs hover:text-brand">{v} <Copy className="h-3 w-3" /></button>
  );
}
