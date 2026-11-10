import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { TrainTools } from "@/components/train/train-tools";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";
import { BadgeCheck, Coins, Radio, Signpost, Ticket, TrainFront } from "lucide-react";

const TOOLS = [
  { icon: Radio, title: "Live running status", text: "Where your train is right now, delay at every station and the expected arrival.", tone: "from-sky-500 to-indigo-500" },
  { icon: Signpost, title: "Station board", text: "Every train arriving and leaving a station in the next few hours, with platforms.", tone: "from-emerald-500 to-teal-400" },
  { icon: TrainFront, title: "Vacant berths", text: "Berths left after the chart is prepared — useful for last-minute travel.", tone: "from-fuchsia-500 to-pink-400" },
  { icon: Ticket, title: "Unreserved fare", text: "UTS fares for general class by train type, ticket type and passengers.", tone: "from-orange-500 to-amber-400" },
];

export const metadata: Metadata = { title: "Train tools · live status, station board, vacant berths, UTS fare" };

export default async function TrainToolsPage() {
  if ((await getSetting("service_train")) !== "on") return <ServiceOff name="Train tools" />;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <section className="relative -mt-20 overflow-hidden pb-14 pt-32">
          <div className="absolute inset-0 sky-fade" />
          <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8),transparent_65%)]" />
          <div className="relative mx-auto max-w-7xl px-5">
            <h1 className="text-center text-4xl font-extrabold tracking-tight text-white md:text-5xl">Train tools</h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-white/85">Live running status, station boards, vacant berths and unreserved fares — all in one place.</p>
            <div className="mt-8">
              <Suspense>
                <TrainTools />
              </Suspense>
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 pb-20">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {TOOLS.map((t) => (
              <div key={t.title} className="rounded-3xl border border-line bg-white p-5 shadow-soft transition hover:-translate-y-1">
                <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${t.tone} text-white shadow-lg`}><t.icon className="h-5 w-5" /></span>
                <h3 className="mt-4 font-extrabold">{t.title}</h3>
                <p className="mt-1 text-sm text-muted">{t.text}</p>
              </div>
            ))}
          </div>
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 rounded-2xl bg-white/70 px-5 py-4 text-xs font-semibold text-muted ring-1 ring-line">
            <span className="flex items-center gap-1.5"><BadgeCheck className="h-4 w-4 text-mint" /> Live data from RailCore — never cached</span>
            <span className="flex items-center gap-1.5"><Coins className="h-4 w-4 text-amber-500" /> Free for logged-in travellers</span>
            <span className="flex items-center gap-1.5"><Radio className="h-4 w-4 text-sky-500" /> Updated every few minutes by the railways</span>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
