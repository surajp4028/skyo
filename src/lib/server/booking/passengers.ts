import "server-only";
import { z } from "zod";
import { exec, query, queryOne } from "../db";
import { decrypt, encrypt } from "../crypto";
import { ApiError } from "../http";
import { getSetting } from "../settings";

/** IRCTC-style traveller profile. Stored as one KMS-encrypted JSON blob per row. */
export const passengerSchema = z.object({
  name: z.string().trim().min(1, "Enter the name").max(16, "Max 16 characters (as IRCTC allows)").regex(/^[A-Za-z][A-Za-z .]*$/, "Use letters, spaces and dots only"),
  age: z.coerce.number().int("Age must be a whole number").min(0, "Enter a valid age (0 for babies under 1)").max(125, "Enter a valid age"),
  gender: z.enum(["M", "F", "T"], { message: "Choose Male, Female or Transgender" }),
  berth: z.enum(["LB", "MB", "UB", "SL", "SU"]).nullable().optional(),
  nationality: z.string().trim().toUpperCase().regex(/^[A-Z]{2}$/, "Use a 2-letter country code").default("IN"),
  /** Optional — needed only for international flights. Stored inside the encrypted traveller blob. */
  passport: z
    .object({
      number: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{6,9}$/, "Passport number: 6–9 letters / digits"),
      expiry: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Passport expiry: pick a date"),
    })
    .nullable()
    .optional(),
});
export type PassengerInput = z.infer<typeof passengerSchema>;
export type Passenger = PassengerInput & { id: number };

export async function listPassengers(userId: number): Promise<Passenger[]> {
  const rows = await query<{ id: number; data_enc: string }>("SELECT id, data_enc FROM saved_passengers WHERE user_id = ? ORDER BY id", [userId]);
  const out: Passenger[] = [];
  for (const r of rows) {
    try {
      out.push({ id: r.id, ...(JSON.parse(await decrypt(r.data_enc)) as PassengerInput) });
    } catch {
      /* skip unreadable */
    }
  }
  return out;
}

export async function getPassengersByIds(userId: number, ids: number[]): Promise<Passenger[]> {
  const all = await listPassengers(userId);
  const map = new Map(all.map((p) => [p.id, p]));
  return ids.map((id) => {
    const p = map.get(id);
    if (!p) throw new ApiError(400, "PASSENGER_NOT_FOUND", "One of the selected travellers no longer exists.");
    return p;
  });
}

export async function addPassenger(userId: number, p: PassengerInput) {
  const max = Math.max(1, parseInt(await getSetting("max_saved_passengers"), 10) || 20);
  const n = (await queryOne<{ n: number }>("SELECT COUNT(*) n FROM saved_passengers WHERE user_id = ?", [userId]))?.n ?? 0;
  if (Number(n) >= max) throw new ApiError(409, "PASSENGER_LIMIT", `You can save up to ${max} travellers. Remove one to add another.`);
  const r = await exec("INSERT INTO saved_passengers (user_id, data_enc) VALUES (?, ?)", [userId, await encrypt(JSON.stringify(p))]);
  return { id: r.insertId, ...p };
}

export async function updatePassenger(userId: number, id: number, p: PassengerInput) {
  const r = await exec("UPDATE saved_passengers SET data_enc = ? WHERE id = ? AND user_id = ?", [await encrypt(JSON.stringify(p)), id, userId]);
  if (!r.affectedRows) throw new ApiError(404, "NOT_FOUND", "Traveller not found");
  return { id, ...p };
}

export async function deletePassenger(userId: number, id: number) {
  const r = await exec("DELETE FROM saved_passengers WHERE id = ? AND user_id = ?", [id, userId]);
  if (!r.affectedRows) throw new ApiError(404, "NOT_FOUND", "Traveller not found");
}
