"use client";
import { useEffect } from "react";
import { motion, stagger, useAnimate } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Text Generate Effect". */
export function TextGenerateEffect({ words, className }: { words: string; className?: string }) {
  const [scope, animate] = useAnimate();
  useEffect(() => {
    animate("span", { opacity: 1, filter: "blur(0px)" }, { duration: 0.5, delay: stagger(0.06) });
  }, [animate]);
  return (
    <motion.div ref={scope} className={cn(className)}>
      {words.split(" ").map((w, i) => (
        <motion.span key={w + i} className="opacity-0" style={{ filter: "blur(10px)" }}>
          {w}{" "}
        </motion.span>
      ))}
    </motion.div>
  );
}
