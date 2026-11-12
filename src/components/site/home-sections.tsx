"use client";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useRef, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowLeft, ArrowRight, BadgePercent, BusFront, Building2, CalendarClock, Clock3, CreditCard, Gift, Headphones, Palmtree, Plane,
  ShieldCheck, Smartphone, Sparkles, TrainFront, Undo2, Wallet, MapPin,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { FlipWords } from "@/components/ui/flip-words";
import { HoverEffect } from "@/components/ui/hover-effect";
import { CardBody, CardContainer, CardItem } from "@/components/ui/card-3d";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { SearchWidget } from "./search-widget";
import { useSite } from "@/lib/client/providers";
import { Meteors } from "@/components/ui/meteors";
import { CloudShader } from "@/components/ui/cloud-shader";
import { isServiceOn, type ServiceKey } from "@/lib/services";
import { IMAGES, img } from "@/lib/utils";
import { SkyClouds } from "@/components/ui/sky-clouds";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6 } };

export function Hero() {
  const site = useSite();
  return (
    <section className="relative -mt-20 overflow-hidden pb-44 pt-32 md:pb-52 md:pt-40">
      {/* Aceternity UI Cloud Shader sky — rendered at half size and scaled up (same as their demo) */}
      <div className="absolute inset-0 bg-gradient-to-t from-[#3f8ef0] to-[#0646c8]" />
      <motion.div aria-hidden className="absolute inset-0" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 1.4, ease: "easeOut" }}>
        <div className="absolute h-1/2 w-1/2 origin-top-left scale-200">
          <CloudShader speed={1} count={6} skyTopColor="#0646c8" skyBottomColor="#3f8ef0" className="absolute inset-0" />
        </div>
      </motion.div>
      {/* soft dark pool behind the headline + fade into the page */}
      <div aria-hidden className="absolute inset-0 bg-[radial-gradient(ellipse_55%_42%_at_50%_34%,rgba(3,25,80,0.32),transparent_75%)]" />
      <div aria-hidden className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-b from-transparent to-[#f6f7fb]" />
      <FlightPath />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <motion.div initial={false} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_8px_30px_-12px_rgba(0,30,90,0.5)] backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> India&apos;s smartest way to travel · {site.site_name}
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-center text-4xl font-lux font-bold leading-[1.06] tracking-[-0.01em] text-white drop-shadow-[0_4px_24px_rgba(0,40,120,0.35)] md:text-7xl">
          Book{" "}
          <FlipWords words={["flights", "trains", "buses", "hotels", "holidays"]} className="font-lux font-bold italic text-gradient-sun" />
          <br className="hidden md:block" /> <span className="relative">without the chaos.</span>
        </h1>
        <motion.p initial={false} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto mt-6 max-w-2xl text-center text-base font-medium text-white/90 [text-shadow:0_1px_12px_rgba(0,40,120,0.45)] md:text-lg">
          {site.site_tagline} Confirmed-seat predictions, instant refunds and zero hidden fees.
        </motion.p>
        <div className="mx-auto mt-8 flex max-w-xl flex-wrap justify-center gap-x-8 gap-y-3 text-sm text-white/80 [text-shadow:0_1px_10px_rgba(0,40,120,0.45)]">
          {[["10Cr+", "tickets booked"], ["4.8★", "app rating"], ["₹0", "convenience fee on UPI"]].map(([a, b]) => (
            <div key={b} className="flex items-baseline gap-2">
              <span className="text-xl font-extrabold text-white">{a}</span>
              {b}
            </div>
          ))}
        </div>
      </div>

      {/* floating boarding passes (desktop) */}
      <motion.div initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.6, type: "spring" }} className="absolute left-[4%] top-[46%] z-10 hidden w-60 -rotate-6 xl:block">
        <div className="animate-float rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_24px_60px_-20px_rgba(10,15,31,0.45)] backdrop-blur-xl">
          <div className="flex items-center justify-between text-[10px] font-bold uppercase tracking-wider text-muted"><span>Boarding pass</span><Plane className="h-3.5 w-3.5 text-brand" /></div>
          <div className="mt-2 flex items-end justify-between">
            <div><div className="text-2xl font-extrabold text-ink">DEL</div><div className="text-[10px] text-muted">06:15</div></div>
            <div className="mb-2 flex-1 border-t-2 border-dashed border-ink/15 mx-2" />
            <div className="text-right"><div className="text-2xl font-extrabold text-ink">BOM</div><div className="text-[10px] text-muted">08:25</div></div>
          </div>
          <div className="mt-3 flex items-center justify-between rounded-xl bg-surface px-3 py-2 text-[11px] font-semibold"><span>Seat 12A · Window</span><span className="text-mint">On time</span></div>
        </div>
      </motion.div>
      <motion.div initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.8, type: "spring" }} className="absolute right-[4%] top-[40%] z-10 hidden w-56 rotate-6 xl:block">
        <div className="animate-float rounded-2xl border border-white/60 bg-white/80 p-4 shadow-[0_24px_60px_-20px_rgba(10,15,31,0.45)] backdrop-blur-xl [animation-delay:1.2s]">
          <div className="flex items-center gap-2 text-[11px] font-bold text-mint"><span className="h-1.5 w-1.5 rounded-full bg-mint" /> FARE ALERT</div>
          <div className="mt-1.5 text-sm font-bold text-ink">Bengaluru → Goa</div>
          <div className="mt-1 flex items-baseline gap-2"><span className="text-2xl font-extrabold text-ink">₹2,899</span><span className="text-xs text-muted line-through">₹4,150</span></div>
          <div className="mt-2 text-[11px] font-medium text-muted">Lowest this month · Fri, 14 Nov</div>
        </div>
      </motion.div>
    </section>
  );
}

