"use client";
import { useState } from "react";
import { toast } from "sonner";
import { Database, KeyRound, Mail, MessageSquare, Settings2, ShieldCheck, Timer } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Btn, Card, PageHeader } from "./ui";
import { api, errMsg } from "@/lib/client/api";
import { Field } from "@/components/ui/field";
import { cn } from "@/lib/utils";

type Resp = { settings: Record<string, string>; system: { encryption: string; email: string; sms: string; otpTtl: number; userSessionDays: number; adminIdleMinutes: number } };

export function SettingsView() {
  const { data } = useFetch<Resp>("/api/admin/settings");
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const v: Record<string, string> = { ...(data?.settings || {}), ...edits };
  const set = (k: string) => (e: { target: { value: string } }) => setEdits((p) => ({ ...p, [k]: e.target.value }));
  const toggle = (k: string) => setEdits((p) => ({ ...p, [k]: v[k] === "on" ? "off" : "on" }));

  return (
    <>
      <PageHeader
        icon={<Settings2 />}
        title="Settings"
        sub="Branding and behaviour. Changing the website name updates every page, email sender label stays in .env."
        actions={
          <Btn
            variant="dark"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                await api("/api/admin/settings", { method: "PUT", body: v });
                toast.success("Settings saved — live across the site");
              } catch (e) {
                toast.error(errMsg(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save settings
          </Btn>
        }
      />
      <div className="grid gap-6 xl:grid-cols-3">
        <div className="space-y-6 xl:col-span-2">
          <Card className="p-6">
            <h3 className="font-bold">Brand</h3>
            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <Field label="Website name" name="site_name" value={v.site_name || ""} onChange={set("site_name")} maxLength={40} hint="Shown in header, footer, titles, login & admin" />
              <Field label="Tagline" name="site_tagline" value={v.site_tagline || ""} onChange={set("site_tagline")} maxLength={120} />
              <Field label="Support email" name="support_email" value={v.support_email || ""} onChange={set("support_email")} />
              <Field label="Support phone" name="support_phone" value={v.support_phone || ""} onChange={set("support_phone")} />
            </div>
            <div className="mt-6 rounded-2xl bg-ink p-5 text-white">
              <div className="text-[10px] font-bold uppercase tracking-widest text-white/40">Live preview</div>
              <div className="mt-2 text-2xl font-extrabold">{v.site_name || "—"}</div>
              <div className="text-sm text-white/60">{v.site_tagline}</div>
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Platform behaviour</h3>
            <div className="mt-4 divide-y divide-line">
              <Toggle label="Allow new user sign-ups" desc="When off, unknown numbers/emails can't create accounts." on={v.user_signup === "on"} onClick={() => toggle("user_signup")} />
              <Toggle label="IP geolocation for sessions" desc="Look up approximate city for each login (ipwho.is). Private IPs are never sent." on={v.ip_geolocation === "on"} onClick={() => toggle("ip_geolocation")} />
              <Toggle label="Maintenance banner" desc="Show a banner on top of the public site." on={v.maintenance_mode === "on"} onClick={() => toggle("maintenance_mode")} />
            </div>
            {v.maintenance_mode === "on" && <div className="mt-4"><Field label="Banner message" name="maintenance_message" value={v.maintenance_message || ""} onChange={set("maintenance_message")} maxLength={200} /></div>}
            <div className="mt-4 max-w-xs"><Field label="OTP resend cooldown (seconds)" name="otp_resend_seconds" inputMode="numeric" value={v.otp_resend_seconds || ""} onChange={set("otp_resend_seconds")} hint="20 – 300" /></div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Services on the website</h3>
            <p className="mt-1 text-xs text-muted">Switching a service off removes it from the home page, navbar, dock and footer, and blocks its pages and APIs.</p>
            <div className="mt-2 grid gap-x-8 divide-y divide-line md:grid-cols-2 md:divide-y-0">
              {([["service_train", "Trains", "Search, availability, schedule"], ["service_flight", "Flights", "Flight search"], ["service_bus", "Buses", "Bus search"], ["service_hotel", "Hotels", "Hotel search"], ["service_package", "Packages", "Holiday packages"], ["train_live", "Train live running status", "Live status page, tab and API"]] as const).map(([k, l, d]) => (
                <Toggle key={k} label={l} desc={d} on={(v[k] ?? "on") === "on"} onClick={() => toggle(k)} />
              ))}
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Travellers & bookings</h3>
            <p className="mt-1 text-xs text-muted">Limits applied on the account page and in the train booking flow.</p>
            <div className="mt-4 grid max-w-lg gap-4 sm:grid-cols-2">
              <Field label="Max saved travellers" name="max_saved_passengers" inputMode="numeric" value={v.max_saved_passengers || ""} onChange={set("max_saved_passengers")} hint="1 – 50 per account" />
              <Field label="Max per train booking" name="max_passengers_per_booking" inputMode="numeric" value={v.max_passengers_per_booking || ""} onChange={set("max_passengers_per_booking")} hint="1 – 6 (Tatkal is capped at 4)" />
            </div>
          </Card>
          <Card className="p-6">
            <h3 className="font-bold">Live train data · RailCore</h3>
            <p className="mt-1 text-xs text-muted">Free plan = 2,500 credits / month. Search 5 · availability 5 · live status 5 · schedule 2 credits. RailCore data is never cached (their terms).</p>
            <div className="mt-2 divide-y divide-line">
              <Toggle label="Enable live train data" desc="Kill switch — when off, SKYO makes no RailCore calls at all." on={v.train_api === "on"} onClick={() => toggle("train_api")} />
            </div>
            <div className="mt-4 max-w-xs"><Field label="Daily credit cap" name="train_daily_credit_cap" inputMode="numeric" value={v.train_daily_credit_cap || ""} onChange={set("train_daily_credit_cap")} hint="≈ 80/day keeps you inside 2,500/month" /></div>
          </Card>
        </div>
        <Card className="h-fit p-6">
          <h3 className="flex items-center gap-2 font-bold"><ShieldCheck className="h-5 w-5 text-mint" /> Security posture</h3>
          <p className="mt-1 text-xs text-muted">Secrets live in .env / AWS — never in the database.</p>
          <ul className="mt-5 space-y-3 text-sm">
            <Item icon={KeyRound} label="PII encryption" value={data?.system.encryption === "aws-kms" ? "AWS KMS envelope (AES-256-GCM)" : "Local AES-256-GCM — set AWS_KMS_KEY_ID"} ok={data?.system.encryption === "aws-kms"} />
            <Item icon={Mail} label="Email OTP" value={data?.system.email || "…"} ok={data?.system.email?.includes("configured") && !data?.system.email.startsWith("Not")} />
            <Item icon={MessageSquare} label="SMS OTP" value={data?.system.sms || "…"} ok={data?.system.sms?.includes("configured") && !data?.system.sms.startsWith("Not")} />
            <Item icon={Timer} label="OTP validity" value={`${data?.system.otpTtl ?? "…"}s · 5 attempts`} ok />
            <Item icon={Database} label="Sessions" value={`Traveller ${data?.system.userSessionDays ?? "…"}d rolling · Agent idle ${data?.system.adminIdleMinutes ?? "…"}m`} ok />
          </ul>
        </Card>
      </div>
    </>
  );
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
