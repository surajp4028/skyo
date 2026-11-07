import { trainRoute } from "@/lib/server/train/guard";
import { stationCode } from "@/lib/server/train/validators";
import { getStation } from "@/lib/server/train/service";

/** GET /api/train/stations/:code — one station (1 credit). */
export const GET = trainRoute({ name: "station", shape: { code: stationCode }, limit: 20 }, (q, c) => getStation(q.code, { userId: c.userId }));
