"use client";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { BadgeCheck, Building2, Loader2, MapPin, Pencil, Search, Trash2 } from "lucide-react";
import { api, errMsg } from "@/lib/client/api";
import { useSite } from "@/lib/client/providers";
import { GSTIN_RE, isValidGstin, PINCODE_RE, STATE_NAMES, stateByCode } from "@/lib/india";
import { cn } from "@/lib/utils";

export type SavedGst = { gstin: string; company: string; address: string | null; pincode: string | null; state: string | null; status: string | null; source: "fetch" | "manual" };
export type Billing = { state: string; pincode: string | null; address: string | null };

const input = "h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none transition focus:border-[#0057ff] focus:ring-4 focus:ring-[#0057ff]/10";

/** Loads the customer's GST + billing once (shared by profile and booking sheet). */
export function useGstProfile() {
  const [state, setState] = useState<{ gst: SavedGst | null; billing: Billing | null; mode: "fetch" | "manual" | "both" } | null>(null);
  useEffect(() => {
    let alive = true;
    api<{ gst: SavedGst | null; billing: Billing | null; mode: "fetch" | "manual" | "both" }>("/api/account/gst").then((r) => alive && setState(r)).catch(() => alive && setState({ gst: null, billing: null, mode: "both" }));
    return () => {
      alive = false;
    };
  }, []);
  return [state, setState] as const;
}

/**
 * GST details for tax invoices. Admin decides the input mode:
 *  fetch  → GSTIN + "Fetch details" (Digio lookup) only
 *  manual → type company / address / pincode
 *  both   → fetch first, fill manually if the lookup fails
 */
export function GstPanel({ gst, mode, onChange, compact }: { gst: SavedGst | null; mode: "fetch" | "manual" | "both"; onChange: (g: SavedGst | null) => void; compact?: boolean }) {
  const site = useSite();
  const [editing, setEditing] = useState(!gst);
  const [gstin, setGstin] = useState(gst?.gstin ?? "");
  const [manual, setManual] = useState(mode === "manual");
  const [f, setF] = useState({ company: gst?.company ?? "", address: gst?.address ?? "", pincode: gst?.pincode ?? "", state: gst?.state ?? "" });
  const [busy, setBusy] = useState<"fetch" | "save" | "del" | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const valid = isValidGstin(gstin);
  const allowManual = mode !== "fetch";
  const allowFetch = mode !== "manual";

  const fetchIt = async () => {
    setErr(null);
    setBusy("fetch");
    try {
      const r = await api<{ gst: SavedGst; tradeName: string | null }>("/api/account/gst/fetch", { body: { gstin } });
      onChange(r.gst);
      setEditing(false);
      toast.success(`GST details saved — ${r.gst.company}`);
    } catch (e) {
      setErr(errMsg(e));
      if (allowManual) setManual(true);
    } finally {
      setBusy(null);
    }
  };
  const save = async () => {
    setErr(null);
    setBusy("save");
    try {
      const r = await api<{ gst: SavedGst }>("/api/account/gst", { method: "PUT", body: { gstin, company: f.company, address: f.address || null, pincode: f.pincode || null, state: f.state || null } });
      onChange(r.gst);
      setEditing(false);
      toast.success("GST details saved");
    } catch (e) {
      setErr(errMsg(e));
    } finally {
      setBusy(null);
    }
  };
  const remove = async () => {
    setBusy("del");
    try {
      await api("/api/account/gst", { method: "DELETE" });
      onChange(null);
      setGstin("");
      setF({ company: "", address: "", pincode: "", state: "" });
      setEditing(true);
      toast.success("GST details removed");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(null);
    }
  };

  if (gst && !editing)
    return (
      <div className="rounded-2xl border border-line bg-white p-4">
        <div className="flex items-start gap-3">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-[#0057ff]/10 text-[#0057ff]"><Building2 className="h-5 w-5" /></span>
          <div className="min-w-0 flex-1">
            <div className="truncate font-bold">{gst.company}</div>
            <div className="font-mono text-xs font-bold text-ink/70">{gst.gstin}</div>
            {(gst.address || gst.state) && <div className="mt-1 text-xs text-muted">{[gst.address, gst.state, gst.pincode].filter(Boolean).join(", ")}</div>}
            <div className="mt-2 flex flex-wrap gap-1.5">
              <span className={cn("inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold", gst.source === "fetch" ? "bg-mint/10 text-mint" : "bg-surface text-muted")}>
                {gst.source === "fetch" ? <><BadgeCheck className="h-3 w-3" /> Verified with GST records</> : "Entered manually"}
              </span>
              {gst.status && <span className="rounded-full bg-surface px-2 py-0.5 text-[10px] font-bold text-muted">GST {gst.status}</span>}
            </div>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={() => setEditing(true)} title="Change" className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"><Pencil className="h-4 w-4" /></button>
            <button onClick={remove} disabled={busy === "del"} title="Remove" className="rounded-lg p-2 text-muted hover:bg-red-50 hover:text-red-600"><Trash2 className="h-4 w-4" /></button>
          </div>
        </div>
      </div>
    );

  return (
    <div className={cn("space-y-3", !compact && "rounded-2xl border border-line bg-white p-4")}>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">GSTIN</label>
        <div className="flex gap-2">
          <input value={gstin} onChange={(e) => setGstin(e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, "").slice(0, 15))} placeholder="22AAAAA0000A1Z5" className={cn(input, "font-mono uppercase tracking-wider", gstin.length === 15 && !valid && "border-red-300")} />
          {allowFetch && (
            <button onClick={fetchIt} disabled={!valid || !!busy} className="flex shrink-0 items-center gap-1.5 rounded-xl bg-ink px-4 text-sm font-bold text-white disabled:opacity-40">
              {busy === "fetch" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Search className="h-4 w-4" />} Fetch
            </button>
          )}
        </div>
        {gstin.length === 15 && !valid && <p className="mt-1 text-[11px] font-semibold text-red-600">This GSTIN doesn&apos;t look right — check the 15 characters.</p>}
        {valid && <p className="mt-1 text-[11px] text-muted">State: {stateByCode(gstin.slice(0, 2))}</p>}
      </div>
      {err && <p className="rounded-xl bg-amber-50 px-3 py-2 text-xs font-semibold text-amber-800">{err}</p>}
      {allowManual && !manual && allowFetch && (
        <button onClick={() => setManual(true)} className="text-xs font-bold text-[#0057ff]">Enter details manually instead</button>
      )}
      {allowManual && (manual || !allowFetch) && (
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Company name</label>
            <input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} maxLength={120} className={input} placeholder="As on GST certificate" />
          </div>
          <div className="sm:col-span-2">
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Company address</label>
            <input value={f.address} onChange={(e) => setF({ ...f, address: e.target.value })} maxLength={300} className={input} placeholder="Building, street, city" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Pincode</label>
            <input value={f.pincode} onChange={(e) => setF({ ...f, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) })} inputMode="numeric" className={cn(input, f.pincode && !PINCODE_RE.test(f.pincode) && "border-red-300")} placeholder="110001" />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">State</label>
            <select value={f.state || (valid ? stateByCode(gstin.slice(0, 2)) ?? "" : "")} onChange={(e) => setF({ ...f, state: e.target.value })} className={input}>
              <option value="">Select state</option>
              {STATE_NAMES.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="flex gap-2 sm:col-span-2">
            <button onClick={save} disabled={!valid || f.company.trim().length < 2 || (!!f.pincode && !PINCODE_RE.test(f.pincode)) || !!busy} className="flex items-center gap-1.5 rounded-xl bg-[#0057ff] px-4 py-2.5 text-sm font-bold text-white disabled:opacity-40">
              {busy === "save" && <Loader2 className="h-4 w-4 animate-spin" />} Save GST details
            </button>
            {gst && <button onClick={() => setEditing(false)} className="rounded-xl border border-line px-4 py-2.5 text-sm font-bold">Cancel</button>}
          </div>
        </div>
      )}
      {!allowManual && gst && <button onClick={() => setEditing(false)} className="text-xs font-bold text-muted">Cancel</button>}
      <p className="text-[11px] text-muted">Your GST details appear on the {site.site_name} invoice so you can claim input tax credit. Saved to your profile.</p>
    </div>
  );
}

