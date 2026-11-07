"use client";
import Image from "next/image";
import { useRef, type ReactNode } from "react";
import { motion, useScroll, useSpring, useTransform, type MotionValue } from "motion/react";

/** Aceternity "Hero Parallax" — three rows of cards that slide and tilt into place as you scroll. */
export type ParallaxItem = { title: string; subtitle?: string; src: string };

export function HeroParallax({ items, header }: { items: ParallaxItem[]; header: ReactNode }) {
  const rows = [items.slice(0, 5), items.slice(5, 10), items.slice(10, 15)];
  const ref = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: ref, offset: ["start start", "end start"] });
  const spring = { stiffness: 300, damping: 30, bounce: 100 };
  const x = useSpring(useTransform(scrollYProgress, [0, 1], [0, 900]), spring);
  const xRev = useSpring(useTransform(scrollYProgress, [0, 1], [0, -900]), spring);
  const rotateX = useSpring(useTransform(scrollYProgress, [0, 0.2], [15, 0]), spring);
  const opacity = useSpring(useTransform(scrollYProgress, [0, 0.2], [0.25, 1]), spring);
  const rotateZ = useSpring(useTransform(scrollYProgress, [0, 0.2], [18, 0]), spring);
  const y = useSpring(useTransform(scrollYProgress, [0, 0.2], [-620, 420]), spring);

  return (
    <div ref={ref} className="relative flex h-[245vh] flex-col self-auto overflow-hidden pb-32 pt-36 antialiased [perspective:1000px] [transform-style:preserve-3d]">
      {header}
      <motion.div style={{ rotateX, rotateZ, translateY: y, opacity }}>
        <motion.div className="mb-14 flex flex-row-reverse gap-10">
          {rows[0].map((p) => <Card key={p.title} p={p} x={x} />)}
        </motion.div>
        <motion.div className="mb-14 flex flex-row gap-10">
          {rows[1].map((p) => <Card key={p.title} p={p} x={xRev} />)}
        </motion.div>
        <motion.div className="flex flex-row-reverse gap-10">
          {rows[2].map((p) => <Card key={p.title} p={p} x={x} />)}
        </motion.div>
      </motion.div>
    </div>
  );
}

function Card({ p, x }: { p: ParallaxItem; x: MotionValue<number> }) {
  return (
    <motion.div style={{ x }} whileHover={{ y: -18 }} className="group/card relative h-72 w-[22rem] shrink-0 overflow-hidden rounded-3xl md:h-80 md:w-[26rem]">
      <Image src={p.src} alt={p.title} fill sizes="420px" className="object-cover transition duration-700 group-hover/card:scale-105" />
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/0 to-transparent opacity-80 transition group-hover/card:opacity-100" />
      <div className="absolute bottom-4 left-5 text-white">
        <div className="text-xl font-extrabold">{p.title}</div>
        {p.subtitle && <div className="text-xs font-semibold text-white/75">{p.subtitle}</div>}
      </div>
    </motion.div>
  );
}
