import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { FlightStatus } from "@/components/flight/flight-status";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export const metadata: Metadata = { title: "Live flight status" };

export default async function FlightStatusPage() {
  if ((await getSetting("service_flight")) !== "on" || (await getSetting("flight_live")) !== "on") return <ServiceOff name="Live flight status" />;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <Suspense>
          <FlightStatus />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
