"use client";
import Link from "next/link";
import { useState } from "react";
import { motion, useMotionValueEvent, useScroll, AnimatePresence } from "motion/react";
import { BusFront, Building2, ChevronDown, LogOut, Palmtree, Plane, TrainFront, User2, Headphones, Menu, X } from "lucide-react";
import { useAuth, useSite } from "@/lib/client/providers";
import { Logo } from "./logo";
import { cn } from "@/lib/utils";
import { isServiceOn, type ServiceKey } from "@/lib/services";

const LINKS = [
  { href: "/#search", label: "Trains", icon: TrainFront, tab: "train" },
  { href: "/#search", label: "Flights", icon: Plane, tab: "flight" },
  { href: "/#search", label: "Buses", icon: BusFront, tab: "bus" },
  { href: "/#search", label: "Hotels", icon: Building2, tab: "hotel" },
  { href: "/#search", label: "Packages", icon: Palmtree, tab: "package" },
];

/** Transparent over hero → frosted glass pill on scroll (Aceternity floating-nav feel). */
export function Navbar({ overHero = true }: { overHero?: boolean }) {
  const { scrollY } = useScroll();
  const [scrolled, setScrolled] = useState(!overHero);
  const [open, setOpen] = useState(false);
  const { user, logout } = useAuth();
  const site = useSite();
  useMotionValueEvent(scrollY, "change", (v) => overHero && setScrolled(v > 40));
  const dark = overHero && !scrolled;
  const links = LINKS.filter((l) => isServiceOn(site, l.tab as ServiceKey)); // white text over the blue sky, ink once the glass bar appears

  return (
    <div className="contents">
      {site.maintenance_mode === "on" && (
        <div className="relative z-[60] bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-center text-xs font-semibold text-white">{site.maintenance_message}</div>
      )}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={cn("sticky top-0 z-50 transition-[padding] duration-300", scrolled ? "px-3 pt-3" : "px-0 pt-0")}
      >
        <nav
          className={cn(
            // border is always present (transparent) so it never flashes in currentColor while transitioning
            "mx-auto flex max-w-7xl items-center justify-between gap-4 rounded-2xl border px-5 transition-[height,background-color,border-color,box-shadow] duration-300",
            scrolled ? "h-16 border-white/60 bg-white/75 shadow-soft backdrop-blur-xl" : "h-20 border-transparent bg-transparent shadow-none",
          )}
        >
          <Logo dark={dark} />
          <div className="hidden items-center gap-1 lg:flex">
            {links.map((l) => (
              <Link
                key={l.label}
                href={`/?tab=${l.tab}#search`}
                className={cn("flex items-center gap-2 rounded-full px-3.5 py-2 text-sm font-semibold transition", dark ? "text-white/80 hover:bg-white/10 hover:text-white" : "text-ink/70 hover:bg-ink/5 hover:text-ink")}
              >
                <l.icon className="h-4 w-4" />
                {l.label}
              </Link>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <a href={`mailto:${site.support_email}`} className={cn("hidden items-center gap-1.5 rounded-full px-3 py-2 text-sm font-semibold md:flex", dark ? "text-white/80" : "text-ink/70")}>
              <Headphones className="h-4 w-4" /> Support
            </a>
            {user ? (
              <UserMenu dark={dark} name={user.name || user.email || user.phone || "Traveller"} avatar={user.avatar ?? null} onLogout={logout} />
            ) : (
              <Link href="/login" className="rounded-full bg-gradient-to-r from-brand to-brand-2 px-5 py-2.5 text-sm font-bold text-white shadow-[0_8px_24px_-8px_rgba(255,90,31,0.8)] transition hover:brightness-110">
                Log in / Sign up
              </Link>
            )}
            <button className={cn("rounded-full p-2 lg:hidden", dark ? "text-white" : "text-ink")} onClick={() => setOpen((v) => !v)} aria-label="Menu">
              {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </nav>
        <AnimatePresence>
          {open && (
            <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }} className="mx-3 mt-2 rounded-2xl border border-line bg-white p-2 shadow-lift lg:hidden">
              {links.map((l) => (
                <Link key={l.label} onClick={() => setOpen(false)} href={`/?tab=${l.tab}#search`} className="flex items-center gap-3 rounded-xl px-4 py-3 text-sm font-semibold text-ink hover:bg-surface">
                  <l.icon className="h-4 w-4 text-brand" /> {l.label}
                </Link>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </motion.header>
    </div>
  );
}

function UserMenu({ name, avatar, onLogout, dark }: { name: string; avatar: string | null; onLogout: () => Promise<void>; dark: boolean }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="relative" onMouseLeave={() => setOpen(false)}>
      <button onClick={() => setOpen((v) => !v)} className={cn("flex items-center gap-2 rounded-full border py-1.5 pl-1.5 pr-3 text-sm font-semibold", dark ? "border-white/20 text-white" : "border-line bg-white text-ink")}>
        {avatar ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatar} alt="" className="h-7 w-7 rounded-full object-cover" />
        ) : (
          <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-brand to-iris text-xs font-bold text-white">{name[0]?.toUpperCase()}</span>
        )}
        <span className="hidden max-w-[120px] truncate sm:inline">{name}</span>
        <ChevronDown className="hidden h-4 w-4 opacity-60 sm:block" />
      </button>
      <AnimatePresence>
        {open && (
          <motion.div initial={{ opacity: 0, y: 6, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6 }} className="absolute right-0 top-full z-50 w-56 pt-2">
            <div className="rounded-2xl border border-line bg-white p-1.5 shadow-lift">
              <Link href="/account" className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-ink hover:bg-surface">
                <User2 className="h-4 w-4" /> My account & trips
              </Link>
              <button
                onClick={async () => {
                  await onLogout();
                  window.location.replace("/");
                }}
                className="flex w-full items-center gap-2.5 rounded-xl px-3 py-2.5 text-sm font-semibold text-red-600 hover:bg-red-50"
              >
                <LogOut className="h-4 w-4" /> Log out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
