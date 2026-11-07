"use client";
import { useEffect, useId, useMemo, useRef, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { PlaneLanding, PlaneTakeoff } from "lucide-react";
import { airportLabel, searchAirports } from "@/lib/flight/airports";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type Opt = { iata: string; city: string; name: string; country: string; countryName?: string };

/**
 * Airport autocomplete: SKYO's own list answers instantly, then ~7,900 airports worldwide from
 * /api/flight/airports (search by code, city, airport or country). Never spends an aviationstack request.
 */
export function AirportInput({ label, value, onChange, kind = "from", placeholder = "City or airport", className }: { label: string; value: string; onChange: (label: string, code: string | null) => void; kind?: "from" | "to"; placeholder?: string; className?: string }) {
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(0);
  const box = useRef<HTMLDivElement>(null);
  const listId = useId();
  const q = value.replace(/\s*\([A-Z]{3}\)\s*$/i, "").trim();
  const local = useMemo<Opt[]>(() => searchAirports(value, 8), [value]);
  const [remote, setRemote] = useState<{ q: string; list: Opt[] } | null>(null);
  const options = remote && remote.q === q ? remote.list : local;
  useEffect(() => {
    if (!open || q.length < 2) return;
    const t = setTimeout(() => {
      api<{ airports: Opt[] }>(`/api/flight/airports?q=${encodeURIComponent(q)}`).then((r) => setRemote({ q, list: r.airports })).catch(() => {});
    }, 140);
    return () => clearTimeout(t);
  }, [q, open]);
  const Icon = kind === "from" ? PlaneTakeoff : PlaneLanding;

  useEffect(() => {
    const onDown = (e: MouseEvent) => !box.current?.contains(e.target as Node) && setOpen(false);
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  const pick = (a: Opt) => {
    onChange(airportLabel(a), a.iata);
    setOpen(false);
  };
  const code = value.match(/\(([A-Z]{3})\)\s*$/)?.[1];

  return (
    <div ref={box} className={cn("relative min-w-0 flex-1", className)}>
      <label className="group flex cursor-text flex-col rounded-2xl border border-line bg-white px-4 py-3 transition hover:border-ink/20 focus-within:border-[#0057ff] focus-within:ring-4 focus-within:ring-[#0057ff]/10">
        <span className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted"><Icon className="h-3.5 w-3.5" />{label}</span>
        <span className="flex items-baseline gap-2">
          <input
            value={value}
            onFocus={(e) => (setOpen(true), e.currentTarget.select())}
            onChange={(e) => (onChange(e.target.value.slice(0, 60), null), setOpen(true), setActive(0))}
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
            className="mt-1 w-full min-w-0 bg-transparent text-[17px] font-bold text-ink outline-none placeholder:font-semibold placeholder:text-ink/30"
          />
        </span>
        {code && <span className="pointer-events-none absolute right-4 top-3 rounded-md bg-ink/5 px-1.5 py-0.5 font-mono text-[10px] font-bold text-ink/50">{code}</span>}
      </label>
      <AnimatePresence>
        {open && options.length > 0 && (
          <motion.ul
            initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 6 }} transition={{ duration: 0.14 }}
            id={listId} role="listbox"
            className="absolute left-0 top-full z-50 mt-2 max-h-80 w-full min-w-[300px] overflow-y-auto rounded-2xl border border-line bg-white p-1.5 shadow-[0_24px_60px_-20px_rgba(10,15,31,0.35)]"
          >
            {!value.trim() && <li className="px-3 pb-1 pt-2 text-[10px] font-bold uppercase tracking-wider text-muted">Popular airports</li>}
            {options.map((a, i) => (
              <li key={a.iata}>
                <button type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(a)} className={cn("flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition", i === active ? "bg-sky-50" : "hover:bg-surface")}>
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-sky-100 to-indigo-100 text-[#0057ff]"><Icon className="h-4 w-4" /></span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-bold text-ink">{a.city}{a.country !== "IN" ? <span className="ml-1 text-[11px] font-semibold text-muted">· {a.countryName || a.country}</span> : null}</span>
                    <span className="block truncate text-xs text-muted">{a.name}</span>
                  </span>
                  <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-[11px] font-bold text-white">{a.iata}</span>
                </button>
              </li>
            ))}
          </motion.ul>
        )}
      </AnimatePresence>
    </div>
  );
}
