"use client";
import { useEffect, useRef } from "react";
import { motion } from "motion/react";
import { cn } from "@/lib/utils";

/** 6-box OTP input with paste, autofill (one-time-code), arrows & backspace. */
export function OtpInput({ value, onChange, onComplete, disabled, error }: { value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; disabled?: boolean; error?: boolean }) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  useEffect(() => {
    if (!disabled && value === "") refs.current[0]?.focus();
  }, [disabled, value, error]);
  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };
  return (
    <motion.div className="flex justify-between gap-2" animate={error ? { x: [0, -8, 8, -6, 6, 0] } : {}} transition={{ duration: 0.4 }}>
      {Array.from({ length: 6 }).map((_, i) => (
        <input
          key={i}
          ref={(el) => {
            refs.current[i] = el;
          }}
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${i + 1}`}
          maxLength={6}
          disabled={disabled}
          value={value[i] || ""}
          onChange={(e) => {
            const v = e.target.value.replace(/\D/g, "");
            if (v.length > 1) {
              set(v);
              refs.current[Math.min(5, v.length)]?.focus();
              return;
            }
            const arr = value.padEnd(6, " ").split("");
            arr[i] = v || " ";
            set(arr.join("").replace(/\s+$/g, "").replace(/ /g, ""));
            if (v && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !value[i] && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowLeft" && i > 0) refs.current[i - 1]?.focus();
            if (e.key === "ArrowRight" && i < 5) refs.current[i + 1]?.focus();
          }}
          className={cn(
            "h-14 w-full min-w-0 rounded-xl border-2 bg-white text-center text-xl font-bold text-ink outline-none transition",
            "focus:border-brand focus:ring-4 focus:ring-brand/15",
            value[i] ? "border-ink/20" : "border-line",
            error && "border-red-400",
          )}
        />
      ))}
    </motion.div>
  );
}
