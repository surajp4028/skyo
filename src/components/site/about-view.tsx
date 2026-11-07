"use client";
import Link from "next/link";
import { motion } from "motion/react";
import { ArrowRight, BadgeCheck, Clock, Fingerprint, Headphones, KeyRound, Lock, MapPin, Radio, Search, ShieldCheck, Sparkles, TrainFront, Wallet } from "lucide-react";
import { HeroParallax } from "@/components/ui/hero-parallax";
import { ContainerScroll } from "@/components/ui/container-scroll";
import { StickyScroll } from "@/components/ui/sticky-scroll";
import { LampContainer } from "@/components/ui/lamp";
import { NumberTicker } from "@/components/ui/number-ticker";
import { CardSpotlight } from "@/components/ui/card-spotlight";
import { Meteors } from "@/components/ui/meteors";
import { MovingBorderButton } from "@/components/ui/moving-border";
import { useSite } from "@/lib/client/providers";
import { IMAGES, img } from "@/lib/utils";

const fade = { initial: { opacity: 0, y: 24 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: "-60px" }, transition: { duration: 0.6 } };

const PARALLAX = [
  ["Taj Mahal", "Agra", IMAGES.taj], ["Backwaters", "Kerala", IMAGES.keralaBoat], ["Dal Lake", "Kashmir", IMAGES.kashmir], ["Hawa Mahal", "Jaipur", IMAGES.jaipur], ["Beaches", "Goa", IMAGES.goa],
  ["Rajdhani nights", "Indian Railways", IMAGES.train], ["Snow peaks", "Manali", IMAGES.manali], ["Gateway of India", "Mumbai", IMAGES.mumbai], ["Above the clouds", "Flights", IMAGES.plane], ["Overnight buses", "Highways", IMAGES.bus],
  ["Stay in style", "Hotels", IMAGES.resort], ["India Gate", "Delhi", IMAGES.delhi], ["Lakes & valleys", "Himalayas", IMAGES.lake], ["Road trips", "Anywhere", IMAGES.roadtrip], ["Through the arch", "Agra", IMAGES.tajArch],
].map(([title, subtitle, id]) => ({ title, subtitle, src: img(id, 700) }));

