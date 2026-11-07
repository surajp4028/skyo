import { trainRoute } from "@/lib/server/train/guard";
import { trainNumber } from "@/lib/server/train/validators";
import { coachPosition } from "@/lib/server/train/service";

/** GET /api/train/trains/:number/coach-position — coach order from engine (2 credits). */
export const GET = trainRoute({ name: "coach", shape: { number: trainNumber }, limit: 10 }, (q, c) => coachPosition(q.number, { userId: c.userId }));
