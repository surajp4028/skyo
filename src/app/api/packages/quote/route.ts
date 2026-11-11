import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { getPackageBySlug } from "@/lib/server/packages";
import { packageQuote, withDeparturePrice } from "@/lib/packages";

export const POST = route(async (req: NextRequest) => {
  const body = await readJson(req, z.object({ slug: z.string().min(3).max(160), guests: z.number().int().min(1).max(12), couponCode: z.string().max(40).optional(), departureId: z.string().max(24).optional() }));
  const item = await getPackageBySlug(body.slug);
  if (!item) throw new ApiError(404, "PACKAGE_NOT_FOUND", "This trip package is not available.");
  const dep = body.departureId ? item.departures.find((d) => d.id === body.departureId) : null;
  const quote = packageQuote(withDeparturePrice(item, dep), body.guests, body.couponCode || "");
  if (!quote.valid) throw new ApiError(422, "INVALID_COUPON", quote.error);
  return ok({ quote });
});
