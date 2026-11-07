"use client";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { RefreshCw, Rows3 } from "lucide-react";
import { trainApi } from "@/lib/train/client";
import { errMsg } from "@/lib/client/api";
import type { CoachPosition } from "@/lib/server/train/types";
import { CLASS_NAMES } from "@/lib/train/format";
import { cn } from "@/lib/utils";

const COLORS: Record<string, string> = {
  "1A": "from-violet-500 to-fuchsia-500", "2A": "from-indigo-500 to-sky-500", "3A": "from-sky-500 to-cyan-400", "3E": "from-cyan-500 to-teal-400",
  SL: "from-emerald-500 to-green-400", CC: "from-amber-500 to-orange-400", EC: "from-rose-500 to-orange-400", "2S": "from-lime-500 to-emerald-400",
};
const tone = (c: string) => COLORS[c] || "from-slate-400 to-slate-500";

/** ixigo-style rake view: bullet-nose locomotive + coaches with windows & bogies. Loaded on demand (2 credits). */
export function CoachStrip({ train, autoLoad }: { train: string; autoLoad?: boolean }) {
  const [requested, setRequested] = useState(!!autoLoad);
  const [s, setS] = useState<{ data?: CoachPosition; error?: string } | null>(null);
  useEffect(() => {
    if (!requested) return;
    let alive = true;
    trainApi<CoachPosition>(`/trains/${train}/coach-position`)
      .then((r) => alive && setS({ data: r.data }))
      .catch((e) => alive && setS({ error: errMsg(e) }));
    return () => {
      alive = false;
    };
  }, [requested, train]);
  if (!requested)
    return (
      <button onClick={() => setRequested(true)} className="flex items-center gap-2 rounded-xl border border-line bg-white px-4 py-2.5 text-sm font-bold transition hover:border-brand hover:text-brand">
        <Rows3 className="h-4 w-4 text-brand" /> Show coach position
      </button>
    );
  if (!s) return <div className="flex items-center gap-2 text-sm font-semibold text-muted"><RefreshCw className="h-4 w-4 animate-spin" /> Loading coach position…</div>;
  if (s.error) return <div className="text-sm font-semibold text-red-600">{s.error}</div>;
  const coaches = [...(s.data?.coach_position || [])].sort((a, b) => a.position_from_engine - b.position_from_engine);
  const classes = [...new Set(coaches.map((c) => c.class_code))].filter((c) => COLORS[c]);

  return (
    <div className="min-w-0 max-w-full">
      <div className="relative overflow-x-auto pb-3 [scrollbar-width:thin] [mask-image:linear-gradient(to_right,black_92%,transparent)]">
        <div className="flex w-max items-end gap-1 pl-1 pr-6 pt-6">
          <Engine />
          {coaches.map((c, i) => (
            <motion.div key={`${c.coach_name}-${i}`} initial={{ opacity: 0, x: -14 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.035, type: "spring", stiffness: 260, damping: 22 }} className="relative flex flex-col items-center">
              <span className="mb-1 font-mono text-[10px] font-bold text-muted">{c.position_from_engine}</span>
              <div className={cn("relative flex h-[58px] w-[72px] flex-col justify-between rounded-[10px] bg-gradient-to-b px-1.5 pb-1.5 pt-1.5 text-white shadow-[0_8px_18px_-10px_rgba(10,15,31,0.6)]", tone(c.class_code))}>
                <div className="flex gap-[3px]">{[0, 1, 2, 3].map((w) => <span key={w} className="h-2.5 flex-1 rounded-[3px] bg-white/80" />)}</div>
                <div className="text-center leading-none">
                  <div className="text-[13px] font-extrabold">{c.coach_name}</div>
                  <div className="mt-0.5 text-[9px] font-bold opacity-85">{c.class_code}</div>
                </div>
                {/* coupling */}
                <span className="absolute -left-1 top-1/2 h-1.5 w-1 -translate-y-1/2 rounded-sm bg-ink/60" />
              </div>
              <Bogies />
            </motion.div>
          ))}
        </div>
        <div className="mt-1 h-1 w-full min-w-max rounded-full bg-[repeating-linear-gradient(90deg,#0a0f1f40_0_14px,transparent_14px_22px)]" />
      </div>
      <div className="mt-3 flex flex-wrap gap-3 text-[11px] font-semibold text-muted">
        {classes.map((c) => (
          <span key={c} className="flex items-center gap-1.5"><span className={cn("h-3 w-3 rounded bg-gradient-to-b", tone(c))} /> {c} · {CLASS_NAMES[c] || c}</span>
        ))}
        <span className="flex items-center gap-1.5"><span className="h-3 w-3 rounded bg-gradient-to-b from-slate-400 to-slate-500" /> Other / luggage</span>
      </div>
    </div>
  );
}

function Engine() {
  return (
    <div className="relative flex flex-col items-center">
      <span className="mb-1 text-[10px] font-bold text-muted">ENG</span>
      <svg width="96" height="58" viewBox="0 0 96 58" className="drop-shadow-[0_10px_18px_rgba(10,15,31,0.45)]" aria-label="Engine">
        <defs>
          <linearGradient id="eng" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#1f2a52" /><stop offset="1" stopColor="#0a0f1f" /></linearGradient>
          <linearGradient id="engStripe" x1="0" x2="1"><stop offset="0" stopColor="#ff5a1f" /><stop offset="1" stopColor="#ffb36b" /></linearGradient>
        </defs>
        {/* bullet nose pointing left */}
        <path d="M96 4 H34 C14 4 2 22 2 40 V54 H96 Z" fill="url(#eng)" />
        <path d="M10 26 C16 14 26 10 38 10 H52 V24 H12 Z" fill="#7dd3fc" opacity="0.9" />
        <rect x="58" y="10" width="12" height="10" rx="2" fill="#bae6fd" opacity="0.85" />
        <rect x="74" y="10" width="12" height="10" rx="2" fill="#bae6fd" opacity="0.85" />
        <rect x="6" y="36" width="90" height="5" fill="url(#engStripe)" />
        <circle cx="10" cy="46" r="2.5" fill="#fde68a" />
      </svg>
      <Bogies wide />
    </div>
  );
}

function Bogies({ wide }: { wide?: boolean }) {
  return (
    <div className={cn("-mt-1 flex justify-between px-1.5", wide ? "w-[92px]" : "w-[72px]")}>
      {[0, 1].map((b) => (
        <span key={b} className="flex gap-[2px]">
          <span className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" />
          <span className="h-2.5 w-2.5 rounded-full border-2 border-ink bg-white" />
        </span>
      ))}
    </div>
  );
}
