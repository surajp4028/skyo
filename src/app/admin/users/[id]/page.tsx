import { notFound } from "next/navigation";
import { guardPage } from "@/lib/server/admin/guard";
import { UserDetail } from "@/components/admin/user-detail";
import { Forbidden } from "@/components/admin/ui";

export default async function Page({ params }: { params: Promise<{ id: string }> }) {
  const { allowed } = await guardPage("users.view");
  if (!allowed) return <Forbidden />;
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id <= 0) notFound();
  return <UserDetail id={id} />;
}
