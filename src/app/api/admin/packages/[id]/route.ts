import type { NextRequest } from "next/server";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { packageInput } from "@/lib/server/package-validation";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

type Ctx = { params: Promise<{ id: string }> };
export const PUT = route<Ctx>(async (req: NextRequest, { params }) => {
  const admin = await requireAdmin("bookings.package");
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404,"NOT_FOUND","Package not found.");
  const p = await readJson(req, packageInput);
  const duplicate = await queryOne<{ id:number }>("SELECT id FROM tour_packages WHERE slug=? AND id<>?",[p.slug,id]);
  if (duplicate) throw new ApiError(409,"SLUG_TAKEN","Another package already uses this URL slug.",{field:"slug"});
  const result = await exec(
    `UPDATE tour_packages SET slug=?,title=?,short_description=?,detailed_description=?,duration_days=?,duration_nights=?,destinations=?,itinerary=?,departures=?,trip_info=?,accommodations=?,original_price=?,discounted_price=?,pricing_type=?,upfront_token_amount=?,cover_photo=?,images=?,video_link=?,inclusions=?,exclusions=?,coupons=?,cancellation_policy=?,cancellation_rules=?,price_notes=?,support_contact=?,status=?,featured=? WHERE id=?`,
    [p.slug,p.title,p.shortDescription,p.detailedDescription,p.durationDays,p.durationNights,JSON.stringify(p.destinations),JSON.stringify(p.itinerary),JSON.stringify(p.departures),p.tripInfo?JSON.stringify(p.tripInfo):null,JSON.stringify(p.accommodations),p.originalPrice,p.discountedPrice,p.pricingType,p.upfrontTokenAmount,p.coverPhoto,JSON.stringify(p.images),p.videoLink||null,JSON.stringify(p.inclusions),JSON.stringify(p.exclusions),JSON.stringify(p.coupons),p.cancellationPolicy,JSON.stringify(p.cancellationRules),p.priceNotes||null,p.supportContact?JSON.stringify(p.supportContact):null,p.status,p.featured?1:0,id],
  );
  if (!result.affectedRows) throw new ApiError(404,"NOT_FOUND","Package not found.");
  await audit({actorType:"admin",actorId:admin.id,action:"package.updated",targetType:"tour_package",targetId:String(id),ip:getClientIp(req.headers),meta:{slug:p.slug,status:p.status}});
  return ok({ saved:true });
});

export const DELETE = route<Ctx>(async (req: NextRequest, { params }) => {
  const admin = await requireAdmin("bookings.package");
  const { id: rawId } = await params;
  const id = Number(rawId);
  if (!Number.isSafeInteger(id) || id < 1) throw new ApiError(404,"NOT_FOUND","Package not found.");
  const result = await exec("UPDATE tour_packages SET status='archived' WHERE id=?",[id]);
  if (!result.affectedRows) throw new ApiError(404,"NOT_FOUND","Package not found.");
  await audit({actorType:"admin",actorId:admin.id,action:"package.archived",targetType:"tour_package",targetId:String(id),ip:getClientIp(req.headers)});
  return ok({ archived:true });
});
