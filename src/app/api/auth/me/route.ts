import { ok, route } from "@/lib/server/http";
import { getSessionUser } from "@/lib/server/session";
import { loadMe } from "@/lib/server/me";

export const GET = route(async () => {
  const s = await getSessionUser();
  return ok({ user: s ? await loadMe(s.id) : null });
});
