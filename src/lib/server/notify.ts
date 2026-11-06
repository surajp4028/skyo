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
    const j = (await res.json().catch(() => ({}))) as { return?: boolean };
    if (!j.return) console.error("[sms] Fast2SMS rejected request", res.status);
    return Boolean(j.return);
  } catch (e) {
    console.error("[sms] Fast2SMS error", (e as Error).name);
    return false;
  }
}
