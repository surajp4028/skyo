"use client";
import Link from "next/link";
import { Lock, ShieldCheck, BadgeCheck } from "lucide-react";
import { useSite } from "@/lib/client/providers";
import { Logo } from "./logo";
import { isServiceOn, isTrainLiveOn } from "@/lib/services";

const LINKS: Record<string, string> = {
  "Train tickets": "/?tab=train#search",
  Flights: "/?tab=flight#search",
  "Bus tickets": "/?tab=bus#search",
  Hotels: "/?tab=hotel#search",
  "Holiday packages": "/?tab=package#search",
  "Live running status": "/trains/live?tool=live",
  "Station board": "/trains/live?tool=board",
  "Vacant berths": "/trains/live?tool=berths",
  "Unreserved fare": "/trains/live?tool=uts",
  "About us": "/about",
  "Contact us": "/contact",
  "Privacy Policy": "/privacy",
  "Agent login": "/login?as=agent",
};

export function Footer() {
  const s = useSite();
  const cols = [
    { h: "Book", items: ([["Train tickets", "train"], ["Flights", "flight"], ["Bus tickets", "bus"], ["Hotels", "hotel"], ["Holiday packages", "package"]] as const).filter(([, k]) => isServiceOn(s, k)).map(([l]) => l) as string[] },
    ...(isServiceOn(s, "train") ? [{ h: "Train tools", items: [...(isTrainLiveOn(s) ? ["Live running status", "Station board"] : []), "Vacant berths", "Unreserved fare"] }] : []),
    { h: "Company", items: ["About us", "Contact us", "Privacy Policy", "Agent login"] },
  ];
  return (
    <footer className="relative overflow-hidden bg-ink text-white">
      <div className="bg-grid absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top,black,transparent_70%)]" />
      <div className="relative mx-auto max-w-7xl px-5 pb-10 pt-16">
        <div className="grid gap-10 md:grid-cols-5">
          <div className="md:col-span-2">
            <Logo dark />
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">{s.site_tagline}</p>
            <div className="mt-6 flex flex-wrap gap-2 text-xs text-white/70">
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><Lock className="h-3.5 w-3.5" /> 256-bit encryption</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><ShieldCheck className="h-3.5 w-3.5" /> DPDP Act 2023 ready</span>
              <span className="flex items-center gap-1.5 rounded-full border border-white/10 bg-white/5 px-3 py-1.5"><BadgeCheck className="h-3.5 w-3.5" /> Secure OTP login</span>
            </div>
          </div>
          {cols.map((c) => (
            <div key={c.h}>
              <h5 className="text-xs font-bold uppercase tracking-widest text-white/40">{c.h}</h5>
              <ul className="mt-4 space-y-2.5 text-sm text-white/70">
                {c.items.map((i) => (
                  <li key={i}>
                    {LINKS[i] ? <Link className="transition hover:text-white" href={LINKS[i]}>{i}</Link> : <span className="cursor-default hover:text-white">{i}</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
        <div className="mt-14 flex flex-col items-start justify-between gap-4 border-t border-white/10 pt-6 text-xs text-white/50 md:flex-row md:items-center">
          <p>© {new Date().getFullYear()} {s.site_name}. All rights reserved. · {s.support_email} · {s.support_phone}</p>
          <div className="flex gap-5">
            <Link href="/privacy" className="hover:text-white">Privacy Policy</Link>
            <Link href="/terms" className="hover:text-white">Terms of Use</Link>
            <Link href="/privacy#grievance" className="hover:text-white">Grievance Officer</Link>
          </div>
        </div>
      </div>
    </footer>
  );
}
