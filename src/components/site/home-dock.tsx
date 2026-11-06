"use client";
import { useState } from "react";
import { AnimatePresence, motion, useMotionValueEvent, useScroll } from "motion/react";
import { BusFront, Building2, Headphones, Palmtree, Plane, TrainFront, UserRound } from "lucide-react";
import { FloatingDock } from "@/components/ui/floating-dock";
import { useSite } from "@/lib/client/providers";

/** Aceternity Floating Dock — appears once the hero is scrolled past. */
export function HomeDock() {
  const site = useSite();
  const { scrollY } = useScroll();
  const [show, setShow] = useState(false);
  useMotionValueEvent(scrollY, "change", (v) => setShow(v > 700));
  const items = [
    { title: "Trains", icon: <TrainFront />, href: "/?tab=train#search" },
    { title: "Flights", icon: <Plane />, href: "/?tab=flight#search" },
    { title: "Buses", icon: <BusFront />, href: "/?tab=bus#search" },
    { title: "Hotels", icon: <Building2 />, href: "/?tab=hotel#search" },
    { title: "Packages", icon: <Palmtree />, href: "/?tab=package#search" },
    { title: "My trips", icon: <UserRound />, href: "/account" },
    { title: "Support", icon: <Headphones />, href: `mailto:${site.support_email}` },
  ];
  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
          transition={{ type: "spring", stiffness: 260, damping: 26 }}
          className="fixed bottom-5 right-5 z-40 md:left-1/2 md:right-auto md:-translate-x-1/2"
        >
          <FloatingDock items={items} />
        </motion.div>
      )}
    </AnimatePresence>
  );
}
