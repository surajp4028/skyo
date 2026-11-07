import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { FlightResults } from "@/components/flight/flight-results";
import { airportLabel } from "@/lib/flight/airports";
import { worldAirport } from "@/lib/server/flight/world-airports";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export const metadata: Metadata = { title: "Flight search" };

export default async function FlightsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if ((await getSetting("service_flight")) !== "on") return <ServiceOff name="Flight booking" />;
  const sp = await searchParams;
  const from = worldAirport(sp.from);
  const to = worldAirport(sp.to);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  if (!from || !to || !date) redirect("/?tab=flight#search");
  const cabin = sp.cabin === "business" ? "business" : "economy";
  const adults = Math.min(9, Math.max(1, parseInt(sp.adults || "1", 10) || 1));
  const children = Math.min(9 - adults, Math.max(0, parseInt(sp.children || "0", 10) || 0));
  const infants = Math.min(adults, 9 - adults - children, Math.max(0, parseInt(sp.infants || "0", 10) || 0));
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <FlightResults q={{ from: from.iata, to: to.iata, fromLabel: airportLabel(from), toLabel: airportLabel(to), date, cabin, adults, children, infants }} />
      </main>
      <Footer />
    </div>
  );
}
