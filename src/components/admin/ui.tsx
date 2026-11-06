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
        {icon && <div className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-neutral-200 bg-gradient-to-b from-white to-neutral-50 text-neutral-700 shadow-[0_1px_2px_rgba(0,0,0,0.05)] [&_svg]:h-5 [&_svg]:w-5">{icon}</div>}
        <div>
          <h1 className="text-[22px] font-semibold tracking-tight text-neutral-900">{title}</h1>
          {sub && <p className="mt-1 max-w-2xl text-sm text-neutral-500">{sub}</p>}
        </div>
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn("rounded-xl border border-neutral-200 bg-white", className)}>{children}</div>;
}

/** Aceternity-style stat card: cursor-following glow + grid pattern. */
export function StatCard({ label, value, hint, icon, tone = "brand" }: { label: string; value: ReactNode; hint?: ReactNode; icon: ReactNode; tone?: "brand" | "iris" | "mint" | "sky" }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const colors = { brand: "255,90,31", iris: "91,91,247", mint: "16,185,129", sky: "56,189,248" };
  const bg = useMotionTemplate`radial-gradient(220px circle at ${x}px ${y}px, rgba(${colors[tone]},0.10), transparent 75%)`;
  const iconTone = { brand: "text-brand", iris: "text-iris", mint: "text-mint", sky: "text-sky-500" };
  return (
    <div
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      className="group relative overflow-hidden rounded-xl border border-neutral-200 bg-white p-5"
    >
      <motion.div className="pointer-events-none absolute inset-0 opacity-0 transition duration-300 group-hover:opacity-100" style={{ background: bg }} />
      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,#f4f4f5_1px,transparent_1px),linear-gradient(to_bottom,#f4f4f5_1px,transparent_1px)] bg-[size:20px_20px] opacity-0 transition duration-300 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)] group-hover:opacity-100" />
      <div className="relative flex items-start justify-between">
        <div className="text-[13px] font-medium text-neutral-500">{label}</div>
        <div className={cn("[&_svg]:h-4 [&_svg]:w-4", iconTone[tone])}>{icon}</div>
      </div>
      <div className="relative mt-3 text-[28px] font-semibold tracking-tight text-neutral-900 tabular-nums">{value}</div>
      {hint && <div className="relative mt-0.5 text-xs text-neutral-500">{hint}</div>}
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
    <label className="flex h-9 min-w-[280px] flex-1 items-center gap-2 rounded-lg border border-neutral-200 bg-white px-3 transition focus-within:border-neutral-400 focus-within:ring-4 focus-within:ring-neutral-100 md:flex-none">
      <Search className="h-4 w-4 text-neutral-400" />
      <input value={value} onChange={(e) => onChange(e.target.value.slice(0, 100))} placeholder={placeholder} className="w-full bg-transparent text-[13px] outline-none placeholder:text-neutral-400" />
    </label>
  );
}

export function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: [string, string][] }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)} className="h-9 rounded-lg border border-neutral-200 bg-white px-2.5 text-[13px] text-neutral-700 outline-none focus:border-neutral-400">
      {options.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
    </select>
  );
}

export function Btn({ children, onClick, variant = "outline", disabled, className, type = "button" }: { children: ReactNode; onClick?: () => void; variant?: "outline" | "dark" | "danger" | "brand"; disabled?: boolean; className?: string; type?: "button" | "submit" }) {
  const v = {
    outline: "border border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50",
    dark: "bg-neutral-900 text-white hover:bg-neutral-800 shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
    danger: "border border-red-200 bg-red-50 text-red-700 hover:bg-red-100",
    brand: "bg-brand text-white hover:brightness-110 shadow-[0_1px_2px_rgba(0,0,0,0.1)]",
  };
  return (
    <button type={type} disabled={disabled} onClick={onClick} className={cn("inline-flex h-9 items-center justify-center gap-1.5 rounded-lg px-3 text-[13px] font-medium transition active:scale-[0.98] disabled:opacity-50", v[variant], className)}>
      {children}
    </button>
  );
}

export function Table({ head, children, loading, empty, colSpan }: { head: string[]; children: ReactNode; loading?: boolean; empty?: boolean; colSpan?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[880px] text-left text-[13px]">
        <thead>
          <tr className="border-b border-neutral-200 bg-neutral-50/60 text-xs font-medium text-neutral-500">
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
  return <div className="flex flex-wrap items-center gap-2 border-b border-neutral-200 p-3">{children}</div>;
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
  return <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border border-neutral-200 bg-gradient-to-b from-white to-neutral-100 text-[11px] font-semibold text-neutral-700", className)}>{initials}</div>;
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
