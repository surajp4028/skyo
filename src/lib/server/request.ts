import "server-only";
import { UAParser } from "ua-parser-js";
import { getSetting } from "./settings";

export type ClientInfo = {
  ip: string;
  userAgent: string;
  device: string;
  client: "web" | "android" | "ios";
};

/**
 * Client IP. Behind AWS ALB / CloudFront / Nginx the left-most X-Forwarded-For
 * entry is the client. Make sure your edge proxy OVERWRITES (not appends) this
 * header so it cannot be spoofed.
 */
export function getClientIp(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  const ip = (xff ? xff.split(",")[0] : headers.get("x-real-ip") || "").trim();
  const clean = ip.replace(/^::ffff:/, "");
  return /^[0-9a-fA-F:.]{2,45}$/.test(clean) ? clean : "0.0.0.0";
}

export function getClientInfo(headers: Headers): ClientInfo {
  const userAgent = (headers.get("user-agent") || "").slice(0, 400);
  const r = UAParser(userAgent);
  const browser = [r.browser.name, r.browser.major].filter(Boolean).join(" ");
  const os = [r.os.name, r.os.version].filter(Boolean).join(" ");
  const kind = r.device.type ? r.device.type[0].toUpperCase() + r.device.type.slice(1) : "Desktop";
  const device = [kind, browser && `· ${browser}`, os && `· ${os}`].filter(Boolean).join(" ").slice(0, 160) || "Unknown";
  const hdrClient = headers.get("x-skyo-client");
  const client = hdrClient === "android" || hdrClient === "ios" ? hdrClient : "web";
  return { ip: getClientIp(headers), userAgent, device, client };
}

function isPrivateIp(ip: string): boolean {
  return (
    ip === "0.0.0.0" ||
    ip === "::1" ||
    ip.startsWith("127.") ||
    ip.startsWith("10.") ||
    ip.startsWith("192.168.") ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(ip) ||
    /^f[cd][0-9a-f]{2}:/i.test(ip) ||
    ip.startsWith("fe80:")
  );
}

const geoCache = new Map<string, { v: string; t: number }>();

/**
 * Approximate location (city, region, country) from IP.
 * Prefers CDN headers (CloudFront / Cloudflare / Vercel); falls back to ipwho.is
 * when enabled in Admin → Settings. Never blocks login for more than ~1.5s.
 */
export async function lookupLocation(ip: string, headers?: Headers): Promise<string> {
  if (headers) {
    const city = headers.get("cloudfront-viewer-city") || headers.get("x-vercel-ip-city");
    const country =
      headers.get("cloudfront-viewer-country-name") || headers.get("cf-ipcountry") || headers.get("x-vercel-ip-country");
    if (city || country) return [city && decodeURIComponent(city), country].filter(Boolean).join(", ").slice(0, 160);
  }
  if (isPrivateIp(ip)) return "Local network";
  const hit = geoCache.get(ip);
  if (hit && Date.now() - hit.t < 6 * 3600_000) return hit.v;
  if ((await getSetting("ip_geolocation")) !== "on") return "";
  try {
    const res = await fetch(`https://ipwho.is/${encodeURIComponent(ip)}?fields=success,city,region,country`, {
      signal: AbortSignal.timeout(1500),
      cache: "no-store",
    });
    const j = (await res.json()) as { success?: boolean; city?: string; region?: string; country?: string };
    const v = j.success ? [j.city, j.region, j.country].filter(Boolean).join(", ").slice(0, 160) : "";
    geoCache.set(ip, { v, t: Date.now() });
    return v;
  } catch {
    return "";
  }
}
