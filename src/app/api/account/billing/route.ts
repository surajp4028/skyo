import type { NextRequest } from "next/server";
import { ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { billingSchema, getBilling, saveBilling } from "@/lib/server/gst";

export const GET = route(async () => {
  const u = await requireUser();
  return ok({ billing: await getBilling(u.id) });
});

/** PUT { state, pincode?, address? } — billing state used for GST on invoices and sent with train bookings. */
export const PUT = route(async (req: NextRequest) => {
  const u = await requireUser();
  const b = await readJson(req, billingSchema);
  const billing = { state: b.state, pincode: b.pincode || null, address: b.address || null };
  await saveBilling(u.id, billing);
  return ok({ billing });
});
