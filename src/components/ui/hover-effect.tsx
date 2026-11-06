"use client";
import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Card Hover Effect" — a highlight that glides between cards. */
export function HoverEffect({
  items,
  className,
}: {
  items: { title: string; description: string; icon?: ReactNode; badge?: string; tone?: string }[];
  className?: string;
}) {
  const [hovered, setHovered] = useState<number | null>(null);
  return (
    <div className={cn("grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4", className)}>
      {items.map((item, idx) => (
        <div key={item.title} className="group relative block h-full w-full p-2" onMouseEnter={() => setHovered(idx)} onMouseLeave={() => setHovered(null)}>
          <AnimatePresence>
            {hovered === idx && (
              <motion.span
                className="absolute inset-0 block h-full w-full rounded-3xl bg-gradient-to-br from-brand/15 to-iris/15"
                layoutId="hoverBackground"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1, transition: { duration: 0.15 } }}
                exit={{ opacity: 0, transition: { duration: 0.15, delay: 0.2 } }}
              />
            )}
          </AnimatePresence>
          <div className="relative z-20 h-full overflow-hidden rounded-2xl border border-line bg-white p-6 shadow-soft transition group-hover:border-transparent">
            <div className={cn("mb-5 inline-flex h-12 w-12 items-center justify-center rounded-xl", item.tone || "bg-brand-soft text-brand")}>{item.icon}</div>
            {item.badge && <span className="absolute right-5 top-5 rounded-full bg-ink px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white">{item.badge}</span>}
            <h4 className="text-lg font-bold tracking-tight text-ink">{item.title}</h4>
            <p className="mt-2 text-sm leading-relaxed text-muted">{item.description}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
