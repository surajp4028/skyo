"use client";
import Image from "next/image";
import Link from "next/link";
import { motion } from "motion/react";
import {
  ArrowRight, BadgeCheck, BusFront, Building2, Fingerprint, Headphones, IndianRupee, Lock, Palmtree, Plane, Radio, ShieldCheck, Sparkles, TrainFront,
} from "lucide-react";
import { Spotlight } from "@/components/ui/spotlight";
import { FlipWords } from "@/components/ui/flip-words";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { Clouds, FlightPath } from "./home-sections";
import { useSite } from "@/lib/client/providers";
import { isServiceOn, type ServiceKey } from "@/lib/services";
import { IMAGES, img } from "@/lib/utils";

const fadeUp = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-80px" }, transition: { duration: 0.6 } };

const SERVICES: { key: ServiceKey; title: string; text: string; icon: typeof Plane; image: string; span: string }[] = [
  { key: "train", title: "Trains", text: "Live seats, fares with or without meals, running status and e-tickets.", icon: TrainFront, image: IMAGES.train, span: "md:col-span-2 md:row-span-2" },
  { key: "flight", title: "Flights", text: "Domestic and international fares, side by side.", icon: Plane, image: IMAGES.plane, span: "" },
  { key: "hotel", title: "Hotels", text: "From budget rooms to resorts.", icon: Building2, image: IMAGES.resort, span: "" },
  { key: "bus", title: "Buses", text: "Sleepers and seaters across operators.", icon: BusFront, image: IMAGES.bus, span: "" },
  { key: "package", title: "Holidays", text: "Travel and stay, planned together.", icon: Palmtree, image: IMAGES.keralaBoat, span: "" },
];

const PRINCIPLES = [
  { icon: Radio, title: "Live, never guessed", body: "Seat availability and running status come from live railway data the moment you ask — not yesterday's cache.", span: "md:col-span-2" },
  { icon: IndianRupee, title: "Every rupee on the table", body: "Fare, IRCTC fee, service fee, insurance and gateway charges are itemised before you pay." },
  { icon: Lock, title: "Private by design", body: "Personal data is encrypted with AWS KMS. Payments run on Razorpay — we never see your card." },
  { icon: Headphones, title: "People who pick up", body: "Our team sees every step of your payment and ticket, so a support call ends with an answer, not a ticket number.", span: "md:col-span-2" },
];

const STEPS = [
  { t: "Search", d: "Route and date — live results in seconds." },
  { t: "Compare", d: "Classes, timings, fares and confirmation chances." },
  { t: "Pay safely", d: "UPI, card or net banking via Razorpay." },
  { t: "Travel", d: "E-ticket in My trips, by SMS and by email." },
];

