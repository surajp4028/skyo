import type { NextRequest } from "next/server";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { exec, queryOne } from "@/lib/server/db";
import { listPackages } from "@/lib/server/packages";
import { packageInput } from "@/lib/server/package-validation";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";

export const GET = route(async () => {
  await requireAdmin("bookings.package");
  const packages = await listPackages(true);
  const metrics = await queryOne<{ bookings: number; revenuePaise: number | string }>("SELECT COUNT(*) bookings, COALESCE(SUM(amount_paid_paise),0) revenuePaise FROM tour_package_bookings");
  return ok({ packages, metrics: { totalPackages: packages.length, totalBookings: Number(metrics?.bookings || 0), revenuePaise: Number(metrics?.revenuePaise || 0) } });
});

export const POST = route(async (req: NextRequest) => {
  const admin = await requireAdmin("bookings.package");
  const p = await readJson(req, packageInput);
  if (await queryOne("SELECT id FROM tour_packages WHERE slug=?", [p.slug])) throw new ApiError(409, "SLUG_TAKEN", "Another package already uses this URL slug.", { field: "slug" });
  const result = await exec(
    `INSERT INTO tour_packages (slug,title,short_description,detailed_description,duration_days,duration_nights,destinations,itinerary,departures,trip_info,accommodations,original_price,discounted_price,pricing_type,upfront_token_amount,cover_photo,images,video_link,inclusions,exclusions,coupons,cancellation_policy,cancellation_rules,price_notes,support_contact,status,featured,created_by)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [p.slug,p.title,p.shortDescription,p.detailedDescription,p.durationDays,p.durationNights,JSON.stringify(p.destinations),JSON.stringify(p.itinerary),JSON.stringify(p.departures),p.tripInfo?JSON.stringify(p.tripInfo):null,JSON.stringify(p.accommodations),p.originalPrice,p.discountedPrice,p.pricingType,p.upfrontTokenAmount,p.coverPhoto,JSON.stringify(p.images),p.videoLink||null,JSON.stringify(p.inclusions),JSON.stringify(p.exclusions),JSON.stringify(p.coupons),p.cancellationPolicy,JSON.stringify(p.cancellationRules),p.priceNotes||null,p.supportContact?JSON.stringify(p.supportContact):null,p.status,p.featured?1:0,admin.id],
  );
  await audit({ actorType:"admin",actorId:admin.id,action:"package.created",targetType:"tour_package",targetId:String(result.insertId),ip:getClientIp(req.headers),meta:{slug:p.slug,status:p.status} });
  return ok({ id: result.insertId });
});
