import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { paging } from "@/lib/server/admin/queries";

/** Provider request/response log for payments & ticketing (decrypted for authorised agents). */
export const GET = route(async (req: NextRequest) => {
  await requireAdmin("payments.view");
  const sp = req.nextUrl.searchParams;
  const { page, size, offset } = paging(sp, 30);
  const where: string[] = [];
  const params: (string | number)[] = [];
  const provider = sp.get("provider");
  if (provider === "razorpay" || provider === "tripgic" || provider === "skyo" || provider === "digio") {
    where.push("provider = ?");
    params.push(provider);
  }
  const outcome = sp.get("outcome");
  if (outcome === "ok" || outcome === "error") {
    where.push("outcome = ?");
    params.push(outcome);
  }
  const q = (sp.get("q") || "").trim().slice(0, 64);
  if (q) {
    where.push("(booking_ref = ? OR external_id = ?)");
    params.push(q.toUpperCase(), q);
  }
  const w = where.length ? "WHERE " + where.join(" AND ") : "";
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM payment_logs ${w}`, params))?.n ?? 0;
  const rows = await query<{ id: number; booking_ref: string | null; provider: string; direction: string; action: string; http_status: number | null; outcome: string; external_id: string | null; event_id: string | null; amount_paise: number | null; latency_ms: number | null; request_enc: string | null; response_enc: string | null; created_at: Date }>(
    `SELECT * FROM payment_logs ${w} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const logs = await Promise.all(
    rows.map(async ({ request_enc, response_enc, ...r }) => ({ ...r, request: (await decrypt(request_enc)) || null, response: (await decrypt(response_enc)) || null })),
  );
  const [sum] = await query<{ paid: number | null; paid_n: number; pending_n: number; failed_n: number }>(
    "SELECT SUM(CASE WHEN payment_status='paid' THEN amount_paise END) paid, SUM(payment_status='paid') paid_n, SUM(status='pending') pending_n, SUM(status='failed') failed_n FROM bookings",
  );
  return ok({ logs, total: Number(total), page, size, summary: { collectedPaise: Number(sum?.paid || 0), paid: Number(sum?.paid_n || 0), pending: Number(sum?.pending_n || 0), failed: Number(sum?.failed_n || 0) } });
});
