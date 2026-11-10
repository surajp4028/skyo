import type { ReactNode } from "react";
import { ShieldCheck } from "lucide-react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <div className="relative">
      <Navbar />
      <main>
        <section className="relative -mt-20 overflow-hidden pb-28 pt-32">
          <div className="absolute inset-0 sky-fade" />
          <div className="absolute right-0 top-0 h-80 w-80 -translate-y-1/4 translate-x-1/4 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.8),transparent_65%)]" />
          <div className="relative mx-auto max-w-3xl px-5 text-white">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-white/30 bg-white/15 px-3 py-1 text-xs font-bold backdrop-blur"><ShieldCheck className="h-3.5 w-3.5" /> Legal</span>
            <h1 className="mt-4 text-4xl font-extrabold tracking-tight md:text-5xl">{title}</h1>
            <p className="mt-2 text-sm text-white/80">Last updated {updated}</p>
          </div>
        </section>
        <div className="relative z-10 mx-auto -mt-16 max-w-3xl px-4 pb-20 sm:px-5">
          <article className="space-y-6 rounded-3xl border border-line bg-white p-6 text-[15px] leading-relaxed text-ink/80 shadow-soft sm:p-10 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_h2:first-child]:mt-0 [&_li]:ml-5 [&_li]:list-disc [&_a]:font-semibold [&_a]:text-brand">
            {children}
          </article>
        </div>
      </main>
      <Footer />
    </div>
  );
}
