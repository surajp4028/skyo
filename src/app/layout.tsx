import type { Metadata, Viewport } from "next";
import { headers } from "next/headers";
import { Plus_Jakarta_Sans, Instrument_Serif } from "next/font/google";
import { Providers } from "@/lib/client/providers";
import { getPublicSettings } from "@/lib/server/settings";
import { getSessionUser } from "@/lib/server/session";
import { loadMe } from "@/lib/server/me";
import "./globals.css";

const jakarta = Plus_Jakarta_Sans({ subsets: ["latin"], variable: "--font-jakarta", display: "swap" });
const serif = Instrument_Serif({ subsets: ["latin"], weight: "400", style: ["normal", "italic"], variable: "--font-display-serif", display: "swap" });

export async function generateMetadata(): Promise<Metadata> {
  const s = await getPublicSettings();
  return {
    title: { default: `${s.site_name} — Trains, Flights, Buses, Hotels & Holidays`, template: `%s · ${s.site_name}` },
    description: s.site_tagline,
    applicationName: s.site_name,
    robots: { index: true, follow: true },
  };
}

export const viewport: Viewport = { themeColor: "#0a0f1f", width: "device-width", initialScale: 1 };

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  await headers(); // dynamic rendering (per-request CSP nonce)
  const [settings, session] = await Promise.all([getPublicSettings(), getSessionUser()]);
  const me = session ? await loadMe(session.id) : null;
  return (
    <html lang="en" data-scroll-behavior="smooth" className={`${jakarta.variable} ${serif.variable}`}>
      <body className="min-h-screen">
        <Providers settings={settings} initialUser={me ? { ...me, memberSince: new Date(me.memberSince).toISOString() } : null}>
          {children}
        </Providers>
      </body>
    </html>
  );
}
