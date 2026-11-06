import { guardPage } from "@/lib/server/admin/guard";
import { SessionsLog } from "@/components/admin/sessions";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("sessions.view");
  return allowed ? <SessionsLog /> : <Forbidden />;
}
