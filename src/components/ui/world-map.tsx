"use client";
import { useRef } from "react";
import { motion, useInView } from "motion/react";

/** Aceternity "World Map" — dotted map with animated great-circle-ish arcs. Map SVG is pre-rendered on the server. */
type Point = { lat: number; lng: number; label?: string };

const project = (lat: number, lng: number) => ({ x: (lng + 180) * (800 / 360), y: (90 - lat) * (400 / 180) });
const curve = (a: { x: number; y: number }, b: { x: number; y: number }) => {
  const midX = (a.x + b.x) / 2;
  const midY = Math.min(a.y, b.y) - Math.max(30, Math.abs(a.x - b.x) * 0.22);
  return `M ${a.x} ${a.y} Q ${midX} ${midY} ${b.x} ${b.y}`;
};

export function WorldMap({ mapSrc, dots, lineColor = "#ff5a1f" }: { mapSrc: string; dots: { start: Point; end: Point }[]; lineColor?: string }) {
  const ref = useRef<SVGSVGElement>(null);
  const inView = useInView(ref, { once: true, margin: "-120px" });
  return (
    <div className="relative aspect-[2/1] w-full overflow-hidden rounded-3xl">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={mapSrc} alt="" draggable={false} className="pointer-events-none h-full w-full select-none [mask-image:linear-gradient(to_bottom,transparent,white_10%,white_90%,transparent)]" />
      <svg ref={ref} viewBox="0 0 800 400" className="pointer-events-none absolute inset-0 h-full w-full select-none" aria-hidden>
        <defs>
          <linearGradient id="wm-grad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="white" stopOpacity="0" />
            <stop offset="5%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="95%" stopColor={lineColor} stopOpacity="1" />
            <stop offset="100%" stopColor="white" stopOpacity="0" />
          </linearGradient>
        </defs>
        {dots.map((d, i) => {
          const a = project(d.start.lat, d.start.lng);
          const b = project(d.end.lat, d.end.lng);
          return (
            <motion.path
              key={`p${i}`}
              d={curve(a, b)}
              fill="none"
              stroke="url(#wm-grad)"
              strokeWidth="1.2"
              initial={{ pathLength: 0 }}
              animate={inView ? { pathLength: 1 } : {}}
              transition={{ duration: 1.2, delay: 0.35 * i, ease: "easeOut" }}
            />
          );
        })}
        {dots.flatMap((d, i) =>
          [d.start, d.end].map((p, j) => {
            const { x, y } = project(p.lat, p.lng);
            return (
              <g key={`d${i}-${j}`}>
                <circle cx={x} cy={y} r="2.2" fill={lineColor} />
                <circle cx={x} cy={y} r="2.2" fill={lineColor} opacity="0.5">
                  <animate attributeName="r" from="2" to="8" dur="1.6s" begin={`${(i * 0.3).toFixed(1)}s`} repeatCount="indefinite" />
                  <animate attributeName="opacity" from="0.5" to="0" dur="1.6s" begin={`${(i * 0.3).toFixed(1)}s`} repeatCount="indefinite" />
                </circle>
              </g>
            );
          }),
        )}
      </svg>
    </div>
  );
}
