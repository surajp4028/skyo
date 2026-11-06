"use client";
import { useState, type ReactNode } from "react";
import { motion, useMotionTemplate, useMotionValue } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Card Spotlight" — radial glow follows the cursor. */
export function CardSpotlight({ children, className, color = "rgba(255,90,31,0.18)", radius = 320 }: { children: ReactNode; className?: string; color?: string; radius?: number }) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const [hover, setHover] = useState(false);
  const bg = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, ${color}, transparent 80%)`;
  return (
    <div
      className={cn("group/spot relative overflow-hidden rounded-3xl border border-white/10 bg-ink-2 p-8", className)}
      onMouseMove={(e) => {
        const r = e.currentTarget.getBoundingClientRect();
        x.set(e.clientX - r.left);
        y.set(e.clientY - r.top);
      }}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
    >
      <motion.div className="pointer-events-none absolute -inset-px z-0 rounded-3xl transition duration-300" style={{ background: bg, opacity: hover ? 1 : 0 }} />
      <div className="relative z-10">{children}</div>
    </div>
  );
}
