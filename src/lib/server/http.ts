import "server-only";
import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { env, isProd } from "./env";

export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string,
    public extra?: Record<string, unknown>,
  ) {
    super(message);
  }
}

export function ok<T extends object>(data: T, init?: ResponseInit) {
  const res = NextResponse.json({ ok: true, ...data }, init);
  res.headers.set("Cache-Control", "no-store");
  return res;
}

export function fail(status: number, code: string, message: string, extra?: Record<string, unknown>) {
  const res = NextResponse.json({ ok: false, error: { code, message, ...extra } }, { status });
  res.headers.set("Cache-Control", "no-store");
  if (extra?.retryAfter) res.headers.set("Retry-After", String(extra.retryAfter));
  return res;
}

/**
 * CSRF defence for cookie-authenticated mutations:
 *  1. SameSite=Lax cookies (set in session.ts)
 *  2. Origin / Sec-Fetch-Site must be same-origin
 *  3. Custom header X-Requested-With: skyo (cannot be sent cross-site without CORS preflight)
 * Mobile apps authenticate with Bearer tokens and skip cookie CSRF checks.
 */
export function assertSameOrigin(req: NextRequest) {
  if (req.headers.get("authorization")?.startsWith("Bearer ")) return;
  const site = req.headers.get("sec-fetch-site");
  if (site && site !== "same-origin" && site !== "none") throw new ApiError(403, "CSRF", "Cross-site request blocked");
  const origin = req.headers.get("origin");
  if (origin) {
    const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
    let originHost = "";
    try {
      originHost = new URL(origin).host;
    } catch {}
    const allowed = new Set([host, new URL(env.appUrl).host]);
    if (!allowed.has(originHost)) throw new ApiError(403, "CSRF", "Cross-site request blocked");
  }
  if (req.headers.get("x-requested-with") !== "skyo") throw new ApiError(403, "CSRF", "Missing request header");
}

export async function readJson<T extends z.ZodTypeAny>(req: NextRequest, schema: T): Promise<z.infer<T>> {
  const len = Number(req.headers.get("content-length") || 0);
  if (len > 32 * 1024) throw new ApiError(413, "PAYLOAD_TOO_LARGE", "Request too large");
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    throw new ApiError(400, "BAD_JSON", "Invalid JSON body");
  }
  const parsed = schema.safeParse(body);
  if (!parsed.success) {
    const first = parsed.error.issues[0];
    throw new ApiError(422, "VALIDATION", first?.message || "Invalid input", { field: first?.path.join(".") });
  }
  return parsed.data;
}

type Handler<C> = (req: NextRequest, ctx: C) => Promise<Response>;

/** Wraps a route handler: CSRF on mutations + uniform error handling (no stack traces leak). */
export function route<C = unknown>(handler: Handler<C>, opts: { csrf?: boolean } = {}): Handler<C> {
  return async (req, ctx) => {
    try {
      const mutating = !["GET", "HEAD", "OPTIONS"].includes(req.method);
      if (mutating && opts.csrf !== false) assertSameOrigin(req);
      return await handler(req, ctx);
    } catch (e) {
      if (e instanceof ApiError) return fail(e.status, e.code, e.message, e.extra);
      console.error("[api] unhandled", req.method, req.nextUrl.pathname, e);
      return fail(500, "SERVER_ERROR", isProd ? "Something went wrong. Please try again." : String((e as Error).message));
    }
  };
}
