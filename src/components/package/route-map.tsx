"use client";
import { useId, useMemo, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { BusFront, Map as MapIcon, Mountain, Navigation, Route as RouteIcon, ShieldCheck } from "lucide-react";
import type { PackageDay } from "@/lib/packages";
import { kmBetween } from "@/lib/place-coords";
import { cn } from "@/lib/utils";

const defaultStops = ["Haridwar", "Rudraprayag", "Guptkashi", "Kedarnath"];

export type PackageGeoProp = {
  india: { src: string; w: number; h: number; box: { x: number; y: number; w: number; h: number } };
  stops: { name: string; lat: number; lon: number }[];
} | null;

/**
 * Route card for a package. Two layouts, switched from the top-right corner:
 *   Route — the stylised route with a moving Mini Traveller
 *   Map   — stops at their real positions, an India locator and a stop-by-stop list with days and distances
 */
export function KedarnathRouteMap({ destinations = defaultStops, itinerary = [], geo = null }: { destinations?: string[]; itinerary?: PackageDay[]; geo?: PackageGeoProp }) {
  const [view, setView] = useState<"route" | "map">("route");
  const hasMap = !!geo && geo.stops.length >= 2;
  return (
    <div className="relative isolate overflow-hidden rounded-[28px] border border-line bg-white text-ink shadow-[0_24px_60px_-38px_rgba(20,40,80,.45)]">
      <div className="absolute inset-0 opacity-[.5] [background-image:radial-gradient(#cfe0f5_1px,transparent_1px)] [background-size:15px_15px] [mask-image:radial-gradient(ellipse_at_center,black,transparent_82%)]" />
      <div className="absolute -right-10 -top-24 h-64 w-64 rounded-full bg-sky-200/50 blur-3xl" />
      <div className="absolute -bottom-24 left-1/3 h-56 w-56 rounded-full bg-orange-200/40 blur-3xl" />

      <div className="relative flex flex-wrap items-start justify-between gap-3 px-5 pt-5 sm:px-7 sm:pt-7">
        <div>
          <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand"><span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" /> The mountain route</div>
          <h2 className="mt-1.5 text-xl font-extrabold tracking-tight sm:text-2xl">{view === "map" ? "Where every stop sits" : "Every stop, along the way"}</h2>
        </div>
        {hasMap ? (
          <div role="tablist" aria-label="Map layout" className="relative flex rounded-full border border-line bg-surface p-1 text-[11px] font-bold backdrop-blur">
            {([["route", "Route", RouteIcon], ["map", "Map view", MapIcon]] as const).map(([k, label, Icon]) => (
              <button key={k} role="tab" aria-selected={view === k} type="button" onClick={() => setView(k)} className={cn("relative flex items-center gap-1.5 rounded-full px-3 py-1.5 transition", view === k ? "text-white" : "text-ink/60 hover:text-ink")}>
                {view === k && <motion.span layoutId="pkg-map-view" className="absolute inset-0 rounded-full bg-ink" transition={{ type: "spring", stiffness: 380, damping: 30 }} />}
                <Icon className="relative h-3.5 w-3.5" /> <span className="relative">{label}</span>
              </button>
            ))}
          </div>
        ) : (
          <span className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3 py-1.5 text-[10px] font-bold text-ink/70"><BusFront className="h-3.5 w-3.5 text-orange-300" /> Road journey · trek where required</span>
        )}
      </div>

      <AnimatePresence mode="wait" initial={false}>
        {view === "map" && hasMap ? (
          <motion.div key="map" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <GeoView geo={geo!} itinerary={itinerary} />
          </motion.div>
        ) : (
          <motion.div key="route" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -6 }} transition={{ duration: 0.3 }}>
            <RouteView destinations={destinations} />
          </motion.div>
        )}
      </AnimatePresence>

      <div className="relative grid grid-cols-3 border-t border-line bg-surface/70 px-5 py-4 text-[10px] sm:px-7">
        <div className="flex items-center gap-2 text-ink/70"><BusFront className="h-4 w-4 text-orange-500" /><span>Road journey</span></div>
        <div className="flex items-center justify-center gap-2 text-ink/70"><Mountain className="h-4 w-4 text-sky-500" /><span>Uphill trek</span></div>
        <div className="flex items-center justify-end gap-2 text-ink/70"><ShieldCheck className="h-4 w-4 text-emerald-500" /><span>Weather aware</span></div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ route (schematic) */

function RouteView({ destinations }: { destinations: string[] }) {
  const uid = useId().replace(/:/g, "");
  const names = destinations.length > 1 ? destinations : defaultStops;
  const last = names.length - 1;
  const stops = names.map((name, i) => ({
    x: 90 + i * (820 / last),
    y: [274, 164, 226, 74, 188, 110][i % 6],
    name,
    meta: i === 0 ? "START" : i === last ? (name.toLowerCase().includes("kedarnath") ? "TREK · 3,583 M" : "FINAL STOP") : "ROUTE STOP",
  }));
  const route = stops.slice(1).reduce((path, b, i) => {
    const a = stops[i];
    const mid = (a.x + b.x) / 2;
    return `${path} C ${mid} ${a.y}, ${mid} ${b.y}, ${b.x} ${b.y}`;
  }, `M ${stops[0].x} ${stops[0].y}`);
  const color = (i: number) => (i === 0 ? "#fb923c" : i === last ? "#c4b5fd" : "#38bdf8");
  return (
    <div className="relative px-1 pb-2 pt-3 sm:px-4">
      <svg viewBox="0 0 1000 360" className="h-auto w-full" aria-label={`Route from ${names[0]} to ${names[last]}`}>
        <defs>
          <linearGradient id={`${uid}-route`} x1="0" x2="1"><stop stopColor="#fb923c" /><stop offset=".58" stopColor="#38bdf8" /><stop offset="1" stopColor="#c4b5fd" /></linearGradient>
          <filter id={`${uid}-glow`}><feGaussianBlur stdDeviation="5" /></filter>
        </defs>
        <path d="M0 308 Q100 250 170 303 T340 280 T510 304 T710 277 T1000 310" fill="none" stroke="#7aa7e0" strokeOpacity=".22" strokeWidth="2" />
        <path d="M0 328 Q130 270 240 328 T480 310 T740 327 T1000 290" fill="none" stroke="#7aa7e0" strokeOpacity=".16" strokeWidth="2" />
        <path d="M640 145 L738 34 L821 142 L884 18 L1000 164 L1000 360 L620 360Z" fill="#bcd6f5" fillOpacity=".35" />
        <path d={route} fill="none" stroke="#38bdf8" strokeOpacity=".28" strokeWidth="12" filter={`url(#${uid}-glow)`} />
        <motion.path d={route} fill="none" stroke={`url(#${uid}-route)`} strokeWidth="4" strokeDasharray="9 10" strokeLinecap="round" initial={{ pathLength: 0 }} whileInView={{ pathLength: 1 }} viewport={{ once: true }} transition={{ duration: 2.4, ease: "easeInOut" }} />
        <g>
          <circle r="17" fill="#fb923c" fillOpacity=".16"><animate attributeName="r" values="11;22;11" dur="2.4s" repeatCount="indefinite" /></circle>
          <BusFront x="-11" y="-11" width="22" height="22" stroke="#fff" fill="#fb923c" strokeWidth="1.6" />
          <animateMotion dur="12s" repeatCount="indefinite" rotate="auto" path={route} />
        </g>
        {stops.map((p, i) => (
          <g key={p.name}>
            <circle cx={p.x} cy={p.y} r="10" fill={color(i)} fillOpacity=".18" />
            <circle cx={p.x} cy={p.y} r="5" fill={color(i)} stroke="#ffffff" strokeWidth="2" />
            <text x={p.x} y={p.y + (i === last ? 27 : -18)} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize="14" fontWeight="800" fill="#0a0f1f" fontFamily="inherit">{p.name}</text>
            <text x={p.x} y={p.y + (i === last ? 42 : -4)} textAnchor={i === 0 ? "start" : i === last ? "end" : "middle"} fontSize="8" fontWeight="700" letterSpacing="1.4" fill="#6b7280" fontFamily="inherit">{p.meta}</text>
          </g>
        ))}
      </svg>
    </div>
  );
}

/* ------------------------------------------------------------------ map (real positions) */

const W = 600;
const H = 380;

function GeoView({ geo, itinerary }: { geo: NonNullable<PackageGeoProp>; itinerary: PackageDay[] }) {
  const uid = useId().replace(/:/g, "");
  const { pts, segs, total, kmPerPx } = useMemo(() => {
    const lats = geo.stops.map((s) => s.lat);
    const lons = geo.stops.map((s) => s.lon);
    const midLat = (Math.min(...lats) + Math.max(...lats)) / 2;
    const kx = Math.cos((midLat * Math.PI) / 180); // squash longitude so the map isn't stretched
    const spanX = Math.max(0.05, (Math.max(...lons) - Math.min(...lons)) * kx);
    const spanY = Math.max(0.05, Math.max(...lats) - Math.min(...lats));
    const pad = 70;
    const scale = Math.min((W - pad * 2) / spanX, (H - pad * 2) / spanY);
    const cx = (Math.min(...lons) + Math.max(...lons)) / 2;
    const cy = midLat;
    const pts = geo.stops.map((s) => ({ ...s, x: W / 2 + (s.lon - cx) * kx * scale, y: H / 2 - (s.lat - cy) * scale }));
    const segs = pts.slice(1).map((b, i) => ({ a: pts[i], b, km: kmBetween([pts[i].lat, pts[i].lon], [b.lat, b.lon]) }));
    const total = segs.reduce((t, s) => t + s.km, 0);
    return { pts, segs, total, kmPerPx: 111 / scale };
  }, [geo]);

  // label placement: nearby stops (e.g. Chopta → Tungnath → Chandrashila, <1 km apart) get stacked labels
  const labels = pts.map((p) => ({ x: p.x, y: p.y - 8, show: true, anchorRight: p.x < W - 120 }));
  pts.forEach((p, i) => {
    const near = pts.slice(0, i).filter((q) => Math.hypot(q.x - p.x, q.y - p.y) < 34).length;
    if (near > 0) {
      labels[i].y = p.y - 8 + near * 16 + 14;
      labels[i].x = p.x;
    }
  });
  // smooth line through the stops
  const path = pts.reduce((d, p, i) => {
    if (i === 0) return `M ${p.x} ${p.y}`;
    const a = pts[i - 1];
    return `${d} Q ${(a.x + p.x) / 2 + (p.y - a.y) * 0.12} ${(a.y + p.y) / 2 - (p.x - a.x) * 0.12} ${p.x} ${p.y}`;
  }, "");
  const dayOf = (name: string) => {
    const n = name.toLowerCase();
    return itinerary.find((d) => `${d.title} ${d.description}`.toLowerCase().includes(n))?.dayNumber ?? null;
  };
  const scaleKm = [1, 2, 5, 10, 20, 25, 50, 100, 200].find((k) => k / kmPerPx >= 60) ?? 200;
  const fmtKm = (k: number) => (k < 10 ? k.toFixed(1) : Math.round(k).toLocaleString("en-IN"));
  const { india } = geo;

  return (
    <div className="relative grid gap-4 px-4 pb-5 pt-4 sm:px-6 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
      {/* map */}
      <div className="relative overflow-hidden rounded-[22px] border border-sky-100 bg-[#eef5ff]">
        <svg viewBox={`0 0 ${W} ${H}`} className="h-auto w-full" aria-label="Map of the stops">
          <defs>
            <pattern id={`${uid}-dots`} width="12" height="12" patternUnits="userSpaceOnUse"><circle cx="1.5" cy="1.5" r="1" fill="#0057ff" fillOpacity=".12" /></pattern>
            <radialGradient id={`${uid}-glow`}><stop stopColor="#38bdf8" stopOpacity=".25" /><stop offset="1" stopColor="#38bdf8" stopOpacity="0" /></radialGradient>
            <linearGradient id={`${uid}-line`} x1="0" x2="1"><stop stopColor="#fb923c" /><stop offset="1" stopColor="#c4b5fd" /></linearGradient>
          </defs>
          <rect width={W} height={H} fill={`url(#${uid}-dots)`} />
          {/* terrain feel: contour rings around the high stops */}
          {pts.slice(-2).map((p, k) => [70, 110, 150].map((r) => <ellipse key={`${k}-${r}`} cx={p.x + 30} cy={p.y - 20} rx={r} ry={r * 0.62} fill="none" stroke="#0057ff" strokeOpacity=".08" />))}
          <circle cx={W / 2} cy={H / 2} r="200" fill={`url(#${uid}-glow)`} />
          <path d={path} fill="none" stroke="#38bdf8" strokeOpacity=".25" strokeWidth="10" strokeLinecap="round" />
          <motion.path d={path} fill="none" stroke={`url(#${uid}-line)`} strokeWidth="3" strokeLinecap="round" strokeDasharray="7 7" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.6, ease: "easeInOut" }} />
          {segs.map((s, i) => {
            if (Math.hypot(s.a.x - s.b.x, s.a.y - s.b.y) < 60) return null; // too short to label on the map — the list has it
            const mx = (s.a.x + s.b.x) / 2;
            const my = (s.a.y + s.b.y) / 2;
            return (
              <g key={i} transform={`translate(${mx} ${my})`}>
                <rect x="-24" y="-9" width="48" height="18" rx="9" fill="#ffffff" fillOpacity=".95" stroke="#0a0f1f" strokeOpacity=".08" />
                <text textAnchor="middle" y="3.5" fontSize="9.5" fontWeight="700" fill="#334155" fontFamily="inherit">≈{fmtKm(s.km)} km</text>
              </g>
            );
          })}
          {pts.map((p, i) => {
            const end = i === 0 || i === pts.length - 1;
            const right = labels[i].anchorRight;
            return (
              <motion.g key={p.name} initial={{ opacity: 0, scale: 0.6 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: 0.2 + i * 0.12 }} style={{ transformOrigin: `${p.x}px ${p.y}px` }}>
                <circle cx={p.x} cy={p.y} r="14" fill={i === 0 ? "#fb923c" : end ? "#c4b5fd" : "#38bdf8"} fillOpacity=".18" />
                <circle cx={p.x} cy={p.y} r="9" fill={i === 0 ? "#fb923c" : end ? "#a78bfa" : "#38bdf8"} stroke="#ffffff" strokeWidth="2" />
                <text x={p.x} y={p.y + 3.2} textAnchor="middle" fontSize="9" fontWeight="900" fill="#ffffff" fontFamily="inherit">{i + 1}</text>
                <text x={labels[i].x + (right ? 15 : -15)} y={labels[i].y} textAnchor={right ? "start" : "end"} fontSize="12.5" fontWeight="800" fill="#0a0f1f" fontFamily="inherit" stroke="#eef5ff" strokeWidth="3" paintOrder="stroke">{p.name}</text>
              </motion.g>
            );
          })}
          {/* compass + scale */}
          <g transform={`translate(${W - 30} 34)`}>
            <circle r="15" fill="#ffffff" stroke="#0a0f1f" strokeOpacity=".1" />
            <path d="M0 -9 L4 3 L0 0 L-4 3 Z" fill="#fb923c" />
            <text y="12" textAnchor="middle" fontSize="7" fontWeight="800" fill="#334155" fontFamily="inherit">N</text>
          </g>
          <g transform={`translate(18 ${H - 20})`}>
            <rect width={scaleKm / kmPerPx} height="4" rx="2" fill="#334155" fillOpacity=".5" />
            <text y="-6" fontSize="9" fontWeight="700" fill="#334155" fontFamily="inherit">{scaleKm} km</text>
          </g>
        </svg>

        {/* India locator */}
        <div className="absolute left-3 top-3 w-[92px] rounded-xl border border-line bg-white/90 p-1.5 shadow-sm backdrop-blur sm:w-[112px]">
          <svg viewBox={`0 0 ${india.w} ${india.h}`} className="h-auto w-full">
            <image href={india.src} width={india.w} height={india.h} />
            <rect x={india.box.x} y={india.box.y} width={Math.max(2, india.box.w)} height={Math.max(2, india.box.h)} fill="#fb923c" fillOpacity=".35" stroke="#fb923c" strokeWidth=".6" rx=".6" />
          </svg>
          <div className="mt-0.5 text-center text-[8px] font-bold uppercase tracking-wider text-muted">India</div>
        </div>
      </div>

      {/* stops list */}
      <div className="flex flex-col rounded-[22px] border border-line bg-surface/60 p-4">
        <div className="flex items-center justify-between text-[10px] font-extrabold uppercase tracking-[.18em] text-brand">
          <span className="flex items-center gap-1.5"><Navigation className="h-3.5 w-3.5" /> {pts.length} stops</span>
          <span className="text-muted">≈{fmtKm(total)} km apart</span>
        </div>
        <ol className="relative mt-3 flex-1 space-y-1">
          <span aria-hidden className="absolute bottom-4 left-[13px] top-4 w-px border-l border-dashed border-ink/15" />
          {pts.map((p, i) => {
            const d = dayOf(p.name);
            const seg = segs[i - 1];
            return (
              <motion.li key={p.name} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.1 + i * 0.06 }} className="relative flex items-center gap-3 rounded-xl px-1 py-1.5 transition hover:bg-white">
                <span className={cn("relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-[11px] font-black text-white", i === 0 ? "bg-orange-400" : i === pts.length - 1 ? "bg-violet-400" : "bg-sky-500")}>{i + 1}</span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-extrabold">{p.name}</span>
                  <span className="block text-[10.5px] text-muted">{i === 0 ? "Start" : `≈${fmtKm(seg.km)} km from ${seg.a.name}`}</span>
                </span>
                {d && <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-[10px] font-bold text-ink ring-1 ring-line">Day {d}</span>}
              </motion.li>
            );
          })}
        </ol>
        <p className="mt-3 text-[10px] leading-relaxed text-muted">Straight-line distances between stops. Mountain roads are longer and trek sections are on foot.</p>
      </div>
    </div>
  );
}
