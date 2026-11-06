import { cn } from "@/lib/utils";

/** Aceternity "Aurora Background" layer (place inside a relative container). */
export function Aurora({ className }: { className?: string }) {
  return (
    <div aria-hidden className={cn("pointer-events-none absolute inset-0 overflow-hidden", className)}>
      <div
        className="absolute -inset-[10px] opacity-60 blur-[10px] will-change-transform animate-aurora [mask-image:radial-gradient(ellipse_at_100%_0%,black_10%,transparent_70%)]"
        style={{
          backgroundImage:
            "repeating-linear-gradient(100deg,#0a0f1f 0%,#0a0f1f 7%,transparent 10%,transparent 12%,#0a0f1f 16%),repeating-linear-gradient(100deg,#ff5a1f 10%,#5b5bf7 15%,#ff8a3d 20%,#38bdf8 25%,#7c3aed 30%)",
          backgroundSize: "300%, 200%",
          backgroundPosition: "50% 50%, 50% 50%",
        }}
      />
    </div>
  );
}
