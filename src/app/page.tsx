import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AppCta, Hero, Offers, SearchSection, ServicesStrip, WhyUs } from "@/components/site/home-sections";
import { WorldMapSection } from "@/components/site/world-map-section";
import { HomeDock } from "@/components/site/home-dock";
import { HomePackages } from "@/components/site/home-packages";
import { listPackages } from "@/lib/server/packages";
import { PopularPlaces } from "@/components/site/popular-places";
import { FeatureBento, HomeSavedPnrs, PlaneWindowSection } from "@/components/site/home-features";

export default async function HomePage() {
  const packages = await listPackages().catch(() => []);
  // single root element: lets Next scroll this page to the top on navigation
  return (
    <div className="relative">
      <Navbar />
      <main>
        <Hero />
        <SearchSection />
        <HomeSavedPnrs />
        <ServicesStrip />
        <FeatureBento />
        <PlaneWindowSection />
        <Offers />
        <PopularPlaces className="pt-24" sub="Pick a place and we'll show you the trips that go there." />
        <HomePackages packages={packages} />
        <WhyUs />
        <WorldMapSection />
        <AppCta />
      </main>
      <Footer />
      <HomeDock />
    </div>
  );
}
