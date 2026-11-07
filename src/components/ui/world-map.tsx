"use client";
import { useRef } from "react";
import { motion, useInView } from "motion/react";

/**
 * Aceternity-style "World Map": dotted map + animated arcs from one hub.
 * Arc height scales with distance so routes fan out instead of overlapping; labelled
 * destinations; a small plane travels each arc once drawn.
 */
type Point = { lat: number; lng: number; label?: string };

const project = (lat: number, lng: number) => ({ x: (lng + 180) * (800 / 360), y: (90 - lat) * (400 / 180) });
function arc(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  const lift = Math.min(150, Math.max(28, dist * 0.42));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  // lift perpendicular to the chord, always towards the top of the map
  let nx = -dy / (dist || 1);
  let ny = dx / (dist || 1);
  if (ny > 0) {
    nx = -nx;
    ny = -ny;
  }
  return `M ${a.x} ${a.y} Q ${mx + nx * lift} ${my + ny * lift} ${b.x} ${b.y}`;
}

export function WorldMap({ mapSrc, hub, destinations, lineColor = "#ff5a1f" }: { mapSrc: string; hub: Point; destinations: Point[]; lineColor?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  const h = project(hub.lat, hub.lng);
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mapSrc} alt="" draggable={false} className="pointer-events-none h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]" />
      <svg ref={ref} viewBox="0 0 800 400" className="pointer-events-none absolute inset-0 h-full w-full select-none" aria-hidden>
        <defs>
          <linearGradient id="wm-line" x1="0" x2="1">
            <stop offset="0%" stopColor={lineColor} stopOpacity="0.9" />
            <stop offset="100%" stopColor="#5b5bf7" stopOpacity="0.9" />
          </linearGradient>
          <filter id="wm-glow"><feGaussianBlur stdDeviation="1.6" /></filter>
        </defs>
        {destinations.map((d, i) => {
          const b = project(d.lat, d.lng);
          const path = arc(h, b);
          const delay = 0.25 * i;
          return (
            <g key={d.label || i}>
              <motion.path d={path} fill="none" stroke={lineColor} strokeOpacity="0.25" strokeWidth="3.5" filter="url(#wm-glow)" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.4, delay, ease: "easeInOut" }} />
              <motion.path d={path} fill="none" stroke="url(#wm-line)" strokeWidth="1.3" strokeDasharray="4 3" initial={{ pathLength: 0 }} animate={inView ? { pathLength: 1 } : {}} transition={{ duration: 1.4, delay, ease: "easeInOut" }} />
              {inView && (
                <circle r="2.6" fill="white" stroke={lineColor} strokeWidth="1.4">
                  <animateMotion dur={`${4 + (i % 3)}s`} begin={`${(delay + 1.4).toFixed(2)}s`} repeatCount="indefinite" path={path} rotate="auto" />
                </circle>
              )}
              <circle cx={b.x} cy={b.y} r="2.6" fill="#5b5bf7" />
              <circle cx={b.x} cy={b.y} r="2.6" fill="#5b5bf7" opacity="0.5">
                <animate attributeName="r" from="2.5" to="9" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
                <animate attributeName="opacity" from="0.5" to="0" dur="2s" begin={`${delay}s`} repeatCount="indefinite" />
              </circle>
              {d.label && (
                <motion.g initial={{ opacity: 0 }} animate={inView ? { opacity: 1 } : {}} transition={{ delay: delay + 1.2 }}>
                  <rect x={b.x - d.label.length * 3.1 - 6} y={b.y - 21} width={d.label.length * 6.2 + 12} height="14" rx="7" fill="white" stroke="#e7e9f2" />
                  <text x={b.x} y={b.y - 11} textAnchor="middle" fontSize="8.5" fontWeight="700" fill="#0a0f1f" fontFamily="inherit">{d.label}</text>
                </motion.g>
              )}
            </g>
          );
        })}
        {/* hub */}
        <circle cx={h.x} cy={h.y} r="5" fill={lineColor} />
        <circle cx={h.x} cy={h.y} r="5" fill={lineColor} opacity="0.4">
          <animate attributeName="r" from="5" to="16" dur="1.8s" repeatCount="indefinite" />
          <animate attributeName="opacity" from="0.45" to="0" dur="1.8s" repeatCount="indefinite" />
        </circle>
        {hub.label && (
          <g>
            <rect x={h.x - 30} y={h.y + 9} width="60" height="15" rx="7.5" fill="#0a0f1f" />
            <text x={h.x} y={h.y + 19.5} textAnchor="middle" fontSize="8.5" fontWeight="800" fill="white" fontFamily="inherit">{hub.label}</text>
          </g>
        )}
      </svg>
    </div>
  );
}
