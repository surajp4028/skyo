"use client";
import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { motion } from "motion/react";
import { ArrowRight, ChevronLeft, ChevronRight, MapPin } from "lucide-react";
import { IMAGES, img, cn } from "@/lib/utils";

/** Tour places — tall photo cards, name in display serif, state in spaced caps, mood + link below. */
const PLACES = [
  { name: "Kedarnath", state: "Uttarakhand", mood: "Temple trek in the snow", image: IMAGES.kedarnathFront },
  { name: "Tungnath", state: "Uttarakhand", mood: "Highest Shiva temple & sunrise peak", image: IMAGES.tungnath },
  { name: "Kashmir", state: "Jammu & Kashmir", mood: "Lakes, meadows & shikaras", image: IMAGES.kashmir },
  { name: "Manali", state: "Himachal Pradesh", mood: "Pine valleys & cafés", image: IMAGES.lake },
  { name: "Goa", state: "Goa", mood: "Sun, sand & shacks", image: IMAGES.goa },
  { name: "Kerala", state: "Kerala", mood: "Backwaters & tea hills", image: IMAGES.keralaBoat },
  { name: "Jaipur", state: "Rajasthan", mood: "Forts & pink lanes", image: IMAGES.jaipur },
  { name: "Agra", state: "Uttar Pradesh", mood: "The Taj at sunrise", image: IMAGES.tajArch },
  { name: "Mumbai", state: "Maharashtra", mood: "Sea face & street food", image: IMAGES.mumbai },
] as const;

export function PopularPlaces({ eyebrow = "Popular destinations", title = "Places worth the journey", sub, className }: { eyebrow?: string; title?: string; sub?: string; className?: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [pos, setPos] = useState({ p: 0, left: false, right: true });
  const measure = () => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setPos({ p: max > 0 ? el.scrollLeft / max : 0, left: el.scrollLeft > 4, right: el.scrollLeft < max - 4 });
  };
  useEffect(() => {
    const t = setTimeout(measure, 60);
    window.addEventListener("resize", measure);
    return () => (clearTimeout(t), window.removeEventListener("resize", measure));
  }, []);
  const scroll = (d: number) => rail.current?.scrollBy({ left: d * (rail.current.clientWidth * 0.8), behavior: "smooth" });

  return (
    <section className={cn("mx-auto max-w-7xl px-4 sm:px-5", className)}>
      <div className="flex items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-brand"><MapPin className="h-3.5 w-3.5" /> {eyebrow}</div>
          <h2 className="mt-2 text-2xl font-extrabold tracking-tight text-ink md:text-[32px] md:leading-[1.15]">{title}</h2>
          {sub && <p className="mt-1.5 text-sm text-muted md:text-base">{sub}</p>}
        </div>
        <div className="hidden gap-2 sm:flex">
          {[-1, 1].map((d) => (
            <button key={d} type="button" onClick={() => scroll(d)} disabled={d < 0 ? !pos.left : !pos.right} aria-label={d < 0 ? "Previous places" : "More places"} className="flex h-10 w-10 items-center justify-center rounded-full bg-white text-ink shadow-soft ring-1 ring-line transition hover:bg-ink hover:text-white disabled:opacity-35 disabled:hover:bg-white disabled:hover:text-ink">
              {d < 0 ? <ChevronLeft className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
            </button>
          ))}
        </div>
      </div>

      <div ref={rail} onScroll={measure} className="no-scrollbar -mx-4 -mb-12 mt-3 flex scroll-px-4 snap-x snap-mandatory gap-4 overflow-x-auto overflow-y-hidden overscroll-x-contain px-4 pb-16 pt-4">
        {PLACES.map((p, i) => (
          <motion.div key={p.name} initial={{ opacity: 0, y: 16 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: "-40px" }} transition={{ duration: 0.5, delay: Math.min(i, 5) * 0.06 }} className="w-[220px] shrink-0 snap-start sm:w-[250px] lg:w-[268px]">
            <Link href={`/packages?destination=${encodeURIComponent(p.name)}`} className="group block overflow-hidden rounded-[26px] bg-white shadow-[0_18px_40px_-26px_rgba(10,15,31,.55)] ring-1 ring-line transition duration-300 hover:-translate-y-1 hover:shadow-lift">
              <div className="relative aspect-[4/5] overflow-hidden">
                <span className="absolute inset-0 bg-cover bg-center transition duration-700 group-hover:scale-110" style={{ backgroundImage: `url("${img(p.image, 640)}")` }} />
                {/* light lift for the name only — the photo stays bright */}
                <span aria-hidden className="absolute inset-x-0 bottom-0 h-2/5 bg-gradient-to-t from-black/45 to-transparent" />
                <div className="absolute inset-x-3 bottom-5 text-center text-white">
                  <div className="font-display text-[34px] leading-none tracking-tight [text-shadow:0_2px_14px_rgba(0,0,0,.45)] sm:text-[38px]">{p.name}</div>
                  <div className="mt-2 text-[9.5px] font-bold uppercase tracking-[0.45em] text-white/90 [text-shadow:0_1px_8px_rgba(0,0,0,.5)]">{p.state}</div>
                </div>
              </div>
              <div className="flex items-center justify-between gap-2 px-4 py-3.5">
                <span className="min-w-0 truncate text-[13px] font-semibold text-ink">{p.mood}</span>
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface text-ink transition group-hover:bg-brand group-hover:text-white">
                  <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
                </span>
              </div>
            </Link>
          </motion.div>
        ))}
      </div>

      {/* scroll progress */}
      <div className="relative mx-auto mt-4 h-1 w-24 overflow-hidden rounded-full bg-line">
        <div className="h-full rounded-full bg-[#0057ff] transition-all duration-300" style={{ width: `${25 + pos.p * 75}%` }} />
      </div>
    </section>
  );
}
