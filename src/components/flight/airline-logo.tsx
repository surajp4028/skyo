import { airlineInfo } from "@/lib/flight/airlines";
import { cn } from "@/lib/utils";

/** Brand-coloured airline mark (no third-party logo files). */
export function AirlineLogo({ iata, name, size = 40, className }: { iata: string; name?: string | null; size?: number; className?: string }) {
  const a = airlineInfo(iata, name);
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
