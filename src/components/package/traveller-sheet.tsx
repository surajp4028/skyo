"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { ArrowRight, Check, Crown, Loader2, Mail, Phone, Plus, Users, X } from "lucide-react";
import { api } from "@/lib/client/api";
import type { SavedPassenger } from "@/components/booking/passenger-form";
import { cn } from "@/lib/utils";

export type TripTraveller = { name: string; age: number | null; gender: "M" | "F" | "T" | null; email: string; phone: string };
type Row = { name: string; age: string; gender: "" | "M" | "F" | "T"; email: string; phone: string; savedId: number | null };

const blank = (): Row => ({ name: "", age: "", gender: "", email: "", phone: "", savedId: null });
const phoneOk = (v: string) => /^[6-9]\d{9}$/.test(v.replace(/\D+/g, "").replace(/^(?:91|0)(?=\d{10}$)/, ""));
const emailOk = (v: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.trim());

/**
 * "Who's travelling?" — one row per guest. Saved travellers from the account appear as chips (tap to add);
 * the first slots fill themselves. Every guest needs a name; the lead (guest 1) also needs email + mobile.
 */
export function TravellerSheet({
  guests,
  me,
  busy,
  priceLabel,
  onClose,
  onContinue,
}: {
  guests: number;
  me: { name?: string | null; email?: string | null; phone?: string | null };
  busy: boolean;
  priceLabel: string;
  onClose: () => void;
  onContinue: (t: TripTraveller[]) => void;
}) {
  const [saved, setSaved] = useState<SavedPassenger[] | null>(null);
  const [rows, setRows] = useState<Row[]>(() =>
    Array.from({ length: guests }, (_, i) => (i === 0 ? { ...blank(), name: me.name || "", email: me.email || "", phone: (me.phone || "").replace(/\D+/g, "").slice(-10) } : blank())),
  );
  const [tried, setTried] = useState(false);
  const [openContact, setOpenContact] = useState<Set<number>>(new Set());
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);

  // saved travellers → fill the empty slots in order (the lead keeps the account holder unless empty)
  useEffect(() => {
    let alive = true;
    api<{ passengers: SavedPassenger[] }>("/api/account/passengers", { method: "GET" })
      .then((r) => {
        if (!alive) return;
        setSaved(r.passengers);
        setRows((cur) => {
          const next = cur.map((x) => ({ ...x }));
          const lead = next[0];
          const meMatch = r.passengers.find((p) => p.name.trim().toLowerCase() === lead.name.trim().toLowerCase());
          if (meMatch) Object.assign(lead, { age: String(meMatch.age ?? ""), gender: meMatch.gender ?? "", savedId: meMatch.id });
          const queue = r.passengers.filter((p) => p.id !== meMatch?.id);
          for (let i = 0; i < next.length && queue.length; i++) {
            if (next[i].name.trim()) continue;
            const p = queue.shift()!;
            Object.assign(next[i], { name: p.name, age: String(p.age ?? ""), gender: p.gender ?? "", savedId: p.id });
          }
          return next;
        });
      })
      .catch(() => alive && setSaved([]));
    const esc = (e: KeyboardEvent) => e.key === "Escape" && closeRef.current();
    window.addEventListener("keydown", esc);
    document.body.style.overflow = "hidden";
    return () => {
      alive = false;
      window.removeEventListener("keydown", esc);
      document.body.style.overflow = "";
    };
  }, []);

  const set = (i: number, patch: Partial<Row>) => setRows((r) => r.map((x, k) => (k === i ? { ...x, ...patch } : x)));
  const used = useMemo(() => new Set(rows.map((r) => r.savedId).filter(Boolean)), [rows]);
  const togglePick = (p: SavedPassenger) => {
    const at = rows.findIndex((r) => r.savedId === p.id);
    if (at >= 0) return set(at, { ...blank(), ...(at === 0 ? { email: rows[0].email, phone: rows[0].phone } : {}) });
    const free = rows.findIndex((r) => !r.name.trim());
    const slot = free >= 0 ? free : -1;
    if (slot < 0) return;
    set(slot, { name: p.name, age: String(p.age ?? ""), gender: p.gender ?? "", savedId: p.id });
  };

  const errors = rows.map((r, i) => ({
    name: r.name.trim().length < 2 ? "Name required" : "",
    email: i === 0 ? (!emailOk(r.email) ? "Valid email required" : "") : r.email && !emailOk(r.email) ? "Check email" : "",
    phone: i === 0 ? (!phoneOk(r.phone) ? "10-digit mobile required" : "") : r.phone && !phoneOk(r.phone) ? "Check mobile" : "",
  }));
  const valid = errors.every((e) => !e.name && !e.email && !e.phone);
  const filled = rows.filter((r) => r.name.trim().length >= 2).length;

  const submit = () => {
    setTried(true);
    if (!valid) return;
    onContinue(
      rows.map((r) => ({
        name: r.name.trim(),
        age: r.age ? Math.max(0, Math.min(120, parseInt(r.age, 10) || 0)) : null,
        gender: r.gender || null,
        email: r.email.trim(),
        phone: r.phone.replace(/\D+/g, "").slice(-10),
      })),
    );
  };

  const field = "h-12 w-full min-w-0 rounded-xl border bg-white px-3.5 text-[15px] font-semibold text-ink outline-none transition placeholder:font-medium placeholder:text-ink/35 focus:border-brand focus:ring-4 focus:ring-brand/10";
  const label = "mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted";
  const pct = Math.round((filled / guests) * 100);
  return createPortal(
    <div className="fixed inset-0 z-[90] flex items-end justify-center bg-ink/50 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 260, damping: 30 }}
        onClick={(e) => e.stopPropagation()}
        className="flex h-[94dvh] w-full max-w-2xl flex-col overflow-hidden rounded-t-[28px] bg-[#f6f7fb] shadow-2xl sm:h-auto sm:max-h-[92vh] sm:rounded-[28px]"
      >
        <header className="border-b border-line bg-white px-4 pb-3 pt-3 sm:px-5 sm:pt-4">
          <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-line sm:hidden" />
          <div className="flex items-center gap-3">
            <div className="min-w-0 flex-1">
              <h2 className="text-lg font-extrabold tracking-tight sm:text-xl">Who&apos;s travelling?</h2>
              <p className="text-xs text-muted">Names as on ID · lead gets the booking updates</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-full border border-line bg-white p-2"><X className="h-4 w-4" /></button>
          </div>
          {/* progress */}
          <div className="mt-3 flex items-center gap-2.5">
            <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
              <motion.div className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" animate={{ width: `${pct}%` }} transition={{ duration: 0.4 }} />
            </div>
            <span className={cn("shrink-0 text-xs font-extrabold", filled === guests ? "text-emerald-600" : "text-ink")}>{filled}/{guests} added</span>
          </div>
        </header>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto overscroll-contain px-4 py-4 sm:px-5">
          {/* saved travellers — swipe row */}
          <section>
            <div className="mb-2 flex items-center gap-1.5 px-0.5 text-[11px] font-extrabold uppercase tracking-wider text-muted"><Users className="h-3.5 w-3.5" /> Your saved travellers</div>
            {saved === null ? (
              <div className="flex items-center gap-2 px-0.5 text-xs text-muted"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…</div>
            ) : saved.length === 0 ? (
              <p className="px-0.5 text-xs text-muted">None saved yet — type the names below.</p>
            ) : (
              <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:flex-wrap sm:px-0">
                {saved.map((p) => {
                  const on = used.has(p.id);
                  const full = !on && rows.every((r) => r.name.trim());
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={full}
                      onClick={() => togglePick(p)}
                      className={cn(
                        "flex shrink-0 items-center gap-2 rounded-2xl border px-3 py-2 text-left transition",
                        on ? "border-brand bg-brand text-white shadow-[0_8px_20px_-10px_rgba(255,90,31,.8)]" : "border-line bg-white text-ink hover:border-brand/50",
                        full && "cursor-not-allowed opacity-40",
                      )}
                    >
                      <span className={cn("flex h-7 w-7 items-center justify-center rounded-full text-xs font-extrabold", on ? "bg-white/20" : "bg-orange-50 text-brand")}>{on ? <Check className="h-4 w-4" /> : p.name[0]?.toUpperCase()}</span>
                      <span>
                        <span className="block whitespace-nowrap text-[13px] font-bold leading-tight">{p.name}</span>
                        <span className={cn("block text-[10.5px] font-semibold", on ? "text-white/80" : "text-muted")}>{p.age} yrs · {p.gender === "M" ? "Male" : p.gender === "F" ? "Female" : "Other"}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </section>

          {/* one card per guest */}
          {rows.map((r, i) => {
            const e = errors[i];
            const show = (msg: string) => (tried && msg ? msg : "");
            const lead = i === 0;
            const contactOpen = lead || openContact.has(i) || !!r.email || !!r.phone;
            return (
              <section key={i} className={cn("rounded-[22px] border bg-white p-4", lead ? "border-brand/30 shadow-[0_14px_34px_-24px_rgba(255,90,31,.8)]" : "border-line")}>
                <div className="mb-3 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2.5">
                    <span className={cn("flex h-8 w-8 items-center justify-center rounded-xl text-sm font-black", lead ? "bg-brand text-white" : "bg-surface text-ink")}>{i + 1}</span>
                    <span>
                      <span className="flex items-center gap-1 text-sm font-extrabold">{lead ? <>Lead traveller <Crown className="h-3.5 w-3.5 text-amber-500" /></> : `Traveller ${i + 1}`}</span>
                      <span className="block text-[11px] text-muted">{lead ? "Name, email & mobile needed" : "Only the name is needed"}</span>
                    </span>
                  </span>
                  {r.savedId ? (
                    <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-bold text-emerald-700">Saved</span>
                  ) : r.name.trim().length >= 2 ? (
                    <Check className="h-4 w-4 text-emerald-600" />
                  ) : null}
                </div>

                <label className="block">
                  <span className={label}>Full name</span>
                  <input className={cn(field, show(e.name) ? "border-red-400" : "border-line")} value={r.name} onChange={(ev) => set(i, { name: ev.target.value, savedId: null })} placeholder="As on ID card" autoComplete={lead ? "name" : "off"} />
                  {show(e.name) && <span className="mt-1 block text-[11px] font-semibold text-red-600">{e.name}</span>}
                </label>

                <div className="mt-3 grid grid-cols-[88px_1fr] gap-2.5">
                  <label className="block">
                    <span className={label}>Age</span>
                    <input className={cn(field, "border-line text-center")} inputMode="numeric" value={r.age} onChange={(ev) => set(i, { age: ev.target.value.replace(/\D+/g, "").slice(0, 3) })} placeholder="—" />
                  </label>
                  <div>
                    <span className={label}>Gender</span>
                    <div className="grid h-12 grid-cols-3 gap-1 rounded-xl bg-surface p-1">
                      {([["M", "Male"], ["F", "Female"], ["T", "Other"]] as const).map(([g, t]) => (
                        <button key={g} type="button" onClick={() => set(i, { gender: r.gender === g ? "" : g })} className={cn("rounded-lg text-xs font-bold transition", r.gender === g ? "bg-white text-ink shadow-sm ring-1 ring-line" : "text-muted hover:text-ink")}>
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {contactOpen ? (
                  <div className="mt-3 space-y-2.5">
                    <label className="block">
                      <span className={label}>Email{lead ? "" : " (optional)"}</span>
                      <span className={cn("flex h-12 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10", show(e.email) ? "border-red-400" : "border-line")}>
                        <Mail className="h-4 w-4 shrink-0 text-muted" />
                        <input type="email" className="h-full w-full min-w-0 bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-ink/35" value={r.email} onChange={(ev) => set(i, { email: ev.target.value })} placeholder="name@email.com" autoComplete={lead ? "email" : "off"} />
                      </span>
                      {show(e.email) && <span className="mt-1 block text-[11px] font-semibold text-red-600">{e.email}</span>}
                    </label>
                    <label className="block">
                      <span className={label}>Mobile{lead ? "" : " (optional)"}</span>
                      <span className={cn("flex h-12 items-center gap-2 rounded-xl border bg-white px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10", show(e.phone) ? "border-red-400" : "border-line")}>
                        <Phone className="h-4 w-4 shrink-0 text-muted" />
                        <span className="text-sm font-bold text-muted">+91</span>
                        <input type="tel" inputMode="numeric" className="h-full w-full min-w-0 bg-transparent text-[15px] font-semibold outline-none placeholder:font-medium placeholder:text-ink/35" value={r.phone} onChange={(ev) => set(i, { phone: ev.target.value.replace(/[^\d\s+]/g, "").slice(0, 14) })} placeholder="98XXXXXXXX" autoComplete={lead ? "tel" : "off"} />
                      </span>
                      {show(e.phone) && <span className="mt-1 block text-[11px] font-semibold text-red-600">{e.phone}</span>}
                    </label>
                  </div>
                ) : (
                  <button type="button" onClick={() => setOpenContact((s) => new Set(s).add(i))} className="mt-3 flex items-center gap-1.5 text-xs font-bold text-[#0057ff] hover:underline">
                    <Plus className="h-3.5 w-3.5" /> Add email / mobile (optional)
                  </button>
                )}
              </section>
            );
          })}
        </div>

        <footer className="border-t border-line bg-white px-4 pb-[calc(0.75rem+env(safe-area-inset-bottom))] pt-3 sm:px-5 sm:pb-4">
          {tried && !valid && <p className="mb-2 text-center text-xs font-semibold text-red-600">Fill the highlighted details to continue</p>}
          <button
            onClick={submit}
            disabled={busy}
            className="flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff8734] px-5 text-[15px] font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(255,90,31,.7)] transition hover:-translate-y-0.5 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {busy ? "Opening payment…" : `Continue to pay ${priceLabel}`} {!busy && <ArrowRight className="h-4 w-4" />}
          </button>
        </footer>
      </motion.div>
    </div>,
    document.body,
  );
}
