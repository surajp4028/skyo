import "server-only";
import { railRequest } from "./client";
import type {
  AvailabilityCalendar, AvailabilityResponse, ClassCode, CoachPosition, FareEstimate, LiveTrainStatus, Quota, RouteTrains,
  Station, StationBoard, Train, TrainSchedule, UnreservedFare,
} from "./types";

/*
 * One function per RailCore v1 operation. Callers pass already-validated input
 * (see ./validators). `u` = SKYO user id for the usage ledger.
 */
type U = { userId?: number | null };
const enc = encodeURIComponent;

/* ----------------------------- Stations ----------------------------- */
export const searchStations = (q: string, limit = 8, o: U = {}) =>
  railRequest<{ results: Station[] }>("stations.search", "/stations/search", { query: { q, limit }, ...o });
export const getStation = (code: string, o: U = {}) => railRequest<Station>("stations.get", `/stations/${enc(code)}`, o);
export const stationLiveBoard = (code: string, windowHours: 4 | 8 = 8, o: U = {}) =>
  railRequest<StationBoard>("stations.live", `/stations/${enc(code)}/live`, { query: { window_hours: windowHours }, ...o });

/* ------------------------------ Trains ------------------------------ */
export const searchTrains = (q: string, limit = 8, o: U = {}) =>
  railRequest<{ results: Train[] }>("trains.search", "/trains/search", { query: { q, limit }, ...o });
export const getTrain = (n: string, o: U = {}) => railRequest<Train>("trains.get", `/trains/${enc(n)}`, o);
export const trainSchedule = (n: string, includeIntermediate = false, o: U = {}) =>
  railRequest<TrainSchedule>("trains.schedule", `/trains/${enc(n)}/schedule`, { query: { include_intermediate: includeIntermediate || undefined }, ...o });
export const trainStops = (n: string, o: U = {}) => railRequest<TrainSchedule>("trains.stops", `/trains/${enc(n)}/stops`, o);
export const trainRoute = (n: string, o: U = {}) => railRequest<TrainSchedule>("trains.route", `/trains/${enc(n)}/route`, o);
export const coachPosition = (n: string, o: U = {}) => railRequest<CoachPosition>("trains.coach", `/trains/${enc(n)}/coach-position`, o);
export const liveTrainStatus = (n: string, date: string, extra: { from?: string; to?: string } = {}, o: U = {}) =>
  railRequest<LiveTrainStatus>("trains.live", `/trains/${enc(n)}/live`, { query: { date, from: extra.from, to: extra.to }, ...o });

/* ----------------------------- Journeys ----------------------------- */
export const trainsBetween = (from: string, to: string, date: string, quota: Quota = "GN", o: U = {}) =>
  railRequest<RouteTrains>("routes.trains", "/routes/trains", { query: { from, to, date, quota }, ...o });
export const journeySearch = (from: string, to: string, date: string, o: U = {}) =>
  railRequest<RouteTrains>("journeys.search", "/journeys/search", { query: { from, to, date }, ...o });
export const compareJourneys = (journeys: { from: string; to: string; date: string; quota?: Quota }[], o: U = {}) =>
  railRequest<{ results: RouteTrains[] }>("journeys.compare", "/journeys/compare", { method: "POST", body: { journeys }, ...o });

/* --------------------------- Availability --------------------------- */
export const seatAvailability = (p: { train: string; from: string; to: string; date: string; cls: ClassCode; quota?: Quota }, o: U = {}) =>
  railRequest<AvailabilityResponse>("availability.seats", "/availability/seats", {
    query: { train_number: p.train, from: p.from, to: p.to, date: p.date, class: p.cls, quota: p.quota },
    ...o,
  });
export const seatAvailabilityBatch = (items: { train_number: string; from: string; to: string; date: string; classes?: ClassCode[]; quota?: Quota }[], o: U = {}) => {
  const classRequests = items.reduce((t, i) => t + (i.classes?.length || 4), 0);
  return railRequest<{ results: AvailabilityResponse[] }>("availability.batch", "/availability/seats/batch", {
    method: "POST",
    body: { items },
    cost: Math.max(5, 2 * classRequests), // documented batch formula
    ...o,
  });
};
export const availabilityCalendar = (p: { train: string; from: string; to: string; cls: ClassCode; quota?: Quota; date?: string; days?: number }, o: U = {}) =>
  railRequest<AvailabilityCalendar>("availability.calendar", "/availability/calendar", {
    query: { train_number: p.train, from: p.from, to: p.to, class: p.cls, quota: p.quota, date: p.date, days: p.days },
    ...o,
  });
export const availableClasses = (p: { train: string; from: string; to: string; date: string }, o: U = {}) =>
  railRequest<{ train_number: string; classes: ClassCode[] }>("availability.classes", "/availability/classes", {
    query: { train_number: p.train, from: p.from, to: p.to, date: p.date },
    ...o,
  });

/* ------------------------------- Fares ------------------------------ */
export const fareEstimate = (p: { train: string; from: string; to: string; cls?: ClassCode; quota?: Quota }, o: U = {}) =>
  railRequest<FareEstimate>("fares.estimate", "/fares/estimate", { query: { train_number: p.train, from: p.from, to: p.to, class: p.cls, quota: p.quota }, ...o });
export const faresOnRoute = (p: { from: string; to: string; date: string; quota?: Quota }, o: U = {}) =>
  railRequest<{ trains: { train_number: string; fares: { class_code: ClassCode; fare: number }[] }[] }>("fares.search", "/fares/search", { query: p, ...o });
export const unreservedFare = (p: { from: string; to: string; date?: string; class?: "II" | "FC"; train_type?: "O" | "E" | "S" | "T"; ticket_type?: "J" | "M" | "Q" | "H" | "Y"; adult?: number; child?: number }, o: U = {}) =>
  railRequest<UnreservedFare>("fares.unreserved", "/fares/unreserved", { query: p, ...o });

/* ------------------------- Charts (Scale+ only) ------------------------- */
export const chartStatus = (p: { train: string; date: string; station: string }, o: U = {}) =>
  railRequest<unknown>("charts.status", "/charts/status", { query: { train_number: p.train, date: p.date, station: p.station }, ...o });
export const vacantBerths = (p: { train: string; from: string; to: string; date: string }, o: U = {}) =>
  railRequest<unknown>("charts.vacant", "/charts/vacant-berths", { query: { train_number: p.train, from: p.from, to: p.to, date: p.date }, ...o });
export const vacantBerthsHopping = (p: { train: string; from: string; to: string; date: string; via?: string; prefer_berth?: string }, o: U = {}) =>
  railRequest<unknown>("charts.hopping", "/charts/vacant-berths/hopping", { query: { train_number: p.train, from: p.from, to: p.to, date: p.date, via: p.via, prefer_berth: p.prefer_berth }, ...o });
