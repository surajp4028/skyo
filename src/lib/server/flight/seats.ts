import "server-only";
import type { PoolConnection, RowDataPacket } from "mysql2/promise";
import { query } from "../db";
import { ApiError } from "../http";
import { getAllSettings } from "../settings";
import { seatMap, todayIST, type FlightSeatSettings } from "@/lib/flight/model";
import type { AircraftCode, CabinKey } from "@/lib/flight/airlines";

/**
 * A SKYO seat hold counts while its booking is alive: paid, confirmed, or still inside the payment hold.
 * Rows of cancelled / failed / refunded / expired bookings are ignored and cleared lazily.
 */
const ALIVE = `(b.status = 'confirmed' OR b.payment_status = 'paid' OR (b.status = 'pending' AND b.hold_expires_at > UTC_TIMESTAMP()))`;

export async function heldSeats(key: string, date: string): Promise<Set<string>> {
  const rows = await query<{ seat: string }>(
    `SELECT h.seat FROM flight_seat_holds h JOIN bookings b ON b.booking_ref = h.booking_ref WHERE h.flight_key = ? AND h.flight_date = ? AND ${ALIVE}`,
    [key, date],
  );
  return new Set(rows.map((r) => r.seat));
}

/** Seat map for the browser: layout + which seats are free + each seat's fee. */
export async function seatMapFor(key: string, date: string, aircraft: AircraftCode, cabin: CabinKey) {
  const s = (await getAllSettings()) as unknown as FlightSeatSettings;
  return seatMap(s, aircraft, cabin, key, date, await heldSeats(key, date), todayIST());
}

/**
 * Inside the booking transaction: clear dead holds on these seats, then insert ours.
 * The UNIQUE (flight_key, flight_date, seat) key makes two customers racing for one seat impossible.
 */
export async function holdSeats(conn: PoolConnection, ref: string, date: string, cabin: CabinKey, picks: { key: string; seat: string }[]) {
  for (const p of picks) {
    await conn.query(
      `DELETE h FROM flight_seat_holds h JOIN bookings b ON b.booking_ref = h.booking_ref
        WHERE h.flight_key = ? AND h.flight_date = ? AND h.seat = ? AND NOT ${ALIVE}`,
      [p.key, date, p.seat],
    );
    const [rows] = await conn.query<RowDataPacket[]>("SELECT booking_ref FROM flight_seat_holds WHERE flight_key = ? AND flight_date = ? AND seat = ?", [p.key, date, p.seat]);
    if (rows.length) throw new ApiError(409, "SEAT_TAKEN", `Seat ${p.seat} on ${p.key} was just taken. Please pick another seat.`);
    try {
      await conn.query("INSERT INTO flight_seat_holds (flight_key, flight_date, cabin, seat, booking_ref) VALUES (?,?,?,?,?)", [p.key, date, cabin, p.seat, ref]);
    } catch (e) {
      if ((e as { code?: string }).code === "ER_DUP_ENTRY") throw new ApiError(409, "SEAT_TAKEN", `Seat ${p.seat} on ${p.key} was just taken. Please pick another seat.`);
      throw e;
    }
  }
}
