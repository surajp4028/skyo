import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { query, queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";
import { paging } from "@/lib/server/admin/queries";

/** Admin inbox for the contact form (decrypted for agents with customer access). */
export const GET = route(async (req: NextRequest) => {
  await requireAdmin("users.view");
  const sp = req.nextUrl.searchParams;
  const { page, size, offset } = paging(sp);
  const status = sp.get("status");
  const where = status && ["new", "in_progress", "closed"].includes(status) ? "WHERE status = ?" : "";
  const params = where ? [status as string] : [];
  const total = (await queryOne<{ n: number }>(`SELECT COUNT(*) n FROM contact_messages ${where}`, params))?.n ?? 0;
  const rows = await query<{ id: number; ref: string; topic: string; name_enc: string; email_enc: string; phone_enc: string | null; message_enc: string; status: string; created_at: Date; user_id: number | null }>(
    `SELECT id, ref, topic, name_enc, email_enc, phone_enc, message_enc, status, created_at, user_id FROM contact_messages ${where} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, size, offset],
  );
  const counts = await query<{ status: string; n: number }>("SELECT status, COUNT(*) n FROM contact_messages GROUP BY status");
  const messages = await Promise.all(
    rows.map(async (r) => ({
      id: r.id, ref: r.ref, topic: r.topic, status: r.status, created_at: r.created_at, user_id: r.user_id,
      name: await decrypt(r.name_enc), email: await decrypt(r.email_enc), phone: (await decrypt(r.phone_enc)) || null, message: await decrypt(r.message_enc),
    })),
  );
  return ok({ messages, total: Number(total), page, size, counts: Object.fromEntries(counts.map((c) => [c.status, Number(c.n)])) });
});
