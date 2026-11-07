"use client";
import { motion } from "motion/react";

/** Animated train running along a track — used while live data loads. */
export function TrainLoader({ label = "Finding the best trains for you…" }: { label?: string }) {
  return (
    <div className="flex flex-col items-center py-10">
      <div className="relative h-16 w-72 overflow-hidden">
        <div className="absolute bottom-3 left-0 right-0 h-[3px] bg-[repeating-linear-gradient(90deg,#0a0f1f33_0_10px,transparent_10px_18px)]" />
        <motion.div className="absolute bottom-4 flex items-end gap-0.5" initial={{ x: -140 }} animate={{ x: 300 }} transition={{ duration: 2.2, repeat: Infinity, ease: "linear" }}>
          {[0, 1, 2].map((i) => (
            <div key={i} className="relative h-7 w-11 rounded-md bg-gradient-to-b from-brand to-brand-2 shadow-sm">
              <div className="absolute left-1.5 right-1.5 top-1.5 flex gap-1">{[0, 1, 2].map((w) => <span key={w} className="h-2 flex-1 rounded-sm bg-white/80" />)}</div>
              <span className="absolute -bottom-1 left-1.5 h-2 w-2 rounded-full bg-ink" />
              <span className="absolute -bottom-1 right-1.5 h-2 w-2 rounded-full bg-ink" />
            </div>
          ))}
          <div className="relative h-8 w-12 rounded-md rounded-r-[18px] bg-ink">
            <span className="absolute right-2 top-1.5 h-2.5 w-3 rounded-sm bg-sky/80" />
            <span className="absolute -bottom-1 left-1.5 h-2 w-2 rounded-full bg-ink ring-2 ring-white" />
            <span className="absolute -bottom-1 right-2.5 h-2 w-2 rounded-full bg-ink ring-2 ring-white" />
          </div>
        </motion.div>
      </div>
      <p className="mt-3 text-sm font-semibold text-muted">{label}</p>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-3xl border border-line bg-white p-5">
      {[60, 90, 40].map((w, i) => (
        <div key={i} className="mb-3 h-4 animate-shimmer rounded-full bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" style={{ width: `${w}%` }} />
      ))}
      <div className="mt-4 flex gap-2">{[0, 1, 2, 3].map((i) => <div key={i} className="h-16 flex-1 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />)}</div>
    </div>
  );
}
