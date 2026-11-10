/** Service catalog shared by client + server. Each can be switched off in Admin → Settings. */
export const SERVICE_KEYS = ["train", "flight", "bus", "hotel", "package"] as const;
export type ServiceKey = (typeof SERVICE_KEYS)[number];
export const serviceSetting = (k: ServiceKey) => `service_${k}` as const;

type SiteLike = Partial<Record<string, string>>;
export const isServiceOn = (site: SiteLike, k: ServiceKey) => (site[serviceSetting(k)] ?? "on") === "on";
export const isTrainLiveOn = (site: SiteLike) => isServiceOn(site, "train") && (site.train_live ?? "on") === "on";
export const isPnrOn = (site: SiteLike) => isServiceOn(site, "train") && (site.pnr_status ?? "on") === "on";
