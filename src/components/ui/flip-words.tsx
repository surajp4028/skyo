"use client";
import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Flip Words". */
export function FlipWords({ words, duration = 2600, className }: { words: string[]; duration?: number; className?: string }) {
  const [current, setCurrent] = useState(words[0]);
  const [animating, setAnimating] = useState(false);

  const next = useCallback(() => {
    setCurrent(words[(words.indexOf(current) + 1) % words.length]);
    setAnimating(true);
  }, [current, words]);

  useEffect(() => {
    if (animating) return;
    const t = setTimeout(next, duration);
    return () => clearTimeout(t);
  }, [animating, duration, next]);

  return (
    <AnimatePresence onExitComplete={() => setAnimating(false)}>
      <motion.span
        key={current}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 100, damping: 10 }}
        exit={{ opacity: 0, y: -40, x: 40, filter: "blur(8px)", scale: 2, position: "absolute" }}
        className={cn("relative z-10 inline-block text-left", className)}
      >
        {current.split("").map((ch, i) => (
          <motion.span
            key={current + i}
            initial={{ opacity: 0, y: 10, filter: "blur(8px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            transition={{ delay: i * 0.04, duration: 0.3 }}
            className="inline-block"
          >
            {ch === " " ? " " : ch}
          </motion.span>
        ))}
      </motion.span>
    </AnimatePresence>
  );
}