export function Clouds() {
  return <SkyClouds className="[mask-image:radial-gradient(ellipse_46%_40%_at_50%_46%,transparent_45%,black_85%)]" />;
}

/** Plane flying along a dashed arc across the sky. */
export function FlightPath() {
  const d = "M -80 420 C 300 120, 820 80, 1600 260";
  return (
    <>
    <div aria-hidden className="pointer-events-none absolute inset-0 hidden md:block">
      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 700" preserveAspectRatio="xMidYMid slice">
        <motion.path d={d} fill="none" stroke="white" strokeWidth="2" strokeDasharray="6 10" strokeLinecap="round" initial={{ pathLength: 0, opacity: 0 }} animate={{ pathLength: 1, opacity: 0.8 }} transition={{ duration: 2.4, ease: "easeInOut" }} />
        <g>
          <path d="M0 0 L18 6 L36 2 L40 6 L36 10 L18 6 Z" fill="white" opacity="0" />
          <g>
            <animateMotion dur="14s" repeatCount="indefinite" rotate="auto" path={d} />
            <g transform="translate(-22,-14)">
              <path d="M44 14c0-1.6-1.4-3-3.2-3H30L19.5 0h-4l5 11H11L7.6 6.6H4.4L6.6 14l-2.2 7.4h3.2L11 17h9.5l-5 11h4L30 17h10.8c1.8 0 3.2-1.4 3.2-3z" fill="white" />
              <path d="M44 14c0-1.6-1.4-3-3.2-3H30L19.5 0h-4l5 11H11L7.6 6.6H4.4L6.6 14l-2.2 7.4h3.2L11 17h9.5l-5 11h4L30 17h10.8c1.8 0 3.2-1.4 3.2-3z" fill="#ff5a1f" opacity="0.15" />
            </g>
          </g>
        </g>
      </svg>
    </div>
    <svg aria-hidden="true" className="pointer-events-none absolute left-0 top-[18%] h-36 w-full overflow-visible opacity-80 md:hidden" viewBox="0 0 390 140" preserveAspectRatio="none">
      <path d="M -24 116 C 72 16, 288 16, 414 116" fill="none" stroke="rgba(255,255,255,.34)" strokeWidth="1.6" strokeDasharray="4 8" />
    </svg>
    <motion.div aria-hidden className="pointer-events-none absolute left-0 top-[18%] z-[1] text-white drop-shadow-[0_2px_8px_rgba(0,30,90,.4)] md:hidden" initial={{ x: "2vw", y: 55 }} animate={{ x: ["2vw", "84vw"], y: [55, 4, 4, 55] }} transition={{ duration: 13, repeat: Infinity, ease: "linear" }}>
      <Plane className="h-6 w-6 fill-white stroke-white" />
    </motion.div>
    </>
  );
}

