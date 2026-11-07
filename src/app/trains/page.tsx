import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { TrainResults } from "@/components/train/train-results";
import { MAJOR_STATIONS, stationLabel } from "@/lib/train/stations";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export const metadata: Metadata = { title: "Train search" };

const code = (v?: string) => (v && /^[A-Za-z0-9]{1,6}$/.test(v) ? v.toUpperCase() : null);
const label = (c: string, l?: string) => {
  const s = MAJOR_STATIONS.find((x) => x.code === c);
  return s ? stationLabel(s) : l && l.length < 70 ? l : c;
};

export default async function TrainsPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  if ((await getSetting("service_train")) !== "on") return <ServiceOff name="Train booking" />;
  const sp = await searchParams;
  const from = code(sp.from);
  const to = code(sp.to);
  const date = sp.date && /^\d{4}-\d{2}-\d{2}$/.test(sp.date) ? sp.date : null;
  if (!from || !to || !date) redirect("/?tab=train#search");
  const quota = ["GN", "TQ", "PT", "LD", "SS"].includes(sp.quota || "") ? sp.quota! : "GN";
  const slots = (sp.slots || "").split(",").filter((s) => ["early", "morning", "afternoon", "night"].includes(s));
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <TrainResults q={{ from, to, date, quota, fromLabel: label(from, sp.fl), toLabel: label(to, sp.tl) }} initialSlots={slots} />
      </main>
      <Footer />
    </div>
  );
}
