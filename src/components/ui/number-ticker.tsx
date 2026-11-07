"use client";
import { useEffect, useRef } from "react";
import { animate, useInView } from "motion/react";

/** Counts up to `value` once visible. */
export function NumberTicker({ value, suffix = "", prefix = "", className }: { value: number; suffix?: string; prefix?: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  useEffect(() => {
    if (!inView || !ref.current) return;
    const el = ref.current;
    const c = animate(0, value, { duration: 1.6, ease: "easeOut", onUpdate: (v) => (el.textContent = `${prefix}${Math.round(v).toLocaleString("en-IN")}${suffix}`) });
    return () => c.stop();
  }, [inView, value, prefix, suffix]);
  return <span ref={ref} className={className}>{prefix}0{suffix}</span>;
}
