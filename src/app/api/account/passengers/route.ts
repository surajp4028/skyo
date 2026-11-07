import type { NextRequest } from "next/server";
import { ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { addPassenger, listPassengers, passengerSchema } from "@/lib/server/booking/passengers";
import { getSetting } from "@/lib/server/settings";

export const GET = route(async () => {
  const u = await requireUser();
  return ok({ passengers: await listPassengers(u.id), max: Number(await getSetting("max_saved_passengers")) || 20 });
});

export const POST = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(req, passengerSchema);
  return ok({ passenger: await addPassenger(u.id, body) });
});
