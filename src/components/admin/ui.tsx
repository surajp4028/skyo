"use client";
import { useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
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
      <div className="flex items-start gap-3.5">
        {icon && <div className="mt-0.5 flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_12px_30px_-10px_rgba(255,90,31,0.7)] [&_svg]:h-5 [&_svg]:w-5">{icon}</div>}
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-ink">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm text-muted">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-2xl border border-line bg-white shadow-soft", className)}>{children}</div>;
}

/** Aceternity-style stat card: cursor-following glow, grid pattern, gradient icon, optional sparkline. */
export function StatCard({ label, value, hint, icon, tone = "brand", spark }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: "brand" | "iris" | "mint" | "sky"; spark?: number[] }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const colors = { brand: "255,90,31", iris: "91,91,247", mint: "16,185,129", sky: "56,189,248" };
  const bg = useMotionTemplate`radial-gradient(240px circle at ${x}px ${y}px, rgba(${colors[tone]},0.14), transparent 75%)`;
  const iconTone = {
    brand: "from-brand to-brand-2 shadow-[0_10px_24px_-10px_rgba(255,90,31,0.8)]",
    iris: "from-iris to-violet-500 shadow-[0_10px_24px_-10px_rgba(91,91,247,0.8)]",
    mint: "from-emerald-500 to-teal-400 shadow-[0_10px_24px_-10px_rgba(16,185,129,0.8)]",
    sky: "from-sky-500 to-cyan-400 shadow-[0_10px_24px_-10px_rgba(56,189,248,0.8)]",
  };
  const barTone = { brand: "bg-brand", iris: "bg-iris", mint: "bg-emerald-500", sky: "bg-sky-500" };
  const max = Math.max(1, ...(spark || [0]));
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      className="group relative overflow-hidden rounded-2xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-0.5 hover:shadow-[0_20px_40px_-20px_rgba(10,15,31,0.25)]"
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: bg }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f4f4f5_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f5_1px,transparent_1px)] bg-[size:20px_20px] opacity-0 transition duration-300 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)] group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className={cn("flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br text-white [&_svg]:h-[18px] [&_svg]:w-[18px]", iconTone[tone])}>{icon}</div>
      </div>
      <div className="relative mt-2 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-extrabold tracking-tight text-ink tabular-nums">{value}</div>
          {hint && <div className="mt-0.5 text-xs font-medium text-muted">{hint}</div>}
        </div>
        {spark && spark.length > 1 && (
          <div className="flex h-10 items-end gap-[3px]">
            {spark.map((v, i) => (
              <motion.span key={i} initial={{ height: 0 }} animate={{ height: `${Math.max(8, (v / max) * 100)}%` }} transition={{ delay: i * 0.03 }} className={cn("w-1.5 rounded-full opacity-70", barTone[tone])} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

const BADGE: Record<string, string> = {
  active: "border-emerald-200 bg-emerald-50 text-emerald-700",
  confirmed: "border-emerald-200 bg-emerald-50 text-emerald-700",
  paid: "border-emerald-200 bg-emerald-50 text-emerald-700",
  inactive: "border-amber-200 bg-amber-50 text-amber-700",
  pending: "border-amber-200 bg-amber-50 text-amber-700",
  unpaid: "border-amber-200 bg-amber-50 text-amber-700",
  blocked: "border-red-200 bg-red-50 text-red-700",
  cancelled: "border-red-200 bg-red-50 text-red-700",
  failed: "border-red-200 bg-red-50 text-red-700",
  locked: "border-red-200 bg-red-50 text-red-700",
  refunded: "border-violet-200 bg-violet-50 text-violet-700",
  admin: "border-neutral-900 bg-neutral-900 text-white",
  staff: "border-violet-200 bg-violet-50 text-violet-700",
};
export function Badge({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = (tone || String(children)).toLowerCase();
  return (
    <span className={cn("inline-flex items-center gap-1 whitespace-nowrap rounded-md border px-1.5 py-0.5 text-[11px] font-medium capitalize", BADGE[key] || "border-neutral-200 bg-neutral-50 text-neutral-600")}>
      {(key === "active" || key === "confirmed") && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}

export function SearchBox({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  return (
    <label className="flex h-10 min-w-[280px] flex-1 items-center gap-2 rounded-xl border border-line bg-white px-3 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10 md:flex-none">
      <Search className="h-4 w-4 text-neutral-400" />
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, 100))} placeholder={placeholder} className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
    </label>
  );
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-10 rounded-xl border border-line bg-white px-3 text-[13px] font-semibold text-ink/80 outline-none focus:border-brand">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Btn({ children, onClick, variant = "outline", disabled, className, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "outline" | "dark" | "danger" | "brand"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const v = {
    outline: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
    dark: "bg-ink text-white hover:bg-ink-2 shadow-[0_8px_20px_-10px_rgba(10,15,31,0.6)]",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    brand: "bg-gradient-to-r from-brand to-brand-2 text-white hover:brightness-110 shadow-[0_10px_24px_-10px_rgba(255,90,31,0.8)]",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cn("inline-flex h-10 items-center justify-center gap-1.5 rounded-xl px-3.5 text-[13px] font-bold transition active:scale-[0.98] disabled:opacity-50", v[variant], className)}>
      {children}
    </button>
  );
}

export function Table({ head, children, loading, empty, colSpan }: { head: string[]; children: ReactNode; loading?: boolean; empty?: boolean; colSpan?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-line bg-surface/70 text-[11px] font-bold uppercase tracking-wider text-muted">
            {head.map((h, i) => <th key={h + i} className="whitespace-nowrap px-4 py-2.5 font-medium">{h}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-neutral-100">
          {loading && empty ? (
            <tr><td colSpan={colSpan || head.length} className="py-16 text-center text-neutral-400"><Loader2 className="mx-auto h-5 w-5 animate-spin" /></td></tr>
          ) : empty ? (
            <tr>
              <td colSpan={colSpan || head.length} className="py-16 text-center">
                <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50"><Inbox className="h-5 w-5 text-neutral-400" /></div>
                <div className="mt-3 text-sm font-medium text-neutral-700">Nothing here yet</div>
                <div className="text-xs text-neutral-400">Records will appear as they come in.</div>
              </td>
            </tr>
          ) : (
            children
          )}
        </tbody>
      </table>
    </div>
  );
}

export const Td = ({ children, className }: { children: ReactNode; className?: string }) => <td className={cn("px-4 py-3 align-middle", className)}>{children}</td>;

export function Toolbar({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">{children}</div>;
}

export function Pager({ page, size, total, onPage }: { page: number; size: number; total: number; onPage: (p: number) => void }) {
  const pages = Math.max(1, Math.ceil(total / size));
  return (
    <div className="flex items-center justify-between border-t border-neutral-200 px-4 py-2.5 text-xs text-neutral-500">
      <span>{total === 0 ? "0 results" : `${(page - 1) * size + 1}–${Math.min(total, page * size)} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <button disabled={page <= 1} onClick={() => onPage(page - 1)} className="rounded-md border border-neutral-200 p-1 hover:bg-neutral-50 disabled:opacity-40"><ChevronLeft className="h-3.5 w-3.5" /></button>
        <span className="px-2 tabular-nums">{page} / {pages}</span>
        <button disabled={page >= pages} onClick={() => onPage(page + 1)} className="rounded-md border border-neutral-200 p-1 hover:bg-neutral-50 disabled:opacity-40"><ChevronRight className="h-3.5 w-3.5" /></button>
      </div>
    </div>
  );
}

export function Avatar({ name, className }: { name: string | null; className?: string }) {
  const initials = (name || "?").split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();
  return <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-brand/15 to-iris/20 text-[11px] font-extrabold text-ink ring-1 ring-white", className)}>{initials}</div>;
}

export function Forbidden() {
  return (
    <Card className="mx-auto mt-16 max-w-md p-10 text-center">
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl border border-neutral-200 bg-neutral-50 text-2xl">🔒</div>
      <h2 className="mt-4 text-lg font-semibold">No access</h2>
      <p className="mt-1 text-sm text-neutral-500">Your role doesn&apos;t include this section. Ask an administrator to grant permission.</p>
    </Card>
  );
}
