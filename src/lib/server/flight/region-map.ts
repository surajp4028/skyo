import "server-only";
import DottedMap from "dotted-map";

/**
 * Aceternity-style dotted map zoomed to a route's region (not the whole world), rendered on the
 * server with dotted-map and cached per region. Returns the SVG as a data URI plus each pin's
 * position in the SVG's own coordinates so the browser can draw the arc, plane and live position.
 */
export type RegionMap = { src: string; w: number; h: number; pins: Record<string, { x: number; y: number }> };

const cache = new Map<string, RegionMap>();

export function regionMap(points: { key: string; lat: number; lon: number }[], theme: "light" | "dark" = "light"): RegionMap {
  const lats = points.map((p) => p.lat);
  const lons = points.map((p) => p.lon);
  const latSpan = Math.max(...lats) - Math.min(...lats);
  const lonSpan = Math.max(...lons) - Math.min(...lons);
  const latPad = Math.max(4, latSpan * 0.45);
  let lonPad = Math.max(6, lonSpan * 0.4);
  let latMin = Math.max(-70, Math.min(...lats) - latPad);
  let latMax = Math.min(80, Math.max(...lats) + latPad);
  // keep the map wider than tall so short hops still look like a map
  const wantLon = (latMax - latMin) * 1.7;
  if (lonSpan + lonPad * 2 < wantLon) lonPad = (wantLon - lonSpan) / 2;
  const lonMin = Math.max(-180, Math.min(...lons) - lonPad);
  const lonMax = Math.min(180, Math.max(...lons) + lonPad);
  latMin = Math.round(latMin * 2) / 2;
  latMax = Math.round(latMax * 2) / 2;
  const key = `${theme}|${latMin}|${latMax}|${Math.round(lonMin * 2) / 2}|${Math.round(lonMax * 2) / 2}|${points.map((p) => `${p.key}:${p.lat.toFixed(2)},${p.lon.toFixed(2)}`).join(";")}`;
  const hit = cache.get(key);
  if (hit) return hit;

  const map = new DottedMap({ height: 64, grid: "diagonal", region: { lat: { min: latMin, max: latMax }, lng: { min: lonMin, max: lonMax } } });
  for (const p of points) map.addPin({ lat: p.lat, lng: p.lon, svgOptions: { color: "transparent", radius: 0.01 }, data: p.key });
  const svg = map.getSVG({ radius: 0.3, color: theme === "dark" ? "#ffffff2e" : "#0a0f1f33", shape: "circle", backgroundColor: "transparent" });
  const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
  const pins: RegionMap["pins"] = {};
  for (const p of map.getPoints() as { x: number; y: number; data?: string }[]) if (p.data) pins[p.data] = { x: p.x, y: p.y };
  const out: RegionMap = { src: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, w: Number(vb?.[1] || 100), h: Number(vb?.[2] || 60), pins };
  if (cache.size > 300) cache.clear();
  cache.set(key, out);
  return out;
}
