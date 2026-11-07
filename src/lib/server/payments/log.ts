import "server-only";
import { exec } from "../db";
import { encOpt } from "../crypto";

/**
 * Provider transaction log — every request/response with Razorpay & Tripgic.
 * Bodies are KMS-encrypted. Never pass secrets or Authorization headers in `request`.
 */
export type LogEntry = {
  bookingRef?: string | null;
  provider: "razorpay" | "tripgic" | "skyo" | "digio" | "aviationstack";
  direction: "outbound" | "inbound";
  action: string;
  httpStatus?: number | null;
  outcome: "ok" | "error";
  externalId?: string | null;
  eventId?: string | null;
  amountPaise?: number | null;
  latencyMs?: number | null;
  request?: unknown;
  response?: unknown;
};

/** Returns false when `eventId` was already logged (duplicate webhook delivery). */
export async function logProvider(e: LogEntry): Promise<boolean> {
  try {
    await exec(
      `INSERT INTO payment_logs (booking_ref, provider, direction, action, http_status, outcome, external_id, event_id, amount_paise, latency_ms, request_enc, response_enc)
       VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`,
      [
        e.bookingRef ?? null, e.provider, e.direction, e.action.slice(0, 48), e.httpStatus ?? null, e.outcome, e.externalId ?? null, e.eventId ?? null,
        e.amountPaise ?? null, e.latencyMs ?? null,
        await encOpt(e.request === undefined ? null : JSON.stringify(e.request)),
        await encOpt(e.response === undefined ? null : JSON.stringify(e.response)),
      ],
    );
    return true;
  } catch (err) {
    if ((err as { code?: string }).code === "ER_DUP_ENTRY") return false;
    console.error("[payment-log] write failed", (err as Error).message);
    return true;
  }
}
