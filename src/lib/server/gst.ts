import "server-only";
import crypto from "node:crypto";
import { z } from "zod";
import { exec, queryOne } from "./db";
import { blindIndex, decrypt, encOpt, encrypt } from "./crypto";
import { ApiError } from "./http";
import { logProvider } from "./payments/log";
import { getSetting } from "./settings";
import { isPrivateIp } from "./request";
import { isValidGstin, matchState, PINCODE_RE, STATE_NAMES, stateByCode } from "@/lib/india";

/* =====================================================================
 * Customer GST details (for tax invoices) + billing state.
 *  Digio GST lookup — same API as the iMoney PHP project:
 *    POST {DIGIO_BASE_URL}/v3/client/kyc/fetch_id_data/GST
 *    Authorization: Basic {DIGIO_AUTH}
 *    { id_no, unique_request_id, is_advanced: false }
 *    → details.{ lgnm, tradeNam, sts, pradr.addr.{ flno, bno, bnm, st, loc, dst, stcd, pncd } }
 * ===================================================================== */

export type GstMode = "fetch" | "manual" | "both";
export const gstMode = async (): Promise<GstMode> => {
  const m = await getSetting("gst_input_mode");
  return m === "fetch" || m === "manual" ? m : "both";
};

export type GstFetched = { gstin: string; company: string; tradeName: string | null; status: string | null; address: string | null; pincode: string | null; state: string | null };

type DigioAddr = { flno?: string; bno?: string; bnm?: string; st?: string; loc?: string; dst?: string; stcd?: string; pncd?: string };
type DigioGst = { details?: { lgnm?: string; tradeNam?: string; sts?: string; pradr?: { addr?: DigioAddr } }; message?: string; error?: string };

export async function digioFetchGst(gstinRaw: string, userUid: string): Promise<GstFetched> {
  const gstin = gstinRaw.trim().toUpperCase();
  if (!isValidGstin(gstin)) throw new ApiError(422, "VALIDATION", "Enter a valid 15-character GSTIN.", { field: "gstin" });
  const base = (process.env.DIGIO_BASE_URL || "").trim().replace(/\/+$/, "");
  const auth = (process.env.DIGIO_AUTH || "").trim();
  if (!base || !auth) throw new ApiError(503, "GST_LOOKUP_OFF", "GST lookup isn't available right now — please enter the details manually.");
  const url = `${base}/v3/client/kyc/fetch_id_data/GST`;
  const body = { id_no: gstin, unique_request_id: `skyo-${Date.now()}-${crypto.randomBytes(3).toString("hex")}`, is_advanced: false };
  const started = Date.now();
  let status = 0;
  let j: DigioGst | null = null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/json", Authorization: `Basic ${auth}` },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20_000),
      cache: "no-store",
    });
    status = res.status;
    j = (await res.json().catch(() => null)) as DigioGst | null;
  } catch (e) {
    await logProvider({ provider: "digio", direction: "outbound", action: "gst.fetch", outcome: "error", latencyMs: Date.now() - started, externalId: userUid, request: { url, body }, response: { error: (e as Error).name } });
    throw new ApiError(504, "GST_LOOKUP_TIMEOUT", "GST lookup didn't respond. Try again or enter the details manually.");
  }
  const d = j?.details;
  const ok = status >= 200 && status < 300 && !!d?.lgnm;
  await logProvider({ provider: "digio", direction: "outbound", action: "gst.fetch", httpStatus: status, outcome: ok ? "ok" : "error", latencyMs: Date.now() - started, externalId: userUid, request: { url, body }, response: j });
  if (!ok || !d) throw new ApiError(404, "GST_NOT_FOUND", j?.message ? `GST lookup: ${j.message}` : "We couldn't find this GSTIN. Check it, or enter the details manually.");
  const a = d.pradr?.addr || {};
  const address = [a.flno, a.bno, a.bnm, a.st, a.loc, a.dst].map((x) => (x || "").trim()).filter(Boolean).join(", ");
  return {
    gstin,
    company: (d.lgnm || "").trim().slice(0, 120),
    tradeName: d.tradeNam?.trim().slice(0, 120) || null,
    status: d.sts?.trim().slice(0, 40) || null,
    address: address ? address.slice(0, 300) : null,
    pincode: a.pncd && PINCODE_RE.test(String(a.pncd)) ? String(a.pncd) : null,
    state: matchState(a.stcd) ?? stateByCode(gstin.slice(0, 2)),
  };
}

