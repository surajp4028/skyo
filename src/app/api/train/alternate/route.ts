import { headers } from "next/headers";
import { ApiError } from "@/lib/server/http";
import { getSetting } from "@/lib/server/settings";
import { rateLimit } from "@/lib/server/ratelimit";
import { getClientIp } from "@/lib/server/request";
import { trainRoute } from "@/lib/server/train/guard";
import { z } from "zod";
import { classCode, journeyDate, quota, stationCode, trainNumber } from "@/lib/server/train/validators";
import { findAlternateSeats } from "@/lib/server/train/alternate";

/**
 * GET /api/train/alternate?train=&from=&to=&date=&classes=SL,3A&quota= — one call per train, all its waitlisted classes
 * Confirmed alternatives on the same train (book from an earlier station / split the journey).
 * Runs in the background for every waitlisted class of the trains on screen (≈ 2 + batch credits each).
 * Logged-out visitors are allowed while `train_alt_guests` is on. Per-search / per-visitor counts apply only when
 * `train_alt_limit` is on; the daily RailCore credit cap always applies.
 */
export const GET = trainRoute(
  { name: "alternate", shape: { train: trainNumber, from: stationCode, to: stationCode, date: journeyDate({ futureDays: 120 }), classes: z.string().trim().max(60).transform((v) => v.split(",").filter(Boolean)).pipe(z.array(classCode).min(1).max(8)), quota, search: z.string().trim().max(60).regex(/^[A-Z0-9|-]*$/).optional() }, limit: 300 }, // 300 / 10 min: flood guard against a broken page only
  async (q, c) => {
    if (!c.userId && (await getSetting("train_alt_guests")) !== "on") throw new ApiError(401, "LOGIN_REQUIRED", "Log in to see alternate seats.");
    // counts only apply when Admin turns on "Limit alternate-seat checks" (off by default)
    if ((await getSetting("train_alt_limit")) === "on") {
      const ip = getClientIp(await headers());
      const who = c.userId ? `u:${c.userId}` : `ip:${ip}`;
      const perSearch = Math.max(0, parseInt(await getSetting("train_alt_auto"), 10) || 0);
      const searchKey = q.search || `${q.from}|${q.to}|${q.date}|${q.quota}`;
      const rs = await rateLimit(`train:alternate:search:${who}:${searchKey}`, perSearch, 1800);
      if (!rs.ok) throw new ApiError(429, "ALT_SEARCH_LIMIT", "Alternate seats were already checked for this search.");
      if (!c.userId) {
        const perDay = Math.max(0, parseInt(await getSetting("train_alt_guest_daily"), 10) || 0);
        const rl = await rateLimit(`train:alternate:guest-day:${ip}`, perDay, 86_400);
        if (!rl.ok) throw new ApiError(429, "RATE_LIMITED", "Log in to see more alternate seats today.");
      }
    }
    return findAlternateSeats({ train: q.train, from: q.from, to: q.to, date: q.date, classes: q.classes, quota: q.quota, userId: c.userId });
  },
);
