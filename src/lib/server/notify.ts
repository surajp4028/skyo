import "server-only";
import { env } from "./env";

/* =====================================================================
 * Outbound notifications — ZeptoMail (email) + Fast2SMS (SMS)
 * Mirrors the PHP merchant project wiring. Never logs OTP / keys / bodies.
 * ===================================================================== */

export type EmailTemplate = "register_otp" | "verify_otp" | "welcome";

function templateKey(t: EmailTemplate): string {
  if (t === "register_otp") return env.zepto.tplRegister || env.zepto.tplVerify;
  if (t === "verify_otp") return env.zepto.tplVerify;
  return env.zepto.tplWelcome;
}

export async function sendEmailTemplate(
  to: string,
  name: string,
  template: EmailTemplate,
  merge: Record<string, string>,
): Promise<boolean> {
  const key = templateKey(template);
  if (!env.zepto.apiKey || !key) {
    console.warn("[mail] ZeptoMail not configured — skipped", template);
    return false;
  }
  try {
    const res = await fetch(env.zepto.url, {
      method: "POST",
      headers: {
        Accept: "application/json",
        "Content-Type": "application/json",
        Authorization: env.zepto.apiKey.startsWith("Zoho-enczapikey") ? env.zepto.apiKey : `Zoho-enczapikey ${env.zepto.apiKey}`,
      },
      body: JSON.stringify({
        template_key: key,
        from: { address: env.zepto.fromEmail, name: env.zepto.fromName },
        to: [{ email_address: { address: to, name: name || "Traveller" } }],
        merge_info: merge,
      }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) console.error("[mail] ZeptoMail HTTP", res.status);
    return res.ok;
  } catch (e) {
    console.error("[mail] ZeptoMail error", (e as Error).name);
    return false;
  }
}

export async function sendOtpSms(phone10: string, otp: string): Promise<boolean> {
  if (!env.sms.apiKey) {
    console.warn("[sms] Fast2SMS not configured — skipped");
    return false;
  }
  const payload =
    env.sms.route === "dlt"
      ? { route: "dlt", sender_id: env.sms.senderId, message: env.sms.templateId, variables_values: otp, numbers: phone10 }
      : { route: "otp", variables_values: otp, numbers: phone10 };
  try {
    const res = await fetch(env.sms.url, {
      method: "POST",
      headers: { authorization: env.sms.apiKey, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json().catch(() => ({}))) as { return?: boolean; request_id?: string; message?: string | string[]; status_code?: number };
    const msg = Array.isArray(j.message) ? j.message.join(" ") : j.message || "";
    // never the key or the full number — just enough to find the message in the Fast2SMS delivery report
    if (!j.return) console.error(`[sms] Fast2SMS rejected OTP to ******${phone10.slice(-4)} · http ${res.status} · code ${j.status_code ?? "-"} · ${String(msg).slice(0, 160)}`);
    else console.log(`[sms] Fast2SMS accepted OTP to ******${phone10.slice(-4)} · request ${j.request_id ?? "-"} · route ${env.sms.route}`);
    return Boolean(j.return);
  } catch (e) {
    console.error("[sms] Fast2SMS error", (e as Error).name);
    return false;
  }
}

/* ------------------------- Booking notifications ------------------------- */

const resendCfg = () => ({ key: (process.env.RESEND_API_KEY || "").trim(), from: (process.env.RESEND_FROM || "SKYO <onboarding@resend.dev>").trim() });

export type SendResult = { ok: boolean; status: number | null; response: unknown; request: unknown };

/** Transactional email through Resend (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendResendEmail(p: { to: string; subject: string; html: string; text: string; attachments?: { filename: string; content: Uint8Array }[] }): Promise<SendResult> {
  const { key, from } = resendCfg();
  const request = { from, to: [p.to], subject: p.subject, attachments: p.attachments?.map((a) => ({ filename: a.filename, bytes: a.content.length })) };
  if (!key) return { ok: false, status: null, response: { skipped: "RESEND_API_KEY not set" }, request };
  if (env.otpDryRun) return { ok: true, status: null, response: { dryRun: true }, request };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [p.to], subject: p.subject, html: p.html, text: p.text,
        attachments: p.attachments?.map((a) => ({ filename: a.filename, content: Buffer.from(a.content).toString("base64") })),
      }),
      signal: AbortSignal.timeout(15_000),
    });
    return { ok: res.ok, status: res.status, response: await res.json().catch(() => null), request };
  } catch (e) {
    return { ok: false, status: null, response: { error: (e as Error).name }, request };
  }
}

/**
 * Booking SMS via Fast2SMS. With FAST2SMS_BOOKING_TEMPLATE_ID → DLT route (variables "ref|pnr|amount");
 * without it → Quick SMS route with plain text (temporary until a DLT template is approved).
 */
export async function sendBookingSms(phone10: string, v: { ref: string; pnr: string; amount: string; text: string }): Promise<SendResult> {
  const tpl = (process.env.FAST2SMS_BOOKING_TEMPLATE_ID || "").trim();
  const payload = tpl
    ? { route: "dlt", sender_id: env.sms.senderId, message: tpl, variables_values: `${v.ref}|${v.pnr}|${v.amount}`, numbers: phone10 }
    : { route: "q", message: v.text, numbers: phone10, flash: 0 };
  if (!env.sms.apiKey) return { ok: false, status: null, response: { skipped: "FAST2SMS not set" }, request: payload };
  if (env.otpDryRun) return { ok: true, status: null, response: { dryRun: true }, request: payload };
  try {
    const res = await fetch(env.sms.url, {
      method: "POST",
      headers: { authorization: env.sms.apiKey, "content-type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await res.json().catch(() => ({}))) as { return?: boolean };
    return { ok: Boolean(j.return), status: res.status, response: j, request: payload };
  } catch (e) {
    return { ok: false, status: null, response: { error: (e as Error).name }, request: payload };
  }
}
