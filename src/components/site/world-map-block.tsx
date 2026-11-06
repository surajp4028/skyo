"use client";
import { motion } from "motion/react";
import { Globe2, Plane, Star } from "lucide-react";
import { WorldMap } from "@/components/ui/world-map";

const DEL = { lat: 28.61, lng: 77.21, label: "Delhi" };
const BOM = { lat: 19.08, lng: 72.88, label: "Mumbai" };
const BLR = { lat: 12.97, lng: 77.59, label: "Bengaluru" };
const MAA = { lat: 13.08, lng: 80.27, label: "Chennai" };
const CCU = { lat: 22.57, lng: 88.36, label: "Kolkata" };

const ROUTES = [
  { start: DEL, end: { lat: 25.2, lng: 55.27, label: "Dubai" } },
  { start: BOM, end: { lat: 51.51, lng: -0.13, label: "London" } },
  { start: DEL, end: { lat: 40.71, lng: -74.01, label: "New York" } },
  { start: BLR, end: { lat: 1.35, lng: 103.82, label: "Singapore" } },
  { start: CCU, end: { lat: 13.76, lng: 100.5, label: "Bangkok" } },
  { start: MAA, end: { lat: -8.65, lng: 115.22, label: "Bali" } },
  { start: BOM, end: { lat: 48.86, lng: 2.35, label: "Paris" } },
  { start: DEL, end: { lat: -33.87, lng: 151.21, label: "Sydney" } },
];

export function WorldMapBlock({ mapSrc }: { mapSrc: string }) {
  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="mx-auto max-w-7xl px-5">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand"><Star className="h-3 w-3 fill-brand" /> Beyond borders</div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-[42px] md:leading-[1.1]">
            From your city to <span className="font-display font-normal italic text-gradient">the world</span>
          </h2>
          <p className="mt-3 text-base text-muted">International flights from every major Indian airport — with visa guides, forex tips and 24×7 support wherever you land.</p>
        </motion.div>
        <div className="mt-10">
          <WorldMap mapSrc={mapSrc} dots={ROUTES} />
        </div>
        <div className="mx-auto mt-8 grid max-w-3xl grid-cols-3 gap-3">
          {[["120+", "countries", Globe2], ["500+", "routes", Plane], ["90+", "airlines", Star]].map(([n, l, I]) => {
            const Icon = I as typeof Plane;
            return (
              <div key={l as string} className="rounded-2xl border border-line bg-surface/60 p-4 text-center">
                <Icon className="mx-auto h-5 w-5 text-brand" />
                <div className="mt-2 text-2xl font-extrabold text-ink">{n as string}</div>
                <div className="text-xs font-semibold text-muted">{l as string}</div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
