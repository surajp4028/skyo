import type { NextRequest } from "next/server";
import { z } from "zod";
import { ok, readJson, route } from "@/lib/server/http";
import { requireUser } from "@/lib/server/session";
import { exec } from "@/lib/server/db";
import { nameSchema } from "@/lib/server/validators";
import { loadMe } from "@/lib/server/me";

export const PATCH = route(async (req: NextRequest) => {
  const u = await requireUser();
  const body = await readJson(req, z.object({ name: nameSchema }));
  await exec("UPDATE users SET name = ? WHERE id = ?", [body.name, u.id]);
  return ok({ user: await loadMe(u.id) });
});
