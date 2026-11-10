import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AppCta, Destinations, Hero, Offers, SearchSection, ServicesStrip, WhyUs } from "@/components/site/home-sections";
import { WorldMapSection } from "@/components/site/world-map-section";
import { HomeDock } from "@/components/site/home-dock";
import { FeatureBento, HomeSavedPnrs, PlaneWindowSection } from "@/components/site/home-features";

export default function HomePage() {
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
        <Destinations />
        <WhyUs />
        <WorldMapSection />
        <AppCta />
      </main>
      <Footer />
      <HomeDock />
    </div>
  );
}
