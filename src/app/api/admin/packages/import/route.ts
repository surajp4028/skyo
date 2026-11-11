import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { importPackagesCsv } from "@/lib/server/package-csv";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

/**
 * POST /api/admin/packages/import  { csv, apply }
 * apply=false → preview only (validates every row, nothing is written). apply=true → creates / updates by slug.
 */
const Body = z.object({ csv: z.string().min(10).max(2_000_000), apply: z.boolean().default(false) });

export const POST = route(async (req: NextRequest) => {
  const admin = await requireAdmin("bookings.package");
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 2_200_000) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "That file is too large (max 2 MB).");
  let body: z.infer<typeof Body>;
  try {
    body = Body.parse(await req.json());
  } catch {
    throw new ApiError(422, "VALIDATION", "Choose a SKYO packages CSV file.");
  }
  const r = await importPackagesCsv(body.csv, { apply: body.apply, adminId: admin.id });
  if (body.apply) {
    await audit({ actorType: "admin", actorId: admin.id, action: "package.imported", targetType: "tour_package", targetId: "csv", ip: getClientIp(req.headers), meta: { created: r.created, updated: r.updated, errors: r.errors } });
  }
  return ok({ ...r, applied: body.apply });
});