export function AboutView() {
  const site = useSite();
  return (
    <div className="overflow-x-clip">
      {/* 1 · Hero parallax on a night-to-dawn sky */}
      <section className="relative -mt-20 bg-[linear-gradient(180deg,#040b24_0%,#0a1d5c_35%,#0b58d8_75%,#f6f7fb_100%)]">
        <Meteors number={20} />
        <HeroParallax
          items={PARALLAX}
          header={
            <div className="relative z-10 mx-auto w-full max-w-7xl px-5 text-white">
              <motion.span initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-bold backdrop-blur">
                <Sparkles className="h-3.5 w-3.5 text-amber-300" /> About {site.site_name}
              </motion.span>
              <motion.h1 initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="mt-6 max-w-4xl text-5xl font-extrabold leading-[1.02] tracking-tight md:text-7xl">
                The calm way <br /> India <span className="font-display font-normal italic text-gradient-sun">travels.</span>
              </motion.h1>
              <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.3 }} className="mt-6 max-w-xl text-lg text-white/75">
                {site.site_name} brings trains, flights, buses, hotels and holidays into one honest, private app — with live data instead of guesswork.
              </motion.p>
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.45 }} className="mt-8 flex flex-wrap gap-3">
                <Link href="/#search" className="group flex items-center gap-2 rounded-2xl bg-white px-6 py-3 text-sm font-extrabold text-ink transition hover:-translate-y-0.5">Plan a trip <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" /></Link>
                <Link href="/contact" className="rounded-2xl border border-white/25 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Talk to us</Link>
              </motion.div>
            </div>
          }
        />
      </section>

      {/* 2 · Honest numbers */}
      <section className="relative z-10 mx-auto -mt-24 max-w-6xl px-5">
        <motion.div {...fade} className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-line bg-line shadow-[0_30px_80px_-30px_rgba(10,15,31,0.35)] md:grid-cols-4">
          {[
            { n: 9000, s: "+", l: "railway stations searchable" },
            { n: 5, s: "", l: "ways to travel, one login" },
            { n: 256, s: "-bit", l: "AES encryption via AWS KMS" },
            { n: 0, s: "", l: "passwords stored for travellers", p: "₹0 fees · " },
          ].map((x, i) => (
            <div key={i} className="bg-white p-6 text-center md:p-8">
              <div className="text-4xl font-extrabold tracking-tight text-ink md:text-5xl">
                {i === 3 ? <span>0</span> : <NumberTicker value={x.n} suffix={x.s} />}
              </div>
              <div className="mt-2 text-sm font-semibold text-muted">{x.l}</div>
            </div>
          ))}
        </motion.div>
      </section>

      {/* 3 · How it works — sticky scroll */}
      <section className="pt-28">
        <motion.div {...fade} className="mx-auto max-w-6xl px-5">
          <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">How {site.site_name} works</p>
          <h2 className="mt-2 max-w-2xl text-4xl font-extrabold tracking-tight md:text-5xl">From “where to?” to “I&apos;m here” — without the chaos</h2>
        </motion.div>
        <StickyScroll
          steps={[
            { tag: "01 · Search", tone: "bg-brand", title: "Every station, every route", description: "Type any of ~9,000 stations — even small halts like Kotdwara. Pick a date, a quota and your preferred departure time.", visual: <SearchVisual /> },
            { tag: "02 · Decide", tone: "bg-[#0057ff]", title: "Live seats & confirmation chances", description: "See class-wise availability, waitlist position and the probability your ticket confirms — checked live, with the time it was checked.", visual: <AvailabilityVisual /> },
            { tag: "03 · Travel", tone: "bg-emerald-500", title: "Track your train, stop by stop", description: "Live running status, delays, platform, coach position and every intermediate station — the train pin follows along.", visual: <LiveVisual /> },
            { tag: "04 · Relax", tone: "bg-violet-500", title: "Private by design", description: "No passwords. Your name, email and phone are encrypted with AWS KMS. You can see and sign out of every device anytime.", visual: <PrivacyVisual /> },
          ]}
        />
      </section>

      {/* 4 · Container scroll — the product */}
      <section className="bg-gradient-to-b from-surface via-white to-surface">
        <ContainerScroll
          title={
            <>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">One app</p>
              <h2 className="mt-2 text-4xl font-extrabold tracking-tight text-ink md:text-6xl">
                Every journey, <span className="font-display font-normal italic text-gradient">beautifully simple</span>
              </h2>
              <p className="mx-auto mt-4 max-w-xl pb-16 text-muted">Same account and SKYO ID on the web today — and on our mobile app next.</p>
            </>
          }
        >
          <AppMock name={site.site_name} />
        </ContainerScroll>
      </section>

      {/* 5 · Trust bento */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <motion.h2 {...fade} className="mb-8 text-center text-4xl font-extrabold tracking-tight md:text-5xl">Built on trust</motion.h2>
        <div className="grid gap-4 md:grid-cols-6">
          <motion.div {...fade} className="md:col-span-4">
            <CardSpotlight className="h-full min-h-[260px]">
              <Meteors number={14} />
              <Radio className="h-8 w-8 text-brand-2" />
              <h3 className="mt-4 text-2xl font-extrabold text-white">Live, never cached</h3>
              <p className="mt-2 max-w-md text-white/65">Availability and running status are fetched at the moment you ask, and every result shows when it was checked.</p>
              <div className="mt-6 flex flex-wrap gap-2 text-xs font-bold text-white/80">
                {["Seat availability", "Confirmation chance", "Running status", "Station boards", "Coach position", "UTS fares"].map((t) => <span key={t} className="rounded-full border border-white/15 bg-white/5 px-3 py-1">{t}</span>)}
              </div>
            </CardSpotlight>
          </motion.div>
          <motion.div {...fade} transition={{ duration: 0.6, delay: 0.08 }} className="md:col-span-2">
            <CardSpotlight className="h-full min-h-[260px]" color="rgba(91,91,247,0.3)">
              <Fingerprint className="h-8 w-8 text-sky-300" />
              <h3 className="mt-4 text-2xl font-extrabold text-white">No passwords</h3>
              <p className="mt-2 text-white/65">One-time codes on email or mobile. Nothing to leak, nothing to forget.</p>
            </CardSpotlight>
          </motion.div>
          {[
            { icon: Wallet, t: "Honest prices", d: "The fare you see is the fare you pay.", c: "rgba(16,185,129,0.28)", ic: "text-emerald-300" },
            { icon: Headphones, t: "Real humans", d: "Every message gets a reference and a reply.", c: "rgba(255,90,31,0.28)", ic: "text-brand-2" },
            { icon: ShieldCheck, t: "DPDP-ready", d: "Consent, access and deletion built in.", c: "rgba(56,189,248,0.28)", ic: "text-sky-300" },
          ].map((x, i) => (
            <motion.div key={x.t} {...fade} transition={{ duration: 0.6, delay: 0.1 + i * 0.06 }} className="md:col-span-2">
              <CardSpotlight className="h-full" color={x.c}>
                <x.icon className={`h-7 w-7 ${x.ic}`} />
                <h3 className="mt-3 text-xl font-extrabold text-white">{x.t}</h3>
                <p className="mt-1 text-sm text-white/60">{x.d}</p>
              </CardSpotlight>
            </motion.div>
          ))}
        </div>
      </section>

      {/* 6 · Image marquee */}
      <section className="overflow-hidden pb-24">
        <div className="flex w-max animate-scroll gap-4 [--animation-duration:70s] hover:[animation-play-state:paused]">
          {[...PARALLAX, ...PARALLAX].map((p, i) => (
            <div key={i} className="relative h-56 w-80 shrink-0 overflow-hidden rounded-3xl">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={p.src} alt={p.title} loading="lazy" className="h-full w-full object-cover transition duration-700 hover:scale-105" />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
              <span className="absolute bottom-3 left-4 flex items-center gap-1.5 text-sm font-extrabold text-white"><MapPin className="h-4 w-4" />{p.title}</span>
            </div>
          ))}
        </div>
      </section>

      {/* 7 · Lamp CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-24">
        <LampContainer>
          <motion.h2 initial={{ opacity: 0.5, y: 100 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ delay: 0.3, duration: 0.8, ease: "easeInOut" }} className="bg-gradient-to-br from-white to-sky-200 bg-clip-text py-4 text-center text-4xl font-extrabold tracking-tight text-transparent md:text-6xl">
            Your next journey <br /> starts here
          </motion.h2>
          <div className="mt-6 flex flex-wrap justify-center gap-3">
            <MovingBorderButton as="a" href="/register">Create free account</MovingBorderButton>
            <Link href="/trains/live" className="rounded-2xl border border-white/20 px-6 py-3 text-sm font-bold text-white hover:bg-white/10">Track a train</Link>
          </div>
        </LampContainer>
      </section>
    </div>
  );
}

/* ---------- step visuals (mini, animated product moments) ---------- */
function Frame({ children, tone }: { children: React.ReactNode; tone: string }) {
  return <div className={`relative flex h-full min-h-[340px] items-center justify-center overflow-hidden rounded-[32px] p-8 ${tone}`}><div className="bg-grid absolute inset-0 opacity-30" />{children}</div>;
}

function SearchVisual() {
  return (
    <Frame tone="bg-gradient-to-br from-brand to-brand-2">
      <div className="relative w-full max-w-sm space-y-3 rounded-3xl bg-white p-5 shadow-2xl">
        {[["From", "New Delhi", "NDLS"], ["To", "Kotdwara", "KTW"]].map(([l, n, c], i) => (
          <motion.div key={l} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 + i * 0.15 }} className="flex items-center justify-between rounded-2xl border border-line px-4 py-3">
            <div><div className="text-[10px] font-bold uppercase tracking-wider text-muted">{l}</div><div className="font-extrabold">{n}</div></div>
            <span className="rounded-md bg-ink px-2 py-0.5 font-mono text-xs font-bold text-white">{c}</span>
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }} className="flex gap-2 text-xs font-bold">
          {["Tomorrow", "Tatkal", "Night"].map((t) => <span key={t} className="rounded-full bg-brand-soft px-3 py-1 text-brand">{t}</span>)}
        </motion.div>
        <motion.div initial={{ scale: 0.95, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.65 }} className="flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 py-3 font-extrabold text-white"><Search className="h-4 w-4" /> Search trains</motion.div>
      </div>
    </Frame>
  );
}

function AvailabilityVisual() {
  return (
    <Frame tone="bg-gradient-to-br from-[#0057ff] to-[#38bdf8]">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between"><span className="font-extrabold">Tejas Rajdhani</span><span className="rounded bg-ink px-1.5 font-mono text-xs font-bold text-white">12952</span></div>
        <div className="mt-4 grid grid-cols-3 gap-2">
          {[["3A", "WL 36", "text-orange-600 bg-orange-50"], ["2A", "AVL 12", "text-emerald-600 bg-emerald-50"], ["1A", "RAC 4", "text-amber-600 bg-amber-50"]].map(([c, s, t], i) => (
            <motion.div key={c} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 + i * 0.1 }} className={`rounded-2xl p-3 ${t}`}>
              <div className="text-sm font-extrabold text-ink">{c}</div>
              <div className="text-xs font-extrabold">{s}</div>
            </motion.div>
          ))}
        </div>
        <div className="mt-4 text-xs font-bold text-muted">Confirmation chance</div>
        <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-surface"><motion.div initial={{ width: 0 }} animate={{ width: "81%" }} transition={{ delay: 0.5, duration: 1 }} className="h-full rounded-full bg-emerald-500" /></div>
        <div className="mt-1 flex justify-between text-xs"><span className="font-extrabold text-emerald-600">81% · High</span><span className="text-muted"><Clock className="mr-1 inline h-3 w-3" />checked just now</span></div>
      </div>
    </Frame>
  );
}