export function SearchSection() {
  return (
    <section className="relative z-20 mx-auto -mt-32 max-w-7xl px-3 md:-mt-36 md:px-5">
      <Suspense fallback={<div className="h-48 rounded-[28px] bg-white" />}>
        <SearchWidget />
      </Suspense>
    </section>
  );
}

const SERVICES = [
  { key: "train", title: "Trains", sub: "IRCTC authorised · Tatkal", icon: TrainFront, image: IMAGES.train },
  { key: "flight", title: "Flights", sub: "Lowest fares, 500+ routes", icon: Plane, image: IMAGES.plane },
  { key: "bus", title: "Buses", sub: "4000+ operators", icon: BusFront, image: IMAGES.bus },
  { key: "hotel", title: "Hotels", sub: "Stays from ₹799", icon: Building2, image: IMAGES.resort },
  { key: "package", title: "Packages", sub: "Curated holidays", icon: Palmtree, image: IMAGES.kerala },
];

export function ServicesStrip() {
  const site = useSite();
  const scroller = useRef<HTMLDivElement>(null);
  const list = SERVICES.filter((x) => isServiceOn(site, x.key as ServiceKey));
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-5 sm:pt-20">
      <div className="flex items-end justify-between gap-4">
        <SectionHead eyebrow="Everything in one app" title={list.length === 5 ? "Five ways to get" : "Ways to get"} accent="going" sub="One login, one wallet, every mode of travel." />
        <div className="mb-1 flex shrink-0 gap-1.5 md:hidden">
          <button aria-label="Scroll services left" onClick={() => scroller.current?.scrollBy({ left: -300, behavior: "smooth" })} className="flex h-10 w-10 items-center justify-center rounded-full border border-line bg-white text-ink shadow-soft"><ArrowLeft className="h-4 w-4" /></button>
          <button aria-label="Scroll services right" onClick={() => scroller.current?.scrollBy({ left: 300, behavior: "smooth" })} className="flex h-10 w-10 items-center justify-center rounded-full bg-ink text-white shadow-soft"><ArrowRight className="h-4 w-4" /></button>
        </div>
      </div>
      <div ref={scroller} className={`no-scrollbar mt-6 -mr-4 flex snap-x snap-proximity gap-3 overflow-x-auto overflow-y-clip overscroll-x-contain pb-4 pr-4 sm:mt-8 sm:mr-0 sm:grid sm:overflow-visible sm:pb-0 sm:pr-0 sm:gap-4 ${list.length >= 5 ? "sm:grid-cols-3 md:grid-cols-5" : list.length === 4 ? "sm:grid-cols-2 md:grid-cols-4" : "sm:grid-cols-2 md:grid-cols-3"}`}>
        {list.map((x, i) => (
          <div key={x.key} className="w-[76vw] max-w-[300px] shrink-0 snap-start sm:w-auto sm:max-w-none"><ServiceCard s={x} i={i} /></div>
        ))}
      </div>
    </section>
  );
}

function ServiceCard({ s, i }: { s: (typeof SERVICES)[number]; i: number }) {
  const [hover, setHover] = useState(false);
  return (
    <motion.div {...fadeUp} transition={{ duration: 0.5, delay: i * 0.07 }} style={{ perspective: 900 }}>
      <motion.div
        onHoverStart={() => setHover(true)}
        onHoverEnd={() => setHover(false)}
        whileHover={{ rotateX: 4, rotateY: -6, y: -6 }}
        transition={{ type: "spring", stiffness: 220, damping: 18 }}
        className="relative"
        style={{ transformStyle: "preserve-3d" }}
      >
        <Link href={`/?tab=${s.key}#search`} className="group relative block aspect-[4/5] overflow-hidden rounded-3xl shadow-[0_20px_50px_-24px_rgba(10,15,31,0.55)] ring-1 ring-white/40">
          <Image src={img(s.image, 600)} alt={s.title} fill sizes="(max-width:768px) 50vw, 20vw" className="object-cover transition duration-700 group-hover:scale-110" />
          {/* only a soft fade at the bottom — the photo stays bright */}
          <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/55 via-black/10 to-transparent" />
          {hover && (
            <div className="pointer-events-none absolute inset-0 overflow-hidden">
              <Meteors number={10} />
            </div>
          )}
          <span className="pointer-events-none absolute -left-1/2 top-0 h-full w-1/3 -skew-x-12 bg-gradient-to-r from-transparent via-white/40 to-transparent opacity-0 transition-all duration-700 group-hover:left-[120%] group-hover:opacity-100" />
          <div className="absolute inset-x-2.5 bottom-2.5 rounded-2xl border border-white/30 bg-white/15 p-3 text-white backdrop-blur-md" style={{ transform: "translateZ(30px)" }}>
            <div className="flex items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white text-brand shadow-lg transition group-hover:bg-brand group-hover:text-white"><s.icon className="h-[18px] w-[18px]" /></span>
              <div className="min-w-0">
                <div className="text-base font-extrabold leading-tight">{s.title}</div>
                <div className="truncate text-[11px] font-medium text-white/85">{s.sub}</div>
              </div>
            </div>
          </div>
          <span className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow transition group-hover:opacity-100"><ArrowRight className="h-4 w-4 -rotate-45" /></span>
        </Link>
      </motion.div>
    </motion.div>
  );
}

