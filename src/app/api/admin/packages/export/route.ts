import { NextResponse, type NextRequest } from "next/server";
import { route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { listPackages } from "@/lib/server/packages";
import { packagesToCsv } from "@/lib/server/package-csv";
import { audit } from "@/lib/server/audit";

/** GET /api/admin/packages/export[?ids=1,2] → the chosen packages (all when no ids; drafts and archived included) as a CSV file. */
export const GET = route(async (req: NextRequest) => {
  const admin = await requireAdmin("bookings.package");
  const ids = new Set((req.nextUrl.searchParams.get("ids") || "").split(",").map((v) => Number(v)).filter((n) => Number.isSafeInteger(n) && n > 0));
  const list = (await listPackages(true)).filter((p) => !ids.size || ids.has(p.id));
  await audit({ actorType: "admin", actorId: admin.id, action: "package.exported", targetType: "tour_package", targetId: "all", meta: { count: list.length } });
  const stamp = new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 16).replace(/[:T]/g, "-");
  return new NextResponse(packagesToCsv(list), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="skyo-packages-${stamp}.csv"`,
      "Cache-Control": "no-store",
    },
  });
});
