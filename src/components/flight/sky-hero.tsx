"use client";
import Image from "next/image";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { cn } from "@/lib/utils";

/**
 * Aceternity UI "Flight Booking Hero" pattern: the Cloud Shader sky (procedural clouds drifting
 * left → right, rendered at half size and scaled up so it stays smooth) with the window-seat wing
 * gently bobbing in front.
 */
export function SkyHero({
  children,
  compact,
}: {
  children: ReactNode;
  compact?: boolean;
}) {
  return (
    <section
      className={cn(
        "relative -mt-20 bg-gradient-to-t from-[#3f8ef0] to-[#0646c8]",
        compact
          ? "pb-36 pt-28 md:pb-40"
          : "min-h-[640px] pb-48 pt-32 md:min-h-[720px] md:pb-56",
      )}
    >
      {/* only the sky layers are clipped — the content (and dropdowns like the airport list) can spill below the hero */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 overflow-hidden"
      >
        <motion.div
          className="absolute inset-0"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.4, ease: "easeOut" }}
        >
          <div className="absolute inset-0 hidden md:block">
            <CloudShader
              speed={1}
              skyTopColor="#0646c8"
              skyBottomColor="#3f8ef0"
              cloudColor="#ffffff"
              className="absolute inset-0"
            />
          </div>
          <div className="cloud-sky-fallback absolute inset-0 md:hidden" />
        </motion.div>
        {/* window-seat wing view with a gentle in-flight bob */}
        <motion.div
          className={cn(
            "pointer-events-none absolute -bottom-6 right-0 z-10",
            compact
              ? "-bottom-1 -right-[8%] w-[64%] sm:bottom-0 sm:right-0 sm:w-[60%] md:w-[44%]"
              : "-bottom-1 -right-[8%] w-[72%] sm:bottom-0 sm:right-0 sm:w-[80%] md:w-[62%]",
          )}
          animate={{ y: [0, -12, 0] }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        >
          <Image
            src="/images/plane-wing.png"
            alt=""
            width={2200}
            height={1227}
            priority
            className="h-auto w-full -scale-x-100"
          />
        </motion.div>
        {/* soft dark pool behind the heading so white text never sits on a bright cloud */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 z-[5] bg-[radial-gradient(ellipse_60%_45%_at_50%_30%,rgba(3,25,80,0.35),transparent_75%)]"
        />
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-transparent to-[#f6f7fb]" />
      </div>
      {/* above the card that overlaps the hero bottom (z-20), so an open dropdown sits on top of it */}
      <div className="relative z-30">{children}</div>
    </section>
  );
}
