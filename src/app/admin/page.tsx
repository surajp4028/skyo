import { guardPage } from "@/lib/server/admin/guard";
import { Overview } from "@/components/admin/overview";
import { Forbidden } from "@/components/admin/ui";

export default async function AdminHome() {
  const { allowed } = await guardPage("dashboard.view");
  return allowed ? <Overview /> : <Forbidden />;
}
