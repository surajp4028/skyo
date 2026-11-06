import { guardPage } from "@/lib/server/admin/guard";
import { AuditTrail } from "@/components/admin/audit";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("audit.view");
  return allowed ? <AuditTrail /> : <Forbidden />;
}
