import { guardPage } from "@/lib/server/admin/guard";
import { DisputesView } from "@/components/admin/disputes";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("bookings.train");
  return allowed ? <DisputesView /> : <Forbidden />;
}
