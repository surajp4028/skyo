"use client";
import Image from "next/image";
import { motion } from "motion/react";
import type { ReactNode } from "react";
import { CloudShader } from "@/components/ui/cloud-shader";

/**
 * Aceternity UI "Flight Booking Hero" pattern: the Cloud Shader sky (procedural clouds drifting
 * left → right, rendered at half size and scaled up so it stays smooth) with the window-seat wing
 * gently bobbing in front.
 */
export function SkyHero({ children }: { children: ReactNode }) {
  return (
    <section className="relative -mt-20 min-h-[640px] overflow-hidden bg-gradient-to-t from-[#4f9cf5] to-[#0b5fe0] pb-48 pt-32 md:min-h-[720px] md:pb-56">
      <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}>
        <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
          <CloudShader speed={1} skyTopColor="#0b5fe0" skyBottomColor="#4f9cf5" cloudColor="#ffffff" className="absolute inset-0" />
        </div>
      </motion.div>
      {/* window-seat wing view with a gentle in-flight bob */}
      <motion.div
        className="pointer-events-none absolute -bottom-6 right-0 z-10 w-[95%] sm:w-[80%] md:w-[62%]"
        animate={{ y: [0, -12, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      >
        <Image src="/images/plane-wing.png" alt="" width={2200} height={1227} priority className="h-auto w-full -scale-x-100" />
      </motion.div>
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-24 bg-gradient-to-b from-transparent to-[#f6f7fb]" />
      <div className="relative z-20">{children}</div>
    </section>
  );
}
