import { guardPage } from "@/lib/server/admin/guard";
import { SettingsView } from "@/components/admin/settings";
import { Forbidden } from "@/components/admin/ui";

export default async function Page({ searchParams }: { searchParams: Promise<{ tab?: string }> }) {
  const { allowed } = await guardPage("settings.manage");
  const { tab } = await searchParams;
  return allowed ? <SettingsView initialTab={tab} /> : <Forbidden />;
}
