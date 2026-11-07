"use client";
import { useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { ExternalLink, Hash, Radio, Search } from "lucide-react";
import { toast } from "sonner";
import { trainApi } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { Train } from "@/lib/server/train/types";
import { LiveStatus } from "./live-status";
import { istISO, titleCase } from "@/lib/train/format";

/**
 * Live tracker: a train number shows live status right here (no redirect);
 * a name runs one train search (1 credit) and lets the user pick.
 */
/** Shortcuts only — nothing is fetched until the user taps one. */
const POPULAR: [string, string][] = [
  ["12951", "Mumbai Rajdhani"], ["12002", "Bhopal Shatabdi"], ["22436", "Vande Bharat"], ["12301", "Howrah Rajdhani"], ["12627", "Karnataka Exp"],
];

export function LiveFinder() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Train[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [picked, setPicked] = useState<{ number: string; name?: string } | null>(null);
  const isNumber = /^\d{4,5}$/.test(q.trim());

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="rounded-[28px] border border-white/70 bg-white/95 p-5 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.5)] backdrop-blur-xl">
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const v = q.trim();
            if (isNumber) {
              setResults(null);
              setPicked({ number: v });
              return;
            }
            if (v.length < 3) return toast.error("Enter a 5-digit train number or at least 3 letters of the name");
            setBusy(true);
            try {
              const r = await trainApi<{ results: Train[] }>("/trains/search", { q: v });
              setResults(r.data.results || []);
              setPicked(null);
            } catch (e) {
              toast.error(errMsg(e));
            } finally {
              setBusy(false);
            }
          }}
          className="flex flex-col gap-3 sm:flex-row"
        >
          <label className="flex flex-1 items-center gap-3 rounded-2xl border border-line px-4 py-3 focus-within:border-brand focus-within:ring-4 focus-within:ring-brand/10">
            <Hash className="h-5 w-5 text-muted" />
            <input value={q} onChange={(e) => setQ(e.target.value.slice(0, 60))} autoFocus placeholder="Train number (12952) or name (Padmavat)" className="w-full bg-transparent text-lg font-bold outline-none placeholder:font-semibold placeholder:text-ink/30" />
          </label>
          <button disabled={busy} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-6 font-extrabold text-white shadow-[0_16px_40px_-12px_rgba(255,90,31,0.8)] disabled:opacity-60">
            {isNumber ? <><Radio className="h-5 w-5" /> Track live</> : <><Search className="h-5 w-5" /> Find train</>}
          </button>
        </form>
        {!picked && !results && (
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="text-xs font-semibold text-muted">Popular:</span>
            {POPULAR.map(([n, name]) => (
              <button key={n} type="button" onClick={() => (setQ(n), setPicked({ number: n, name }))} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/80 transition hover:-translate-y-0.5 hover:border-brand hover:text-brand">
                <span className="font-mono text-[11px] text-muted">{n}</span> {name}
              </button>
            ))}
          </div>
        )}
        <AnimatePresence>
          {results && (
            <motion.ul initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="mt-4 divide-y divide-line overflow-hidden">
              {results.length === 0 && <li className="py-4 text-sm text-muted">No trains found for “{q}”. Try the train number.</li>}
              {results.map((t, i) => (
                <motion.li key={t.train_number} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.04 }}>
                  <button onClick={() => (setPicked({ number: t.train_number, name: t.train_name }), setResults(null), setQ(t.train_number))} className="flex w-full items-center gap-3 rounded-xl px-2 py-3 text-left transition hover:bg-surface">
                    <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-xs font-bold text-white">{t.train_number}</span>
                    <span className="min-w-0 flex-1 truncate font-bold">{titleCase(t.train_name)}</span>
                    <span className="font-mono text-xs text-muted">{t.source_station_code} → {t.destination_station_code}</span>
                  </button>
                </motion.li>
              ))}
            </motion.ul>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence mode="wait">
        {picked && (
          <motion.div key={picked.number} initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="rounded-[28px] border border-line bg-white p-5 shadow-[0_30px_80px_-30px_rgba(10,15,31,0.35)]">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-sm font-bold text-white">{picked.number}</span>
                {picked.name && <span className="font-extrabold">{titleCase(picked.name)}</span>}
              </div>
              <a href={`/trains/${picked.number}`} target="_blank" rel="noopener" className="flex items-center gap-1.5 rounded-xl border border-line px-3 py-1.5 text-xs font-bold text-ink/70 hover:border-brand hover:text-brand">
                Full route & coaches <ExternalLink className="h-3.5 w-3.5" />
              </a>
            </div>
            <LiveStatus train={picked.number} initialDate={istISO(0)} autoLoad />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
