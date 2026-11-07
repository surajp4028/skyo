"use client";
import Link from "next/link";
import { ArrowRight, BadgeCheck, BusFront, Building2, Headphones, Lock, Palmtree, Plane, Radio, ShieldCheck, TrainFront, Wallet } from "lucide-react";
import { useSite } from "@/lib/client/providers";
import { isServiceOn, type ServiceKey } from "@/lib/services";
import { IMAGES, img } from "@/lib/utils";

const SERVICES: { key: ServiceKey; title: string; text: string; icon: typeof Plane }[] = [
  { key: "train", title: "Trains", text: "Live seat availability, fares with or without food, running status and PNR-ready e-tickets.", icon: TrainFront },
  { key: "flight", title: "Flights", text: "Domestic and international fares compared in one clean list.", icon: Plane },
  { key: "bus", title: "Buses", text: "Sleeper and seater buses across operators and routes.", icon: BusFront },
  { key: "hotel", title: "Hotels", text: "Stays from budget rooms to resorts, with clear pricing.", icon: Building2 },
  { key: "package", title: "Holidays", text: "Ready-made trips with travel and stay planned together.", icon: Palmtree },
];

const VALUES = [
  { icon: Radio, title: "Live, not guessed", text: "Availability and running status come from live railway data at the moment you ask." },
  { icon: Wallet, title: "Every rupee shown", text: "Fare, IRCTC fee, service fee, insurance and gateway charges are listed before you pay." },
  { icon: Lock, title: "Private by design", text: "Your details are encrypted with AWS KMS. We never see or store your card." },
];

const STEPS = [
  ["Search", "Pick your route and date — results appear in seconds."],
  ["Choose", "Compare classes, timings and fares, then select saved travellers."],
  ["Pay safely", "Pay through Razorpay by UPI, card or net banking."],
  ["Travel", "Your e-ticket is in My trips, by SMS and by email."],
];

export function AboutView() {
  const site = useSite();
  const services = SERVICES.filter((s) => isServiceOn(site, s.key));
  return (
    <div className="bg-white">
      {/* Hero */}
      <section className="mx-auto grid max-w-6xl items-center gap-10 px-5 pb-16 pt-28 md:grid-cols-2 md:pt-36">
        <div>
          <span className="text-xs font-bold uppercase tracking-[0.2em] text-brand">About {site.site_name}</span>
          <h1 className="mt-3 text-4xl font-extrabold leading-tight tracking-tight text-ink md:text-5xl">Travel booking that is simple, honest and safe.</h1>
          <p className="mt-5 text-lg leading-relaxed text-muted">
            {site.site_name} brings trains, flights, buses, hotels and holidays into one place. We show live information, clear prices and keep your data private — so planning a trip feels easy.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/#search" className="inline-flex items-center gap-2 rounded-xl bg-ink px-5 py-3 text-sm font-bold text-white transition hover:bg-ink/85">
              Start a search <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="rounded-xl border border-line px-5 py-3 text-sm font-bold text-ink transition hover:bg-surface">Contact us</Link>
          </div>
        </div>
        <div className="relative">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={img(IMAGES.train, 900)} alt="Train passing through green hills" className="aspect-[4/3] w-full rounded-3xl object-cover shadow-[0_30px_60px_-30px_rgba(10,15,31,0.45)]" />
          <div className="absolute -bottom-5 left-5 flex items-center gap-3 rounded-2xl border border-line bg-white px-4 py-3 shadow-lg">
            <ShieldCheck className="h-6 w-6 text-mint" />
            <div className="text-sm"><div className="font-bold text-ink">Secure payments</div><div className="text-xs text-muted">Powered by Razorpay</div></div>
          </div>
        </div>
      </section>

      {/* Mission */}
      <section className="border-y border-line bg-surface">
        <div className="mx-auto max-w-3xl px-5 py-16 text-center">
          <h2 className="text-2xl font-extrabold text-ink md:text-3xl">Our mission</h2>
          <p className="mt-4 text-base leading-relaxed text-muted md:text-lg">
            Make every Indian journey easy to plan and easy to trust. No hidden charges, no confusing screens, and real people to help when something goes wrong.
          </p>
        </div>
      </section>

      {/* Values */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-2xl font-extrabold text-ink md:text-3xl">What we stand for</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-3">
          {VALUES.map((v) => (
            <div key={v.title} className="rounded-2xl border border-line p-6 transition hover:shadow-md">
              <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-brand/10 text-brand"><v.icon className="h-5 w-5" /></span>
              <h3 className="mt-4 text-lg font-bold text-ink">{v.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted">{v.text}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Services */}
      {services.length > 0 && (
        <section className="bg-surface">
          <div className="mx-auto max-w-6xl px-5 py-16">
            <h2 className="text-center text-2xl font-extrabold text-ink md:text-3xl">What you can book</h2>
            <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {services.map((s) => (
                <div key={s.key} className="flex gap-4 rounded-2xl bg-white p-5 shadow-sm ring-1 ring-line">
                  <s.icon className="mt-0.5 h-6 w-6 shrink-0 text-brand" />
                  <div>
                    <h3 className="font-bold text-ink">{s.title}</h3>
                    <p className="mt-1 text-sm text-muted">{s.text}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-5 py-16">
        <h2 className="text-center text-2xl font-extrabold text-ink md:text-3xl">How it works</h2>
        <ol className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
          {STEPS.map(([t, d], i) => (
            <li key={t} className="rounded-2xl border border-line p-5">
              <span className="flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
              <h3 className="mt-4 font-bold text-ink">{t}</h3>
              <p className="mt-1 text-sm text-muted">{d}</p>
            </li>
          ))}
        </ol>
      </section>

      {/* Trust + CTA */}
      <section className="mx-auto max-w-6xl px-5 pb-20">
        <div className="grid gap-8 rounded-3xl bg-ink p-8 text-white md:grid-cols-[1.4fr_1fr] md:p-12">
          <div>
            <h2 className="text-2xl font-extrabold md:text-3xl">Here when you need us</h2>
            <p className="mt-3 text-white/70">Questions about a booking, refund or payment? Our team can see every step of your transaction and will help you quickly.</p>
            <ul className="mt-6 space-y-2 text-sm text-white/85">
              <li className="flex items-center gap-2"><BadgeCheck className="h-4 w-4 text-mint" /> {site.support_email}</li>
              <li className="flex items-center gap-2"><Headphones className="h-4 w-4 text-mint" /> {site.support_phone}</li>
            </ul>
          </div>
          <div className="flex flex-col justify-center gap-3">
            <Link href="/#search" className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-5 py-3 text-sm font-bold text-ink transition hover:bg-white/90">
              Plan your trip <ArrowRight className="h-4 w-4" />
            </Link>
            <Link href="/contact" className="rounded-xl border border-white/25 px-5 py-3 text-center text-sm font-bold text-white transition hover:bg-white/10">Contact support</Link>
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-muted">{site.site_name} is an independent travel platform and is not affiliated with IRCTC or Indian Railways.</p>
      </section>
    </div>
  );
}
