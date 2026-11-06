import { guardPage } from "@/lib/server/admin/guard";
import { SettingsView } from "@/components/admin/settings";
import { Forbidden } from "@/components/admin/ui";

export default async function Page() {
  const { allowed } = await guardPage("settings.manage");
  return allowed ? <SettingsView /> : <Forbidden />;
}
