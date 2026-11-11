import "server-only";
import { z } from "zod";

const line = z.string().trim().max(240);
const urlOrPath = z.string().trim().max(1000).refine((v) => !v || v.startsWith("/") || /^https?:\/\//i.test(v), "Use an https image URL or a local path.");
const strings = z.array(line).max(40);
const ymd = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date");
const hm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use a time like 06:30");
const departure = z.object({
  id: z.string().trim().min(3).max(24).regex(/^[a-z0-9-]+$/), startDate: ymd, startTime: hm, endDate: ymd, endTime: hm,
  seats: z.number().int().min(1).max(500), price: z.number().int().positive().max(10000000).nullable().optional(),
  status: z.enum(["open", "closed"]), note: z.string().trim().max(80).optional(),
}).refine((d) => d.endDate >= d.startDate, { message: "Return date must be on or after the departure date.", path: ["endDate"] });
export const packageInput = z.object({
  slug: z.string().trim().toLowerCase().min(3).max(160).regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/),
  title: z.string().trim().min(3).max(180), shortDescription: z.string().trim().min(10).max(320), detailedDescription: z.string().trim().min(20).max(20000),
  durationDays: z.number().int().min(1).max(60), durationNights: z.number().int().min(0).max(59), destinations: strings.min(1),
  itinerary: z.array(z.object({ dayNumber: z.number().int().min(1).max(60), title: line.min(2), description: z.string().trim().max(1500), activityDetails: strings, time: z.string().trim().max(80).optional() })).min(1).max(60),
  departures: z.array(departure).max(60).default([]),
  tripInfo: z.object({ origin: line.optional(), reportingPoint: line.optional(), returnPoint: line.optional(), travelMode: line.optional(), mealPlan: line.optional() }).nullable().optional(),
  cancellationRules: z.array(z.object({ daysBefore: z.number().int().min(0).max(365), deductionPct: z.number().min(0).max(100) })).max(12).default([])
    .refine((r) => new Set(r.map((x) => x.daysBefore)).size === r.length, "Each cancellation slab needs a different 'days before'."),
  accommodations: z.array(z.object({ hotelName: line.min(2), starRating: z.number().int().min(1).max(5), roomType: line, amenities: strings, city: line.optional() })).max(30),
  originalPrice: z.number().int().positive().max(10000000), discountedPrice: z.number().int().positive().max(10000000), pricingType: z.enum(["per_person", "per_couple"]), upfrontTokenAmount: z.number().int().min(0).max(1000000),
  coverPhoto: urlOrPath.refine(Boolean, "Cover image is required."), images: z.array(urlOrPath).max(20), videoLink: z.union([z.literal(""), z.string().url().max(1000)]).nullable().optional(),
  inclusions: strings, exclusions: strings, coupons: z.array(z.object({ code: z.string().trim().toUpperCase().min(3).max(40).regex(/^[A-Z0-9_-]+$/), discountType: z.enum(["percentage", "flat"]), discountValue: z.number().positive().max(1000000), isActive: z.boolean(), validFrom: z.string().nullable().optional(), validUntil: z.string().nullable().optional(), minGuests: z.number().int().min(1).max(20).nullable().optional(), maxDiscount: z.number().positive().nullable().optional() })).max(30),
  cancellationPolicy: z.string().trim().min(10).max(6000), priceNotes: z.string().trim().max(1000).nullable().optional(), supportContact: z.object({ name: line, email: z.union([z.literal(""), z.string().email()]), phone: z.string().max(30) }).nullable().optional(), status: z.enum(["draft", "published", "archived"]), featured: z.boolean(),
}).refine((p) => p.discountedPrice <= p.originalPrice, { message: "Discounted price must be less than or equal to original price.", path: ["discountedPrice"] })
  .refine((p) => new Set(p.departures.map((d) => d.id)).size === p.departures.length, { message: "Two departures share the same id.", path: ["departures"] });

export const packageCheckoutInput = z.object({
  slug: z.string().trim().min(3).max(160), travelDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(), departureId: z.string().trim().max(24).optional(), guests: z.number().int().min(1).max(12),
  name: z.string().trim().min(2).max(100), email: z.string().trim().toLowerCase().email().max(190), phone: z.string().trim().min(8).max(20),
  couponCode: z.string().trim().max(40).optional().default(""), paymentType: z.enum(["upfront", "full"]).default("upfront"),
});
