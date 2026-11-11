import "server-only";
import DottedMap from "dotted-map";
import { placeCoord } from "@/lib/place-coords";

/** Small dotted India locator + the package's stops with coordinates, for the package "Map view". */
export type PackageGeo = {
  india: { src: string; w: number; h: number; box: { x: number; y: number; w: number; h: number } };
  stops: { name: string; lat: number; lon: number }[];
};

const INDIA = { lat: { min: 6, max: 37.5 }, lng: { min: 67.5, max: 98 } };
let base: { map: string; w: number; h: number } | null = null;
const cache = new Map<string, PackageGeo | null>();

export function packageGeo(destinations: string[]): PackageGeo | null {
  const key = destinations.join("|");
  if (cache.has(key)) return cache.get(key)!;
  const stops = destinations.flatMap((name) => {
    const c = placeCoord(name);
    return c ? [{ name, lat: c[0], lon: c[1] }] : [];
  });
  if (stops.length < 2) {
    cache.set(key, null);
    return null;
  }
  if (!base) {
    const m = new DottedMap({ height: 60, grid: "diagonal", region: INDIA });
    const svg = m.getSVG({ radius: 0.32, color: "#33507a66", shape: "circle", backgroundColor: "transparent" });
    const vb = svg.match(/viewBox="0 0 ([\d.]+) ([\d.]+)"/);
    base = { map: `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`, w: Number(vb?.[1] || 60), h: Number(vb?.[2] || 60) };
  }
  // the trip's area as a box on the locator (simple equirectangular placement inside the India bounds)
  const lats = stops.map((s) => s.lat);
  const lons = stops.map((s) => s.lon);
  const px = (lon: number) => ((lon - INDIA.lng.min) / (INDIA.lng.max - INDIA.lng.min)) * base!.w;
  const py = (lat: number) => ((INDIA.lat.max - lat) / (INDIA.lat.max - INDIA.lat.min)) * base!.h;
  const pad = 0.8;
  const x1 = px(Math.min(...lons) - pad);
  const x2 = px(Math.max(...lons) + pad);
  const y1 = py(Math.max(...lats) + pad);
  const y2 = py(Math.min(...lats) - pad);
  const geo: PackageGeo = { india: { src: base.map, w: base.w, h: base.h, box: { x: x1, y: y1, w: x2 - x1, h: y2 - y1 } }, stops };
  if (cache.size > 200) cache.clear();
  cache.set(key, geo);
  return geo;
}