function LiveVisual() {
  return (
    <Frame tone="bg-gradient-to-br from-emerald-500 to-teal-400">
      <div className="relative w-full max-w-sm rounded-3xl bg-ink p-5 text-white shadow-2xl">
        <span className="rounded-full bg-amber-400/20 px-2.5 py-1 text-xs font-extrabold text-amber-200">7 min late</span>
        <div className="mt-3 text-lg font-extrabold">Approaching Ratlam Jn</div>
        <div className="relative mt-6 h-2.5 rounded-full bg-white/10">
          <motion.div initial={{ width: "10%" }} animate={{ width: "62%" }} transition={{ duration: 1.6, ease: "easeOut" }} className="h-full rounded-full bg-gradient-to-r from-brand to-brand-2" />
          <motion.span initial={{ left: "10%" }} animate={{ left: "62%" }} transition={{ duration: 1.6, ease: "easeOut" }} className="absolute -top-3 flex h-8 w-8 -translate-x-1/2 items-center justify-center rounded-full bg-white text-brand"><TrainFront className="h-4 w-4" /></motion.span>
        </div>
        <div className="mt-6 space-y-2">
          {["Kota Jn · passed 21:40", "Nagda Jn · passed 23:59", "Ratlam Jn · ETA 00:41"].map((t, i) => (
            <motion.div key={t} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.4 + i * 0.15 }} className="flex items-center gap-2 text-sm text-white/80"><span className={`h-2.5 w-2.5 rounded-full ${i < 2 ? "bg-brand" : "animate-pulse bg-sky-400"}`} />{t}</motion.div>
          ))}
        </div>
      </div>
    </Frame>
  );
}

