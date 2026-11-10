import type { NextRequest } from "next/server";
import { z } from "zod";
import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";
import { getSetting } from "@/lib/server/settings";
import { listUserPnrs, removeUserPnr, saveUserPnr } from "@/lib/server/train/pnr";

/**
 * "Your PNRs" for the logged-in traveller. Reads/writes only SKYO's own tables — never calls RailKit.
 *   GET                         → saved PNRs with their last known status
 *   POST   { pnrs: string[] }   → import PNRs saved in this browser before logging in (numbers only)
 *   DELETE { pnr }              → remove one
 */
const pnr = z
  .string()
  .transform((v) => v.replace(/\D+/g, ""))
  .refine((v) => /^\d{10}$/.test(v), "PNR is 10 digits");

async function me() {
  const u = await getSessionUser();
  if (!u) throw new ApiError(401, "LOGIN_REQUIRED", "Please log in.");
  return u;
}

export const GET = route(async () => {
  const u = await me();
  if ((await getSetting("pnr_status")) !== "on") return ok({ pnrs: [] });
  return ok({ pnrs: await listUserPnrs(u.id) });
});

export const POST = route(async (req: NextRequest) => {
  const u = await me();
  const { pnrs } = await readJson(req, z.object({ pnrs: z.array(pnr).max(10) }));
  // oldest first so the newest ends up on top
  for (const p of [...new Set(pnrs)].reverse()) await saveUserPnr(u.id, p, null);
  return ok({ pnrs: await listUserPnrs(u.id) });
});

export const DELETE = route(async (req: NextRequest) => {
  const u = await me();
  const body = await readJson(req, z.object({ pnr }));
  return ok({ removed: await removeUserPnr(u.id, body.pnr) });
});
