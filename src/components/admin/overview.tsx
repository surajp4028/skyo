"use client";
import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import { motion } from "motion/react";
import { Activity, ArrowUpRight, BusFront, Building2, LogIn, Palmtree, Plane, Settings2, ShieldCheck, Sparkles, TrainFront, UserPlus, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Avatar, Card, StatCard } from "./ui";
import { useAdmin } from "./admin-context";
import { RailUsage } from "./rail-usage";
import { Meteors } from "@/components/ui/meteors";
import { IMAGES, formatINR, img, timeAgo } from "@/lib/utils";

type Stats = {
  users: { total: number; active: number; today: number; week: number };
  sessions: { live: number; logins24: number };
  byService: { service: string; count: number; revenuePaise: number }[];
  signups: { date: string; count: number }[];
  recent: { id: number; uid: string; name: string | null; email: string | null; phone: string | null; location: string | null; created_at: string }[];
};

const SVC = [
  { key: "train", label: "Trains", icon: TrainFront, image: IMAGES.train },
  { key: "flight", label: "Flights", icon: Plane, image: IMAGES.plane },
  { key: "bus", label: "Buses", icon: BusFront, image: IMAGES.bus },
  { key: "hotel", label: "Hotels", icon: Building2, image: IMAGES.resort },
  { key: "package", label: "Packages", icon: Palmtree, image: IMAGES.kerala },
] as const;

