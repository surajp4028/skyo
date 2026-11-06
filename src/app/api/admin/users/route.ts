import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listUsers } from "@/lib/server/admin/queries";
import { can } from "@/lib/permissions";
import { audit } from "@/lib/server/audit";

export const GET = route(async (req: NextRequest) => {
  const a = await requireAdmin("users.view");
  const unmask = can(a, "users.contact") && req.nextUrl.searchParams.get("reveal") === "1";
  if (unmask) await audit({ actorType: "admin", actorId: a.id, action: "pii.reveal_list", meta: { q: req.nextUrl.searchParams.get("q") || "" } });
  return ok(await listUsers(req.nextUrl.searchParams, unmask));
});
