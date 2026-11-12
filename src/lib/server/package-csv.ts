import "server-only";
import type { TourPackage } from "@/lib/packages";
import { packageInput } from "./package-validation";
import { exec, queryOne } from "./db";

/*
 * Packages ⇄ CSV, for moving packages between environments (local → Vercel).
 * One row per package. Simple fields are plain cells; lists/objects (itinerary, departures, photos…) are JSON
 * inside the cell. Matching on import is by `slug`: existing → updated, new → created.
 * Cells that start with = + - @ get a leading ' on export (so Excel never runs them as formulas); import strips it.
 */
const COLUMNS = [
  "slug", "title", "status", "featured", "short_description", "detailed_description", "duration_days", "duration_nights",
  "destinations", "categories", "itinerary", "departures", "trip_info", "accommodations", "original_price", "discounted_price", "pricing_type",
  "upfront_token_amount", "cover_photo", "images", "video_link", "inclusions", "exclusions", "coupons", "cancellation_policy",
  "cancellation_rules", "price_notes", "support_contact",
] as const;
type Col = (typeof COLUMNS)[number];

function cell(v: unknown): string {
  let s = v == null ? "" : typeof v === "string" ? v : typeof v === "object" ? JSON.stringify(v) : String(v);
  if (/^[=+\-@]/.test(s)) s = `'${s}`;
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function packagesToCsv(list: TourPackage[]): string {
  const row = (p: TourPackage): Record<Col, unknown> => ({
    slug: p.slug, title: p.title, status: p.status, featured: p.featured ? 1 : 0, short_description: p.shortDescription,
    detailed_description: p.detailedDescription, duration_days: p.durationDays, duration_nights: p.durationNights,
    destinations: p.destinations, categories: p.categories || [], itinerary: p.itinerary, departures: p.departures || [], trip_info: p.tripInfo, accommodations: p.accommodations,
    original_price: p.originalPrice, discounted_price: p.discountedPrice, pricing_type: p.pricingType, upfront_token_amount: p.upfrontTokenAmount,
    cover_photo: p.coverPhoto, images: p.images, video_link: p.videoLink, inclusions: p.inclusions, exclusions: p.exclusions, coupons: p.coupons,
    cancellation_policy: p.cancellationPolicy, cancellation_rules: p.cancellationRules || [], price_notes: p.priceNotes, support_contact: p.supportContact,
  });
  // BOM so Excel opens UTF-8 (₹, Hindi) correctly
  return "﻿" + [COLUMNS.join(","), ...list.map((p) => COLUMNS.map((c) => cell(row(p)[c])).join(","))].join("\r\n") + "\r\n";
}

/** RFC 4180 parser: quoted cells, "" escapes, commas and line breaks inside quotes. */
export function parseCsv(text: string): string[][] {
  const t = text.replace(/^﻿/, "");
  const rows: string[][] = [];
  let row: string[] = [];
  let cur = "";
  let q = false;
  for (let i = 0; i < t.length; i++) {
    const ch = t[i];
    if (q) {
      if (ch === '"') {
        if (t[i + 1] === '"') {
          cur += '"';
          i++;
        } else q = false;
      } else cur += ch;
    } else if (ch === '"') q = true;
    else if (ch === ",") {
      row.push(cur);
      cur = "";
    }
    else if (ch === "\n" || ch === "\r") {
      if (ch === "\r" && t[i + 1] === "\n") i++;
      row.push(cur);
      cur = "";
      if (row.some((c) => c !== "")) rows.push(row);
      row = [];
    } else cur += ch;
  }
  row.push(cur);
  if (row.some((c) => c !== "")) rows.push(row);
  return rows;
}

const unprotect = (s: string) => (/^'[=+\-@]/.test(s) ? s.slice(1) : s);

export type ImportRow = { row: number; slug: string; title: string; action: "create" | "update" | "error"; error?: string };

/** Validate every row; when `apply`, write them. Returns what happened (or would happen) per row. */
export async function importPackagesCsv(text: string, opts: { apply: boolean; adminId: number }): Promise<{ rows: ImportRow[]; created: number; updated: number; errors: number }> {
  const grid = parseCsv(text);
  if (grid.length < 2) return { rows: [{ row: 1, slug: "", title: "", action: "error", error: "The file has no package rows." }], created: 0, updated: 0, errors: 1 };
  const header = grid[0].map((h) => h.trim().toLowerCase());
  const missing = ["slug", "title"].filter((c) => !header.includes(c));
  if (missing.length) return { rows: [{ row: 1, slug: "", title: "", action: "error", error: `Not a SKYO packages file — missing column(s): ${missing.join(", ")}.` }], created: 0, updated: 0, errors: 1 };

  const out: ImportRow[] = [];
  let created = 0, updated = 0, errors = 0;
  for (let i = 1; i < grid.length; i++) {
    const raw: Partial<Record<Col, string>> = {};
    header.forEach((h, k) => {
      if ((COLUMNS as readonly string[]).includes(h)) raw[h as Col] = unprotect(grid[i][k] ?? "");
    });
    const slug = (raw.slug || "").trim();
    const title = (raw.title || "").trim();
    try {
      const j = <T,>(c: Col, fallback: T): T => {
        const v = (raw[c] || "").trim();
        if (!v) return fallback;
        try {
          return JSON.parse(v) as T;
        } catch {
          throw new Error(`Column "${c}" isn't valid JSON.`);
        }
      };
      const n = (c: Col) => Number((raw[c] || "").trim());
      const candidate = {
        slug, title, status: (raw.status || "draft").trim(), featured: ["1", "true", "yes"].includes((raw.featured || "").trim().toLowerCase()),
        shortDescription: raw.short_description || "", detailedDescription: raw.detailed_description || "",
        durationDays: n("duration_days"), durationNights: n("duration_nights"),
        destinations: j("destinations", [] as string[]), categories: j("categories", [] as string[]), itinerary: j("itinerary", []), departures: j("departures", []), tripInfo: j("trip_info", null),
        accommodations: j("accommodations", []), originalPrice: n("original_price"), discountedPrice: n("discounted_price"),
        pricingType: (raw.pricing_type || "per_person").trim(), upfrontTokenAmount: n("upfront_token_amount") || 0,
        coverPhoto: (raw.cover_photo || "").trim(), images: j("images", []), videoLink: (raw.video_link || "").trim() || null,
        inclusions: j("inclusions", []), exclusions: j("exclusions", []), coupons: j("coupons", []),
        cancellationPolicy: raw.cancellation_policy || "", cancellationRules: j("cancellation_rules", []),
        priceNotes: (raw.price_notes || "").trim() || null, supportContact: j("support_contact", null),
      };
      const parsed = packageInput.safeParse(candidate);
      if (!parsed.success) {
        const issue = parsed.error.issues[0];
        throw new Error(`${issue.path.join(".") || "row"}: ${issue.message}`);
      }
      const p = parsed.data;
      const existing = await queryOne<{ id: number }>("SELECT id FROM tour_packages WHERE slug=?", [p.slug]);
      if (opts.apply) {
        const values = [p.title, p.shortDescription, p.detailedDescription, p.durationDays, p.durationNights, JSON.stringify(p.destinations), JSON.stringify(p.categories), JSON.stringify(p.itinerary), JSON.stringify(p.departures), p.tripInfo ? JSON.stringify(p.tripInfo) : null, JSON.stringify(p.accommodations), p.originalPrice, p.discountedPrice, p.pricingType, p.upfrontTokenAmount, p.coverPhoto, JSON.stringify(p.images), p.videoLink || null, JSON.stringify(p.inclusions), JSON.stringify(p.exclusions), JSON.stringify(p.coupons), p.cancellationPolicy, JSON.stringify(p.cancellationRules), p.priceNotes || null, p.supportContact ? JSON.stringify(p.supportContact) : null, p.status, p.featured ? 1 : 0];
        if (existing) {
          await exec(
            "UPDATE tour_packages SET title=?,short_description=?,detailed_description=?,duration_days=?,duration_nights=?,destinations=?,categories=?,itinerary=?,departures=?,trip_info=?,accommodations=?,original_price=?,discounted_price=?,pricing_type=?,upfront_token_amount=?,cover_photo=?,images=?,video_link=?,inclusions=?,exclusions=?,coupons=?,cancellation_policy=?,cancellation_rules=?,price_notes=?,support_contact=?,status=?,featured=? WHERE id=?",
            [...values, existing.id],
          );
        } else {
          await exec(
            "INSERT INTO tour_packages (title,short_description,detailed_description,duration_days,duration_nights,destinations,categories,itinerary,departures,trip_info,accommodations,original_price,discounted_price,pricing_type,upfront_token_amount,cover_photo,images,video_link,inclusions,exclusions,coupons,cancellation_policy,cancellation_rules,price_notes,support_contact,status,featured,slug,created_by) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)",
            [...values, p.slug, opts.adminId],
          );
        }
      }
      out.push({ row: i + 1, slug: p.slug, title: p.title, action: existing ? "update" : "create" });
      if (existing) updated++;
      else created++;
    } catch (e) {
      errors++;
      out.push({ row: i + 1, slug, title, action: "error", error: (e as Error).message.slice(0, 240) });
    }
  }
  return { rows: out, created, updated, errors };
}
