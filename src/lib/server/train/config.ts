import "server-only";

/**
 * RailCore (https://railcore.tech/docs) configuration + the official credit price list.
 * Free plan: 2,500 credits/month, 20 req/min, 300 req/IST-day. Starter (current): 40,000 credits/month, 60 req/min. Chart family = Scale/Enterprise only.
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

/** Operation catalog: request cost and plan entitlement — from railcore.tech/docs/credits (10 Nov 2026). Charts need Scale/Enterprise. */
export const OPS = {
  "stations.search": { cost: 1, premium: false },
  "stations.get": { cost: 1, premium: false },
  "stations.live": { cost: 1, premium: false },
  "trains.search": { cost: 1, premium: false },
  "trains.get": { cost: 1, premium: false },
  "trains.schedule": { cost: 1, premium: false },
  "trains.stops": { cost: 1, premium: false },
  "trains.route": { cost: 1, premium: false },
  "trains.coach": { cost: 1, premium: false },
  "trains.live": { cost: 1, premium: false },
  "routes.trains": { cost: 1, premium: false },
  "journeys.search": { cost: 1, premium: false },
  "journeys.compare": { cost: 1, premium: false },
  "availability.seats": { cost: 1, premium: false },
  "availability.batch": { cost: 1, premium: false }, // real: 1 per distinct class per item — computed per call
  "availability.calendar": { cost: 1, premium: false },
  "availability.classes": { cost: 1, premium: false },
  "fares.estimate": { cost: 1, premium: false },
  "fares.search": { cost: 1, premium: false },
  "fares.unreserved": { cost: 1, premium: false },
  "charts.status": { cost: 1, premium: true },
  "charts.vacant": { cost: 3, premium: true },
  "charts.hopping": { cost: 4, premium: true },
  "charts.routeScan": { cost: 8, premium: true },
} as const;

export type Op = keyof typeof OPS;
