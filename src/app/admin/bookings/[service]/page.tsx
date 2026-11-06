import { notFound } from "next/navigation";
import { guardPage } from "@/lib/server/admin/guard";
import { BookingsView } from "@/components/admin/bookings";
import { Forbidden } from "@/components/admin/ui";
import { SERVICES } from "@/lib/permissions";

export default async function Page({ params }: { params: Promise<{ service: string }> }) {
  const { service } = await params;
  const svc = SERVICES.find((s) => s.key === service);
  if (!svc) notFound();
  const { allowed } = await guardPage(svc.perm);
  return allowed ? <BookingsView service={svc.key} /> : <Forbidden />;
}
