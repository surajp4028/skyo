import type { Metadata } from "next";
import { Suspense } from "react";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AirportBoard } from "@/components/flight/airport-board";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export const metadata: Metadata = { title: "Airport live board" };

export default async function AirportBoardPage() {
  if ((await getSetting("service_flight")) !== "on" || (await getSetting("flight_airport_board")) !== "on") return <ServiceOff name="Airport live board" />;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <Suspense>
          <AirportBoard />
        </Suspense>
      </main>
      <Footer />
    </div>
  );
}
