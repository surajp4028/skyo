import type { Metadata } from "next";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { ContactView } from "@/components/site/contact-view";

export const metadata: Metadata = { title: "Contact us" };

export default function ContactPage() {
  return (
    <div className="relative">
      <Navbar />
      <main>
        <ContactView />
      </main>
      <Footer />
    </div>
  );
}
