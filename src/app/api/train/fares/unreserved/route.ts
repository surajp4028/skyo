import { z } from "zod";
import { trainRoute } from "@/lib/server/train/guard";
import { journeyDate, stationCode } from "@/lib/server/train/validators";
import { unreservedFare } from "@/lib/server/train/service";

/** GET /api/train/fares/unreserved?from=&to=&class=II|FC&train_type=O|E|S|T&ticket_type=J|M|Q|H|Y&adult=&child= (3 credits). */
export const GET = trainRoute(
  {
    name: "fares-uts",
    shape: {
      from: stationCode,
      to: stationCode,
      date: journeyDate({ futureDays: 3 }).optional(),
      class: z.enum(["II", "FC"]).default("II"),
      train_type: z.enum(["O", "E", "S", "T"]).default("O"),
      ticket_type: z.enum(["J", "M", "Q", "H", "Y"]).default("J"),
      adult: z.coerce.number().int().min(1).max(9).default(1),
      child: z.coerce.number().int().min(0).max(9).default(0),
    },
    limit: 10,
  },
  (q, c) => unreservedFare(q, { userId: c.userId }),
);
