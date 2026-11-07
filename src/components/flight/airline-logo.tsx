"use client";
import { useState } from "react";
import { airlineInfo } from "@/lib/flight/airlines";
import { cn } from "@/lib/utils";

/** Square airline icon (pics.avs.io); falls back to a brand-coloured code badge if the image can't load. */
export function AirlineLogo({ iata, name, size = 40, className }: { iata: string; name?: string | null; size?: number; className?: string }) {
  const a = airlineInfo(iata, name);
  const [failed, setFailed] = useState(false);
  const px = size <= 32 ? 64 : 96;
  if (!failed && /^[A-Z0-9]{2}$/.test(a.iata)) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={`https://pics.avs.io/al_square/${px}/${px}/${a.iata}@2x.png`}
        alt={a.name}
        title={a.name}
        width={size}
        height={size}
        loading="lazy"
        onError={() => setFailed(true)}
        className={cn("shrink-0 rounded-xl bg-white object-cover shadow-[0_2px_8px_-2px_rgba(10,15,31,0.25)]", className)}
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <span
      className={cn("relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-xl font-black tracking-tight shadow-[inset_0_-8px_16px_rgba(0,0,0,0.15)]", className)}
      style={{ width: size, height: size, background: `linear-gradient(140deg, ${a.color}, ${a.color}cc)`, color: a.ink, fontSize: size * 0.34 }}
      title={a.name}
      aria-label={a.name}
    >
      <span className="absolute -right-2 -top-3 h-[70%] w-[70%] rotate-12 rounded-full bg-white/15" />
      <span className="relative">{a.iata}</span>
    </span>
  );
}
