"use client";
import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight, Inbox, Loader2, Search } from "lucide-react";
import { cn } from "@/lib/utils";

/** Page number that resets to 1 whenever `key` (the active filters) changes — no effect needed. */
export function usePage(key: string) {
  const [s, setS] = useState({ key, page: 1 });
  const page = s.key === key ? s.page : 1;
  return [page, (p: number) => setS({ key, page: p })] as const;
}

export function PageHeader({ title, sub, actions, icon }: { title: string; sub?: string; actions?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="mb-7 flex flex-col justify-between gap-4 md:flex-row md:items-end">
      <div className="flex items-center gap-4">
        {icon && <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-ink text-white shadow-lift">{icon}</div>}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink md:text-[28px]">{title}</h1>
          {sub && <p className="mt-1 text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-3xl border border-line bg-white shadow-soft", className)}>{children}</div>;
}

export function StatCard({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: "brand" | "iris" | "mint" | "sky" }) {
  const tones = { brand: "from-brand/15 text-brand", iris: "from-iris/15 text-iris", mint: "from-mint/15 text-mint", sky: "from-sky/15 text-sky-600" };
  return (
    <Card className="group relative overflow-hidden p-5">
      <div className={cn("absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br to-transparent opacity-70 blur-2xl transition group-hover:scale-125", tones[tone])} />
      <div className="relative flex items-start justify-between">
        <div>
          <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
          <div className="mt-2 text-3xl font-extrabold tracking-tight text-ink">{value}</div>
          {hint && <div className="mt-1 text-xs font-medium text-muted">{hint}</div>}
        </div>
        <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br to-white", tones[tone])}>{icon}</div>
      </div>
    </Card>
  );
}

const BADGE: Record<string, string> = {
  active: "bg-mint/10 text-mint",
  confirmed: "bg-mint/10 text-mint",
  paid: "bg-mint/10 text-mint",
  inactive: "bg-amber-100 text-amber-700",
  pending: "bg-amber-100 text-amber-700",
  unpaid: "bg-amber-100 text-amber-700",
  blocked: "bg-red-100 text-red-700",
  cancelled: "bg-red-100 text-red-700",
  failed: "bg-red-100 text-red-700",
  revoked: "bg-slate-100 text-slate-600",
  expired: "bg-slate-100 text-slate-600",
  refunded: "bg-iris/10 text-iris",
  admin: "bg-ink text-white",
  staff: "bg-iris/10 text-iris",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = (tone || String(children)).toLowerCase();
  return <span className={cn("inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-bold capitalize", BADGE[key] || "bg-surface text-ink/70")}>{key === "active" && <span className="h-1.5 w-1.5 rounded-full bg-current" />}{children}</span>;
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-11 min-w-[260px] items-center gap-2 rounded-xl border border-line bg-white px-3.5 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
      <Search className="h-4 w-4 text-muted" />
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, 100))} placeholder={placeholder} className="w-full bg-transparent text-sm font-medium outline-none placeholder:text-muted/70" />
    </label>
  );
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-11 rounded-xl border border-line bg-white px-3 text-sm font-semibold outline-none focus:border-brand">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Table({ head, children, loading, empty, colSpan }: { head: string[]; children: ReactNode; loading?: boolean; empty?: boolean; colSpan?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[860px] text-left text-sm">
        <thead>
          <tr className="border-b border-line text-[11px] font-bold uppercase tracking-wider text-muted">
            {head.map((h) => <th key={h} className="whitespace-nowrap px-5 py-3.5">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-line">
          {loading && empty ? (
            <tr><td colSpan={colSpan || head.length} className="py-16 text-center text-muted"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
          ) : empty ? (
            <tr><td colSpan={colSpan || head.length} className="py-16 text-center"><Inbox className="mx-auto h-8 w-8 text-muted/50" /><div className="mt-2 text-sm font-semibold text-muted">Nothing here yet</div></td></tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between border-t border-line px-5 py-3.5 text-xs font-semibold text-muted">
      <span>{total === 0 ? "0 results" : `${(page - 1) * size + 1}–${Math.min(total, page * size)} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-lg p-1.5 hover:bg-surface disabled:opacity-30"><ChevronLeft className="h-4 w-4" /></button>
        <span className="px-2">Page {page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-lg p-1.5 hover:bg-surface disabled:opacity-30"><ChevronRight className="h-4 w-4" /></button>
      </div>
    </div>
  );
}

export function Forbidden() {
  return (
    <Card className="mx-auto mt-16 max-w-md p-10 text-center">
      <div className="text-5xl">🔒</div>
      <h2 className="mt-4 text-xl font-extrabold">No access</h2>
      <p className="mt-2 text-sm text-muted">Your role doesn&apos;t include this section. Ask an administrator to grant permission.</p>
    </Card>
  );
}
