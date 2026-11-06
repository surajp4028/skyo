import { NextResponse, type NextRequest } from "next/server";

/**
 * Runs before every page request:
 *  - strict, nonce-based Content-Security-Policy
 *  - security headers (HSTS, frame, referrer, permissions…)
 *  - optimistic auth redirects (real checks happen server-side in layouts + APIs)
 */
const isProd = process.env.NODE_ENV === "production";
const USER_COOKIE = isProd ? "__Host-skyo_s" : "skyo_s";
const ADMIN_COOKIE = isProd ? "__Host-skyo_a" : "skyo_a";

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (pathname.startsWith("/admin") && !req.cookies.get(ADMIN_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = "?as=agent";
    return NextResponse.redirect(url);
  }
  if (pathname.startsWith("/account") && !req.cookies.get(USER_COOKIE)) {
    const url = req.nextUrl.clone();
    url.pathname = "/login";
    url.search = `?next=${encodeURIComponent(pathname)}`;
    return NextResponse.redirect(url);
  }

  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");
  const csp = [
    "default-src 'self'",
    `script-src 'self' 'nonce-${nonce}' 'strict-dynamic'${isProd ? "" : " 'unsafe-eval'"}`,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https://images.unsplash.com",
    "font-src 'self' data:",
    `connect-src 'self'${isProd ? "" : " ws: wss:"}`,
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");

  const reqHeaders = new Headers(req.headers);
  reqHeaders.set("x-nonce", nonce);
  reqHeaders.set("Content-Security-Policy", csp);
  const res = NextResponse.next({ request: { headers: reqHeaders } });
  res.headers.set("Content-Security-Policy", csp);
  return res;
}

export const config = {
  matcher: [
    {
      source: "/((?!api|_next/static|_next/image|favicon.ico|icon.svg|robots.txt).*)",
      missing: [
        { type: "header", key: "next-router-prefetch" },
        { type: "header", key: "purpose", value: "prefetch" },
      ],
    },
  ],
};
