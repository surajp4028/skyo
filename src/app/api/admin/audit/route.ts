import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listAudit } from "@/lib/server/admin/queries";

export const GET = route(async (req: NextRequest) => {
  await requireAdmin("audit.view");
  return ok(await listAudit(req.nextUrl.searchParams));
});
