import type { NextRequest } from "next/server";
import { ApiError, ok, route } from "@/lib/server/http";
import { getPackageBySlug } from "@/lib/server/packages";

type Ctx = { params: Promise<{ slug: string }> };
export const GET = route<Ctx>(async (_req: NextRequest, { params }) => {
  const { slug } = await params;
  const item = await getPackageBySlug(slug);
  if (!item) throw new ApiError(404, "PACKAGE_NOT_FOUND", "This trip package is not available.");
  return ok({ package: item });
});
