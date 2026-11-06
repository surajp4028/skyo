"use client";
import Link from "next/link";
import { useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion, useMotionValue, useSpring, useTransform, type MotionValue } from "motion/react";
import { LayoutGrid } from "lucide-react";
import { cn } from "@/lib/utils";

/** Aceternity "Floating Dock" — macOS-style magnifying dock (desktop) + expandable stack (mobile). */
type Item = { title: string; icon: ReactNode; href: string };

export function FloatingDock({ items, className }: { items: Item[]; className?: string }) {
  return (
    <>
      <DockDesktop items={items} className={className} />
      <DockMobile items={items} className={className} />
    </>
  );
}

function DockMobile({ items, className }: { items: Item[]; className?: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cn("relative block md:hidden", className)}>
      <AnimatePresence>
        {open && (
          <motion.div layoutId="dock-nav" className="absolute inset-x-0 bottom-full mb-2 flex flex-col gap-2">
            {items.map((item, idx) => (
              <motion.div key={item.title} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 10, transition: { delay: idx * 0.04 } }} transition={{ delay: (items.length - 1 - idx) * 0.04 }}>
                <Link href={item.href} onClick={() => setOpen(false)} aria-label={item.title} className="flex h-11 w-11 items-center justify-center rounded-full border border-white/60 bg-white/90 text-ink shadow-soft backdrop-blur">
                  <div className="h-5 w-5">{item.icon}</div>
                </Link>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
      <button onClick={() => setOpen((o) => !o)} aria-label="Quick links" className="flex h-12 w-12 items-center justify-center rounded-full bg-ink text-white shadow-lift">
        <LayoutGrid className="h-5 w-5" />
      </button>
    </div>
  );
}

function DockDesktop({ items, className }: { items: Item[]; className?: string }) {
  const mouseX = useMotionValue(Infinity);
  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageX)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className={cn("mx-auto hidden h-16 items-end gap-3 rounded-2xl border border-white/70 bg-white/75 px-4 pb-3 shadow-[0_20px_50px_-15px_rgba(10,15,31,0.35)] backdrop-blur-xl md:flex", className)}
    >
      {items.map((item) => (
        <DockIcon mouseX={mouseX} key={item.title} {...item} />
      ))}
    </motion.div>
  );
}

function DockIcon({ mouseX, title, icon, href }: Item & { mouseX: MotionValue }) {
  const ref = useRef<HTMLDivElement>(null);
  const distance = useTransform(mouseX, (val) => {
    const b = ref.current?.getBoundingClientRect() ?? { x: 0, width: 0 };
    return val - b.x - b.width / 2;
  });
  const size = useSpring(useTransform(distance, [-150, 0, 150], [40, 76, 40]), { mass: 0.1, stiffness: 150, damping: 12 });
  const iconSize = useSpring(useTransform(distance, [-150, 0, 150], [20, 38, 20]), { mass: 0.1, stiffness: 150, damping: 12 });
  const [hovered, setHovered] = useState(false);
  return (
    <Link href={href} aria-label={title}>
      <motion.div
        ref={ref}
        style={{ width: size, height: size }}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="relative flex aspect-square items-center justify-center rounded-full bg-gradient-to-b from-white to-surface text-ink ring-1 ring-line"
      >
        <AnimatePresence>
          {hovered && (
            <motion.div initial={{ opacity: 0, y: 10, x: "-50%" }} animate={{ opacity: 1, y: 0, x: "-50%" }} exit={{ opacity: 0, y: 2, x: "-50%" }} className="absolute -top-8 left-1/2 w-fit whitespace-pre rounded-md bg-ink px-2 py-0.5 text-xs font-semibold text-white">
              {title}
            </motion.div>
          )}
        </AnimatePresence>
        <motion.div style={{ width: iconSize, height: iconSize }} className="flex items-center justify-center [&_svg]:h-full [&_svg]:w-full">
          {icon}
        </motion.div>
      </motion.div>
    </Link>
  );
}
