"use client";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { motion } from "motion/react";
import {
  ArrowRight, BadgeIndianRupee, BookUser, Ticket, FileText, Plane, PlaneLanding, PlaneTakeoff, Radio, Route, ShieldCheck, Sparkles, TrainFront, Undo2,
} from "lucide-react";
import { CloudShader } from "@/components/ui/cloud-shader";
import { GlowingEffect } from "@/components/ui/glowing-effect";
import { SavedPnrs } from "@/components/train/saved-pnrs";
import { useSite } from "@/lib/client/providers";
import { isPnrOn, isServiceOn, isTrainLiveOn } from "@/lib/services";
import { cn } from "@/lib/utils";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" } };

/** Mount heavy things (the WebGL sky) only once the section is close to the screen. */
function useNearView<T extends Element>() {
  const ref = useRef<T>(null);
  const [near, setNear] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting) {
        setNear(true);
        io.disconnect();
      }
    }, { rootMargin: "300px" });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return [ref, near] as const;
}

function useIsMobile() {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const up = () => setM(mq.matches);
    up();
    mq.addEventListener("change", up);
    return () => mq.removeEventListener("change", up);
  }, []);
  return m;
}

/* ------------------------------------------------------------------ */
/* Plane window — after Aceternity UI's "Plane Window Hero Section"     */
/* ------------------------------------------------------------------ */

const WALL = "bg-[radial-gradient(circle,rgba(255,255,255,0.2)_1px,transparent_1px)] bg-[size:16px_16px]";