function PrivacyVisual() {
  return (
    <Frame tone="bg-gradient-to-br from-violet-600 to-fuchsia-500">
      <div className="relative w-full max-w-sm rounded-3xl bg-white p-5 shadow-2xl">
        <div className="flex items-center gap-2 font-extrabold"><Lock className="h-4 w-4 text-violet-600" /> Stored in our database</div>
        <div className="mt-3 space-y-2 font-mono text-[11px]">
          {["name   k1.eyJjaXBoZXJ0ZXh0Ijoi…", "email  k1.eyJjaXBoZXJ0ZXh0Ijoi…", "phone  k1.eyJjaXBoZXJ0ZXh0Ijoi…"].map((t, i) => (
            <motion.div key={t} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2 + i * 0.15 }} className="truncate rounded-lg bg-surface px-3 py-2 text-ink/70">{t}</motion.div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-3 rounded-2xl bg-violet-50 p-3 text-sm font-semibold text-violet-700"><KeyRound className="h-4 w-4" /> Keys managed by AWS KMS</div>
        <div className="mt-2 flex items-center gap-3 rounded-2xl bg-emerald-50 p-3 text-sm font-semibold text-emerald-700"><BadgeCheck className="h-4 w-4" /> Signed in with a one-time code</div>
      </div>
    </Frame>
  );
}

function AppMock({ name }: { name: string }) {
  return (
    <div className="h-full overflow-hidden">
      <div className="bg-[linear-gradient(180deg,#0057ff,#2f94ff)] px-6 pb-16 pt-5 text-white">
        <div className="flex items-center justify-between text-sm font-extrabold"><span>{name}</span><span className="rounded-full bg-white/20 px-3 py-1 text-xs">Trains · Flights · Buses · Hotels</span></div>
        <div className="mt-6 text-2xl font-extrabold md:text-3xl">New Delhi → Mumbai Central</div>
        <div className="text-sm text-white/75">Tue, 10 Nov · General quota · 15 trains</div>
      </div>
      <div className="-mt-10 space-y-3 px-4 md:px-6">
        {[["Tejas Rajdhani", "12952", "16:55", "08:35", "15h 40m", [["3A", "WL 36", "text-orange-600"], ["2A", "AVL 12", "text-emerald-600"], ["1A", "RAC 4", "text-amber-600"]]], ["Golden Temple Mail", "12904", "04:00", "23:55", "19h 55m", [["SL", "RLWL 81", "text-orange-600"], ["3A", "AVL 3", "text-emerald-600"]]], ["Punjab Mail", "12138", "05:10", "07:35", "26h 25m", [["SL", "WL 120", "text-red-600"], ["3E", "AVL 40", "text-emerald-600"]]]].map(([n, num, d, a, dur, cls]) => (
          <div key={num as string} className="rounded-2xl bg-white p-4 shadow-soft">
            <div className="flex items-center gap-2"><span className="font-extrabold">{n as string}</span><span className="rounded bg-ink px-1.5 font-mono text-[10px] font-bold text-white">{num as string}</span></div>
            <div className="mt-2 flex items-center justify-between text-sm"><span className="text-lg font-extrabold">{d as string}</span><span className="text-xs text-muted">{dur as string}</span><span className="text-lg font-extrabold">{a as string}</span></div>
            <div className="mt-2 flex gap-2">
              {(cls as string[][]).map(([c, s, t]) => <span key={c} className="rounded-xl bg-surface px-3 py-1.5 text-xs font-bold">{c} <span className={t}>{s}</span></span>)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
