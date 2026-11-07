import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { searchTrains } from "@/lib/server/train/service";

/** GET /api/train/trains/search?q=rajdhani — by name or number (1 credit). */
export const GET = trainRoute(
  { name: "train-search", shape: { q: z.string().trim().min(3, "Type at least 3 characters").max(80) }, limit: 25 },
  (q, c) => searchTrains(q.q, 8, { userId: c.userId }),
);
