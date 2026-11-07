import { guardPage } from "@/lib/server/admin/guard";
import { MessagesInbox } from "@/components/admin/messages";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("users.view");
  return allowed ? <MessagesInbox /> : <Forbidden />;
}
