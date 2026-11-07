"use client";
import { useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BadgePercent, BusFront, Building2, Database, Globe2, KeyRound, LayoutGrid, Mail, MessageSquare, Palmtree, Plane, Settings2, ShieldCheck, Timer, TrainFront, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Btn, Card, PageHeader } from "./ui";
import { CouponsManager } from "./coupons";
import { api, errMsg } from "@/lib/client/api";
import { Field } from "@/components/ui/field";
import { trainCharges, type ChargeSettings, type PayMode } from "@/lib/train/charges";
import { flightCharges, legFare, type FlightChargeSettings } from "@/lib/flight/model";
import { FlightUsage } from "./flight-usage";
import { cn } from "@/lib/utils";

type Resp = { settings: Record<string, string>; system: { encryption: string; email: string; sms: string; otpTtl: number; userSessionDays: number; adminIdleMinutes: number } };

const TABS = [
  { key: "general", label: "General", icon: Globe2, group: "Platform" },
  { key: "services", label: "Services", icon: LayoutGrid, group: "Platform" },
  { key: "travellers", label: "Travellers", icon: Users, group: "Platform" },
  { key: "coupons", label: "Coupons", icon: BadgePercent, group: "Platform" },
  { key: "train", label: "Trains", icon: TrainFront, group: "Services" },
  { key: "flight", label: "Flights", icon: Plane, group: "Services" },
  { key: "bus", label: "Buses", icon: BusFront, group: "Services" },
  { key: "hotel", label: "Hotels", icon: Building2, group: "Services" },
  { key: "package", label: "Packages", icon: Palmtree, group: "Services" },
  { key: "security", label: "Security", icon: ShieldCheck, group: "System" },
] as const;
type Tab = (typeof TABS)[number]["key"];

