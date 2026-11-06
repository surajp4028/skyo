import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getPublicSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Terms of Use" };

export default async function Terms() {
  const s = await getPublicSettings();
  return (
    <LegalPage title="Terms of Use" updated="November 2026">
      <p>By using {s.site_name} you agree to these terms. <em>Template — have it reviewed by your legal counsel before launch.</em></p>
      <h2>Your account</h2>
      <p>You log in with a one-time code sent to your email or mobile. Keep your devices secure; you are responsible for activity on your account. You must be 18+ or use the service under a guardian’s supervision.</p>
      <h2>Bookings</h2>
      <p>{s.site_name} acts as an intermediary. Train tickets are subject to Indian Railways / IRCTC rules; flights, buses and hotels are subject to the respective provider’s fare rules, cancellation and refund policies, which are shown before you pay.</p>
      <h2>Payments & refunds</h2>
      <p>Payments are processed by RBI-regulated payment aggregators. We never store your full card details. Refunds are credited to the original payment source as per provider timelines.</p>
      <h2>Acceptable use</h2>
      <p>No automated scraping, reselling of tickets in violation of carrier rules, or attempts to breach security. We may suspend accounts involved in fraud.</p>
      <h2>Contact</h2>
      <p>{s.support_email} · {s.support_phone}</p>
    </LegalPage>
  );
}
