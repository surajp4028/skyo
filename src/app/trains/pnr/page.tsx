import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { ServiceOff } from "@/components/site/service-off";
import { PnrStatus } from "@/components/train/pnr-status";
import { getSetting } from "@/lib/server/settings";
import { BadgeCheck, ClipboardList, Hourglass, ShieldCheck, Ticket, Users, XCircle } from "lucide-react";

export const metadata: Metadata = { title: "PNR status · confirmation, coach & berth" };

const CODES = [
  { code: "CNF", name: "Confirmed", text: "Your berth is fixed. Coach and berth number show once allotted.", tone: "bg-emerald-50 text-emerald-700 ring-emerald-200" },
  { code: "RAC", name: "Reservation Against Cancellation", text: "You can board and share a side-lower berth; it may turn into a full berth.", tone: "bg-amber-50 text-amber-700 ring-amber-200" },
  { code: "GNWL / WL", name: "General waitlist", text: "Moves up as others cancel. The usual list, with the best chance of confirming.", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  { code: "PQWL · RLWL", name: "Pooled / remote location waitlist", text: "Waitlists for journeys from or to smaller stations. They clear more slowly.", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  { code: "TQWL", name: "Tatkal waitlist", text: "Tatkal waitlists rarely clear. If still WL after charting, the e-ticket auto-cancels.", tone: "bg-rose-50 text-rose-700 ring-rose-200" },
  { code: "CAN", name: "Cancelled", text: "This passenger's booking was cancelled.", tone: "bg-slate-100 text-slate-600 ring-slate-200" },
];

export default async function PnrPage() {
  if ((await getSetting("service_train")) !== "on" || (await getSetting("pnr_status")) !== "on") return <ServiceOff name="PNR status" />;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <section className="relative -mt-20 pb-16 pt-32">
          <div className="absolute inset-0 overflow-hidden">
            <div className="absolute inset-0 sky-fade" />
            <div className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8),transparent_65%)]" />
            <div className="absolute inset-0 bg-[radial-gradient(ellipse_55%_40%_at_50%_25%,rgba(3,25,80,0.3),transparent_75%)]" />
          </div>
          <div className="relative mx-auto max-w-7xl px-4 sm:px-5">
            <span className="mx-auto flex w-fit items-center gap-1.5 rounded-full border border-white/40 bg-white/15 px-3 py-1 text-xs font-bold text-white backdrop-blur">
              <Ticket className="h-3.5 w-3.5" /> PNR status
            </span>
            <h1 className="mt-3 text-center text-4xl font-lux font-bold tracking-[-0.01em] text-white drop-shadow-[0_6px_30px_rgba(10,40,120,0.35)] md:text-5xl">Is my ticket <span className="lux-gold-light">confirmed?</span></h1>
            <p className="mx-auto mt-3 max-w-xl text-center text-white/90">Booking status, current status, coach and berth for every passenger, and whether the chart is prepared.</p>
            <div className="mt-8">
              <PnrStatus />
            </div>
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-5">
          <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
            <div className="rounded-[28px] border border-line bg-white p-6 shadow-soft">
              <h2 className="flex items-center gap-2 text-lg font-extrabold text-ink"><ClipboardList className="h-5 w-5 text-brand" /> What the status codes mean</h2>
              <ul className="mt-4 grid gap-3 sm:grid-cols-2">
                {CODES.map((c) => (
                  <li key={c.code} className="rounded-2xl bg-surface/70 p-3 ring-1 ring-line">
                    <span className={`inline-flex rounded-lg px-2 py-0.5 font-mono text-xs font-extrabold ring-1 ${c.tone}`}>{c.code}</span>
                    <div className="mt-1.5 text-sm font-bold text-ink">{c.name}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{c.text}</p>
                  </li>
                ))}
              </ul>
            </div>
            <div className="space-y-4">
              {[
                { icon: Ticket, t: "Where's my PNR?", d: "The 10-digit number at the top left of your e-ticket or in the booking SMS from IRCTC." },
                { icon: Hourglass, t: "When is the chart prepared?", d: "About 4 hours before departure (the first chart), and a second one about 30 minutes before. After that, waitlists stop moving." },
                { icon: Users, t: "Booked through SKYO?", d: "Your trips page has a PNR status button on every train booking — no typing needed." },
                { icon: ShieldCheck, t: "Private by design", d: "We never put your PNR in a link, and a recent status is kept for a short while so checking again is instant." },
              ].map((x) => (
                <div key={x.t} className="flex gap-3 rounded-[22px] border border-line bg-white p-4 shadow-soft">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-iris to-[#0057ff] text-white"><x.icon className="h-5 w-5" /></span>
                  <div>
                    <div className="text-sm font-extrabold text-ink">{x.t}</div>
                    <p className="mt-0.5 text-xs leading-relaxed text-muted">{x.d}</p>
                  </div>
                </div>
              ))}
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 rounded-2xl bg-white/70 px-4 py-3 text-[11px] font-semibold text-muted ring-1 ring-line">
                <span className="flex items-center gap-1"><BadgeCheck className="h-3.5 w-3.5 text-mint" /> Live from Indian Railways</span>
                <span className="flex items-center gap-1"><XCircle className="h-3.5 w-3.5 text-rose-400" /> Old PNRs expire after the journey</span>
              </div>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
