import { guardPage } from "@/lib/server/admin/guard";
import { StaffManager } from "@/components/admin/staff";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("staff.manage");
  return allowed ? <StaffManager /> : <Forbidden />;
}
