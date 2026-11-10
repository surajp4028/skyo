"use client";
import { useState } from "react";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { api, ClientApiError, errMsg } from "@/lib/client/api";
import { cn } from "@/lib/utils";

export type SavedPassport = { number: string; expiry: string };
export type SavedPassenger = { id: number; name: string; age: number; gender: "M" | "F" | "T"; berth?: "LB" | "MB" | "UB" | "SL" | "SU" | null; nationality: string; passport?: SavedPassport | null };
export const maskPassport = (n: string) => `${"•".repeat(Math.max(0, n.length - 3))}${n.slice(-3)}`;
export const GENDERS = [["M", "Male"], ["F", "Female"], ["T", "Transgender"]] as const;
export const BERTHS = [["LB", "Lower"], ["MB", "Middle"], ["UB", "Upper"], ["SL", "Side lower"], ["SU", "Side upper"]] as const;
export const genderLabel = (g: string) => GENDERS.find(([k]) => k === g)?.[1] ?? g;
export const berthLabel = (b?: string | null) => BERTHS.find(([k]) => k === b)?.[1] ?? "No preference";

/** IRCTC-style traveller form: name ≤ 16, age, gender, optional berth preference, nationality (IN). */
export function PassengerForm({ initial, onSaved, onCancel, compact }: { initial?: SavedPassenger; onSaved: (p: SavedPassenger) => void; onCancel?: () => void; compact?: boolean }) {
  const [name, setName] = useState(initial?.name ?? "");
  const [age, setAge] = useState(initial ? String(initial.age) : "");
  const [gender, setGender] = useState<"M" | "F" | "T" | "">(initial?.gender ?? "");
  const [berth, setBerth] = useState<string>(initial?.berth ?? "");
  const [nat, setNat] = useState(initial?.nationality ?? "IN");
  const [ppOpen, setPpOpen] = useState(!!initial?.passport);
  const [ppNo, setPpNo] = useState(initial?.passport?.number ?? "");
  const [ppExp, setPpExp] = useState(initial?.passport?.expiry ?? "");
  const ppFilled = !!(ppNo || ppExp);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<{ field?: string; msg: string } | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      const body = { name: name.trim(), age: Number(age), gender, berth: berth || null, nationality: nat || "IN", passport: ppFilled ? { number: ppNo, expiry: ppExp } : null };
      const r = initial
        ? await api<{ passenger: SavedPassenger }>(`/api/account/passengers/${initial.id}`, { method: "PATCH", body })
        : await api<{ passenger: SavedPassenger }>("/api/account/passengers", { body });
      onSaved(r.passenger);
    } catch (e) {
      setErr({ field: e instanceof ClientApiError ? e.info.field : undefined, msg: errMsg(e) });
    } finally {
      setBusy(false);
    }
  };

  const input = "h-11 w-full rounded-xl border-2 border-line bg-white px-3 text-sm font-semibold outline-none transition focus:border-brand focus:ring-4 focus:ring-brand/10";
  return (
    <form onSubmit={submit} className="space-y-3">
      <div className={cn("grid gap-3", compact ? "grid-cols-[1fr_88px]" : "sm:grid-cols-[1fr_110px]")}>
        <label className="block">
          <span className="mb-1 flex justify-between text-[11px] font-bold uppercase tracking-wider text-muted">Full name <span className="normal-case tracking-normal">{name.length}/16</span></span>
          <input value={name} maxLength={16} onChange={(e) => setName(e.target.value.replace(/[^A-Za-z .]/g, ""))} placeholder="As on ID" className={cn(input, err?.field === "name" && "border-red-300")} autoFocus />
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Age</span>
          <input value={age} inputMode="numeric" onChange={(e) => setAge(e.target.value.replace(/\D/g, "").slice(0, 3))} placeholder="30" className={cn(input, err?.field === "age" && "border-red-300")} />
        </label>
      </div>
      <div>
        <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Gender</span>
        <div className="flex gap-1.5">
          {GENDERS.map(([k, l]) => (
            <button key={k} type="button" onClick={() => setGender(k)} className={cn("flex-1 rounded-xl border-2 px-2 py-2 text-xs font-bold transition", gender === k ? "border-brand bg-brand-soft text-brand" : "border-line text-ink/60 hover:border-ink/30")}>{l}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-3 sm:grid-cols-[1fr_96px]">
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Berth preference (optional)</span>
          <select value={berth} onChange={(e) => setBerth(e.target.value)} className={input}>
            <option value="">No preference</option>
            {BERTHS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
          </select>
        </label>
        <label className="block">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Nationality</span>
          <input value={nat} maxLength={2} onChange={(e) => setNat(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""))} className={input} />
        </label>
      </div>
      <p className="flex items-start gap-1.5 text-[11px] text-muted"><Info className="mt-0.5 h-3.5 w-3.5 shrink-0" /> Berth preference is a request, not a guarantee — allotment is done by Indian Railways.</p>
      <div className="rounded-xl border border-line">
        <button type="button" onClick={() => setPpOpen((o) => !o)} className="flex w-full items-center justify-between px-3 py-2.5 text-left">
          <span>
            <span className="block text-xs font-extrabold">Passport <span className="font-semibold text-muted">(optional · for international flights)</span></span>
            {!ppOpen && <span className="block text-[11px] text-muted">{initial?.passport ? `${maskPassport(initial.passport.number)} · valid till ${initial.passport.expiry}` : "Add once — we'll fill it in when you fly abroad"}</span>}
          </span>
          <span className="text-xs font-bold text-brand">{ppOpen ? "Hide" : initial?.passport ? "Edit" : "Add"}</span>
        </button>
        {ppOpen && (
          <div className="grid gap-3 border-t border-line p-3 sm:grid-cols-[1fr_170px]">
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Passport number</span>
              <input value={ppNo} onChange={(e) => setPpNo(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 9))} placeholder="Z1234567" className={cn(input, "font-mono uppercase", err?.field?.startsWith("passport") && "border-red-300")} />
            </label>
            <label className="block">
              <span className="mb-1 block text-[11px] font-bold uppercase tracking-wider text-muted">Expiry date</span>
              <input type="date" value={ppExp} onChange={(e) => setPpExp(e.target.value)} className={cn(input, err?.field?.startsWith("passport") && "border-red-300")} />
            </label>
            {ppFilled && <button type="button" onClick={() => (setPpNo(""), setPpExp(""))} className="text-left text-[11px] font-bold text-red-600 sm:col-span-2">Remove passport</button>}
          </div>
        )}
      </div>
      {err && <p className="rounded-xl bg-red-50 px-3 py-2 text-xs font-semibold text-red-700">{err.msg}</p>}
      <div className="flex gap-2">
        {onCancel && <Button type="button" variant="outline" className="flex-1" onClick={onCancel}>Cancel</Button>}
        <Button type="submit" className="flex-1" loading={busy} disabled={!name.trim() || !age || !gender}>{initial ? "Save changes" : "Save traveller"}</Button>
      </div>
    </form>
  );
}
