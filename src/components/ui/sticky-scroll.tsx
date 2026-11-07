"use client";
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Sticky Scroll Reveal" (page-scroll version): text steps on the left, a sticky visual on the right. */
export function StickyScroll({ steps }: { steps: { title: string; description: string; tag: string; visual: ReactNode; tone: string }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start 55%", "end 55%"] });
  useMotionValueEvent(scrollYProgress, "change", (p) => setActive(Math.min(steps.length - 1, Math.max(0, Math.floor(p * steps.length)))));
  return (
    <div ref={ref} className="relative mx-auto grid max-w-6xl gap-10 px-5 lg:grid-cols-2">
      <div>
        {steps.map((s, i) => (
          <div key={s.title} className="flex min-h-[62vh] flex-col justify-center py-10">
            <motion.div animate={{ opacity: active === i ? 1 : 0.28, x: active === i ? 0 : -6 }} transition={{ duration: 0.35 }}>
              <span className={cn("inline-flex rounded-full px-3 py-1 text-xs font-extrabold text-white", s.tone)}>{s.tag}</span>
              <h3 className="mt-4 text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{s.title}</h3>
              <p className="mt-3 max-w-md text-lg leading-relaxed text-muted">{s.description}</p>
            </motion.div>
            <div className="mt-6 lg:hidden">{s.visual}</div>
          </div>
        ))}
      </div>
      <div className="hidden lg:block">
        <div className="sticky top-[18vh] h-[64vh]">
          <AnimatePresence mode="wait">
            <motion.div key={active} initial={{ opacity: 0, y: 30, scale: 0.97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -30, scale: 0.97 }} transition={{ duration: 0.35 }} className="h-full">
              {steps[active].visual}
            </motion.div>
          </AnimatePresence>
          <div className="absolute -left-6 top-1/2 flex -translate-y-1/2 flex-col gap-2">
            {steps.map((s, i) => <span key={s.title} className={cn("h-2 w-2 rounded-full transition-all", active === i ? "h-6 bg-brand" : "bg-ink/15")} />)}
          </div>
        </div>
      </div>
    </div>
  );
}
