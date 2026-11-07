"use client";
import { useId } from "react";
import { airportByCode } from "@/lib/flight/airports";
import { cn } from "@/lib/utils";

type Pt = { iata: string; lat: number; lon: number };

/**
 * Stylised great-circle-ish route map (SVG, no map tiles): origin → (hub) → destination,
 * a plane gliding along the arc, and — when tracking — the live position.
 */
export function RouteMap({ codes, live, progress, className, dark = true }: { codes: string[]; live?: { lat: number; lon: number; direction?: number } | null; progress?: number | null; className?: string; dark?: boolean }) {
  const id = useId().replace(/:/g, "");
  const pts = codes.map((c) => airportByCode(c)).filter(Boolean).map((a) => ({ iata: a!.iata, lat: a!.lat, lon: a!.lon })) as Pt[];
  if (pts.length < 2) return null;
  const W = 400;
  const H = 210;
  const pad = 46;
  const lats = [...pts.map((p) => p.lat), ...(live ? [live.lat] : [])];
  const lons = [...pts.map((p) => p.lon), ...(live ? [live.lon] : [])];
  let [minLat, maxLat, minLon, maxLon] = [Math.min(...lats), Math.max(...lats), Math.min(...lons), Math.max(...lons)];
  // keep a sensible aspect so short hops don't look like a straight vertical line
  const span = Math.max(maxLat - minLat, (maxLon - minLon) * 0.55, 2.5);
  const cLat = (minLat + maxLat) / 2;
  const cLon = (minLon + maxLon) / 2;
  minLat = cLat - span / 2;
  maxLat = cLat + span / 2;
  minLon = cLon - span / 1.1;
  maxLon = cLon + span / 1.1;
  const x = (lon: number) => pad + ((lon - minLon) / (maxLon - minLon)) * (W - pad * 2);
  const y = (lat: number) => H - pad + 10 - ((lat - minLat) / (maxLat - minLat)) * (H - pad * 2);
  const segs = pts.slice(1).map((b, i) => {
    const a = pts[i];
    const [x1, y1, x2, y2] = [x(a.lon), y(a.lat), x(b.lon), y(b.lat)];
    const dx = x2 - x1;
    const dy = y2 - y1;
    const len = Math.hypot(dx, dy) || 1;
    const bow = Math.min(70, len * 0.32);
    // bow the arc to the side that curves upwards (like a great circle on a flat map)
    const nx = -dy / len;
    const ny = dx / len;
    const sign = ny > 0 ? -1 : 1;
    const cx = (x1 + x2) / 2 + nx * bow * sign;
    const cy = (y1 + y2) / 2 + ny * bow * sign;
    return { d: `M${x1},${y1} Q${cx},${cy} ${x2},${y2}`, x1, y1, x2, y2, cx, cy };
  });
  const along = (s: (typeof segs)[number], t: number) => ({
    px: (1 - t) ** 2 * s.x1 + 2 * (1 - t) * t * s.cx + t ** 2 * s.x2,
    py: (1 - t) ** 2 * s.y1 + 2 * (1 - t) * t * s.cy + t ** 2 * s.y2,
  });
  const livePt = live ? { px: x(live.lon), py: y(live.lat) } : progress != null && segs.length === 1 ? along(segs[0], Math.min(1, Math.max(0, progress))) : null;
  const ink = dark ? "#ffffff" : "#0a0f1f";
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className={cn("h-auto w-full", className)} role="img" aria-label={`Route ${codes.join(" to ")}`}>
      <defs>
        <linearGradient id={`g${id}`} x1="0" x2="1">
          <stop offset="0" stopColor="#38bdf8" />
          <stop offset="1" stopColor="#a78bfa" />
        </linearGradient>
        <radialGradient id={`r${id}`}>
          <stop offset="0" stopColor="#38bdf8" stopOpacity="0.7" />
          <stop offset="1" stopColor="#38bdf8" stopOpacity="0" />
        </radialGradient>
        <pattern id={`p${id}`} width="14" height="14" patternUnits="userSpaceOnUse">
          <circle cx="1.2" cy="1.2" r="1.2" fill={ink} opacity={dark ? 0.08 : 0.07} />
        </pattern>
      </defs>
      <rect width={W} height={H} fill={`url(#p${id})`} />
      {segs.map((s, i) => (
        <g key={i}>
          <path d={s.d} fill="none" stroke={`url(#g${id})`} strokeWidth="6" opacity="0.18" strokeLinecap="round" />
          <path d={s.d} fill="none" stroke={`url(#g${id})`} strokeWidth="2" strokeDasharray="5 6" strokeLinecap="round">
            <animate attributeName="stroke-dashoffset" from="22" to="0" dur="1.2s" repeatCount="indefinite" />
          </path>
          {!livePt && (
            <g>
              <path d="M-7,-2 L6,0 L-7,2 L-4,0 Z M-2,-6 L1,0 L-2,6 Z" fill={ink}>
                <animateMotion dur={`${4 + i}s`} repeatCount="indefinite" rotate="auto" path={s.d} />
              </path>
            </g>
          )}
        </g>
      ))}
      {livePt && (
        <g transform={`translate(${livePt.px},${livePt.py})`}>
          <circle r="16" fill={`url(#r${id})`}>
            <animate attributeName="r" values="10;18;10" dur="2s" repeatCount="indefinite" />
          </circle>
          <g transform={`rotate(${(live?.direction ?? 0) - 90})`}>
            <path d="M-9,-2.5 L8,0 L-9,2.5 L-5,0 Z M-3,-8 L1,0 L-3,8 Z" fill={ink} />
          </g>
        </g>
      )}
      {pts.map((p, i) => {
        const end = i === 0 || i === pts.length - 1;
        return (
          <g key={p.iata} transform={`translate(${x(p.lon)},${y(p.lat)})`}>
            <circle r={end ? 9 : 6} fill={`url(#r${id})`} />
            <circle r={end ? 4.5 : 3.5} fill={end ? "#38bdf8" : "#fbbf24"} stroke={dark ? "#0b1020" : "#fff"} strokeWidth="2" />
            <text y={-12} textAnchor="middle" fontSize="12" fontWeight="800" fill={ink} style={{ letterSpacing: 1 }}>{p.iata}</text>
          </g>
        );
      })}
    </svg>
  );
}
