import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { deleteUserGst, getBilling, getUserGst, gstMode, saveUserGst } from "@/lib/server/gst";
import { audit } from "@/lib/server/audit";
import { getClientIp } from "@/lib/server/request";
import { isValidGstin, PINCODE_RE, STATE_NAMES, stateByCode } from "@/lib/india";

/** GET — saved GST details, billing state and which input modes the admin allows. */
export const GET = route(async () => {
  const u = await requireUser();
  return ok({ gst: await getUserGst(u.id), billing: await getBilling(u.id), mode: await gstMode() });
});

/** PUT — manual GST entry (allowed when Admin → Settings → GST mode is "manual" or "both"). */
export const PUT = route(async (req: NextRequest) => {
  const u = await requireUser();
  if ((await gstMode()) === "fetch") throw new ApiError(403, "GST_FETCH_ONLY", "Please use “Fetch details” with your GSTIN.");
  const b = await readJson(
    req,
    z.object({
      gstin: z.string().trim().toUpperCase().refine(isValidGstin, "Enter a valid 15-character GSTIN"),
      company: z.string().trim().min(2, "Enter the company name").max(120),
      address: z.string().trim().max(300).optional().nullable(),
      pincode: z.string().trim().regex(PINCODE_RE, "6-digit pincode").optional().nullable().or(z.literal("")),
      state: z.string().refine((s) => STATE_NAMES.includes(s), "Pick a state").optional().nullable(),
    }),
  );
  const g = { gstin: b.gstin, company: b.company, address: b.address || null, pincode: b.pincode || null, state: b.state || stateByCode(b.gstin.slice(0, 2)), status: null };
  await saveUserGst(u.id, g, "manual");
  await audit({ actorType: "user", actorId: u.id, action: "gst.saved", targetType: "user", targetId: u.uid, ip: getClientIp(req.headers), meta: { source: "manual" } });
  return ok({ gst: await getUserGst(u.id) });
});

export const DELETE = route(async (req: NextRequest) => {
  const u = await requireUser();
  await deleteUserGst(u.id);
  await audit({ actorType: "user", actorId: u.id, action: "gst.removed", targetType: "user", targetId: u.uid, ip: getClientIp(req.headers) });
  return ok({ gst: null });
});
