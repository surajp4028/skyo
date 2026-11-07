"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion, useScroll, useTransform } from "motion/react";

/** Aceternity "Timeline": sticky titles on the left, a beam that fills as you scroll. */
export function Timeline({ data }: { data: { title: string; content: ReactNode }[] }) {
  const ref = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const [h, setH] = useState(0);
  useEffect(() => {
    if (!ref.current) return;
    const ro = new ResizeObserver(() => setH(ref.current?.getBoundingClientRect().height || 0));
    ro.observe(ref.current);
    return () => ro.disconnect();
  }, []);
  const { scrollYProgress } = useScroll({ target: box, offset: ["start 15%", "end 60%"] });
  const height = useTransform(scrollYProgress, [0, 1], [0, h]);
  const opacity = useTransform(scrollYProgress, [0, 0.1], [0, 1]);
  return (
    <div ref={box} className="w-full">
      <div ref={ref} className="relative mx-auto max-w-5xl pb-10">
        {data.map((item) => (
          <div key={item.title} className="flex justify-start pt-10 md:gap-10 md:pt-24">
            <div className="sticky top-32 z-30 flex max-w-xs flex-col items-center self-start md:w-full md:flex-row lg:max-w-sm">
              <div className="absolute left-3 flex h-10 w-10 items-center justify-center rounded-full bg-white shadow-soft">
                <div className="h-4 w-4 rounded-full border border-line bg-surface" />
              </div>
              <h3 className="hidden text-3xl font-extrabold text-ink/40 md:block md:pl-20 md:text-4xl">{item.title}</h3>
            </div>
            <div className="relative w-full pl-20 pr-4 md:pl-4">
              <h3 className="mb-4 block text-2xl font-extrabold text-ink/50 md:hidden">{item.title}</h3>
              {item.content}
            </div>
          </div>
        ))}
        <div style={{ height: `${h}px` }} className="absolute left-8 top-0 w-[2px] overflow-hidden bg-[linear-gradient(to_bottom,transparent_0%,#e7e9f2_10%,#e7e9f2_90%,transparent_99%)] [mask-image:linear-gradient(to_bottom,transparent_0%,black_10%,black_90%,transparent_100%)]">
          <motion.div style={{ height, opacity }} className="absolute inset-x-0 top-0 w-[2px] rounded-full bg-gradient-to-t from-iris via-brand to-transparent" />
        </div>
      </div>
    </div>
  );
}
