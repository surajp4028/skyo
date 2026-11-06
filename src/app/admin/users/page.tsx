import { guardPage } from "@/lib/server/admin/guard";
import { UsersList } from "@/components/admin/users";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("users.view");
  return allowed ? <UsersList /> : <Forbidden />;
}
