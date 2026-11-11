import { ok, route } from "@/lib/server/http";
import { listPackages } from "@/lib/server/packages";

export const GET = route(async () => ok({ packages: await listPackages() }));
