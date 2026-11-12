"use client";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import type { TourPackage } from "@/lib/packages";
import { Heading, Rail } from "@/components/package/package-browser";

/** Home page: the real published packages, in the same cards and swipe rail as /packages. */
export function HomePackages({ packages }: { packages: TourPackage[] }) {
  if (!packages.length) return null;
  return (
    <section className="mx-auto max-w-7xl px-4 pt-8 sm:px-6 sm:pt-10 lg:px-8">
      <Heading
        eyebrow="Trending this season"
        title="Where India is"
        accent="heading"
        sub="Day-by-day plans, stays and transfers — with clear prices."
        action={
          <Link href="/packages" className="group inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-brand ring-1 ring-orange-100 transition hover:bg-brand hover:text-white">
            View all<ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-0.5" />
          </Link>
        }
      />
      <Rail list={packages.slice(0, 10)} className="mt-5" />
    </section>
  );
}
