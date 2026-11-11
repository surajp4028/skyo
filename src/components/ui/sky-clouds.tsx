"use client";

type SkyCloudsProps = {
  className?: string;
  variant?: "hero" | "window";
};

/** Lightweight CSS clouds shared by the home hero and the flight window. */
export function SkyClouds({ className = "", variant = "hero" }: SkyCloudsProps) {
  const clouds = [
    { top: "16%", w: variant === "hero" ? 220 : 190, dur: 75, delay: -10, op: 0.95 },
    { top: "34%", w: variant === "hero" ? 300 : 250, dur: 100, delay: -45, op: 0.9 },
    { top: "58%", w: variant === "hero" ? 260 : 210, dur: 85, delay: -25, op: 0.95 },
    { top: "70%", w: variant === "hero" ? 380 : 300, dur: 120, delay: -80, op: 0.9 },
  ];

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
      {clouds.map((cloud, i) => (
        <div key={i} className="absolute left-0 animate-[drift_var(--d)_linear_infinite]" style={{ top: cloud.top, ["--d" as string]: `${cloud.dur}s`, animationDelay: `${cloud.delay}s`, opacity: cloud.op }}>
          <div className="relative" style={{ width: cloud.w, height: cloud.w * 0.32 }}>
            <span className="absolute bottom-0 left-0 h-[58%] w-full rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-[22%] left-[16%] h-[85%] w-[40%] rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-[28%] left-[44%] h-[105%] w-[38%] rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-0 left-[6%] h-[30%] w-[88%] rounded-full bg-sky-100/70 blur-[3px]" />
          </div>
        </div>
      ))}
    </div>
  );
}
