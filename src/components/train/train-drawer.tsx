"use client";
import { useEffect } from "react";
import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { X } from "lucide-react";
import { TrainInsight } from "./train-insight";
import { titleCase } from "@/lib/train/format";

/** Right-side sheet for a train: Route · Live · Coaches. Fixed width, own scroll — never stretches the results list. */
export function TrainDrawer({ train, name, from, to, date, tab, onClose }: { train: string; name: string; from: string; to: string; date: string; tab: "route" | "live"; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose]);

  return createPortal(
    <motion.div className="fixed inset-0 z-[90] flex justify-end" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/40 backdrop-blur-[2px]" onClick={onClose} />
      <motion.aside
        initial={{ x: "100%" }}
        animate={{ x: 0 }}
        exit={{ x: "100%" }}
        transition={{ type: "spring", stiffness: 300, damping: 34 }}
        className="relative flex h-full w-full max-w-[600px] flex-col bg-white shadow-[-30px_0_80px_-30px_rgba(10,15,31,0.5)]"
        role="dialog"
        aria-label={`${name} details`}
      >
        <div className="relative overflow-hidden bg-[linear-gradient(120deg,#0057ff,#1a82ff_60%,#6cbcff)] px-5 py-5 text-white">
          <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-white/25 blur-2xl" />
          <div className="relative flex items-start justify-between gap-3">
            <div className="min-w-0">
              <span className="rounded-md bg-white/20 px-2 py-0.5 font-mono text-xs font-bold">{train}</span>
              <h2 className="mt-1.5 truncate text-xl font-extrabold">{titleCase(name)}</h2>
              <p className="text-xs text-white/80">{from} → {to} · {new Date(date + "T00:00:00").toLocaleDateString("en-IN", { weekday: "short", day: "numeric", month: "short" })}</p>
            </div>
            <button onClick={onClose} aria-label="Close" className="rounded-xl p-2 text-white/80 hover:bg-white/15 hover:text-white"><X className="h-5 w-5" /></button>
          </div>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 pb-6">
          <TrainInsight bare train={train} from={from} to={to} date={date} initialTab={tab} />
        </div>
      </motion.aside>
    </motion.div>,
    document.body,
  );
}
