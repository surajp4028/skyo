import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { TrainDetail } from "@/components/train/train-detail";
import { getSetting } from "@/lib/server/settings";
import { ServiceOff } from "@/components/site/service-off";

export async function generateMetadata({ params }: { params: Promise<{ number: string }> }): Promise<Metadata> {
  return { title: `Train ${(await params).number} · schedule & live status` };
}

const code = (v?: string) => (v && /^[A-Za-z0-9]{1,6}$/.test(v) ? v.toUpperCase() : undefined);

export default async function TrainPage({ params, searchParams }: { params: Promise<{ number: string }>; searchParams: Promise<Record<string, string | undefined>> }) {
  const { number } = await params;
  if (!/^[0-9A-Za-z]{4,6}$/.test(number)) notFound();
  if ((await getSetting("service_train")) !== "on") return <ServiceOff name="Trains" />;
  const sp = await searchParams;
  return (
    <div className="relative">
      <Navbar />
      <main className="min-h-screen">
        <TrainDetail number={number.toUpperCase()} from={code(sp.from)} to={code(sp.to)} date={sp.date} tab={sp.tab} />
      </main>
      <Footer />
    </div>
  );
}
