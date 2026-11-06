import DottedMap from "dotted-map";
import { WorldMapBlock } from "./world-map-block";

/** Server-side: build the dotted world map SVG once per process (expensive), ship it as a data URI. */
let cached: string | null = null;
function mapDataUri() {
  if (!cached) {
    const map = new DottedMap({ height: 100, grid: "diagonal" });
    const svg = map.getSVG({ radius: 0.22, color: "#0a0f1f33", shape: "circle", backgroundColor: "transparent" });
    cached = `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
  }
  return cached;
}

export function WorldMapSection() {
  return <WorldMapBlock mapSrc={mapDataUri()} />;
}