export type UserGst = { gstin: string; company: string; address: string | null; pincode: string | null; state: string | null; status: string | null; source: "fetch" | "manual"; updatedAt: Date };

export async function getUserGst(userId: number): Promise<UserGst | null> {
  const r = await queryOne<{ gstin_enc: string; company_enc: string; address_enc: string | null; pincode: string | null; state: string | null; gst_status: string | null; source: "fetch" | "manual"; updated_at: Date }>(
    "SELECT gstin_enc, company_enc, address_enc, pincode, state, gst_status, source, updated_at FROM user_gst WHERE user_id = ?",
    [userId],
  );
  if (!r) return null;
  return {
    gstin: await decrypt(r.gstin_enc), company: await decrypt(r.company_enc), address: (await decrypt(r.address_enc)) || null,
    pincode: r.pincode, state: r.state, status: r.gst_status, source: r.source, updatedAt: r.updated_at,
  };
}

export async function saveUserGst(userId: number, g: { gstin: string; company: string; address: string | null; pincode: string | null; state: string | null; status: string | null }, source: "fetch" | "manual", raw?: unknown) {
  const gstin = g.gstin.trim().toUpperCase();
  await exec(
    `INSERT INTO user_gst (user_id, gstin_enc, gstin_bidx, company_enc, address_enc, pincode, state, gst_status, source, raw_enc)
     VALUES (?,?,?,?,?,?,?,?,?,?)
     ON DUPLICATE KEY UPDATE gstin_enc=VALUES(gstin_enc), gstin_bidx=VALUES(gstin_bidx), company_enc=VALUES(company_enc), address_enc=VALUES(address_enc),
       pincode=VALUES(pincode), state=VALUES(state), gst_status=VALUES(gst_status), source=VALUES(source), raw_enc=VALUES(raw_enc)`,
    [userId, await encrypt(gstin), blindIndex("ref", gstin), await encrypt(g.company), await encOpt(g.address), g.pincode, g.state, g.status, source, await encOpt(raw ? JSON.stringify(raw) : null)],
  );
}

export const deleteUserGst = (userId: number) => exec("DELETE FROM user_gst WHERE user_id = ?", [userId]);

/* ------------------------------ Billing ------------------------------ */

export type Billing = { state: string; pincode: string | null; address: string | null };
export const billingSchema = z.object({
  state: z.string().refine((s) => STATE_NAMES.includes(s), "Pick your state"),
  pincode: z.union([z.literal(""), z.null(), z.string().trim().regex(PINCODE_RE, "6-digit pincode")]).optional(),
  address: z.string().trim().max(200).optional().nullable(),
});

export async function getBilling(userId: number): Promise<Billing | null> {
  const r = await queryOne<{ billing_enc: string | null }>("SELECT billing_enc FROM users WHERE id = ?", [userId]);
  const v = await decrypt(r?.billing_enc ?? null);
  try {
    return v ? (JSON.parse(v) as Billing) : null;
  } catch {
    return null;
  }
}

export async function saveBilling(userId: number, b: Billing) {
  await exec("UPDATE users SET billing_enc = ? WHERE id = ?", [await encrypt(JSON.stringify(b)), userId]);
}

/** Free IP geolocation (ipwho.is) → state + postcode guess. Nothing for private / local IPs. */
export async function guessRegion(ip: string): Promise<{ state: string | null; pincode: string | null; city: string | null }> {
  const none = { state: null, pincode: null, city: null };
  if ((await getSetting("ip_geolocation")) !== "on") return none;
  // Local development: the browser and server share one internet connection, so look up the server's own public IP.
  const local = !ip || isPrivateIp(ip);
  if (local && process.env.NODE_ENV === "production") return none;
  try {
    const res = await fetch(`https://ipwho.is/${local ? "" : encodeURIComponent(ip)}?fields=success,country_code,region,city,postal`, { signal: AbortSignal.timeout(3000), cache: "no-store" });
    const j = (await res.json()) as { success?: boolean; country_code?: string; region?: string; city?: string; postal?: string };
    if (!j.success || j.country_code !== "IN") return none;
    return { state: matchState(j.region), pincode: j.postal && PINCODE_RE.test(j.postal) ? j.postal : null, city: j.city || null };
  } catch {
    return none;
  }
}
