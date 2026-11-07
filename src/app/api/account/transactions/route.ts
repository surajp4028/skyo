import { ok, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { listUserAttempts } from "@/lib/server/payments/attempts";

/** GET — every payment attempt the customer made (success / failed / pending), newest first. */
export const GET = route(async () => {
  const u = await requireUser();
  return ok({ attempts: await listUserAttempts(u.uid) });
});