export function PlaneWindowSection() {
  const site = useSite();
  const [ref, near] = useNearView<HTMLDivElement>();
  const mobile = useIsMobile();
  if (!isServiceOn(site, "flight")) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-5 sm:pt-24">
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* plane window card: black shell → dark bezel (dotted walls) → the view */}
        <div ref={ref} className="relative h-[440px] overflow-hidden rounded-3xl bg-gradient-to-r from-neutral-900 via-neutral-700 to-neutral-900 px-2 pt-4 md:h-[420px] md:px-3 md:pt-5 lg:col-span-2">
          <div className="h-[110%] w-full rounded-t-[56px] bg-neutral-950 p-0.5 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9),0_12px_32px_rgba(0,0,0,0.6)] md:rounded-t-[110px]">
            <div className="relative h-full overflow-hidden rounded-t-[54px] bg-neutral-900 p-3 shadow-[inset_0_2px_4px_rgba(255,255,255,0.12),inset_0_-8px_20px_rgba(0,0,0,0.55)] md:rounded-t-[108px] md:p-4">
              {/* four dotted walls, each rotated into the page, mitred at the corners */}
              <div aria-hidden className="absolute inset-0">
                <div className="absolute inset-0 [clip-path:polygon(0_0,100%_0,50%_50%)] [perspective:2000px]">
                  <div className={cn("absolute -inset-x-1/4 inset-y-0 origin-top [transform:rotateX(-40deg)]", WALL)} />
                </div>
                <div className="absolute inset-0 [clip-path:polygon(0_100%,100%_100%,50%_50%)] [perspective:2000px]">
                  <div className={cn("absolute -inset-x-1/4 inset-y-0 origin-bottom [transform:rotateX(40deg)]", WALL)} />
                </div>
                <div className="absolute inset-0 [clip-path:polygon(0_0,0_100%,50%_50%)] [perspective:2000px]">
                  <div className={cn("absolute inset-x-0 -inset-y-1/4 origin-left [transform:rotateY(40deg)]", WALL)} />
                </div>
                <div className="absolute inset-0 [clip-path:polygon(100%_0,100%_100%,50%_50%)] [perspective:2000px]">
                  <div className={cn("absolute inset-x-0 -inset-y-1/4 origin-right [transform:rotateY(-40deg)]", WALL)} />
                </div>
              </div>

              <div className="relative h-full overflow-hidden rounded-t-[42px] bg-gradient-to-t from-[#3f8ef0] to-[#0646c8] md:rounded-t-[94px]">
                {near && (
                  <motion.div className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}>
                    {/* Aceternity UI Cloud Shader (Plane Window demo) — same sky colours as the home hero, half size scaled 2× */}
                    <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
                      <CloudShader speed={1} count={mobile ? 3 : 6} skyTopColor="#0646c8" skyBottomColor="#3f8ef0" className="absolute inset-0" />
                    </div>
                  </motion.div>
                )}
                {/* glass: a soft rim + one diagonal reflection */}
                <div aria-hidden className="pointer-events-none absolute inset-0 z-[15] rounded-t-[42px] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.25),inset_0_30px_60px_-30px_rgba(255,255,255,0.45)] md:rounded-t-[94px]" />

                <div className="relative z-20 px-6 pt-10 md:px-14 md:pt-14">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-2.5 py-0.5 text-[11px] font-semibold text-white backdrop-blur-md">
                    <Plane className="h-3 w-3" /> Seat 12A · Window
                  </span>
                  <h2 className="mt-3 max-w-md text-2xl font-extrabold tracking-tight text-white [text-shadow:0_2px_16px_rgba(5,25,70,0.55)] md:text-4xl">
                    Your window seat to <span className="font-display font-normal italic text-gradient-sun">anywhere</span>
                  </h2>
                  <p className="mt-2 max-w-sm text-sm text-white/90 [text-shadow:0_1px_10px_rgba(5,25,70,0.5)]">
                    7,900 airports, hub connections when there&apos;s no direct flight, and live status once you&apos;re up there.
                  </p>
                  <div className="mt-5 flex flex-wrap items-center gap-2">
                    <Link href="/?tab=flight#search" className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-ink shadow-lg transition hover:bg-white/90">
                      Book a flight
                    </Link>
                    <Link href="/flights/status" className="rounded-full border border-white/40 px-5 py-2 text-sm font-semibold text-white transition hover:bg-white/10">
                      Track a flight
                    </Link>
                  </div>
                </div>

                <motion.div
                  className="pointer-events-none absolute -bottom-2 -right-[8%] z-10 w-[64%] sm:bottom-0 sm:right-0 sm:w-[52%]"
                  animate={{ y: [0, -8, 0] }}
                  transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                >
                  <Image src="/images/plane-wing.png" alt="Aeroplane wing above the clouds" width={2200} height={1227} className="h-auto w-full -scale-x-100" />
                </motion.div>
              </div>
            </div>
          </div>
        </div>

        {/* what flying with us gets you */}
        <div className="relative flex flex-col overflow-hidden rounded-3xl bg-ink p-5 dotted-glow-bg sm:p-6 md:h-[420px]">
          <div className="bg-grid absolute inset-0 opacity-30 [mask-image:radial-gradient(ellipse_at_top,black,transparent_75%)]" />
          <div className="relative">
            <div className="flex gap-2">
              {[PlaneTakeoff, Route, BookUser].map((I, i) => (
                <span key={i} className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/10 text-white"><I className="h-4 w-4" /></span>
              ))}
            </div>
            <h3 className="mt-4 text-2xl font-extrabold leading-tight text-white">Flights, done properly</h3>
            <p className="mt-2 text-sm text-white/60">Everything you&apos;d want before, during and after the flight.</p>
          </div>
          <ul className="relative mt-5 space-y-2.5 text-sm">
            {[
              ["Live flight status", "/flights/status"],
              ["Airport departures & arrivals board", "/flights/airport"],
              ["1-stop & 2-stop connections", "/?tab=flight#search"],
              ["Pick window, aisle or extra legroom", "/?tab=flight#search"],
              ["Child & infant fares", "/?tab=flight#search"],
              ["Add passports now or later", "/account"],
            ].map(([t, h]) => (
              <li key={t}>
                <Link href={h} className="group flex items-center gap-2.5 text-white/80 transition hover:text-white">
                  <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-mint shadow-[0_0_8px_rgba(16,185,129,0.9)]" />
                  {t}
                  <ArrowRight className="ml-auto h-3.5 w-3.5 opacity-0 transition group-hover:opacity-100" />
                </Link>
              </li>
            ))}
          </ul>
          <Link href="/flights/airport" className="relative mt-auto inline-flex items-center gap-1 pt-5 text-sm font-semibold text-brand-2 hover:text-brand">
            Open an airport board <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------ */
