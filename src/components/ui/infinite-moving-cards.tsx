"use client";
import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

/** Aceternity "Infinite Moving Cards". */
export function InfiniteMovingCards({
  items,
  direction = "left",
  speed = "slow",
  className,
}: {
  items: { quote: string; name: string; title: string }[];
  direction?: "left" | "right";
  speed?: "fast" | "normal" | "slow";
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLUListElement>(null);
  const [start, setStart] = useState(false);

  useEffect(() => {
    const c = containerRef.current;
    const s = scrollerRef.current;
    if (!c || !s || s.dataset.cloned) return;
    Array.from(s.children).forEach((child) => {
      const clone = child.cloneNode(true) as HTMLElement;
      clone.setAttribute("aria-hidden", "true");
      s.appendChild(clone);
    });
    s.dataset.cloned = "1";
    c.style.setProperty("--animation-direction", direction === "left" ? "forwards" : "reverse");
    c.style.setProperty("--animation-duration", speed === "fast" ? "20s" : speed === "normal" ? "40s" : "80s");
    setStart(true);
  }, [direction, speed]);

  return (
    <div ref={containerRef} className={cn("relative z-20 max-w-7xl overflow-hidden [mask-image:linear-gradient(to_right,transparent,white_15%,white_85%,transparent)]", className)}>
      <ul ref={scrollerRef} className={cn("flex w-max min-w-full shrink-0 flex-nowrap gap-4 py-4 hover:[animation-play-state:paused]", start && "animate-scroll")}>
        {items.map((item) => (
          <li key={item.name} className="relative w-[300px] max-w-full shrink-0 rounded-[22px] border border-line bg-white px-6 py-5 shadow-soft md:w-[400px]">
            <blockquote>
              <div className="mb-3 text-sm tracking-[.2em] text-[#d9822b]">★★★★★</div>
              <p className="font-lux text-[17px] italic leading-relaxed text-ink">“{item.quote}”</p>
              <div className="mt-5 flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand to-iris text-sm font-bold text-white">{item.name[0]}</div>
                <div>
                  <div className="text-sm font-bold text-ink">{item.name}</div>
                  <div className="text-xs text-muted">{item.title}</div>
                </div>
              </div>
            </blockquote>
          </li>
        ))}
      </ul>
    </div>
  );
}