export function AboutView() {
  const site = useSite();
  const services = SERVICES.filter((s) => isServiceOn(site, s.key));
  return (
    <div className="overflow-x-clip">
      {/* ── Hero: same sky as home ─────────────────────────────── */}
      <section className="relative -mt-20 overflow-hidden pb-40 pt-32 md:pb-48 md:pt-40">
        <div className="absolute inset-0 bg-[linear-gradient(180deg,#0057ff_0%,#0a74ff_28%,#2f94ff_55%,#6cbcff_78%,#cfe9ff_92%,#f6f7fb_100%)]" />
        <div className="absolute -right-16 -top-20 h-[360px] w-[360px] rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.95)_0%,rgba(255,246,214,0.55)_22%,transparent_60%)]" />
        <Clouds />
        <FlightPath />
        <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" fill="white" />

        <div className="relative z-10 mx-auto max-w-5xl px-5 text-center">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="mx-auto mb-6 flex w-fit items-center gap-2 rounded-full border border-white/30 bg-white/15 px-4 py-1.5 text-xs font-semibold text-white shadow-[0_8px_30px_-12px_rgba(0,30,90,0.5)] backdrop-blur-md">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" /> About {site.site_name}
          </motion.div>
          <motion.h1 initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="text-4xl font-extrabold leading-[1.06] tracking-tight text-white drop-shadow-[0_4px_24px_rgba(0,40,120,0.35)] md:text-7xl">
            We make travel <br className="hidden md:block" />
            <FlipWords words={["simple.", "honest.", "secure.", "calm."]} className="font-display font-normal italic text-gradient-sun" />
          </motion.h1>
          <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mx-auto mt-6 max-w-2xl text-base font-medium text-white/90 [text-shadow:0_1px_12px_rgba(0,40,120,0.45)] md:text-lg">
            {site.site_name} brings trains, flights, buses, hotels and holidays into one clean, private app — with live data, clear prices and real people behind it.
          </motion.p>
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-9 flex flex-wrap justify-center gap-3">
            <Link href="/#search" className="group flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-ink shadow-[0_18px_40px_-18px_rgba(0,30,90,0.7)] transition hover:-translate-y-0.5">
              Plan a trip <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" />
            </Link>
            <Link href="/contact" className="rounded-2xl border border-white/40 bg-white/10 px-6 py-3 text-sm font-bold text-white backdrop-blur transition hover:bg-white/20">Talk to us</Link>
          </motion.div>
        </div>
      </section>

      {/* ── Floating glass stats (like the home search card) ───── */}
      <section className="relative z-20 mx-auto -mt-28 max-w-5xl px-5">
        <motion.div {...fadeUp} className="grid grid-cols-2 overflow-hidden rounded-[28px] border border-white/70 bg-white/85 shadow-[0_40px_90px_-40px_rgba(10,30,90,0.55)] backdrop-blur-xl md:grid-cols-4">
          {[
            ["9,000+", "railway stations searchable"],
            ["5", "ways to travel, one login"],
            ["256-bit", "AES encryption via AWS KMS"],
            ["24×7", "payment & ticket tracking"],
          ].map(([n, l], i) => (
            <div key={l} className={`p-6 text-center md:p-8 ${i % 2 ? "" : "border-r border-line/70"} ${i < 2 ? "border-b border-line/70 md:border-b-0" : ""} ${i === 1 ? "md:border-r" : ""}`}>
              <div className="text-3xl font-extrabold tracking-tight text-ink md:text-4xl">{n}</div>
              <div className="mt-1 text-xs font-semibold text-muted md:text-sm">{l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* ── Story ─────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-7xl items-center gap-14 px-5 py-24 md:grid-cols-2 md:py-32">
        <motion.div {...fadeUp}>
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Our story</div>
          <h2 className="mt-3 text-3xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl">
            Built by travellers who were tired of <span className="font-display font-normal italic text-brand">guesswork.</span>
          </h2>
          <p className="mt-6 text-base leading-relaxed text-muted md:text-lg">
            Waitlists you couldn&apos;t read. Fees that appeared at the last step. Refunds that vanished for weeks. We started {site.site_name} to fix the parts of Indian travel booking that make people anxious.
          </p>
          <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
            Today every booking runs on live data, every charge is itemised, and every payment is double-checked with the bank before your ticket is issued.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            {["Razorpay secured", "AWS KMS encryption", "DPDP 2023 ready", "Live railway data"].map((t) => (
              <span key={t} className="flex items-center gap-1.5 rounded-full border border-line bg-white px-3 py-1.5 text-xs font-bold text-ink/80"><BadgeCheck className="h-3.5 w-3.5 text-mint" /> {t}</span>
            ))}
          </div>
        </motion.div>
        <motion.div {...fadeUp} className="relative h-[420px] md:h-[520px]">
          <div className="absolute right-0 top-0 h-[78%] w-[78%] overflow-hidden rounded-[32px] shadow-[0_40px_80px_-40px_rgba(10,15,31,0.6)]">
            <Image src={img(IMAGES.taj, 900)} alt="Taj Mahal at sunrise" fill sizes="(min-width:768px) 40vw, 80vw" className="object-cover" />
          </div>
          <div className="absolute bottom-0 left-0 h-[52%] w-[56%] overflow-hidden rounded-[28px] border-[6px] border-white shadow-[0_30px_60px_-30px_rgba(10,15,31,0.6)]">
            <Image src={img(IMAGES.train, 700)} alt="Train through the hills" fill sizes="(min-width:768px) 28vw, 56vw" className="object-cover" />
          </div>
          <div className="absolute bottom-[42%] right-[4%] flex items-center gap-3 rounded-2xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg backdrop-blur animate-float">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-mint/15 text-mint"><ShieldCheck className="h-5 w-5" /></span>
            <div className="text-xs"><div className="font-extrabold text-ink">Payment verified twice</div><div className="text-muted">Signature + bank record</div></div>
          </div>
        </motion.div>
      </section>

      {/* ── Services bento ────────────────────────────────────── */}
      {services.length > 0 && (
        <section className="mx-auto max-w-7xl px-5 pb-24">
          <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">One app</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-5xl">Everything for the journey</h2>
          </motion.div>
          <div className="mt-12 grid auto-rows-[220px] gap-4 md:grid-cols-4">
            {services.map((s, i) => (
              <motion.div key={s.key} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.06 }} className={`group relative overflow-hidden rounded-[28px] ${s.span}`}>
                <Image src={img(s.image, 900)} alt={s.title} fill sizes="(min-width:768px) 50vw, 100vw" className="object-cover transition duration-700 group-hover:scale-105" />
                <div className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/20 to-transparent" />
                <div className="absolute inset-x-0 bottom-0 p-6 text-white">
                  <span className="mb-3 flex h-10 w-10 items-center justify-center rounded-xl bg-white/20 backdrop-blur"><s.icon className="h-5 w-5" /></span>
                  <h3 className="text-xl font-extrabold">{s.title}</h3>
                  <p className="mt-1 max-w-sm text-sm text-white/80">{s.text}</p>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* ── Principles (dark, like "Why us") ──────────────────── */}
      <section className="relative overflow-hidden bg-ink py-24">
        <div className="bg-grid absolute inset-0 opacity-50 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
        <div className="relative mx-auto max-w-7xl px-5">
          <motion.div {...fadeUp} className="max-w-2xl">
            <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">What we stand for</div>
            <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-white md:text-5xl">Four promises, every booking</h2>
          </motion.div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {PRINCIPLES.map((p, i) => (
              <motion.div key={p.title} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.08 }} className={p.span}>
                <CardSpotlight className="h-full">
                  <div className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-brand-2 text-white shadow-[0_10px_30px_-10px_rgba(255,90,31,0.8)]"><p.icon className="h-6 w-6" /></div>
                  <h3 className="text-xl font-bold text-white">{p.title}</h3>
                  <p className="mt-2 max-w-md text-sm leading-relaxed text-white/60">{p.body}</p>
                </CardSpotlight>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ──────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 py-24">
        <motion.div {...fadeUp} className="mx-auto max-w-2xl text-center">
          <div className="text-xs font-bold uppercase tracking-[0.2em] text-brand">How it works</div>
          <h2 className="mt-3 text-3xl font-extrabold tracking-tight text-ink md:text-5xl">From search to seat in four steps</h2>
        </motion.div>
        <ol className="relative mt-14 grid gap-8 md:grid-cols-4">
          <div aria-hidden className="absolute left-[12%] right-[12%] top-6 hidden h-px bg-gradient-to-r from-transparent via-brand/40 to-transparent md:block" />
          {STEPS.map((s, i) => (
            <motion.li key={s.t} {...fadeUp} transition={{ duration: 0.5, delay: i * 0.1 }} className="relative text-center">
              <span className="relative mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-white text-lg font-extrabold text-brand shadow-[0_14px_30px_-14px_rgba(10,15,31,0.45)] ring-1 ring-line">{i + 1}</span>
              <h3 className="mt-5 text-lg font-extrabold text-ink">{s.t}</h3>
              <p className="mx-auto mt-1 max-w-[220px] text-sm text-muted">{s.d}</p>
            </motion.li>
          ))}
        </ol>
      </section>

      {/* ── CTA ───────────────────────────────────────────────── */}
      <section className="mx-auto max-w-7xl px-5 pb-24">
        <div className="relative overflow-hidden rounded-[36px] bg-[linear-gradient(120deg,#0057ff,#1a82ff_55%,#38bdf8)] p-10 md:p-16">
          <div className="bg-dots absolute inset-0 opacity-25" />
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/25 blur-3xl" />
          <div className="relative grid items-center gap-8 md:grid-cols-[1.4fr_1fr]">
            <div>
              <h2 className="text-3xl font-extrabold leading-tight text-white md:text-5xl">Your next trip, <span className="font-display font-normal italic">without the chaos.</span></h2>
              <p className="mt-4 max-w-md text-white/85">Questions about a booking, refund or payment? Write to {site.support_email} or call {site.support_phone}.</p>
            </div>
            <div className="flex flex-wrap gap-3 md:justify-end">
              <MovingBorderButton as="a" href="/#search" duration={3500}>
                Start searching <ArrowRight className="ml-2 h-4 w-4" />
              </MovingBorderButton>
              <Link href="/contact" className="flex items-center gap-2 rounded-2xl border border-white/40 px-6 py-3 text-sm font-semibold text-white hover:bg-white/10"><Fingerprint className="h-4 w-4" /> Contact support</Link>
            </div>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">{site.site_name} is an independent travel platform and is not affiliated with IRCTC or Indian Railways.</p>
      </section>
    </div>
  );
}
