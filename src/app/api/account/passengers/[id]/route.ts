import { ApiError, ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { deletePassenger, passengerSchema, updatePassenger } from "@/lib/server/booking/passengers";

type Ctx = { params: Promise<{ id: string }> };
const idOf = async (c: Ctx) => {
  const n = Number((await c.params).id);
  if (!Number.isInteger(n) || n <= 0) throw new ApiError(400, "BAD_ID", "Invalid id");
  return n;
};

export const PATCH = route<Ctx>(async (req, ctx) => {
  const u = await requireUser();
  return ok({ passenger: await updatePassenger(u.id, await idOf(ctx), await readJson(req, passengerSchema)) });
});

export const DELETE = route<Ctx>(async (_req, ctx) => {
  const u = await requireUser();
  await deletePassenger(u.id, await idOf(ctx));
  return ok({});
});
