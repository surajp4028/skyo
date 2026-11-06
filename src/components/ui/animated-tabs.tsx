"use client";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

/** Aceternity-style animated tabs (shared-layout pill). */
export function AnimatedTabs<T extends string>({
  tabs,
  value,
  onChange,
  layoutId = "tab-pill",
  className,
  pillClassName,
  tabClassName,
  activeTextClassName = "text-white",
}: {
  tabs: { value: T; label: string; icon?: ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  layoutId?: string;
  className?: string;
  pillClassName?: string;
  tabClassName?: string;
  activeTextClassName?: string;
}) {
  return (
    <div role="tablist" className={cn("relative flex items-center gap-1 overflow-x-auto no-scrollbar", className)}>
      {tabs.map((t) => {
        const active = t.value === value;
        return (
          <button
            key={t.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onChange(t.value)}
            className={cn("relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors", active ? activeTextClassName : "text-muted hover:text-ink", tabClassName)}
            style={{ transformStyle: "preserve-3d" }}
          >
            {active && (
              <motion.span layoutId={layoutId} transition={{ type: "spring", bounce: 0.25, duration: 0.55 }} className={cn("absolute inset-0 rounded-full bg-ink", pillClassName)} />
            )}
            <span className="relative z-10 flex items-center gap-2">
              {t.icon}
              {t.label}
            </span>
          </button>
        );
      })}
    </div>
  );
}
