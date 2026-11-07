import { ApiError, ok, route } from "@/lib/server/http";
import { requireAdmin } from "@/lib/server/session";
import { queryOne } from "@/lib/server/db";
import { decrypt } from "@/lib/server/crypto";

type Ctx = { params: Promise<{ id: string }> };

/** GET — one aviationstack call with its full (decrypted) response, for the admin ledger. */
export const GET = route<Ctx>(async (_req, { params }) => {
  await requireAdmin("payments.view");
  const id = Number((await params).id);
  if (!Number.isInteger(id) || id < 1) throw new ApiError(404, "NOT_FOUND", "Call not found");
  const r = await queryOne<{ id: number; endpoint: string; params: string; http_status: number; error_code: string | null; billable: number; result_count: number; result_total: number | null; latency_ms: number; reason: string | null; created_at: Date; response_enc: string | null }>(
    "SELECT * FROM flight_api_calls WHERE id = ?",
    [id],
  );
  if (!r) throw new ApiError(404, "NOT_FOUND", "Call not found");
  const { response_enc, ...rest } = r;
  let response: unknown = null;
  try {
    response = response_enc ? JSON.parse(await decrypt(response_enc)) : null;
  } catch {}
  return ok({ call: { ...rest, request: `GET /v1/${r.endpoint}?access_key=•••&${r.params}`, response } });
});
