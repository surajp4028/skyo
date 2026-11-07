import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionAdmin } from "@/lib/server/session";
import { AdminShell } from "@/components/admin/shell";

export const metadata: Metadata = { title: "Agent console", robots: { index: false, follow: false } };

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const a = await getSessionAdmin();
  if (!a) redirect("/login?as=agent");
  return <AdminShell admin={{ id: a.id, name: a.name, email: a.email, role: a.role, permissions: a.permissions, avatar: a.avatar ?? null }}>{children}</AdminShell>;
}
