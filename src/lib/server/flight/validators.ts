import "server-only";
import { z } from "zod";
import { isWorldAirport } from "./world-airports";
import { todayIST, addDays } from "@/lib/flight/model";

/** Input contracts — invalid input never reaches (or bills) aviationstack. */
export const airportCode = z.string().trim().toUpperCase().regex(/^[A-Z]{3}$/, "Use a 3-letter airport code").refine(isWorldAirport, "We couldn't find that airport");
export const flightDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Use YYYY-MM-DD").refine((d) => d >= todayIST() && d <= addDays(todayIST(), 330), "Pick a date within the next 11 months");
export const cabin = z.enum(["economy", "business"]).default("economy");
export const flightCode = z.string().trim().toUpperCase().transform((v) => v.replace(/\s+/g, "")).pipe(z.string().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?$/, "Flight number like 6E622"));
export const optionId = z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2}\d{1,4}[A-Z]?(\.[A-Z0-9]{2}\d{1,4}[A-Z]?)?$/, "Invalid flight");
