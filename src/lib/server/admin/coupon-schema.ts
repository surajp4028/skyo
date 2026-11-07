import "server-only";
import { z } from "zod";

const money = z.coerce.number().min(0).max(100000);
const intOrNull = z.union([z.null(), z.coerce.number().int().min(1).max(1_000_000)]);
const dateOrNull = z.union([z.string().regex(/^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2})?$/), z.null()]);

/** Admin coupon form. value = percent (1–100) or ₹ amount; zero_service ignores value. */
export const couponInput = z
  .object({
    code: z.string().trim().toUpperCase().regex(/^[A-Z0-9_-]{3,32}$/, "3–32 letters, numbers, - or _"),
    title: z.string().trim().max(100).nullable().optional(),
    type: z.enum(["percent", "fixed", "zero_service"]),
    value: money.default(0),
    applyOn: z.enum(["base_fare", "service_fee", "total"]).default("total"),
    maxDiscount: z.union([z.null(), money]).optional(),
    minOrder: z.union([z.null(), money]).optional(),
    service: z.enum(["train", "all"]).default("train"),
    perUserLimit: intOrNull.optional(),
    totalLimit: intOrNull.optional(),
    userUid: z.union([z.string().trim().toUpperCase().regex(/^SKYO\d{8}$/, "SKYO ID like SKYO12345678"), z.null()]).optional(),
    status: z.enum(["active", "paused"]).default("active"),
    startsAt: dateOrNull.optional(),
    expiresAt: dateOrNull.optional(),
  })
  .superRefine((c, ctx) => {
    if (c.type === "percent" && (c.value <= 0 || c.value > 100)) ctx.addIssue({ code: "custom", path: ["value"], message: "Percent must be 1 – 100" });
    if (c.type === "fixed" && c.value <= 0) ctx.addIssue({ code: "custom", path: ["value"], message: "Enter the ₹ amount" });
  });
export type CouponInput = z.infer<typeof couponInput>;

/** IST date (YYYY-MM-DD or YYYY-MM-DDTHH:mm from the admin form) → UTC DATETIME string. */
export function istToUtc(v: string | null | undefined) {
  if (!v) return null;
  const d = new Date(`${v.length === 10 ? `${v}T00:00` : v}:00+05:30`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 19).replace("T", " ");
}

export const couponParams = (c: CouponInput) => [
  c.code, c.title || null, c.type, c.type === "zero_service" ? 0 : c.value, c.type === "zero_service" ? "service_fee" : c.applyOn,
  c.type === "percent" ? (c.maxDiscount ?? null) : null, c.minOrder ?? null, c.service, c.perUserLimit ?? null, c.totalLimit ?? null,
  c.userUid ?? null, c.status, istToUtc(c.startsAt), istToUtc(c.expiresAt),
];
