import { ok, route } from "@/lib/server/http";
import { getPublicSettings } from "@/lib/server/settings";

export const GET = route(async () => ok({ settings: await getPublicSettings() }));