/* Feature bento — what the site can actually do                       */
/* ------------------------------------------------------------------ */

type Feature = { key: string; title: string; body: string; href: string; cta: string; icon: typeof Plane; span: string; tone: string; wash: string; tag: string; live?: boolean; visual: ReactNode; show: boolean };

export function FeatureBento() {
  const site = useSite();
  const train = isServiceOn(site, "train");
  const flight = isServiceOn(site, "flight");
  const features: Feature[] = [
    { key: "live", title: "Where's my train?", body: "Live running status with the delay at every station and the expected arrival.", href: "/trains/live", cta: "Check live status", icon: Radio, span: "md:col-span-2", tone: "from-sky-500 to-indigo-500", wash: "from-sky-50 via-indigo-50 to-white", tag: "Trains", live: true, visual: <TrainLine />, show: isTrainLiveOn(site) },
    { key: "pnr", title: "PNR status", body: "Confirmed, RAC or waitlist — coach and berth for every passenger, and whether the chart is out.", href: "/trains/pnr", cta: "Check a PNR", icon: Ticket, span: "md:col-span-2", tone: "from-violet-500 to-indigo-500", wash: "from-violet-50 via-indigo-50/60 to-white", tag: "Trains", live: true, visual: <MiniPnr />, show: isPnrOn(site) },
    { key: "fstatus", title: "Live flight status", body: "Gate, terminal, delay and where the plane is right now, for any flight number.", href: "/flights/status", cta: "Track a flight", icon: Plane, span: "md:col-span-2", tone: "from-[#0057ff] to-sky-400", wash: "from-blue-50 to-white", tag: "Flights", live: true, visual: <FlightProgress />, show: flight },
    { key: "board", title: "Airport live board", body: "Today's departures and arrivals at any airport, with delays and gates.", href: "/flights/airport", cta: "Open a board", icon: PlaneTakeoff, span: "md:col-span-2", tone: "from-amber-500 to-orange-500", wash: "from-amber-50 to-white", tag: "Flights", live: true, visual: <MiniBoard />, show: flight },
    { key: "seat", title: "Choose your seat", body: "A real cabin map: window, aisle, extra legroom. Seats are held while you pay.", href: "/?tab=flight#search", cta: "Find a flight", icon: BookUser, span: "md:col-span-2", tone: "from-violet-500 to-fuchsia-500", wash: "from-violet-50 via-fuchsia-50/60 to-white", tag: "Flights", visual: <MiniSeats />, show: flight },
    { key: "conn", title: "Smart connections", body: "No direct flight? We look through the big hubs for 1-stop and 2-stop options.", href: "/?tab=flight#search", cta: "Search a route", icon: Route, span: "md:col-span-2", tone: "from-emerald-500 to-teal-500", wash: "from-emerald-50 via-teal-50/60 to-white", tag: "Flights", visual: <MiniConnection />, show: flight },
    { key: "trains", title: "Trains with seat availability", body: "Every class, quota and coach in one view, with the fare broken down before you pay.", href: "/?tab=train#search", cta: "Search trains", icon: TrainFront, span: "md:col-span-2", tone: "from-rose-500 to-orange-400", wash: "from-rose-50 via-orange-50/60 to-white", tag: "Trains", visual: <MiniCoaches />, show: train },
    { key: "docs", title: "E-ticket & GST invoice", body: "PDF ticket and a proper GST invoice in My Trips, the moment your booking is issued.", href: "/account", cta: "Go to My Trips", icon: FileText, span: "md:col-span-2", tone: "from-slate-600 to-slate-800", wash: "from-slate-100 to-white", tag: "After booking", visual: <MiniDocs />, show: true },
    { key: "refund", title: "Refunds & help, tracked", body: "Raise a dispute or a refund from your booking and follow every step.", href: "/account", cta: "View bookings", icon: Undo2, span: "md:col-span-2", tone: "from-mint to-emerald-600", wash: "from-emerald-50 to-white", tag: "After booking", visual: <MiniRefund />, show: true },
  ].filter((f) => f.show);

  return (
    <section className="relative mx-auto max-w-7xl px-5 pt-24">
      {/* faint colour behind the grid so the glass cards have something to sit on */}
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-40 -z-10 mx-auto h-[70%] max-w-5xl bg-[radial-gradient(ellipse_at_center,rgba(0,87,255,0.08),transparent_65%),radial-gradient(ellipse_at_80%_80%,rgba(255,90,31,0.07),transparent_60%)] blur-2xl" />
      <motion.div {...fadeUp} transition={{ duration: 0.6 }} className="flex flex-col justify-between gap-4 md:flex-row md:items-end">
        <div className="max-w-2xl">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand"><Sparkles className="h-3 w-3" /> What you can do here</div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-[42px] md:leading-[1.1]">
            More than just a <span className="font-display font-normal italic text-gradient-deep">booking page</span>
          </h2>
          <p className="mt-3 text-base text-muted">Track, pick, connect and get your papers sorted, all from one account.</p>
        </div>
        <div className="flex items-center gap-2 self-start rounded-full border border-line bg-white px-3 py-1.5 text-xs font-semibold text-ink shadow-soft md:self-auto">
          <span className="relative flex h-2 w-2"><span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-mint opacity-60" /><span className="relative inline-flex h-2 w-2 rounded-full bg-mint" /></span>
          {features.filter((f) => f.live).length} live tools · {features.length} features
        </div>
      </motion.div>

      <div className="mt-10 grid gap-4 md:grid-cols-6">
        {features.map((f, i) => (
          <motion.div key={f.key} {...fadeUp} transition={{ duration: 0.5, delay: (i % 3) * 0.07 }} className={cn("min-h-[22rem]", f.span)}>
            {/* Aceternity Glowing Effect: the border lights up and follows the pointer */}
            <div className="relative h-full rounded-[1.6rem] border border-line bg-white/50 p-2 backdrop-blur-sm md:p-2.5">
              <GlowingEffect variant="brand" spread={40} glow disabled={false} proximity={64} inactiveZone={0.01} borderWidth={3} />
              <Link
                href={f.href}
                className="group relative flex h-full flex-col overflow-hidden rounded-[1.15rem] border border-line/70 bg-white p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.9),0_12px_30px_-20px_rgba(10,15,31,0.35)] md:p-5"
              >
                <div className={cn("relative overflow-hidden rounded-xl bg-gradient-to-br ring-1 ring-inset ring-black/[0.04]", f.wash, "h-40")}>
                  <div aria-hidden className="bg-dots absolute inset-0 opacity-60" />
                  <div className="absolute inset-0 transition duration-500 group-hover:scale-[1.03]">{f.visual}</div>
                  <span className="absolute left-2.5 top-2.5 z-10 flex items-center gap-1.5 rounded-full bg-white/90 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-ink shadow-sm backdrop-blur">
                    {f.live && <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-rose-500" />}
                    {f.live ? "Live" : f.tag}
                  </span>
                </div>

                <div className="mt-5 flex items-center gap-3">
                  <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br text-white shadow-[0_8px_20px_-8px_rgba(10,15,31,0.5)] ring-4 ring-white", f.tone)}>
                    <f.icon className="h-[18px] w-[18px]" />
                  </span>
                  <div className="min-w-0">
                    {f.live && <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{f.tag}</div>}
                    <h3 className="text-lg font-bold leading-tight tracking-tight text-ink">{f.title}</h3>
                  </div>
                </div>
                <p className="mt-2.5 text-sm leading-relaxed text-muted">{f.body}</p>

                <div className="mt-auto flex items-center justify-between border-t border-dashed border-line pt-4">
                  <span className="text-sm font-semibold text-ink transition group-hover:text-brand">{f.cta}</span>
                  <span className="flex h-8 w-8 items-center justify-center rounded-full border border-line bg-surface text-ink transition group-hover:border-brand group-hover:bg-brand group-hover:text-white">
                    <ArrowRight className="h-4 w-4 -rotate-45 transition group-hover:rotate-0" />
                  </span>
                </div>
              </Link>
            </div>
          </motion.div>
        ))}
      </div>
      <TrustRow />
    </section>
  );
}

function TrustRow() {
  const items = [
    { icon: ShieldCheck, t: "Razorpay secured payments", c: "bg-blue-50 text-[#0057ff]" },
    { icon: BadgeIndianRupee, t: "Coupons applied at checkout", c: "bg-orange-50 text-brand" },
    { icon: FileText, t: "GST invoice on every booking", c: "bg-slate-100 text-slate-700" },
    { icon: BookUser, t: "Saved travellers & passports", c: "bg-violet-50 text-violet-600" },
  ];
  return (
    <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 md:grid-cols-4">
      {items.map((x) => (
        <div key={x.t} className="relative rounded-2xl border border-line bg-white/50 p-1.5">
          <GlowingEffect variant="brand" spread={30} glow disabled={false} proximity={40} inactiveZone={0.01} borderWidth={2} />
          <div className="relative flex items-center gap-3 rounded-xl border border-line/70 bg-white px-3 py-2.5 text-sm font-semibold text-ink">
            <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", x.c)}><x.icon className="h-4 w-4" /></span>
            <span className="min-w-0">{x.t}</span>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ---- tiny illustrations (pure CSS / motion, no data, no requests) ---- */

function TrainLine() {
  const stops = ["NDLS", "AGC", "GWL", "BPL"];
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-6">
      <div className="relative flex items-center justify-between">
        <div className="absolute inset-x-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-line" />
        <motion.div className="absolute left-2 top-1/2 h-1 -translate-y-1/2 rounded-full bg-gradient-to-r from-sky-500 to-indigo-500" initial={{ width: 0 }} whileInView={{ width: "52%" }} viewport={{ once: true }} transition={{ duration: 1.6, ease: "easeOut" }} />
        {stops.map((s, i) => (
          <div key={s} className="relative z-10 flex flex-col items-center">
            <span className={cn("h-3.5 w-3.5 rounded-full border-2 border-white shadow", i < 2 ? "bg-indigo-500" : "bg-line")} />
            <span className="mt-2 text-[10px] font-bold text-ink">{s}</span>
          </div>
        ))}
      </div>
      <div className="mt-4 flex items-center justify-center gap-2 text-[11px] font-semibold">
        <span className="rounded-full bg-white px-2 py-0.5 text-ink shadow-sm">Left Agra Cantt 14:32</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">+12 min</span>
      </div>
    </div>
  );
}

function FlightProgress() {
  return (
    <div className="absolute inset-0 flex flex-col justify-center bg-gradient-to-br from-[#0b4fc4] to-[#3f8ef0] px-6 text-white">
      <div className="flex items-end justify-between">
        <div><div className="text-2xl font-extrabold">DEL</div><div className="text-[10px] text-white/75">T3 · Gate 42</div></div>
        <div className="text-right"><div className="text-2xl font-extrabold">BOM</div><div className="text-[10px] text-white/75">T2 · Belt 6</div></div>
      </div>
      <div className="relative mt-3 h-1.5 rounded-full bg-white/25">
        <motion.div className="absolute left-0 top-0 h-full rounded-full bg-white" initial={{ width: 0 }} whileInView={{ width: "64%" }} viewport={{ once: true }} transition={{ duration: 1.8, ease: "easeOut" }} />
        <motion.span className="absolute top-1/2 -translate-x-1/2 -translate-y-1/2" initial={{ left: "0%" }} whileInView={{ left: "64%" }} viewport={{ once: true }} transition={{ duration: 1.8, ease: "easeOut" }}>
          <Plane className="h-4 w-4 rotate-45 fill-white" />
        </motion.span>
      </div>
      <div className="mt-3 flex justify-between text-[11px] font-semibold"><span>In the air · 37,000 ft</span><span className="text-emerald-200">Lands 08:22</span></div>
    </div>
  );
}

function MiniBoard() {
  const rows = [["06:10", "6E 2134", "Mumbai", "Departed", "bg-emerald-400/20 text-emerald-300"], ["06:35", "AI 805", "Bengaluru", "Boarding", "bg-sky-400/20 text-sky-300"], ["06:50", "UK 951", "Kolkata", "Delayed", "bg-amber-400/20 text-amber-300"], ["07:05", "QP 1402", "Goa", "On time", "text-white/80"]];
  return (
    <div className="absolute inset-0 bg-ink p-3 pt-10 font-mono text-[10.5px] text-white/90">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-amber-300"><PlaneTakeoff className="h-3 w-3" /> Departures · DEL</div>
      {rows.map((r, i) => (
        <motion.div key={r[1]} initial={{ opacity: 0, rotateX: -90 }} whileInView={{ opacity: 1, rotateX: 0 }} viewport={{ once: true }} transition={{ delay: 0.15 * i }} className="grid grid-cols-[38px_58px_1fr_auto] gap-1.5 border-t border-white/10 py-1">
          <span>{r[0]}</span><span className="text-white">{r[1]}</span><span className="truncate">{r[2]}</span>
          <span className={cn("rounded px-1 font-sans font-semibold", r[4])}>{r[3]}</span>
        </motion.div>
      ))}
    </div>
  );
}

function MiniSeats() {
  const taken = new Set([1, 4, 8, 9, 15, 19, 22]);
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="grid grid-cols-[repeat(3,18px)_12px_repeat(3,18px)] gap-1.5">
        {Array.from({ length: 24 }).flatMap((_, i) => {
          const cell = (
            <span key={i} className={cn("h-[18px] w-[18px] rounded-[5px] border", i === 12 ? "border-brand bg-brand shadow-[0_0_0_3px_rgba(255,90,31,0.25)]" : taken.has(i) ? "border-line bg-line" : "border-violet-300 bg-white")} />
          );
          return i % 6 === 3 ? [<span key={`a${i}`} />, cell] : [cell];
        })}
      </div>
      <span className="absolute bottom-2 right-3 rounded-full bg-brand px-2 py-0.5 text-[10px] font-bold text-white">12A · Window</span>
    </div>
  );
}

function MiniConnection() {
  const pts = [["DEL", "Delhi"], ["PEK", "Beijing"], ["UBN", "Ulaanbaatar"]];
  return (
    <div className="absolute inset-0 flex items-center justify-between px-5">
      {pts.map(([c, n], i) => (
        <div key={c} className="contents">
          <div className="flex flex-col items-center">
            <span className={cn("flex h-10 w-10 items-center justify-center rounded-full text-[11px] font-extrabold", i === 1 ? "bg-emerald-100 text-emerald-700" : "bg-white text-ink shadow")}>{c}</span>
            <span className="mt-1 text-[9.5px] font-medium text-muted">{n}</span>
          </div>
          {i < 2 && (
            <div className="relative mx-1 mb-4 h-px flex-1 border-t-2 border-dashed border-emerald-300">
              <motion.span className="absolute -top-2.5" initial={{ left: "0%" }} whileInView={{ left: "80%" }} viewport={{ once: true }} transition={{ duration: 1.4, delay: i * 1.2 }}>
                <Plane className="h-4 w-4 rotate-45 text-emerald-600" />
              </motion.span>
            </div>
          )}
        </div>
      ))}
      <span className="absolute right-3 top-2 rounded-full bg-white px-2 py-0.5 text-[10px] font-semibold text-emerald-700 shadow-sm">1 stop · 2h 40m layover</span>
    </div>
  );
}

function MiniCoaches() {
  const cls = [["2A", "AVL 12", "text-emerald-600"], ["3A", "RAC 4", "text-amber-600"], ["SL", "WL 18", "text-rose-600"]];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-2 px-4">
      <div className="flex gap-1">
        {["E", "H1", "A1", "B1", "B2", "S1", "S2"].map((c, i) => (
          <span key={c} className={cn("flex h-6 flex-1 items-center justify-center rounded-md text-[9px] font-bold text-white", i === 0 ? "bg-ink" : i < 3 ? "bg-indigo-500" : i < 5 ? "bg-sky-500" : "bg-orange-400")}>{c}</span>
        ))}
      </div>
      <div className="grid grid-cols-3 gap-1.5">
        {cls.map(([c, s, t]) => (
          <div key={c} className="rounded-xl bg-white p-2 text-center shadow-sm">
            <div className="text-xs font-extrabold text-ink">{c}</div>
            <div className={cn("text-[10px] font-bold", t)}>{s}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MiniDocs() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <motion.div initial={{ rotate: -8, x: -14 }} whileInView={{ rotate: -10, x: -26 }} viewport={{ once: true }} className="absolute h-28 w-20 rounded-lg border border-line bg-white p-2 shadow">
        <div className="text-[8px] font-bold text-muted">TAX INVOICE</div>
        {[...Array(5)].map((_, i) => <div key={i} className="mt-1.5 h-1 rounded bg-line" style={{ width: `${90 - i * 12}%` }} />)}
      </motion.div>
      <motion.div initial={{ rotate: 6, x: 14 }} whileInView={{ rotate: 8, x: 26 }} viewport={{ once: true }} className="absolute h-28 w-20 rounded-lg border border-line bg-white p-2 shadow-md">
        <div className="text-[8px] font-bold text-brand">E-TICKET</div>
        <div className="mt-1 text-[11px] font-extrabold text-ink">DEL → BOM</div>
        <div className="mt-2 grid grid-cols-4 gap-0.5">{[...Array(16)].map((_, i) => <span key={i} className={cn("h-2 w-2", (i * 7) % 3 ? "bg-ink" : "bg-transparent")} />)}</div>
      </motion.div>
    </div>
  );
}

function MiniRefund() {
  const steps = ["Requested", "Approved", "Credited"];
  return (
    <div className="absolute inset-0 flex flex-col justify-center px-5">
      <div className="flex items-baseline justify-between">
        <span className="text-xl font-extrabold text-ink">₹2,340</span>
        <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600"><PlaneLanding className="h-3 w-3" /> to source account</span>
      </div>
      <div className="mt-3 flex items-center">
        {steps.map((s, i) => (
          <div key={s} className="flex flex-1 items-center last:flex-none">
            <motion.span initial={{ scale: 0.4, backgroundColor: "#e7e9f2" }} whileInView={{ scale: 1, backgroundColor: "#10b981" }} viewport={{ once: true }} transition={{ delay: 0.35 * i }} className="h-3.5 w-3.5 rounded-full" />
            {i < 2 && <motion.span initial={{ scaleX: 0 }} whileInView={{ scaleX: 1 }} viewport={{ once: true }} transition={{ delay: 0.35 * i + 0.15 }} className="h-0.5 flex-1 origin-left bg-emerald-400" />}
          </div>
        ))}
      </div>
      <div className="mt-1.5 flex justify-between text-[10px] font-medium text-muted">{steps.map((s) => <span key={s}>{s}</span>)}</div>
    </div>
  );
}

function MiniPnr() {
  const rows = [["1", "WL 12", "CNF", "B4 · 32 LB", "bg-emerald-50 text-emerald-700"], ["2", "WL 13", "RAC 7", "S2 · 7", "bg-amber-50 text-amber-700"]];
  return (
    <div className="absolute inset-0 flex flex-col justify-center gap-1.5 px-4 pt-6">
      <div className="flex items-center justify-between text-[10px] font-bold">
        <span className="font-mono tracking-widest text-ink/70">PNR 482-1937605</span>
        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-700">Chart not prepared</span>
      </div>
      {rows.map((r, i) => (
        <motion.div key={r[0]} initial={{ opacity: 0, x: -10 }} whileInView={{ opacity: 1, x: 0 }} viewport={{ once: true }} transition={{ delay: 0.2 * i }} className="flex items-center gap-2 rounded-xl bg-white px-2.5 py-1.5 text-[11px] shadow-sm">
          <span className="flex h-5 w-5 items-center justify-center rounded-md bg-surface font-mono font-bold">{r[0]}</span>
          <span className="font-mono text-muted line-through">{r[1]}</span>
          <ArrowRight className="h-3 w-3 text-muted" />
          <span className={cn("rounded-md px-1.5 py-0.5 font-extrabold", r[4])}>{r[2]}</span>
          <span className="ml-auto font-mono font-semibold text-ink">{r[3]}</span>
        </motion.div>
      ))}
    </div>
  );
}

/** Under the home search: the PNRs this person has checked (renders nothing until they've checked one). */
export function HomeSavedPnrs() {
  return <SavedPnrs className="mx-auto max-w-7xl px-5 pt-10" />;
}
