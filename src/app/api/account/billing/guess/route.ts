import type { NextRequest } from "next/server";
import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { guessRegion } from "@/lib/server/gst";
import { getClientIp } from "@/lib/server/request";

/** GET — best guess of the customer's state from their IP (free ipwho.is lookup). */
export const GET = route(async (req: NextRequest) => {
  await requireUser();
  return ok({ guess: await guessRegion(getClientIp(req.headers)) });
});