export function Offers() {
  return (
    <section className="mx-auto max-w-7xl px-4 pt-14 sm:px-5 sm:pt-24">
      <SectionHead eyebrow="Offers for you" title="Deals that actually" accent="save" sub="Auto-applied at checkout. No coupon hunting." />
      <HoverEffect
        className="mt-8"
        items={[
          { title: "Flat 12% off flights", description: "On your first domestic flight booking. Max ₹1,500. Use code SKYFIRST.", icon: <Plane className="h-6 w-6" />, badge: "New user" },
          { title: "₹0 payment gateway fee", description: "Pay with any UPI app for trains — no PG charges, ever.", icon: <Wallet className="h-6 w-6" />, tone: "bg-mint/10 text-mint" },
          { title: "Free cancellation", description: "Cancel train tickets & get full fare back — not just the refundable part.", icon: <Undo2 className="h-6 w-6" />, tone: "bg-iris/10 text-iris" },
          { title: "Up to 30% off hotels", description: "Handpicked stays across 1,200+ cities with pay-at-hotel option.", icon: <BadgePercent className="h-6 w-6" />, tone: "bg-sky/10 text-sky-600", badge: "Hot" },
        ]}
      />
    </section>
  );
}

const DESTS = [
  { name: "Kashmir", tag: "Paradise on earth", price: "₹18,999", basis: "couple", image: IMAGES.kashmir, days: "5N/6D" },
  { name: "Kerala", tag: "Backwaters & tea hills", price: "₹14,499", basis: "couple", image: IMAGES.keralaBoat, days: "4N/5D" },
  { name: "Goa", tag: "Sun, sand & shacks", price: "₹9,999", basis: "person", image: IMAGES.goa, days: "3N/4D" },
  { name: "Jaipur", tag: "The pink city", price: "₹7,499", basis: "person", image: IMAGES.jaipur, days: "2N/3D" },
  { name: "Manali", tag: "Snow & cafés", price: "₹11,999", basis: "couple", image: IMAGES.manali, days: "4N/5D" },
  { name: "Agra", tag: "Wonder of the world", price: "₹4,999", basis: "person", image: IMAGES.tajArch, days: "1N/2D" },
] as const;

export function Destinations() {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-24">
      <SectionHead size="sm" eyebrow="Trending this season" title="Where India is" accent="heading" sub="Packages with stays, transfers & sightseeing — all included." />
      <div className="mt-6 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {DESTS.map((d) => (
          <CardContainer key={d.name} className="w-full" containerClassName="py-6">
            <Link href={`/packages?destination=${encodeURIComponent(d.name)}`} className="block w-full">
              <CardBody className="group/card relative h-auto w-full rounded-3xl border border-line bg-white p-4 shadow-soft hover:shadow-lift">
                <CardItem translateZ={60} className="relative h-56 w-full overflow-hidden rounded-2xl">
                  <Image src={img(d.image, 800)} alt={d.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-700 group-hover/card:scale-105" />
                  <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink backdrop-blur">{d.days}</span>
                  <span className={`absolute right-3 top-3 flex items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-bold backdrop-blur ${d.basis === "couple" ? "bg-rose-500/90 text-white" : "bg-ink/80 text-white"}`}>
                    {d.basis === "couple" ? "♥ Couple · 2 guests" : "Per person"}
                  </span>
                </CardItem>
                <div className="mt-4 flex items-end justify-between gap-3 px-1">
                  <div className="min-w-0">
                    <CardItem translateZ={40} as="h3" className="flex items-center gap-1.5 text-lg font-bold tracking-tight text-ink">
                      <MapPin className="h-4 w-4 shrink-0 text-brand" /> {d.name}
                    </CardItem>
                    <CardItem translateZ={30} as="p" className="mt-0.5 truncate text-[13px] text-muted">{d.tag}</CardItem>
                  </div>
                  <CardItem translateZ={50} className="shrink-0 text-right">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-muted">from</div>
                    <div className="text-lg font-extrabold leading-tight text-ink">{d.price}</div>
                    <div className="text-[11px] font-semibold text-muted">{d.basis === "couple" ? "per couple" : "per person"}</div>
                  </CardItem>
                </div>
              </CardBody>
            </Link>
          </CardContainer>
        ))}
      </div>
    </section>
  );
}

