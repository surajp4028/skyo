"use client";
import { motion } from "motion/react";
import { Globe2, Plane, Star } from "lucide-react";
import { WorldMap } from "@/components/ui/world-map";

const HUB = { lat: 28.61, lng: 77.21, label: "New Delhi" };
const DESTS = [
  { lat: 40.71, lng: -74.01, label: "New York" },
  { lat: 51.51, lng: -0.13, label: "London" },
  { lat: 55.76, lng: 37.62, label: "Moscow" },
  { lat: 25.2, lng: 55.27, label: "Dubai" },
  { lat: -1.29, lng: 36.82, label: "Nairobi" },
  { lat: 1.35, lng: 103.82, label: "Singapore" },
  { lat: 35.68, lng: 139.69, label: "Tokyo" },
  { lat: -33.87, lng: 151.21, label: "Sydney" },
];

export function WorldMapBlock({ mapSrc }: { mapSrc: string }) {
  return (
    <section className="relative overflow-hidden bg-white py-24">
      <div className="mx-auto max-w-7xl px-5">
        <motion.div initial={{ opacity: 0, y: 24 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-80px" }} transition={{ duration: 0.6 }} className="mx-auto max-w-2xl text-center">
          <div className="flex items-center justify-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand"><Star className="h-3 w-3 fill-brand" /> Beyond borders</div>
          <h2 className="mt-3 text-3xl font-lux font-bold tracking-[-0.01em] text-ink md:text-[42px] md:leading-[1.1]">
            From your city to <span className="font-lux italic text-gradient">the world</span>
          </h2>
          <p className="mt-3 text-base text-muted">International flights from every major Indian airport — with visa guides, forex tips and 24×7 support wherever you land.</p>
        </motion.div>
        <div className="mt-10">
          <WorldMap mapSrc={mapSrc} hub={HUB} destinations={DESTS} />
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
