"use client";
import { useRef, type ComponentPropsWithoutRef, type ReactNode } from "react";
import { motion, useAnimationFrame, useMotionTemplate, useMotionValue, useTransform } from "motion/react";
import { cn } from "@/lib/utils";

/** Aceternity "Moving Border" button. */
export function MovingBorderButton({
  children,
  className,
  containerClassName,
  duration = 3000,
  as: As = "button",
  ...rest
}: { children: ReactNode; className?: string; containerClassName?: string; duration?: number; as?: "button" | "a" } & ComponentPropsWithoutRef<"button"> &
  ComponentPropsWithoutRef<"a">) {
  const Comp = As as "button";
  return (
    <Comp className={cn("relative overflow-hidden rounded-2xl bg-transparent p-[1.5px]", containerClassName)} {...(rest as ComponentPropsWithoutRef<"button">)}>
      <div className="absolute inset-0 rounded-2xl">
        <MovingBorder duration={duration} rx="16" ry="16">
          <div className="h-16 w-16 bg-[radial-gradient(#ff8a3d_40%,transparent_60%)] opacity-90" />
        </MovingBorder>
      </div>
      <div className={cn("relative flex h-full w-full items-center justify-center rounded-[15px] border border-white/10 bg-ink/90 px-6 py-3 text-sm font-semibold text-white backdrop-blur-xl", className)}>
        {children}
      </div>
    </Comp>
  );
}

function MovingBorder({ children, duration = 3000, rx, ry }: { children: ReactNode; duration?: number; rx?: string; ry?: string }) {
  const pathRef = useRef<SVGRectElement>(null);
  const progress = useMotionValue(0);
  useAnimationFrame((time) => {
    const length = pathRef.current?.getTotalLength();
    if (length) progress.set((time * (length / duration)) % length);
  });
  const x = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).x ?? 0);
  const y = useTransform(progress, (v) => pathRef.current?.getPointAtLength(v).y ?? 0);
  const transform = useMotionTemplate`translateX(${x}px) translateY(${y}px) translateX(-50%) translateY(-50%)`;
  return (
    <>
      <svg xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="none" className="absolute h-full w-full" width="100%" height="100%" aria-hidden>
        <rect fill="none" width="100%" height="100%" rx={rx} ry={ry} ref={pathRef} />
      </svg>
      <motion.div style={{ position: "absolute", top: 0, left: 0, display: "inline-block", transform }}>{children}</motion.div>
    </>
  );
}
