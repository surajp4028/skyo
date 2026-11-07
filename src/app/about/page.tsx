import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AboutView } from "@/components/site/about-view";

export const metadata: Metadata = { title: "About us" };

export default function AboutPage() {
  return (
    <div className="relative">
      <Navbar overHero={false} />
      <main>
        <AboutView />
      </main>
      <Footer />
    </div>
  );
}
