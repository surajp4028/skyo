"use client";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Travel date picker: two-month calendar popover, range support (return / check-out),
 * past dates disabled, weekends highlighted, quick chips. Values are "YYYY-MM-DD".
 */
const pad = (n: number) => String(n).padStart(2, "0");
export const toISO = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const fromISO = (s: string) => {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
};
export const addDaysISO = (iso: string, n: number) => {
  const d = fromISO(iso);
  d.setDate(d.getDate() + n);
  return toISO(d);
};
const WEEK = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];

type Props = {
  label: string;
  value: string;
  onChange: (v: string) => void;
  /** optional second date (return / check-out) */
  endLabel?: string;
  endValue?: string | null;
  onEndChange?: (v: string | null) => void;
  min?: string;
  className?: string;
  icon?: ReactNode;
};

export function DatePicker({ label, value, onChange, endLabel, endValue, onEndChange, min, className, icon }: Props) {
  const [open, setOpen] = useState(false);
  const [picking, setPicking] = useState<"start" | "end">("start");
  const [today] = useState(() => toISO(new Date()));
  const minISO = min || today;
  const [cursor, setCursor] = useState(() => {
    const d = fromISO(value || today);
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const box = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<string | null>(null);
  const range = !!onEndChange;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const pick = (iso: string) => {
    if (!range || picking === "start") {
      onChange(iso);
      if (range && endValue && endValue <= iso) onEndChange?.(addDaysISO(iso, 1));
      if (range && endLabel) setPicking("end");
      else setOpen(false);
    } else {
      if (iso <= value) {
        onChange(iso);
        return;
      }
      onEndChange?.(iso);
      setOpen(false);
      setPicking("start");
    }
  };

  const fmt = (iso: string | null | undefined) =>
    iso ? fromISO(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short" }) : null;
  const day = (iso: string | null | undefined) => (iso ? fromISO(iso).toLocaleDateString("en-IN", { weekday: "long" }) : "");

  return (
    <div ref={box} className={cn("relative flex min-w-0 flex-1 gap-2", className)}>
      <Trigger
        active={open && picking === "start"}
        label={label}
        icon={icon}
        main={fmt(value) || "Select"}
        sub={day(value)}
        onClick={() => {
          setPicking("start");
          setOpen((o) => !(o && picking === "start"));
        }}
      />
      {range && endLabel && (
        <Trigger
          active={open && picking === "end"}
          label={endLabel}
          icon={icon}
          main={fmt(endValue) || <span className="text-ink/30">Add date</span>}
          sub={endValue ? day(endValue) : "Save more on round trips"}
          onClear={endValue ? () => onEndChange?.(null) : undefined}
          onClick={() => {
            setPicking("end");
            setOpen((o) => !(o && picking === "end"));
          }}
        />
      )}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.98 }}
            transition={{ duration: 0.16 }}
            className="absolute left-0 top-full z-40 mt-2 w-[min(92vw,640px)] rounded-3xl border border-line bg-white p-5 shadow-[0_30px_80px_-20px_rgba(10,15,31,0.35)]"
          >
            <div className="mb-3 flex items-center justify-between">
              <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))} disabled={toISO(cursor) <= minISO.slice(0, 8) + "01"} className="rounded-full p-2 hover:bg-surface disabled:opacity-30" aria-label="Previous month">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="text-xs font-bold uppercase tracking-wider text-muted">{range && endLabel ? (picking === "start" ? `Select ${label.toLowerCase()}` : `Select ${endLabel.toLowerCase()}`) : `Select ${label.toLowerCase()}`}</span>
              <button type="button" onClick={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))} className="rounded-full p-2 hover:bg-surface" aria-label="Next month">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>
            <div className="grid gap-6 sm:grid-cols-2">
              {[0, 1].map((off) => (
                <Month
                  key={off}
                  className={off === 1 ? "hidden sm:block" : ""}
                  month={new Date(cursor.getFullYear(), cursor.getMonth() + off, 1)}
                  minISO={minISO}
                  today={today}
                  start={value}
                  end={range ? (picking === "end" && hover && hover > value ? hover : endValue) ?? null : null}
                  onPick={pick}
                  onHover={setHover}
                />
              ))}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-line pt-4">
              {[["Today", 0], ["Tomorrow", 1], ["This weekend", null], ["Next week", 7]].map(([l, n]) => {
                const iso = n === null ? nextSaturday(today) : addDaysISO(today, n as number);
                return (
                  <button key={l as string} type="button" onClick={() => pick(iso)} className={cn("rounded-full border px-3 py-1.5 text-xs font-bold transition", (picking === "start" ? value : endValue) === iso ? "border-brand bg-brand-soft text-brand" : "border-line text-ink/70 hover:border-ink/30")}>
                    {l as string}
                  </button>
                );
              })}
              <span className="ml-auto flex items-center gap-3 text-[11px] text-muted">
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-brand" /> Selected</span>
                <span className="flex items-center gap-1"><span className="h-2 w-2 rounded-full bg-rose-300" /> Weekend</span>
              </span>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function nextSaturday(todayISO: string) {
  const d = fromISO(todayISO);
  const add = (6 - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + add);
  return toISO(d);
}

