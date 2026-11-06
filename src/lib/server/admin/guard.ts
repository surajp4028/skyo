import "server-only";
import { redirect } from "next/navigation";
import { getSessionAdmin } from "../session";
import { can, type ADMIN_ONLY, type Permission } from "@/lib/permissions";

/** Server-side page guard: redirects when signed out, returns `allowed=false` when lacking permission. */
export async function guardPage(perm: Permission | (typeof ADMIN_ONLY)[number]) {
  const a = await getSessionAdmin();
  if (!a) redirect("/login?as=agent");
  return { admin: a, allowed: can(a, perm) };
}
