import "server-only";
import crypto from "node:crypto";
import { logProvider } from "../payments/log";

/**
 * Tripgic — ticket issuance after a confirmed payment.
 * TRIPGIC_MODE=mock (default) returns a realistic SAMPLE ticket so the whole flow can be built and tested.
 * When Tripgic's API docs/keys are available, implement `live()` below — callers don't change.
 */
export type IssueRequest = {
  bookingRef: string;
  train: { number: string; name: string };
  from: string; to: string; date: string; cls: string; quota: string;
  passengers: { name: string; age: number; gender: "M" | "F" | "T"; berth?: string | null; nationality: string }[];
  availability: { status: string; text: string };
  paymentId: string; amountPaise: number;
};
export type IssueResult = {
  pnr: string; ticketNo: string; chartStatus: string;
  allocations: { name: string; age: number; gender: string; status: string; coach?: string; berth?: number; berthType?: string }[];
};

const BERTHS = ["LB", "MB", "UB", "LB", "MB", "UB", "SL", "SU"];
const COACH: Record<string, string> = { "1A": "H1", "2A": "A1", "3A": "B2", "3E": "M1", SL: "S4", CC: "C1", EC: "E1", "2S": "D3" };

function mock(r: IssueRequest): IssueResult {
  const pnr = String(crypto.randomInt(1_000_000_000, 10_000_000_000)).slice(0, 10);
  const confirmed = r.availability.status === "AVAILABLE";
  const wl = Number((r.availability.text.match(/WL\s*(\d+)/i) || [])[1] || 0);
  const rac = r.availability.status === "RAC";
  return {
    pnr,
    ticketNo: "TG" + crypto.randomInt(10_000_000, 99_999_999),
    chartStatus: "Chart not prepared",
    allocations: r.passengers.map((p, i) => {
      if (confirmed) {
        const berthType = p.berth || BERTHS[i % BERTHS.length];
        return { name: p.name, age: p.age, gender: p.gender, status: "CNF", coach: COACH[r.cls] || "B1", berth: 10 + i * 3, berthType };
      }
      if (rac) return { name: p.name, age: p.age, gender: p.gender, status: `RAC ${i + 1}` };
      return { name: p.name, age: p.age, gender: p.gender, status: `WL ${wl + i + 1}` };
    }),
  };
}

export async function issueTicket(r: IssueRequest): Promise<IssueResult> {
  const mode = (process.env.TRIPGIC_MODE || "mock").toLowerCase();
  const started = Date.now();
  // What will be sent to Tripgic (no secrets).
  const request = { endpoint: mode === "mock" ? "mock://tripgic/tickets" : `${process.env.TRIPGIC_BASE_URL}/tickets`, body: r };
  try {
    if (mode !== "mock") throw new Error("Tripgic live mode is not implemented yet — set TRIPGIC_MODE=mock or add the API integration");
    const result = mock(r);
    await logProvider({ bookingRef: r.bookingRef, provider: "tripgic", direction: "outbound", action: "ticket.issue", httpStatus: 200, outcome: "ok", externalId: result.pnr, amountPaise: r.amountPaise, latencyMs: Date.now() - started, request, response: { mode: "mock", ...result } });
    return result;
  } catch (e) {
    await logProvider({ bookingRef: r.bookingRef, provider: "tripgic", direction: "outbound", action: "ticket.issue", outcome: "error", latencyMs: Date.now() - started, request, response: { error: (e as Error).message } });
    throw e;
  }
}