export function WhyUs() {
  const site = useSite();
  const items = [
    { icon: CalendarClock, title: "Confirm-ticket prediction", body: "Live waitlist confirmation chances on every class, before you pay.", tint: "from-sky-500 to-indigo-500", span: "md:col-span-2" },
    { icon: Undo2, title: "Instant refunds", body: "Refunds go back to your source account — no wallet lock-in.", tint: "from-emerald-500 to-teal-500" },
    { icon: ShieldCheck, title: "Bank-grade security", body: "Encrypted personal data, OTP login and no stored card numbers.", tint: "from-violet-500 to-fuchsia-500" },
    { icon: Headphones, title: "Human support", body: "Real people on chat and call when a trip needs a hand.", tint: "from-orange-500 to-rose-500", span: "md:col-span-2" },
  ];
  return (
    <section className="relative mt-16 overflow-hidden bg-[linear-gradient(180deg,#f6f7fb_0%,#fff8f1_55%,#f6f7fb_100%)] py-16 md:mt-20 md:py-20">
      <div aria-hidden className="absolute -left-24 top-10 h-72 w-72 rounded-full bg-orange-200/40 blur-3xl" />
      <div aria-hidden className="absolute -right-24 bottom-10 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
      <div className="relative mx-auto max-w-7xl px-5">
        <SectionHead eyebrow={`Why ${site.site_name}`} title="Built for the way India" accent="travels" sub="Thoughtful features that make every trip calmer." />
        <div className="mt-8 grid gap-3 md:grid-cols-3 md:gap-4">
          {items.map((it, i) => (
            <motion.div key={it.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }} className={it.span}>
              <div className="group flex h-full items-start gap-4 rounded-[24px] border border-line bg-white/90 p-5 shadow-soft backdrop-blur transition hover:-translate-y-0.5 hover:shadow-lift md:p-6">
                <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br ${it.tint} text-white shadow-[0_10px_24px_-12px_rgba(10,15,31,.5)]`}>
                  <it.icon className="h-5 w-5" />
                </span>
                <div className="min-w-0">
                  <h3 className="font-lux text-lg font-bold text-ink md:text-xl">{it.title}</h3>
                  <p className="mt-1 max-w-md text-sm leading-relaxed text-muted">{it.body}</p>
                </div>
              </div>
            </motion.div>
          ))}
        </div>
        <div className="mt-14">
          <SectionHead eyebrow="Loved by travellers" title="What travellers" accent="say" />
          <InfiniteMovingCards
            className="mx-auto mt-4"
            speed="slow"
            items={[
              { quote: "Got a confirmed Tatkal seat on the Rajdhani in under a minute. The prediction was spot on.", name: "Ananya Sharma", title: "Delhi → Mumbai" },
              { quote: "Cancelled my train and the full amount was back in my account before I reached home.", name: "Rohit Verma", title: "Lucknow → Varanasi" },
              { quote: "Booked flight + hotel for our honeymoon in Kashmir. Everything was seamless.", name: "Priya & Karan", title: "Srinagar package" },
              { quote: "Clean app, no spammy pop-ups, and the live train status is genuinely accurate.", name: "Arjun Nair", title: "Kochi → Bengaluru" },
              { quote: "Sleeper bus to Goa with live tracking — my parents could see where we were all night.", name: "Sneha Kulkarni", title: "Pune → Goa" },
            ]}
          />
        </div>
      </div>
    </section>
  );
}

export function AppCta() {
  const site = useSite();
  return (
    <section className="mx-auto max-w-7xl px-5 py-24">
      <div className="relative overflow-hidden rounded-[36px] bg-gradient-to-br from-brand via-[#ff6d2e] to-brand-2 p-10 md:p-16">
        <div className="bg-dots absolute inset-0 opacity-30" />
        <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/20 blur-3xl" />
        <div className="relative grid items-center gap-10 md:grid-cols-2">
          <div>
            <span className="inline-flex items-center gap-2 rounded-full bg-white/20 px-3 py-1 text-xs font-bold text-white"><Smartphone className="h-3.5 w-3.5" /> Coming soon on Android & iOS</span>
            <h2 className="mt-5 text-3xl font-lux font-bold leading-tight text-white md:text-5xl">Your whole trip, <span className="font-lux italic">in your pocket.</span></h2>
            <p className="mt-4 max-w-md text-white/85">Live PNR alerts, offline tickets, one-tap rebooking and app-only fares. Sign up today and your account carries over to the {site.site_name} app.</p>
            <div className="mt-8 flex flex-wrap gap-3">
              <MovingBorderButton as="a" href="/register" duration={3500}>
                Create free account <ArrowRight className="ml-2 h-4 w-4" />
              </MovingBorderButton>
              <Link href="/login" className="rounded-2xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10">Log in</Link>
            </div>
          </div>
          <div className="relative mx-auto hidden h-[340px] w-[300px] md:block">
            <motion.div className="absolute left-0 top-6 w-56 rotate-[-6deg] rounded-3xl bg-white p-4 shadow-lift animate-float">
              <div className="flex items-center gap-2 text-xs font-bold text-mint"><span className="h-2 w-2 rounded-full bg-mint" /> CONFIRMED · CNF</div>
              <div className="mt-3 text-sm font-bold text-ink">12952 · Mumbai Rajdhani</div>
              <div className="mt-2 flex items-center justify-between text-xs text-muted"><span>NDLS 16:55</span><TrainFront className="h-4 w-4 text-brand" /><span>MMCT 08:35</span></div>
              <div className="mt-3 rounded-xl bg-surface p-2.5 text-xs font-semibold text-ink">Coach B4 · Berth 32 (LB)</div>
            </motion.div>
            <motion.div className="absolute bottom-0 right-0 w-56 rotate-[5deg] rounded-3xl bg-ink p-4 text-white shadow-lift animate-float [animation-delay:1.5s]">
              <div className="flex items-center justify-between text-xs text-white/60"><span>Refund status</span><Clock3 className="h-3.5 w-3.5" /></div>
              <div className="mt-2 text-2xl font-extrabold">₹2,340</div>
              <div className="mt-1 text-xs text-mint">Credited to UPI · 2 min ago</div>
              <div className="mt-3 flex gap-2 text-[10px]"><span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1"><CreditCard className="h-3 w-3" /> UPI</span><span className="flex items-center gap-1 rounded-full bg-white/10 px-2 py-1"><Gift className="h-3 w-3" /> +50 coins</span></div>
            </motion.div>
          </div>
        </div>
      </div>
    </section>
  );
}

function SectionHead({ eyebrow, title, accent, sub, dark, size = "lg" }: { eyebrow: string; title: string; accent?: string; sub?: string; dark?: boolean; size?: "sm" | "lg" }) {
  return (
    <motion.div {...fadeUp} className="max-w-2xl">
      <p className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-[.28em] text-[#8a6a2f]">
        <span className="h-px w-5 bg-gradient-to-r from-transparent to-[#c79a4a]" />
        {eyebrow}
      </p>
      <h2 className={`mt-1.5 font-lux font-bold leading-tight tracking-[-0.01em] ${size === "sm" ? "text-[24px] md:text-[30px]" : "text-[26px] md:text-[38px]"} ${dark ? "text-white" : "text-ink"}`}>
        {title}
        {accent && <> <span className="bg-gradient-to-r from-[#b8740a] via-[#d9822b] to-[#ff5a1f] bg-clip-text pr-1 italic text-transparent">{accent}</span></>}
      </h2>
      {sub && <p className={`mt-1.5 text-sm md:text-[15px] ${dark ? "text-white/60" : "text-muted"}`}>{sub}</p>}
    </motion.div>
  );
}
