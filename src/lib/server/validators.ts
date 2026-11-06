import "server-only";
import { z } from "zod";

export const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(190, "Email is too long")
  .email("Enter a valid email address");

/** Indian mobile numbers, normalised to 10 digits. */
export const phoneSchema = z
  .string()
  .trim()
  .transform((v) => v.replace(/[\s\-()]/g, "").replace(/^(\+91|0091|91(?=\d{10}$)|0(?=\d{10}$))/, ""))
  .refine((v) => /^[6-9]\d{9}$/.test(v), "Enter a valid 10-digit Indian mobile number");

export const nameSchema = z
  .string()
  .trim()
  .min(2, "Name is too short")
  .max(100, "Name is too long")
  .regex(/^[\p{L}][\p{L} .'-]*$/u, "Name can only contain letters, spaces, . ' -");

export const otpSchema = z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code");
export const challengeSchema = z.string().regex(/^[a-f0-9]{32}$/, "Invalid challenge");

/** Detects whether a single login field is an email or a phone. */
export function parseIdentifier(raw: string): { channel: "email" | "phone"; value: string } | null {
  const v = raw.trim();
  if (v.includes("@")) {
    const r = emailSchema.safeParse(v);
    return r.success ? { channel: "email", value: r.data } : null;
  }
  const r = phoneSchema.safeParse(v);
  return r.success ? { channel: "phone", value: r.data } : null;
}

export function maskEmail(email: string): string {
  const [u, d] = email.split("@");
  if (!d) return "***";
  const head = u.slice(0, Math.min(2, u.length));
  return `${head}${"*".repeat(Math.max(1, Math.min(6, u.length - 2)))}@${d}`;
}

export function maskPhone(phone: string): string {
  return phone.length >= 10 ? `${phone.slice(0, 2)}******${phone.slice(-2)}` : "**********";
}

export const strongPassword = z
  .string()
  .min(10, "Use at least 10 characters")
  .max(128)
  .regex(/[a-z]/, "Add a lowercase letter")
  .regex(/[A-Z]/, "Add an uppercase letter")
  .regex(/\d/, "Add a number")
  .regex(/[^A-Za-z0-9]/, "Add a symbol");
