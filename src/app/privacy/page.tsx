import type { Metadata } from "next";
import { LegalPage } from "@/components/site/legal-page";
import { getPublicSettings } from "@/lib/server/settings";

export const metadata: Metadata = { title: "Privacy Policy" };

export default async function Privacy() {
  const s = await getPublicSettings();
  return (
    <LegalPage title="Privacy Policy" updated="November 2026">
      <p>This notice explains how {s.site_name} (“we”) processes your personal data under the Digital Personal Data Protection Act, 2023 (DPDP Act) and the IT Act, 2000. <em>Template — have it reviewed by your legal counsel before launch.</em></p>
      <h2>What we collect</h2>
      <ul>
        <li>Identity & contact: name, email address, mobile number (verified via one-time codes).</li>
        <li>Booking data: traveller names, journey details, ID details where the carrier requires them.</li>
        <li>Security data: IP address, approximate location derived from IP, device/browser type and login history — used to protect your account.</li>
      </ul>
      <h2>Why we use it (purpose limitation)</h2>
      <ul>
        <li>To create and secure your account and to complete the bookings you request.</li>
        <li>To send tickets, OTPs and service alerts. Marketing only with separate opt-in.</li>
        <li>To detect fraud and comply with legal obligations.</li>
      </ul>
      <h2>How we protect it</h2>
      <p>Email addresses and phone numbers are encrypted at rest with AES-256-GCM using keys managed in AWS KMS. Passwords are never stored for travellers; OTPs and session tokens are stored only as one-way hashes. All traffic uses TLS. Access by our staff is permission-based and audit-logged.</p>
      <h2>Your rights</h2>
      <p>You may access, correct or erase your data, withdraw consent, and nominate another person to exercise your rights. You can sign out of any device from <b>My account</b>. Write to {s.support_email}.</p>
      <h2>Retention</h2>
      <p>We keep account data while your account is active, and booking/tax records for the period required by law. Security logs are kept for up to 180 days.</p>
      <h2 id="grievance">Grievance Officer</h2>
      <p>Grievance Officer, {s.site_name} · {s.support_email} · {s.support_phone}. We acknowledge complaints within 24 hours and resolve them within 15 days. You may also approach the Data Protection Board of India.</p>
    </LegalPage>
  );
}
