"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, TrainFront } from "lucide-react";
import { api } from "@/lib/client/api";
import { searchLocalStations, stationLabel, type LocalStation } from "@/lib/train/stations";
import { cn } from "@/lib/utils";

type Opt = LocalStation & { source?: "local" | "railcore" };

/**
 * Station autocomplete. Major stations resolve instantly from a local list (0 credits).
 * Only when nothing matches locally, after a 450 ms pause and ≥ 3 chars, it asks /api/train/stations/search.
 */
export function StationInput({
  label, value, onChange, placeholder = "City or station", className, dark,
}: { label: string; value: string; onChange: (label: string, code: string | null) => void; placeholder?: string; className?: string; dark?: boolean }) {
  const [open, setOpen] = useState(false);
  const [remote, setRemote] = useState<{ q: string; list: Opt[] } | null>(null);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const q = value.replace(/\s*\([A-Z0-9]+\)\s*$/i, "").trim();
  const local = useMemo<Opt[]>(() => searchLocalStations(q, 7), [q]);
  const options = remote && remote.q === q ? remote.list : local;

  useEffect(() => {
    if (!open || q.length < 2) return;
    const t = setTimeout(() => {
      api<{ stations: Opt[] }>(`/api/train/stations/search?q=${encodeURIComponent(q)}`)
        .then((r) => setRemote({ q, list: r.stations }))
        .catch(() => {});
    }, 160);
    return () => clearTimeout(t);
  }, [q, open]);

  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (s: Opt) => {
    onChange(stationLabel(s), s.code);
    setOpen(false);
  };

  return (
    <div ref={box} className={cn("relative min-w-0 flex-1", className)}>
      <label className={cn("group flex cursor-text flex-col rounded-2xl border px-4 py-3 transition focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10", dark ? "border-white/15 bg-white/10" : "border-line bg-white hover:border-ink/20")}>
        <span className={cn("flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider", dark ? "text-white/60" : "text-muted")}><MapPin className="h-3.5 w-3.5" />{label}</span>
        <input
          value={value}
          onFocus={(e) => {
            setOpen(true);
            e.currentTarget.select();
          }}
          onChange={(e) => {
            onChange(e.target.value.slice(0, 60), null);
            setOpen(true);
            setActive(0);
          }}
          onKeyDown={(e) => {
            if (!open) return;
            if (e.key === "ArrowDown") {
              e.preventDefault();
              setActive((a) => Math.min(a + 1, options.length - 1));
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              setActive((a) => Math.max(a - 1, 0));
            } else if (e.key === "Enter" && options[active]) {
              e.preventDefault();
              pick(options[active]);
            }
            if (e.key === "Escape") setOpen(false);
          }}
          placeholder={placeholder}
          autoComplete="off"
          role="combobox"
          aria-expanded={open}
          aria-controls={listId}
          className={cn("mt-1 w-full min-w-0 bg-transparent text-[17px] font-bold outline-none placeholder:font-semibold", dark ? "text-white placeholder:text-white/30" : "text-ink placeholder:text-ink/30")}
        />
      </label>
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.14 }}
            id={listId}
            role="listbox"
            className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full min-w-[300px] overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(10,15,31,0.35)]"
          >
            {options.map((s, i) => (
              <li key={s.code}>
                <button
                  type="button"
                  onMouseEnter={() => setActive(i)}
                  onClick={() => pick(s)}
                  className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === active ? "bg-brand-soft" : "hover:bg-surface")}
                >
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-surface text-ink/60"><TrainFront className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{s.name}</span>
                    <span className="block truncate text-xs text-muted">{s.city}</span>
                  </span>
                  <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-white">{s.code}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
