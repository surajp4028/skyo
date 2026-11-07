import "server-only";

/**
 * RailCore (https://railcore.tech/docs) configuration + the official credit price list.
 * Free plan: 2,500 credits/month, 20 req/min, 300 req/IST-day. Chart family = Scale/Enterprise only.
 */
const str = (k: string, d = "") => (process.env[k] ?? d).toString().trim();

export const railConfig = {
  key: str("RK_LIVE"),
  baseUrl: str("RK_BASE_URL", "https://ir.railcore.tech/v1").replace(/\/+$/, ""),
  plan: (str("RK_PLAN", "free").toLowerCase() as "free" | "starter" | "growth" | "scale" | "enterprise"),
  dailyCreditCap: Math.max(0, parseInt(str("RK_DAILY_CREDIT_CAP", "80"), 10) || 80),
  timeoutMs: 20_000,
};

export type Plan = typeof railConfig.plan;
export const PREMIUM_PLANS: Plan[] = ["scale", "enterprise"];

/** Operation catalog: path template, credit cost (from docs/credits) and plan entitlement. */
export const OPS = {
  "stations.search": { cost: 1, premium: false },
  "stations.get": { cost: 1, premium: false },
  "stations.live": { cost: 4, premium: false },
  "trains.search": { cost: 1, premium: false },
  "trains.get": { cost: 1, premium: false },
  "trains.schedule": { cost: 2, premium: false },
  "trains.stops": { cost: 2, premium: false },
  "trains.route": { cost: 2, premium: false },
  "trains.coach": { cost: 2, premium: false },
  "trains.live": { cost: 5, premium: false },
  "routes.trains": { cost: 5, premium: false },
  "journeys.search": { cost: 5, premium: false },
  "journeys.compare": { cost: 5, premium: false },
  "availability.seats": { cost: 5, premium: false },
  "availability.batch": { cost: 5, premium: false }, // real: max(5, 2 × item/class combos) — computed per call
  "availability.calendar": { cost: 4, premium: false },
  "availability.classes": { cost: 3, premium: false },
  "fares.estimate": { cost: 3, premium: false },
  "fares.search": { cost: 3, premium: false },
  "fares.unreserved": { cost: 3, premium: false },
  "charts.status": { cost: 4, premium: true },
  "charts.vacant": { cost: 8, premium: true },
  "charts.hopping": { cost: 10, premium: true },
  "charts.routeScan": { cost: 25, premium: true },
} as const;

export type Op = keyof typeof OPS;
