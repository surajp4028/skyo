import { trainRoute } from "@/lib/server/train/guard";
import { trainNumber } from "@/lib/server/train/validators";
import { getTrain } from "@/lib/server/train/service";

/** GET /api/train/trains/:number — train details (1 credit). */
export const GET = trainRoute({ name: "train", shape: { number: trainNumber }, limit: 20 }, (q, c) => getTrain(q.number, { userId: c.userId }));
