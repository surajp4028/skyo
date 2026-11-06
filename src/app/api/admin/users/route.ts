import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listUsers } from "@/lib/server/admin/queries";
import { can } from "@/lib/permissions";

/** Admins see full name / email / phone; staff need `users.contact` for unmasked contacts. */
export const GET = route(async (req: NextRequest) => {
  const a = await requireAdmin("users.view");
  return ok({ ...(await listUsers(req.nextUrl.searchParams, can(a, "users.contact"))), full: can(a, "users.contact") });
});
