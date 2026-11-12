import Link from "next/link";
import { Navbar } from "./navbar";
import { Footer } from "./footer";

/** Shown when an admin has switched a service off. */
export function ServiceOff({ name }: { name: string }) {
  return (
    <div className="relative">
      <Navbar overHero={false} />
      <main className="mx-auto flex min-h-[60vh] max-w-xl flex-col items-center justify-center px-5 py-20 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-brand-soft text-3xl">🛠️</div>
        <h1 className="mt-5 text-3xl font-lux font-bold">{name} is unavailable right now</h1>
        <p className="mt-2 text-muted">We&apos;ve paused this service for a little while. Please check back soon.</p>
        <Link href="/" className="mt-6 rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Back to home</Link>
      </main>
      <Footer />
    </div>
  );
}
