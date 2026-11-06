import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionUser } from "@/lib/server/session";
import { Navbar } from "@/components/site/navbar";
import { Footer } from "@/components/site/footer";
import { AccountView } from "@/components/site/account-view";

export const metadata: Metadata = { title: "My account", robots: { index: false } };

export default async function AccountPage() {
  const u = await getSessionUser();
  if (!u) redirect("/login?next=/account");
  return (
    <>
      <Navbar overHero={false} />
      <AccountView />
      <Footer />
    </>
  );
}
