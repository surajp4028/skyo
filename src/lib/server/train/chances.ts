import "server-only";
import { seatAvailabilityBatch } from "./service";
import { assertDailyBudget, type RailResult } from "./client";
import type { ClassCode, Quota } from "./types";

export type ChanceItem = { train: string; from: string; to: string; classes: ClassCode[] };
export type Chances = Record<string, Record<string, { pct: number | null; text: string }>>;

const CHUNK = 25; // trains per batch call (RailCore batch limit: 25 items)

/**
 * Real confirmation % for every waitlisted / RAC class of a search's trains, in as few calls as possible
 * (one batch per 25 trains, own route only — 1 request per class). Much cheaper than the alternate-seat check.
 */
export async function trainChances(p: { items: ChanceItem[]; date: string; quota: Quota; userId: number | null }): Promise<RailResult<Chances>> {
  const items = p.items.filter((i) => i.classes.length).slice(0, 40);
  if (!items.length) throw new Error("no classes"); // the route always sends at least one
  const chunks: ChanceItem[][] = [];
  for (let i = 0; i < items.length; i += CHUNK) chunks.push(items.slice(i, i + CHUNK));
  const out: Chances = {};
  let cost = 0;
  let remaining: number | null = null;
  let meta: RailResult<Chances>["meta"] | null = null;
  for (const chunk of chunks) {
    const classRequests = chunk.reduce((t, i) => t + i.classes.length, 0);
    await assertDailyBudget(Math.max(1, classRequests));
    const r = await seatAvailabilityBatch(
      chunk.map((i) => ({ train_number: i.train, from: i.from, to: i.to, date: p.date, classes: i.classes, quota: p.quota })),
      { userId: p.userId },
    );
    cost += r.credits.cost;
    remaining = r.credits.remaining;
    meta = r.meta;
    for (const res of r.data.results || []) {
      const row = (out[res.train_number] ||= {});
      for (const c of res.classes || []) {
        row[c.class_code] = { pct: c.status === "AVAILABLE" ? 100 : c.confirmation_probability?.percentage ?? null, text: c.availability_text };
      }
    }
  }
  return { data: out, meta: meta!, credits: { cost, remaining } };
}
