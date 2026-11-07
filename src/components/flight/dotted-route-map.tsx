"use client";
import { useEffect, useId, useState } from "react";
import { motion } from "motion/react";
import { api } from "@/lib/client/api";
import { cn } from "@/lib/utils";

type MapData = { map: { src: string; w: number; h: number; pins: Record<string, { x: number; y: number }> }; airports: { iata: string; city: string }[] };

/**
 * Aceternity-style dotted map zoomed to the route: glowing arc(s) that draw in, a plane gliding
 * along them, pulsing airports with labels and — when tracking — the live aircraft position.
 */
export function DottedRouteMap({ codes, live, progress, theme = "light", className }: { codes: string[]; live?: { lat: number; lon: number; direction?: number } | null; progress?: number | null; theme?: "light" | "dark"; className?: string }) {
  const id = useId().replace(/:/g, "");
  const key = `${codes.join(",")}|${live ? `${live.lat.toFixed(2)},${live.lon.toFixed(2)}` : ""}|${theme}`;
  const [state, setState] = useState<{ key: string; data?: MapData } | null>(null);
  useEffect(() => {
    let alive = true;
    const qs = new URLSearchParams({ codes: codes.join(","), theme, ...(live ? { live: `${live.lat},${live.lon}` } : {}) });
    api<MapData>(`/api/flight/map?${qs}`).then((d) => alive && setState({ key, data: d })).catch(() => alive && setState({ key }));
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const d = state?.key === key ? state.data : undefined;
  const dark = theme === "dark";
  if (!d) return <div className={cn("aspect-[16/10] w-full animate-pulse rounded-2xl", dark ? "bg-white/5" : "bg-sky-50", className)} />;
  const { w, h, pins } = d.map;
  const pts = codes.map((c) => ({ c, p: pins[c], city: d.airports.find((a) => a.iata === c)?.city || c })).filter((x) => x.p);
  const s = w / 100; // stroke / text scale relative to the SVG size
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const dx = b.p.x - a.p.x;
    const dy = b.p.y - a.p.y;
    const len = Math.hypot(dx, dy) || 1;
    let nx = -dy / len;
    let ny = dx / len;
    if (ny > 0) {
      nx = -nx;
      ny = -ny;
    }
    const lift = Math.min(len * 0.35, h * 0.3);
    const cx = (a.p.x + b.p.x) / 2 + nx * lift;
    const cy = (a.p.y + b.p.y) / 2 + ny * lift;
    return { d: `M${a.p.x},${a.p.y} Q${cx},${cy} ${b.p.x},${b.p.y}`, a: a.p, b: b.p, cx, cy };
  });
  const along = (t: number) => {
    const g = segs[0];
    return { x: (1 - t) ** 2 * g.a.x + 2 * (1 - t) * t * g.cx + t ** 2 * g.b.x, y: (1 - t) ** 2 * g.a.y + 2 * (1 - t) * t * g.cy + t ** 2 * g.b.y };
  };
  const plane = pins.LIVE ? pins.LIVE : progress != null && segs.length === 1 ? along(Math.min(1, Math.max(0, progress))) : null;
  const ink = dark ? "#ffffff" : "#0a0f1f";
  const planePath = "M-3,-0.8 L2.6,0 L-3,0.8 L-1.8,0 Z M-0.9,-2.6 L0.5,0 L-0.9,2.6 Z";

  return (
    <div className={cn("relative w-full overflow-hidden rounded-2xl", className)} style={{ aspectRatio: `${w} / ${h}` }}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={d.map.src} alt="" draggable={false} className="pointer-events-none absolute inset-0 h-full w-full select-none [mask-image:radial-gradient(ellipse_75%_70%_at_50%_50%,black_55%,transparent_100%)]" />
      <svg viewBox={`0 0 ${w} ${h}`} className="absolute inset-0 h-full w-full" role="img" aria-label={`Route ${codes.join(" to ")}`}>
        <defs>
          <linearGradient id={`l${id}`} x1="0" x2="1"><stop offset="0" stopColor="#0ea5e9" /><stop offset="1" stopColor="#6366f1" /></linearGradient>
          <filter id={`b${id}`}><feGaussianBlur stdDeviation={0.6 * s} /></filter>
        </defs>
        {segs.map((g, i) => (
          <g key={i}>
            <motion.path d={g.d} fill="none" stroke="#38bdf8" strokeOpacity="0.35" strokeWidth={1.6 * s} filter={`url(#b${id})`} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, delay: i * 0.4, ease: "easeInOut" }} />
            <motion.path d={g.d} fill="none" stroke={`url(#l${id})`} strokeWidth={0.55 * s} strokeDasharray={`${1.6 * s} ${1.1 * s}`} strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.3, delay: i * 0.4, ease: "easeInOut" }} />
            {!plane && (
              <g>
                <animateMotion dur={`${4.5 + i}s`} begin="1.3s" repeatCount="indefinite" rotate="auto" path={g.d} />
                <g transform={`scale(${s})`}><path d={planePath} fill={ink} /></g>
              </g>
            )}
          </g>
        ))}
        {plane && (
          <g transform={`translate(${plane.x},${plane.y})`}>
            <circle r={3 * s} fill="#38bdf8" opacity="0.25">
              <animate attributeName="r" values={`${2 * s};${4 * s};${2 * s}`} dur="2s" repeatCount="indefinite" />
            </circle>
            <g transform={`rotate(${(live?.direction ?? 0) - 90}) scale(${s * 1.3})`}><path d={planePath} fill={ink} /></g>
          </g>
        )}
        {pts.map(({ c, p, city }, i) => {
          const end = i === 0 || i === pts.length - 1;
          const label = `${city} · ${c}`;
          const lw = label.length * 1.15 * s + 3 * s;
          const below = p.y < h * 0.22;
          return (
            <g key={c} transform={`translate(${p.x},${p.y})`}>
              <circle r={1.1 * s} fill={end ? "#0ea5e9" : "#f59e0b"}>
                <animate attributeName="r" values={`${1.1 * s};${3.2 * s}`} dur="2s" repeatCount="indefinite" />
                <animate attributeName="opacity" values="0.5;0" dur="2s" repeatCount="indefinite" />
              </circle>
              <circle r={1.1 * s} fill={end ? "#0ea5e9" : "#f59e0b"} stroke={dark ? "#0b1020" : "#fff"} strokeWidth={0.45 * s} />
              <g transform={`translate(0,${below ? 4.6 * s : -4.6 * s})`}>
                <rect x={-lw / 2} y={-2.1 * s} width={lw} height={4.2 * s} rx={2.1 * s} fill={dark ? "#0b1020" : "#ffffff"} stroke={dark ? "#ffffff30" : "#e7e9f2"} strokeWidth={0.2 * s} />
                <text y={0.75 * s} textAnchor="middle" fontSize={2.1 * s} fontWeight="800" fill={ink} fontFamily="inherit">{label}</text>
              </g>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