export function Overview() {
  const admin = useAdmin();
  const { data } = useFetch<{ stats: Stats }>("/api/admin/stats");
  const s = data?.stats;
  const [now] = useState(() => Date.now());
  const days = useMemo(
    () =>
      Array.from({ length: 14 }, (_, i) => {
        const d = new Date(now - (13 - i) * 86400_000).toISOString().slice(0, 10);
        return { d, n: s?.signups.find((x) => x.date === d)?.count || 0 };
      }),
    [now, s],
  );
  const series = days.map((d) => d.n);
  const hour = new Date(now).getHours();

  return (
    <>
      {/* hero banner */}
      <div className="relative mb-6 overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#0a0f1f_0%,#141c3d_55%,#2a1a3f_100%)] p-6 text-white md:p-8">
        <Meteors number={16} />
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-40 [mask-image:radial-gradient(ellipse_at_top_right,black,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-24 left-1/3 h-64 w-64 rounded-full bg-iris/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 lg:flex-row lg:items-end">
          <div>
            <div className="flex items-center gap-2 text-xs font-bold text-white/60">
              <Sparkles className="h-3.5 w-3.5 text-brand-2" />
              {new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
            <h1 className="mt-2 text-3xl font-extrabold tracking-tight md:text-4xl">
              Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, <span className="text-gradient">{admin.name.split(" ")[0]}</span>
            </h1>
            <p className="mt-2 max-w-xl text-sm text-white/60">Your travel platform at a glance — travellers, sessions, bookings and live rail data.</p>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            {[
              ["Online now", s?.sessions.live ?? "—", "text-emerald-300"],
              ["New today", s?.users.today ?? "—", "text-brand-2"],
              ["Logins 24h", s?.sessions.logins24 ?? "—", "text-sky-300"],
            ].map(([l, v, c]) => (
              <div key={l as string} className="rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 backdrop-blur">
                <div className={`text-2xl font-extrabold tabular-nums ${c}`}>{v}</div>
                <div className="text-[11px] font-semibold text-white/50">{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div className="relative mt-6 flex flex-wrap gap-2">
          {admin.can("users.view") && <QuickLink href="/admin/users" icon={<Users className="h-4 w-4" />} label="Users" />}
          {admin.can("bookings.train") && <QuickLink href="/admin/bookings/train" icon={<TrainFront className="h-4 w-4" />} label="Train bookings" />}
          {admin.can("bookings.package") && <QuickLink href="/admin/packages" icon={<Palmtree className="h-4 w-4" />} label="Tour packages" />}
          {admin.can("sessions.view") && <QuickLink href="/admin/sessions" icon={<Activity className="h-4 w-4" />} label="Live sessions" />}
          {admin.can("settings.manage") && <QuickLink href="/admin/settings" icon={<Settings2 className="h-4 w-4" />} label="Settings" />}
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={s?.users.total ?? "—"} hint={`${s?.users.active ?? 0} active accounts`} icon={<Users />} spark={series} />
        <StatCard label="New this week" value={s?.users.week ?? "—"} hint={`${s?.users.today ?? 0} joined today`} icon={<UserPlus />} tone="mint" spark={series.slice(-7)} />
        <StatCard label="Online now" value={s?.sessions.live ?? "—"} hint="active in last 30 min" icon={<Activity />} tone="sky" />
        <StatCard label="Logins (24h)" value={s?.sessions.logins24 ?? "—"} hint="new sessions" icon={<LogIn />} tone="iris" />
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="font-extrabold">Sign-ups</h3>
              <p className="text-xs text-muted">Last 14 days</p>
            </div>
            <div className="text-right">
              <div className="text-3xl font-extrabold tabular-nums">{series.reduce((a, b) => a + b, 0)}</div>
              <div className="text-[11px] font-semibold text-muted">new travellers</div>
            </div>
          </div>
          <AreaChart values={series} labels={days.map((d) => d.d)} />
        </Card>
        {admin.can("bookings.train") ? <RailUsage /> : <SecurityCard />}
      </div>

      <div className="mt-4 grid gap-4 xl:grid-cols-3">
        <div className="xl:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="font-extrabold">Bookings by service</h3>
            <span className="text-xs text-muted">Revenue counts paid bookings only</span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {SVC.map((v, i) => {
              const row = s?.byService.find((b) => b.service === v.key);
              const allowed = admin.can(`bookings.${v.key}` as never);
              return (
                <motion.div key={v.key} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
                  <Link href={allowed ? `/admin/bookings/${v.key}` : "#"} className={`group relative block aspect-[4/5] overflow-hidden rounded-2xl bg-ink ${allowed ? "" : "pointer-events-none opacity-50"}`}>
                    <Image src={img(v.image, 400)} alt="" fill sizes="20vw" className="object-cover opacity-60 transition duration-700 group-hover:scale-110 group-hover:opacity-80" />
                    <div className="absolute inset-0 bg-gradient-to-t from-ink via-ink/40 to-transparent" />
                    <ArrowUpRight className="absolute right-3 top-3 h-4 w-4 text-white/70 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-white" />
                    <div className="absolute inset-x-0 bottom-0 p-4 text-white">
                      <div className="mb-2 flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 backdrop-blur transition group-hover:bg-brand"><v.icon className="h-4 w-4" /></div>
                      <div className="text-xs font-semibold text-white/70">{v.label}</div>
                      <div className="text-2xl font-extrabold tabular-nums">{row?.count ?? 0}</div>
                      <div className="text-[11px] text-white/60">{formatINR(row?.revenuePaise ?? 0)}</div>
                    </div>
                  </Link>
                </motion.div>
              );
            })}
          </div>
        </div>
        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h3 className="font-extrabold">Newest travellers</h3>
            {admin.can("users.view") && <Link href="/admin/users" className="text-xs font-bold text-brand">View all →</Link>}
          </div>
          <div className="mt-3 flex-1 space-y-1">
            {(s?.recent || []).map((u, i) => (
              <motion.div key={u.uid} initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.05 }}>
                <Link href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-xl p-2 transition hover:bg-surface">
                  <Avatar name={u.name} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-bold">{u.name || "Unnamed traveller"}</div>
                    <div className="truncate text-xs text-muted">{u.email || (u.phone ? `+91 ${u.phone}` : "—")}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-mono text-[10px] font-bold text-ink/60">{u.uid}</div>
                    <div className="text-[11px] text-muted">{timeAgo(u.created_at)}</div>
                  </div>
                </Link>
              </motion.div>
            ))}
            {s && s.recent.length === 0 && <p className="py-6 text-center text-sm text-muted">No sign-ups yet.</p>}
          </div>
        </Card>
      </div>
    </>
  );
}

function QuickLink({ href, icon, label }: { href: string; icon: React.ReactNode; label: string }) {
  return (
    <Link href={href} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.06] px-3.5 py-2 text-xs font-bold text-white/80 backdrop-blur transition hover:bg-white/[0.12] hover:text-white">
      {icon} {label}
    </Link>
  );
}

function SecurityCard() {
  return (
    <Card className="p-5">
      <div className="flex items-center gap-2 font-extrabold"><ShieldCheck className="h-5 w-5 text-emerald-600" /> Security</div>
      <p className="mt-2 text-sm text-muted">All personal data is KMS-encrypted. Your access is permission-based and audit-logged.</p>
    </Card>
  );
}

/** Smooth gradient area chart (pure SVG, no chart lib). */
function AreaChart({ values, labels }: { values: number[]; labels: string[] }) {
  const W = 640;
  const H = 180;
  const max = Math.max(1, ...values);
  const pts = values.map((v, i) => [ (i / (values.length - 1)) * W, H - 12 - (v / max) * (H - 36) ] as const);
  const line = pts.reduce((acc, [x, y], i) => {
    if (i === 0) return `M ${x} ${y}`;
    const [px, py] = pts[i - 1];
    const cx = (px + x) / 2;
    return `${acc} C ${cx} ${py}, ${cx} ${y}, ${x} ${y}`;
  }, "");
  const area = `${line} L ${W} ${H} L 0 ${H} Z`;
  return (
    <div className="mt-4">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-48 w-full overflow-visible" preserveAspectRatio="none">
        <defs>
          <linearGradient id="area-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ff5a1f" stopOpacity="0.35" />
            <stop offset="100%" stopColor="#ff5a1f" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="area-line" x1="0" x2="1">
            <stop offset="0%" stopColor="#5b5bf7" />
            <stop offset="100%" stopColor="#ff5a1f" />
          </linearGradient>
        </defs>
        {[0.25, 0.5, 0.75].map((g) => <line key={g} x1="0" x2={W} y1={H * g} y2={H * g} stroke="#eef0f6" strokeDasharray="4 6" />)}
        <motion.path d={area} fill="url(#area-fill)" initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.8 }} />
        <motion.path d={line} fill="none" stroke="url(#area-line)" strokeWidth="3" strokeLinecap="round" initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 1.2, ease: "easeOut" }} />
        {pts.map(([x, y], i) => values[i] > 0 && <circle key={i} cx={x} cy={y} r="4.5" fill="white" stroke="#ff5a1f" strokeWidth="2.5" />)}
      </svg>
      <div className="mt-2 flex justify-between text-[11px] font-semibold text-muted">
        <span>{new Date(labels[0]).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span>{new Date(labels[Math.floor(labels.length / 2)]).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
        <span>Today</span>
      </div>
    </div>
  );
}
