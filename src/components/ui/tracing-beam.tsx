"use client";
import { useEffect, useRef, useState, type ReactNode, type RefObject } from "react";
import { motion, useScroll, useSpring, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/**
 * Aceternity "Tracing Beam" — a gradient beam that fills as you scroll.
 * Works with the page scroll or with a scrollable container (pass `container`).
 */
export function TracingBeam({ children, className, container }: { children: ReactNode; className?: string; container?: RefObject<HTMLElement | null> }) {
  const ref = useRef<HTMLDivElement>(null);
  const content = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!content.current) return;
    const ro = new ResizeObserver(() => setH(content.current?.offsetHeight || 0));
    ro.observe(content.current);
    return () => ro.disconnect();
  }, []);
  const { scrollYProgress } = useScroll(container ? { container, target: ref, offset: ["start start", "end end"] } : { target: ref, offset: ["start 30%", "end 70%"] });
  const y1 = useSpring(useTransform(scrollYProgress, [0, 0.8], [40, h]), { stiffness: 500, damping: 90 });
  const y2 = useSpring(useTransform(scrollYProgress, [0, 1], [10, h - 160]), { stiffness: 500, damping: 90 });
  return (
    <motion.div ref={ref} className={cn("relative w-full", className)}>
      <div className="absolute left-[78px] top-2 hidden sm:block" aria-hidden>
        <svg viewBox={`0 0 20 ${h}`} width="20" height={h} className="block">
          <path d={`M 1 0 V ${h}`} fill="none" stroke="#e7e9f2" strokeWidth="3" />
          <motion.path d={`M 1 0 V ${h}`} fill="none" stroke="url(#beam-grad)" strokeWidth="3" className="motion-reduce:hidden" />
          <defs>
            <motion.linearGradient id="beam-grad" gradientUnits="userSpaceOnUse" x1="0" x2="0" y1={y1} y2={y2}>
              <stop stopColor="#ff5a1f" stopOpacity="0" />
              <stop stopColor="#ff5a1f" />
              <stop offset="0.4" stopColor="#ff8a3d" />
              <stop offset="1" stopColor="#5b5bf7" stopOpacity="0" />
            </motion.linearGradient>
          </defs>
        </svg>
      </div>
      <div ref={content}>{children}</div>
    </motion.div>
  );
}
