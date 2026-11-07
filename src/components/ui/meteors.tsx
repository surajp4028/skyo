"use client";
import { cn } from "@/lib/utils";

/** Aceternity "Meteors" — diagonal shooting streaks for dark hero cards. */
export function Meteors({ number = 18, className }: { number?: number; className?: string }) {
  // deterministic pseudo-random (same on server + client → no hydration mismatch)
  const meteors = Array.from({ length: number }, (_, i) => {
    const r = (n: number) => ((Math.sin(i * 9301 + n * 49297) + 1) / 2) % 1;
    return { left: Math.floor(r(1) * 900 - 300), delay: Number((r(2) * 1.2 + 0.2).toFixed(2)), dur: Math.floor(r(3) * 6 + 3) };
  });
  return (
    <>
      {meteors.map((m, i) => (
        <span
          key={i}
          className={cn(
            "pointer-events-none absolute left-1/2 top-0 h-0.5 w-0.5 rotate-[215deg] animate-[meteor_linear_infinite] rounded-full bg-slate-400 shadow-[0_0_0_1px_#ffffff10]",
            "before:absolute before:top-1/2 before:h-px before:w-[60px] before:-translate-y-1/2 before:bg-gradient-to-r before:from-[#ffb36b] before:to-transparent before:content-['']",
            className,
          )}
          style={{ top: 0, left: `${m.left}px`, animationDelay: `${m.delay}s`, animationDuration: `${m.dur}s` }}
        />
      ))}
    </>
  );
}