function Trigger({ label, icon, main, sub, onClick, active, onClear }: { label: string; icon?: ReactNode; main: ReactNode; sub: string; onClick: () => void; active: boolean; onClear?: () => void }) {
  return (
    <div className={cn("relative flex min-w-0 flex-1 rounded-2xl border bg-white transition", active ? "border-brand ring-4 ring-brand/10" : "border-line hover:border-ink/20")}>
      <button type="button" onClick={onClick} className="flex min-w-0 flex-1 flex-col items-start px-4 py-3 text-left">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{icon || <CalendarDays className="h-3.5 w-3.5" />}{label}</span>
        <span className="mt-1 truncate text-[17px] font-bold text-ink">{main}</span>
        <span className="truncate text-xs font-medium text-muted">{sub}</span>
      </button>
      {onClear && (
        <button type="button" onClick={onClear} className="absolute right-2 top-2 rounded-full px-1.5 text-xs text-muted hover:bg-surface hover:text-ink" aria-label="Clear">×</button>
      )}
    </div>
  );
}

function Month({ month, minISO, today, start, end, onPick, onHover, className }: { month: Date; minISO: string; today: string; start: string; end: string | null; onPick: (iso: string) => void; onHover: (iso: string | null) => void; className?: string }) {
  const cells = useMemo(() => {
    const first = (month.getDay() + 6) % 7; // Monday-first
    const days = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
    return [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => toISO(new Date(month.getFullYear(), month.getMonth(), i + 1)))];
  }, [month]);
  return (
    <div className={className} onMouseLeave={() => onHover(null)}>
      <div className="mb-2 text-center text-sm font-extrabold text-ink">{month.toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</div>
      <div className="grid grid-cols-7 text-center text-[11px] font-bold text-muted">
        {WEEK.map((w, i) => <div key={w} className={cn("py-1", i >= 5 && "text-rose-400")}>{w}</div>)}
      </div>
      <div className="grid grid-cols-7 gap-y-1">
        {cells.map((iso, i) => {
          if (!iso) return <div key={`e${i}`} />;
          const disabled = iso < minISO;
          const isStart = iso === start;
          const isEnd = !!end && iso === end;
          const inRange = !!end && iso > start && iso < end;
          const weekend = i % 7 >= 5;
          return (
            <div key={iso} className={cn("relative flex justify-center", inRange && "bg-brand-soft", isStart && end && "rounded-l-full bg-brand-soft", isEnd && "rounded-r-full bg-brand-soft")}>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onPick(iso)}
                onMouseEnter={() => onHover(iso)}
                className={cn(
                  "relative flex h-10 w-10 flex-col items-center justify-center rounded-full text-sm font-semibold transition",
                  disabled ? "cursor-not-allowed text-ink/20" : "hover:bg-ink hover:text-white",
                  weekend && !disabled && !isStart && !isEnd && "text-rose-500",
                  (isStart || isEnd) && "bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_8px_20px_-8px_rgba(255,90,31,0.9)]",
                )}
              >
                {Number(iso.slice(8))}
                {iso === today && !isStart && <span className="absolute bottom-1 h-1 w-1 rounded-full bg-brand" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