export function SettingsView({ initialTab }: { initialTab?: string }) {
  const { data } = useFetch<Resp>("/api/admin/settings");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [tab, setTab] = useState<Tab>(TABS.some((t) => t.key === initialTab) ? (initialTab as Tab) : "general");
  const v: Record<string, string> = { ...(data?.settings || {}), ...edits };
  const set = (k: string) => (e: { target: { value: string } }) => setEdits((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k: string) => setEdits((p) => ({ ...p, [k]: (v[k] ?? "on") === "on" ? "off" : "on" }));
  const dirty = Object.keys(edits).length;

  const save = async () => {
    setBusy(true);
    try {
      await api("/api/admin/settings", { method: "PUT", body: edits });
      setEdits({});
      toast.success("Settings saved — live across the site within seconds");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader
        icon={<Settings2 />}
        title="Settings"
        sub="Branding, services and per-service charges. Secrets stay in .env, never here."
        actions={
          <div className="flex items-center gap-3">
            {dirty > 0 && <span className="text-xs font-semibold text-amber-600">{dirty} unsaved change{dirty > 1 ? "s" : ""}</span>}
            {dirty > 0 && <Btn onClick={() => setEdits({})}>Discard</Btn>}
            <Btn variant="dark" disabled={busy || !dirty} onClick={save}>Save settings</Btn>
          </div>
        }
      />
      <div className="grid gap-6 lg:grid-cols-[220px_1fr]">
        <nav className="h-fit rounded-2xl border border-line bg-white p-2 lg:sticky lg:top-20">
          {(["Platform", "Services", "System"] as const).map((g) => (
            <div key={g} className="mb-1">
              <div className="px-3 pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted">{g}</div>
              {TABS.filter((t) => t.group === g).map((t) => (
                <button
                  key={t.key}
                  onClick={() => setTab(t.key)}
                  className={cn("flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm font-semibold transition", tab === t.key ? "bg-ink text-white" : "text-ink/70 hover:bg-surface")}
                >
                  <t.icon className="h-4 w-4" /> {t.label}
                  {g === "Services" && t.key !== "train" && t.key !== "flight" && <span className={cn("ml-auto rounded px-1.5 text-[10px]", tab === t.key ? "bg-white/15" : "bg-surface text-muted")}>soon</span>}
                </button>
              ))}
            </div>
          ))}
        </nav>

        <div className="min-w-0 space-y-6">
          {tab === "general" && (
            <>
              <Section title="Brand" desc="Shown in the header, footer, page titles, login and admin.">
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Website name" name="site_name" value={v.site_name || ""} onChange={set("site_name")} maxLength={40} />
                  <Field label="Tagline" name="site_tagline" value={v.site_tagline || ""} onChange={set("site_tagline")} maxLength={120} />
                  <Field label="Support email" name="support_email" value={v.support_email || ""} onChange={set("support_email")} />
                  <Field label="Support phone" name="support_phone" value={v.support_phone || ""} onChange={set("support_phone")} />
                </div>
                <div className="mt-5 rounded-2xl bg-ink p-5 text-white">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Live preview</div>
                  <div className="mt-2 text-2xl font-extrabold">{v.site_name || "—"}</div>
                  <div className="text-sm text-white/60">{v.site_tagline}</div>
                </div>
              </Section>
              <Section title="Platform behaviour">
                <div className="divide-y divide-line">
                  <Toggle label="Allow new user sign-ups" desc="When off, unknown numbers/emails can't create accounts." on={v.user_signup === "on"} onClick={() => toggle("user_signup")} />
                  <Toggle label="IP geolocation for sessions" desc="Look up approximate city for each login (ipwho.is). Private IPs are never sent." on={v.ip_geolocation === "on"} onClick={() => toggle("ip_geolocation")} />
                  <Toggle label="Maintenance banner" desc="Show a banner on top of the public site." on={v.maintenance_mode === "on"} onClick={() => toggle("maintenance_mode")} />
                </div>
                {v.maintenance_mode === "on" && <div className="mt-4"><Field label="Banner message" name="maintenance_message" value={v.maintenance_message || ""} onChange={set("maintenance_message")} maxLength={200} /></div>}
                <div className="mt-4 max-w-xs"><Field label="OTP resend cooldown (seconds)" name="otp_resend_seconds" inputMode="numeric" value={v.otp_resend_seconds || ""} onChange={set("otp_resend_seconds")} hint="20 – 300" /></div>
              </Section>
            </>
          )}

          {tab === "services" && (
            <Section title="Services on the website" desc="Switching a service off removes it from the home page, navbar, dock and footer, and blocks its pages and APIs.">
              <div className="grid gap-x-8 divide-y divide-line md:grid-cols-2 md:divide-y-0">
                {([["service_train", "Trains", "Search, availability, booking"], ["service_flight", "Flights", "Flight search"], ["service_bus", "Buses", "Bus search"], ["service_hotel", "Hotels", "Hotel search"], ["service_package", "Packages", "Holiday packages"], ["train_live", "Train live running status", "Live status page, tab and API"]] as const).map(([k, l, d]) => (
                  <Toggle key={k} label={l} desc={d} on={(v[k] ?? "on") === "on"} onClick={() => toggle(k)} />
                ))}
              </div>
            </Section>
          )}

          {tab === "travellers" && (
            <Section title="GST details input" desc="How customers add GST details (profile and booking page). Fetch uses the Digio GST lookup (paid per call).">
              <div className="flex flex-wrap gap-2">
                {([["fetch", "Fetch only", "GSTIN → details from GST records"], ["manual", "Manual only", "Customer types company, address, pincode"], ["both", "Both", "Fetch first, manual if the lookup fails"]] as const).map(([k, l, d]) => (
                  <button key={k} type="button" onClick={() => setEdits((p) => ({ ...p, gst_input_mode: k }))} className={cn("rounded-xl border px-4 py-3 text-left transition", (v.gst_input_mode || "both") === k ? "border-ink bg-ink text-white" : "border-line hover:bg-surface")}>
                    <div className="text-sm font-bold">{l}</div>
                    <div className={cn("text-[11px]", (v.gst_input_mode || "both") === k ? "text-white/70" : "text-muted")}>{d}</div>
                  </button>
                ))}
              </div>
            </Section>
          )}
          {tab === "travellers" && (
            <Section title="Travellers & bookings" desc="Limits applied on the account page and in the booking flow.">
              <div className="grid max-w-lg gap-4 sm:grid-cols-2">
                <Field label="Max saved travellers" name="max_saved_passengers" inputMode="numeric" value={v.max_saved_passengers || ""} onChange={set("max_saved_passengers")} hint="1 – 50 per account" />
                <Field label="Max per train booking" name="max_passengers_per_booking" inputMode="numeric" value={v.max_passengers_per_booking || ""} onChange={set("max_passengers_per_booking")} hint="1 – 6 (Tatkal is capped at 4)" />
              </div>
            </Section>
          )}

          {tab === "coupons" && (
            <>
              <CouponsManager />
              <Section title="Coupon limit" desc="How many coupons can exist at once (general + personal). Save settings after changing.">
                <div className="max-w-xs"><Field label="Max coupons" name="max_coupons" inputMode="numeric" value={v.max_coupons ?? ""} onChange={set("max_coupons")} hint="Default 20" /></div>
              </Section>
            </>
          )}

          {tab === "train" && <TrainTab v={v} set={set} toggle={toggle} />}
          {tab === "flight" && <FlightTab v={v} set={set} toggle={toggle} />}

          {(tab === "bus" || tab === "hotel" || tab === "package") && (
            <Section title={`${TABS.find((t) => t.key === tab)!.label} charges`} desc="Booking for this service isn't live yet. Its fees, insurance and provider settings will appear here once the supplier API is connected.">
              <div className="rounded-2xl border-2 border-dashed border-line p-8 text-center text-sm text-muted">Nothing to configure yet.</div>
            </Section>
          )}

          {tab === "security" && (
            <Section title="Security posture" desc="Secrets live in .env / AWS — never in the database.">
              <ul className="grid gap-3 text-sm md:grid-cols-2">
                <Item icon={KeyRound} label="PII encryption" value={data?.system.encryption === "aws-kms" ? "AWS KMS envelope (AES-256-GCM)" : "Local AES-256-GCM — set AWS_KMS_KEY_ID"} ok={data?.system.encryption === "aws-kms"} />
                <Item icon={Mail} label="Email OTP" value={data?.system.email || "…"} ok={data?.system.email?.includes("configured") && !data?.system.email.startsWith("Not")} />
                <Item icon={MessageSquare} label="SMS OTP" value={data?.system.sms || "…"} ok={data?.system.sms?.includes("configured") && !data?.system.sms.startsWith("Not")} />
                <Item icon={Timer} label="OTP validity" value={`${data?.system.otpTtl ?? "…"}s · 5 attempts`} ok />
                <Item icon={Database} label="Sessions" value={`Traveller ${data?.system.userSessionDays ?? "…"}d rolling · Agent idle ${data?.system.adminIdleMinutes ?? "…"}m`} ok />
              </ul>
            </Section>
          )}
        </div>
      </div>
    </>
  );
}

function TrainTab({ v, set, toggle }: { v: Record<string, string>; set: (k: string) => (e: { target: { value: string } }) => void; toggle: (k: string) => void }) {
  const [mode, setMode] = useState<PayMode>("upi");
  const [cls, setCls] = useState("SL");
  const f = (k: string, label: string, hint?: string) => <Field label={label} name={k} inputMode="decimal" value={v[k] ?? ""} onChange={set(k)} hint={hint} />;
  // Sample: ₹650 × 2 passengers = ₹1,300 ticket fare
  const preview = trainCharges(v as unknown as ChargeSettings, { perPassengerFare: 650, count: 2, cls, payMode: mode, insurance: true });
  return (
    <>
      <Section title="Live train data · RailCore" desc="Free plan = 2,500 credits / month. Search 5 · availability 5 · live status 5 · schedule 2 credits. Data is never cached (their terms).">
        <div className="divide-y divide-line">
          <Toggle label="Enable live train data" desc="Kill switch — when off, SKYO makes no RailCore calls at all." on={v.train_api === "on"} onClick={() => toggle("train_api")} />
          <Toggle label="Dev: show only 1 train in search results" desc="Saves credits while building — every result can trigger availability / schedule look-ups. Turn off to show all trains." on={v.train_dev_single_result === "on"} onClick={() => toggle("train_dev_single_result")} />
        </div>
        <div className="mt-4 max-w-xs"><Field label="Daily credit cap" name="train_daily_credit_cap" inputMode="numeric" value={v.train_daily_credit_cap || ""} onChange={set("train_daily_credit_cap")} hint="≈ 80/day keeps you inside 2,500/month" /></div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="IRCTC convenience fee" desc="Charged once per ticket (not per passenger). Depends on AC / non-AC class and how the customer pays.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("train_irctc_fee_nonac_upi", "Non-AC · UPI (₹)")}
              {f("train_irctc_fee_nonac_card", "Non-AC · Card / NetBanking (₹)")}
              {f("train_irctc_fee_ac_upi", "AC (1A/2A/3A/CC…) · UPI (₹)")}
              {f("train_irctc_fee_ac_card", "AC · Card / NetBanking (₹)")}
              {f("train_irctc_gst_pct", "GST on IRCTC fee (%)", "Usually 18")}
            </div>
          </Section>
          <Section title="SKYO service fee" desc="Your agent fee, charged per passenger.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("train_agent_fee", "Service fee per passenger (₹)")}
              {f("train_agent_gst_pct", "GST on service fee (%)", "0 to keep it GST-free")}
            </div>
          </Section>
          <Section title="Payment gateway charges" desc="Percentage of everything above (fare + fees + insurance), plus GST on that charge.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("train_pg_fee_pct", "Gateway fee (%)", "e.g. 2")}
              {f("train_pg_gst_pct", "GST on gateway fee (%)", "Usually 18")}
            </div>
          </Section>
          <Section title="Travel insurance" desc="Optional for the customer and ticked by default. When switched off it is hidden from booking completely.">
            <Toggle label="Offer travel insurance" desc="Premium is charged per passenger. Policy details are sent to the insurer once that integration is added." on={v.train_insurance === "on"} onClick={() => toggle("train_insurance")} />
            {v.train_insurance === "on" && <div className="mt-2 max-w-xs">{f("train_insurance_fee", "Premium per passenger (₹)")}</div>}
          </Section>
        </div>

        <Card className="h-fit p-5 xl:sticky xl:top-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Live preview</div>
          <div className="mt-1 text-sm font-bold">₹650 × 2 passengers = ₹1,300 fare</div>
          <div className="mt-3 flex gap-1.5">
            {(["SL", "3A"] as const).map((c) => <Chip key={c} on={cls === c} onClick={() => setCls(c)}>{c === "SL" ? "Sleeper" : "3A (AC)"}</Chip>)}
            {(["upi", "card"] as const).map((m) => <Chip key={m} on={mode === m} onClick={() => setMode(m)}>{m === "upi" ? "UPI" : "Card/NB"}</Chip>)}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {preview.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3"><span className="text-muted">{l.label}</span><span className="font-semibold tabular-nums">₹{(l.paise / 100).toFixed(2)}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3"><span className="font-bold">Customer pays</span><span className="text-xl font-extrabold tabular-nums">₹{(preview.totalPaise / 100).toFixed(2)}</span></div>
          <p className="mt-2 text-[11px] text-muted">Preview uses the values on screen, including unsaved changes. The server uses the same formula when it creates the Razorpay order.</p>
        </Card>
      </div>
    </>
  );
}

function FlightTab({ v, set, toggle }: { v: Record<string, string>; set: (k: string) => (e: { target: { value: string } }) => void; toggle: (k: string) => void }) {
  const [cabin, setCabin] = useState<"economy" | "business">("economy");
  const [days, setDays] = useState(7);
  const f = (k: string, label: string, hint?: string) => <Field label={label} name={k} inputMode="decimal" value={v[k] ?? ""} onChange={set(k)} hint={hint} />;
  // Sample: DEL → BOM (1,137 km), IndiGo, 09:30, 2 adults, 1 window seat
  const s = v as unknown as FlightChargeSettings;
  const [today] = useState(() => new Date(Date.now() + 5.5 * 3600_000).toISOString().slice(0, 10));
  const date = new Date(Date.parse(`${today}T00:00:00Z`) + days * 86400_000).toISOString().slice(0, 10);
  const fare = legFare(s, { key: "6E6107", airline: { iata: "6E", name: "IndiGo", icao: "IGO" }, distanceKm: 1137, from: { iata: "DEL", airport: "", city: "", terminal: null, gate: null, time: "09:30", tz: "Asia/Kolkata" }, to: { iata: "BOM", airport: "", city: "", terminal: null, gate: null, time: "12:05", tz: "Asia/Kolkata" } }, date, cabin, today);
  const preview = flightCharges(s, { fare, pax: { adults: 2, children: 1, infants: 0 }, cabin, seatFeesPaise: cabin === "business" ? 0 : Math.round(Number(v.flight_seat_fee_window || 0) * 100), seatNote: "12A", payMode: "upi", insurance: true });
  return (
    <>
      <FlightUsage />
      <Section title="Live flight data · aviationstack" desc="Free plan = 100 requests / month, real-time flights only. One request fetches a whole route's daily schedule; SKYO caches it so every search on that route is free until it expires.">
        <div className="divide-y divide-line">
          <Toggle label="Enable live flight data" desc="Kill switch — when off, SKYO makes no aviationstack calls. Cached routes keep working." on={v.flight_api === "on"} onClick={() => toggle("flight_api")} />
          <Toggle label="Dev: show only 1 flight in search results" desc="Keeps result lists short while you build. Turn off to show every flight." on={v.flight_dev_single_result === "on"} onClick={() => toggle("flight_dev_single_result")} />
          <Toggle label="One-stop connections" desc="Builds connections through hubs (DEL, BOM, BLR…) from routes already in the cache — 0 extra requests." on={v.flight_connections === "on"} onClick={() => toggle("flight_connections")} />
          <Toggle label="Live flight tracking" desc="Logged-in travellers can track flights operating today. Each new flight costs 1 request, then it's cached." on={v.flight_live === "on"} onClick={() => toggle("flight_live")} />
        </div>
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <Field label="Requests per month (cap)" name="flight_monthly_cap" inputMode="numeric" value={v.flight_monthly_cap || ""} onChange={set("flight_monthly_cap")} hint="Free plan has 100 — keep a few spare" />
          <Field label="Route cache (hours)" name="flight_cache_hours" inputMode="numeric" value={v.flight_cache_hours || ""} onChange={set("flight_cache_hours")} hint="168 = 7 days" />
          <Field label="Pages per route" name="flight_pages_per_route" inputMode="numeric" value={v.flight_pages_per_route || ""} onChange={set("flight_pages_per_route")} hint="1 page = 100 rows ≈ 35 flights" />
          <Field label="Hubs fetched for connections" name="flight_connection_fetch" inputMode="numeric" value={v.flight_connection_fetch || ""} onChange={set("flight_connection_fetch")} hint="0 = cache only · each hub = 2 requests" />
          <Field label="Live status cache (minutes)" name="flight_live_cache_min" inputMode="numeric" value={v.flight_live_cache_min || ""} onChange={set("flight_live_cache_min")} hint="Default 15" />
          <Field label="Max travellers per booking" name="max_passengers_per_flight" inputMode="numeric" value={v.max_passengers_per_flight || ""} onChange={set("max_passengers_per_flight")} hint="1 – 9" />
          <Field label="Plan renews on day" name="flight_quota_reset_day" inputMode="numeric" value={v.flight_quota_reset_day || ""} onChange={set("flight_quota_reset_day")} hint="Day you subscribed (1 – 28) — the meter resets then" />
          <Field label="Keep API responses (days)" name="flight_log_retention_days" inputMode="numeric" value={v.flight_log_retention_days || ""} onChange={set("flight_log_retention_days")} hint="Older full responses are cleared; the request row stays" />
          <Field label="Keep request history (days)" name="flight_log_keep_days" inputMode="numeric" value={v.flight_log_keep_days || ""} onChange={set("flight_log_keep_days")} hint="35 – 3650" />
        </div>
      </Section>

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Section title="Fare model" desc="aviationstack has schedules, not prices. Until Tripgic returns live fares, SKYO prices each flight from distance, cabin, days to departure and time of day — same formula on the server and in this preview.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("flight_base_fare", "Base fare (₹)", "Fixed part of every fare")}
              {f("flight_per_km", "Per km (₹)", "DEL–BOM is 1,137 km")}
              {f("flight_fullservice_pct", "Full-service airline premium (%)", "Air India, Vistara…")}
              {f("flight_business_mult", "Business multiplier", "e.g. 3.2 × economy")}
              {f("flight_intl_mult", "International multiplier")}
              {f("flight_lastminute_pct", "Last-minute surge (%)", "Tapers off by 14 days out")}
              {f("flight_peak_pct", "Peak-hour premium (%)", "6–10 am and 5–9 pm")}
              {f("flight_connection_discount_pct", "Connection discount (%)", "Off the base fare for 1-stop trips")}
              {f("flight_child_discount_pct", "Child (2–11) discount on base fare (%)", "0 = same as adult")}
              {f("flight_infant_fee", "Infant fee · under 2, on lap (₹)", "Flat per infant, no seat, no airport fee")}
            </div>
          </Section>
          <Section title="Taxes & airport fees" desc="Collected on behalf of the airline / airport, per traveller.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("flight_airport_fee", "Airport fees · domestic (₹)", "UDF + ASF + PSF")}
              {f("flight_airport_fee_intl", "Airport fees · international (₹)")}
              {f("flight_gst_eco_pct", "GST on economy airfare (%)", "5 in India")}
              {f("flight_gst_biz_pct", "GST on business airfare (%)", "12 in India")}
            </div>
          </Section>
          <Section title="Seat prices" desc="Charged per seat picked on the seat map. Business seats are included in the fare. Skipped seats are auto-assigned free.">
            <div className="grid gap-4 sm:grid-cols-3">
              {f("flight_seat_fee_window", "Window (₹)")}
              {f("flight_seat_fee_aisle", "Aisle (₹)")}
              {f("flight_seat_fee_middle", "Middle (₹)", "0 = free")}
              {f("flight_seat_fee_front", "Front rows 1–5 (₹)")}
              {f("flight_seat_fee_xl", "Extra legroom / exit (₹)")}
            </div>
          </Section>
          <Section title="SKYO service fee & gateway" desc="Service fee per traveller; gateway % applies to the whole amount after coupons.">
            <div className="grid gap-4 sm:grid-cols-2">
              {f("flight_agent_fee", "Service fee per traveller (₹)")}
              {f("flight_agent_gst_pct", "GST on service fee (%)")}
              {f("flight_pg_fee_pct", "Gateway fee (%)")}
              {f("flight_pg_gst_pct", "GST on gateway fee (%)")}
            </div>
          </Section>
          <Section title="Travel insurance" desc="Optional for the customer, ticked by default.">
            <Toggle label="Offer travel insurance" desc="Premium per traveller." on={v.flight_insurance === "on"} onClick={() => toggle("flight_insurance")} />
            {v.flight_insurance === "on" && <div className="mt-2 max-w-xs">{f("flight_insurance_fee", "Premium per traveller (₹)")}</div>}
          </Section>
        </div>
        <Card className="h-fit p-5 xl:sticky xl:top-20">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Live preview</div>
          <div className="mt-1 text-sm font-bold">DEL → BOM · IndiGo 09:30 · 2 adults + 1 child{cabin === "economy" ? " · 1 window seat" : ""}</div>
          <div className="mt-3 flex flex-wrap gap-1.5">
            {(["economy", "business"] as const).map((c) => <Chip key={c} on={cabin === c} onClick={() => setCabin(c)}>{c === "economy" ? "Economy" : "Business"}</Chip>)}
            {[1, 7, 30].map((d) => <Chip key={d} on={days === d} onClick={() => setDays(d)}>{d === 1 ? "Tomorrow" : `${d} days out`}</Chip>)}
          </div>
          <ul className="mt-4 space-y-1.5 text-sm">
            {preview.lines.map((l) => (
              <li key={l.key} className="flex justify-between gap-3"><span className="text-muted">{l.label}</span><span className="font-semibold tabular-nums">₹{(l.paise / 100).toFixed(2)}</span></li>
            ))}
          </ul>
          <div className="mt-3 flex items-end justify-between border-t border-line pt-3"><span className="font-bold">Customer pays</span><span className="text-xl font-extrabold tabular-nums">₹{(preview.totalPaise / 100).toFixed(2)}</span></div>
          <p className="mt-2 text-[11px] text-muted">Fare per adult ₹{((fare.basePaise + fare.taxesPaise) / 100).toFixed(0)} (±7% varies by flight). Uses the values on screen, including unsaved changes.</p>
        </Card>
      </div>
    </>
  );
}

function Section({ title, desc, children }: { title: string; desc?: string; children: ReactNode }) {
  return (
    <Card className="p-6">
      <h3 className="font-bold">{title}</h3>
      {desc && <p className="mt-1 text-xs text-muted">{desc}</p>}
      <div className="mt-4">{children}</div>
    </Card>
  );
}
function Chip({ on, onClick, children }: { on: boolean; onClick: () => void; children: ReactNode }) {
  return <button type="button" onClick={onClick} className={cn("rounded-lg border px-2.5 py-1 text-xs font-bold transition", on ? "border-ink bg-ink text-white" : "border-line text-ink/70 hover:bg-surface")}>{children}</button>;
}
function Toggle({ label, desc, on, onClick }: { label: string; desc: string; on: boolean; onClick: () => void }) {
  return (
    <div className="flex items-center justify-between gap-6 py-4">
      <div><div className="font-semibold">{label}</div><div className="text-xs text-muted">{desc}</div></div>
      <button type="button" role="switch" aria-checked={on} onClick={onClick} className={cn("relative h-7 w-12 shrink-0 rounded-full transition", on ? "bg-mint" : "bg-line")}>
        <span className={cn("absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all", on ? "left-6" : "left-1")} />
      </button>
    </div>
  );
}
function Item({ icon: Icon, label, value, ok }: { icon: typeof Mail; label: string; value: string; ok?: boolean }) {
  return (
    <li className="flex gap-3 rounded-xl bg-surface p-3">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-mint" : "text-amber-500")} />
      <div><div className="text-xs font-bold uppercase tracking-wider text-muted">{label}</div><div className="font-semibold">{value}</div></div>
    </li>
  );
}
