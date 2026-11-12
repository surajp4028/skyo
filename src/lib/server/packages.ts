import "server-only";
import { query, queryOne } from "./db";
import type { TourPackage } from "@/lib/packages";

type Row = Record<string, unknown> & { id: number; slug: string; title: string; short_description: string; detailed_description: string; duration_days: number; duration_nights: number; original_price: number; discounted_price: number; pricing_type: TourPackage["pricingType"]; upfront_token_amount: number; cover_photo: string; video_link: string | null; cancellation_policy: string; price_notes: string | null; status: TourPackage["status"]; featured: number; created_at?: Date; updated_at?: Date };
const json = <T,>(v: unknown, fallback: T): T => {
  if (v == null) return fallback;
  if (typeof v === "string") { try { return JSON.parse(v) as T; } catch { return fallback; } }
  return v as T;
};
export function packageFromRow(r: Row): TourPackage {
  return {
    id: Number(r.id), slug: r.slug, title: r.title, shortDescription: r.short_description, detailedDescription: r.detailed_description,
    durationDays: Number(r.duration_days), durationNights: Number(r.duration_nights), destinations: json(r.destinations, []), categories: json(r.categories, []), itinerary: json(r.itinerary, []),
    accommodations: json(r.accommodations, []), departures: json(r.departures, []), tripInfo: json(r.trip_info, null), cancellationRules: json(r.cancellation_rules, []), originalPrice: Number(r.original_price), discountedPrice: Number(r.discounted_price),
    pricingType: r.pricing_type, upfrontTokenAmount: Number(r.upfront_token_amount), coverPhoto: r.cover_photo, images: json(r.images, []),
    videoLink: r.video_link, inclusions: json(r.inclusions, []), exclusions: json(r.exclusions, []), coupons: json(r.coupons, []),
    cancellationPolicy: r.cancellation_policy, priceNotes: r.price_notes, supportContact: json(r.support_contact, null), status: r.status, featured: !!r.featured,
    createdAt: r.created_at?.toISOString(), updatedAt: r.updated_at?.toISOString(),
  };
}
export async function listPackages(admin = false) {
  const rows = await query<Row>(`SELECT * FROM tour_packages ${admin ? "ORDER BY updated_at DESC" : "WHERE status='published' ORDER BY featured DESC, updated_at DESC"}`);
  return rows.map(packageFromRow);
}
export async function getPackageBySlug(slug: string, admin = false) {
  const row = await queryOne<Row>(`SELECT * FROM tour_packages WHERE slug=? ${admin ? "" : "AND status='published'"} LIMIT 1`, [slug]);
  return row ? packageFromRow(row) : null;
}
