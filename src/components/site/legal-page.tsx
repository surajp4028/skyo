import type { ReactNode } from "react";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

export function LegalPage({ title, updated, children }: { title: string; updated: string; children: ReactNode }) {
  return (
    <>
      <Navbar overHero={false} />
      <main className="mx-auto max-w-3xl px-5 py-14">
        <p className="text-xs font-bold uppercase tracking-[0.2em] text-brand">Legal</p>
        <h1 className="mt-2 text-4xl font-extrabold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-muted">Last updated {updated}</p>
        <article className="mt-10 space-y-6 text-[15px] leading-relaxed text-ink/80 [&_h2]:mt-10 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-ink [&_li]:ml-5 [&_li]:list-disc">{children}</article>
      </main>
      <Footer />
    </>
  );
}
