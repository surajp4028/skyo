import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { TrainTools } from "@/components/train/train-tools";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export const metadata: Metadata = { title: "Train tools · live status, station board, vacant berths, UTS fare" };

export default async function TrainToolsPage() {
  if ((await getSetting("service_train")) !== "on") return <ServiceOff name="Train tools" />;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <section className="relative -mt-20 overflow-hidden pb-24 pt-32">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#0057ff_0%,#1a82ff_40%,#7cc4ff_80%,#f6f7fb_100%)]" />
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
      </main>
      <Footer />
    </div>
  );
}