/** Billing state (+ optional pincode / address). "Detect" uses a free IP lookup. */
export function BillingFields({ value, onChange }: { value: Billing; onChange: (b: Billing) => void }) {
  const [detecting, setDetecting] = useState(false);
  const detect = async () => {
    setDetecting(true);
    try {
      const r = await api<{ guess: { state: string | null; pincode: string | null; city: string | null } }>("/api/account/billing/guess");
      if (r.guess.state) {
        onChange({ ...value, state: r.guess.state, pincode: value.pincode || r.guess.pincode });
        toast.success(`Detected ${r.guess.city ? `${r.guess.city}, ` : ""}${r.guess.state}`);
      } else toast.info("Couldn't detect your state — please pick it.");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setDetecting(false);
    }
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <div className="mb-1 flex items-center justify-between">
          <label className="text-[11px] font-semibold uppercase tracking-wider text-muted">State</label>
          <button type="button" onClick={detect} disabled={detecting} className="flex items-center gap-1 text-[11px] font-bold text-[#0057ff]">
            {detecting ? <Loader2 className="h-3 w-3 animate-spin" /> : <MapPin className="h-3 w-3" />} Detect my state
          </button>
        </div>
        <select value={value.state} onChange={(e) => onChange({ ...value, state: e.target.value })} className={input}>
          <option value="">Select your state</option>
          {STATE_NAMES.map((s) => <option key={s}>{s}</option>)}
        </select>
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Pincode <span className="normal-case text-muted/70">(optional)</span></label>
        <input value={value.pincode ?? ""} onChange={(e) => onChange({ ...value, pincode: e.target.value.replace(/\D/g, "").slice(0, 6) || null })} inputMode="numeric" placeholder="110001" className={cn(input, value.pincode && !PINCODE_RE.test(value.pincode) && "border-red-300")} />
      </div>
      <div>
        <label className="mb-1 block text-[11px] font-semibold uppercase tracking-wider text-muted">Address <span className="normal-case text-muted/70">(optional)</span></label>
        <input value={value.address ?? ""} onChange={(e) => onChange({ ...value, address: e.target.value.slice(0, 200) || null })} placeholder="House, street, city" className={input} />
      </div>
    </div>
  );
}

export const billingValid = (b: Billing) => STATE_NAMES.includes(b.state) && (!b.pincode || PINCODE_RE.test(b.pincode));
export { GSTIN_RE };
