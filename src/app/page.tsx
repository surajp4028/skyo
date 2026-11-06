import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AppCta, Destinations, Hero, Offers, SearchSection, ServicesStrip, WhyUs } from "@/components/site/home-sections";

export default function HomePage() {
  return (
    <>
      <Navbar />
      <main>
        <Hero />
        <SearchSection />
        <ServicesStrip />
        <Offers />
        <Destinations />
        <WhyUs />
        <AppCta />
      </main>
      <Footer />
    </>
  );
}
