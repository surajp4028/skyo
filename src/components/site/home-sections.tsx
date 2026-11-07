"use client";
import Image from "next/image";
import Link from "next/link";
import { Suspense, useState } from "react";
import { motion } from "motion/react";
import {
  ArrowRight, BadgePercent, BusFront, Building2, CalendarClock, Clock3, CreditCard, Gift, Headphones, Palmtree, Plane,
  ShieldCheck, Smartphone, Sparkles, TrainFront, Undo2, Wallet, Star, MapPin,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { FlipWords } from "@/components/ui/flip-words";
import { HoverEffect } from "@/components/ui/hover-effect";
import { CardBody, CardContainer, CardItem } from "@/components/ui/card-3d";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { InfiniteMovingCards } from "@/components/ui/infinite-moving-cards";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { SearchWidget } from "./search-widget";
import { useSite } from "@/lib/client/providers";
import { Meteors } from "@/components/ui/meteors";
import { isServiceOn, type ServiceKey } from "@/lib/services";
import { IMAGES, img } from "@/lib/utils";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6 } };

export function Hero() {
  const site = useSite();
  return (
    <section className="relative -mt-20 overflow-hidden pb-44 pt-32 md:pb-52 md:pt-40">
      {/* bluish sky */}
      {/* clear, saturated daytime sky */}
      <div className="absolute inset-0 bg-[linear-gradient(180deg,#0057ff_0%,#0a74ff_28%,#2f94ff_55%,#6cbcff_78%,#cfe9ff_92%,#f6f7fb_100%)]" />
      <div className="absolute -right-16 -top-20 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,246,214,0.55)_22%,transparent_60%)]" />
      <Clouds />
      <FlightPath />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

      <div className="relative z-10 mx-auto max-w-7xl px-5">
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_8px_30px_-12px_rgba(0,30,90,0.5)] backdrop-blur-md">
          <Sparkles className="h-3.5 w-3.5 text-amber-300" /> India&apos;s smartest way to travel · {site.site_name}
        </motion.div>
        <h1 className="mx-auto max-w-4xl text-center text-4xl font-extrabold leading-[1.06] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,40,120,0.35)] md:text-7xl">
          Book{" "}
          <FlipWords words={["flights", "trains", "buses", "hotels", "holidays"]} className="font-display font-normal italic text-gradient-sun" />
          <br className="hidden md:block" /> <span className="relative">without the chaos.</span>
        </h1>
        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto mt-6 max-w-2xl text-center text-base font-medium text-white/90 [text-shadow:0_1px_12px_rgba(0,40,120,0.45)] md:text-lg">
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

function Clouds() {
  const clouds = [
    { top: "16%", w: 220, dur: 75, delay: -10, op: 0.95 },
    { top: "34%", w: 300, dur: 100, delay: -45, op: 0.9 },
    { top: "58%", w: 260, dur: 85, delay: -25, op: 0.95 },
    { top: "70%", w: 380, dur: 120, delay: -80, op: 0.9 },
  ];
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden [mask-image:radial-gradient(ellipse_46%_40%_at_50%_46%,transparent_45%,black_85%)]">
      {clouds.map((c, i) => (
        <div key={i} className="absolute left-0 animate-[drift_var(--d)_linear_infinite]" style={{ top: c.top, ["--d" as string]: `${c.dur}s`, animationDelay: `${c.delay}s`, opacity: c.op }}>
          <div className="relative" style={{ width: c.w, height: c.w * 0.32 }}>
            <span className="absolute bottom-0 left-0 h-[58%] w-full rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-[22%] left-[16%] h-[85%] w-[40%] rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-[28%] left-[44%] h-[105%] w-[38%] rounded-full bg-white blur-[2px]" />
            <span className="absolute bottom-0 left-[6%] h-[30%] w-[88%] rounded-full bg-sky-100/70 blur-[3px]" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Plane flying along a dashed arc across the sky. */
function FlightPath() {
  const d = "M -80 420 C 300 120, 820 80, 1600 260";
  return (
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
  const list = SERVICES.filter((x) => isServiceOn(site, x.key as ServiceKey));
  if (!list.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-5 pt-20">
      <SectionHead eyebrow="Everything in one app" title={list.length === 5 ? "Five ways to get going" : "Ways to get going"} sub="One login, one wallet, every mode of travel." />
      <div className={`mt-10 grid grid-cols-2 gap-4 ${list.length >= 5 ? "md:grid-cols-5" : list.length === 4 ? "md:grid-cols-4" : "md:grid-cols-3"}`}>
        {list.map((x, i) => (
          <ServiceCard key={x.key} s={x} i={i} />
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
    <section className="mx-auto max-w-7xl px-5 pt-24">
      <SectionHead eyebrow="Offers for you" title="Deals that actually save" sub="Auto-applied at checkout. No coupon hunting." />
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
  { name: "Kashmir", tag: "Paradise on earth", price: "₹18,999", image: IMAGES.kashmir, days: "5N/6D" },
  { name: "Kerala", tag: "Backwaters & tea hills", price: "₹14,499", image: IMAGES.keralaBoat, days: "4N/5D" },
  { name: "Goa", tag: "Sun, sand & shacks", price: "₹9,999", image: IMAGES.goa, days: "3N/4D" },
  { name: "Jaipur", tag: "The pink city", price: "₹7,499", image: IMAGES.jaipur, days: "2N/3D" },
  { name: "Manali", tag: "Snow & cafés", price: "₹11,999", image: IMAGES.manali, days: "4N/5D" },
  { name: "Agra", tag: "Wonder of the world", price: "₹4,999", image: IMAGES.tajArch, days: "1N/2D" },
];

export function Destinations() {
  return (
    <section className="mx-auto max-w-7xl px-5 pt-24">
      <SectionHead eyebrow="Trending this season" title="Where India is heading" sub="Packages with stays, transfers & sightseeing — all included." />
      <div className="mt-6 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3">
        {DESTS.map((d) => (
          <CardContainer key={d.name} className="w-full" containerClassName="py-6">
            <CardBody className="group/card relative h-auto w-full rounded-3xl border border-line bg-white p-4 shadow-soft hover:shadow-lift">
              <CardItem translateZ={60} className="relative h-56 w-full overflow-hidden rounded-2xl">
                <Image src={img(d.image, 800)} alt={d.name} fill sizes="(max-width:768px) 100vw, 33vw" className="object-cover transition duration-700 group-hover/card:scale-105" />
                <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold text-ink backdrop-blur">{d.days}</span>
              </CardItem>
              <div className="mt-4 flex items-end justify-between px-1">
                <div>
                  <CardItem translateZ={40} as="h3" className="flex items-center gap-1.5 text-xl font-extrabold text-ink">
                    <MapPin className="h-4 w-4 text-brand" /> {d.name}
                  </CardItem>
                  <CardItem translateZ={30} as="p" className="mt-0.5 text-sm text-muted">{d.tag}</CardItem>
                </div>
                <CardItem translateZ={50} className="text-right">
                  <div className="text-[11px] font-semibold text-muted">from</div>
                  <div className="text-lg font-extrabold text-ink">{d.price}</div>
                </CardItem>
              </div>
            </CardBody>
          </CardContainer>
        ))}
      </div>
    </section>
  );
}

export function WhyUs() {
  const site = useSite();
  const items = [
    { icon: CalendarClock, title: "Confirm-ticket prediction", body: "Our model predicts waitlist confirmation chances before you pay — with 94% accuracy.", span: "md:col-span-2" },
    { icon: Undo2, title: "Instant refunds", body: "Refunds land in your source account in minutes, not weeks." },
    { icon: ShieldCheck, title: "Bank-grade security", body: "AES-256 envelope encryption with AWS KMS, OTP login, zero stored card data." },
    { icon: Headphones, title: "24×7 human support", body: "Real people on chat & call — in Hindi, English and 8 regional languages.", span: "md:col-span-2" },
  ];
  return (
    <section className="relative mt-28 overflow-hidden bg-ink py-24">
      <div className="bg-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-5">
        <SectionHead dark eyebrow={`Why ${site.site_name}`} title="Built for the way India travels" sub="Thoughtful features that make every trip calmer." />
        <div className="mt-12 grid gap-4 md:grid-cols-3">
          {items.map((it, i) => (
            <motion.div key={it.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }} className={it.span}>
              <CardSpotlight className="h-full">
                <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_10px_30px_-10px_rgba(255,90,31,0.8)]">
                  <it.icon className="h-6 w-6" />
                </div>
                <h3 className="text-xl font-bold text-white">{it.title}</h3>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">{it.body}</p>
              </CardSpotlight>
            </motion.div>
          ))}
        </div>
        <div className="mt-20">
          <SectionHead dark eyebrow="Loved by travellers" title="Real trips. Real reviews." />
          <InfiniteMovingCards
            className="mx-auto mt-8"
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
            <h2 className="mt-5 text-3xl font-extrabold leading-tight text-white md:text-5xl">Your whole trip, <span className="font-display italic font-normal">in your pocket.</span></h2>
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

function SectionHead({ eyebrow, title, sub, dark }: { eyebrow: string; title: string; sub?: string; dark?: boolean }) {
  return (
    <motion.div {...fadeUp} className="max-w-2xl">
      <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-[0.2em] text-brand"><Star className="h-3 w-3 fill-brand" />{eyebrow}</div>
      <h2 className={`mt-3 text-3xl font-extrabold tracking-tight md:text-[42px] md:leading-[1.1] ${dark ? "text-white" : "text-ink"}`}>{title}</h2>
      {sub && <p className={`mt-3 text-base ${dark ? "text-white/60" : "text-muted"}`}>{sub}</p>}
    </motion.div>
  );
}
