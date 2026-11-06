"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Activity, ArrowUpRight, BusFront, Building2, LayoutDashboard, LogIn, Palmtree, Plane, TrainFront, UserPlus, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Card, PageHeader, StatCard } from "./ui";
import { useAdmin } from "./admin-context";
import { formatINR, timeAgo } from "@/lib/utils";

type Stats = {
  users: { total: number; active: number; today: number; week: number };
  sessions: { live: number; logins24: number };
  byService: { service: string; count: number; revenuePaise: number }[];
  signups: { date: string; count: number }[];
  recent: { uid: string; name: string | null; email_masked: string | null; phone_masked: string | null; last_location: string | null; created_at: string }[];
};

const SVC = [
  { key: "train", label: "Trains", icon: TrainFront, color: "from-brand to-brand-2" },
  { key: "flight", label: "Flights", icon: Plane, color: "from-iris to-sky" },
  { key: "bus", label: "Buses", icon: BusFront, color: "from-mint to-emerald-300" },
  { key: "hotel", label: "Hotels", icon: Building2, color: "from-fuchsia-500 to-pink-400" },
  { key: "package", label: "Packages", icon: Palmtree, color: "from-amber-500 to-yellow-300" },
] as const;

export function Overview() {
  const admin = useAdmin();
  const { data } = useFetch<{ stats: Stats }>("/api/admin/stats");
  const s = data?.stats;
  const [now] = useState(() => Date.now());

  // last 14 days, filling gaps
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 86400_000).toISOString().slice(0, 10);
    return { d, n: s?.signups.find((x) => x.date === d)?.count || 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const hour = new Date(now).getHours();

  return (
    <>
      <PageHeader
        icon={<LayoutDashboard className="h-6 w-6" />}
        title={`Good ${hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, ${admin.name.split(" ")[0]}`}
        sub="Here's what's happening across your travel platform today."
      />
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={s?.users.total ?? "—"} hint={`${s?.users.active ?? 0} active`} icon={<Users className="h-5 w-5" />} />
        <StatCard label="New today" value={s?.users.today ?? "—"} hint={`${s?.users.week ?? 0} this week`} icon={<UserPlus className="h-5 w-5" />} tone="mint" />
        <StatCard label="Online now" value={s?.sessions.live ?? "—"} hint="active in last 30 min" icon={<Activity className="h-5 w-5" />} tone="sky" />
        <StatCard label="Logins (24h)" value={s?.sessions.logins24 ?? "—"} hint="new sessions" icon={<LogIn className="h-5 w-5" />} tone="iris" />
      </div>

      <div className="mt-6 grid gap-6 xl:grid-cols-3">
        <Card className="p-6 xl:col-span-2">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold">New sign-ups</h3>
              <p className="text-xs text-muted">Last 14 days</p>
            </div>
            <span className="rounded-full bg-surface px-3 py-1 text-xs font-bold">{days.reduce((a, b) => a + b.n, 0)} total</span>
          </div>
          <div className="mt-6 flex h-48 items-end gap-2">
            {days.map((d, i) => (
              <div key={d.d} className="group relative flex h-full flex-1 flex-col justify-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(4, (d.n / max) * 100)}%` }}
                  transition={{ delay: i * 0.03, type: "spring", stiffness: 120, damping: 18 }}
                  className={`w-full rounded-t-md ${d.n ? "bg-gradient-to-t from-brand to-brand-2" : "bg-line"}`}
                />
                <span className="pointer-events-none absolute -top-7 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-md bg-ink px-2 py-1 text-[10px] font-bold text-white opacity-0 transition group-hover:opacity-100">
                  {d.n} · {new Date(d.d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[10px] font-semibold text-muted">
            <span>{new Date(days[0].d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </Card>

        <Card className="p-6">
          <div className="flex items-center justify-between">
            <h3 className="font-bold">Newest travellers</h3>
            {admin.can("users.view") && <Link href="/admin/users" className="text-xs font-bold text-brand">View all</Link>}
          </div>
          <div className="mt-4 space-y-3">
            {(s?.recent || []).map((u) => (
              <div key={u.uid} className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-gradient-to-br from-brand/20 to-iris/20 text-sm font-bold text-ink">{(u.name || "T")[0]}</div>
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold">{u.name || "Unnamed traveller"}</div>
                  <div className="truncate text-xs text-muted">{u.email_masked || u.phone_masked} · {u.last_location || "—"}</div>
                </div>
                <span className="text-[11px] text-muted">{timeAgo(u.created_at)}</span>
              </div>
            ))}
            {s && s.recent.length === 0 && <p className="py-6 text-center text-sm text-muted">No sign-ups yet.</p>}
          </div>
        </Card>
      </div>

      <h3 className="mb-4 mt-8 font-bold">Bookings by service</h3>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {SVC.map((v) => {
          const row = s?.byService.find((b) => b.service === v.key);
          const allowed = admin.can(`bookings.${v.key}` as never);
          return (
            <Link key={v.key} href={allowed ? `/admin/bookings/${v.key}` : "#"} className={!allowed ? "pointer-events-none opacity-50" : ""}>
              <Card className="group relative overflow-hidden p-5 transition hover:-translate-y-0.5 hover:shadow-lift">
                <div className={`flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${v.color} text-white`}><v.icon className="h-5 w-5" /></div>
                <ArrowUpRight className="absolute right-4 top-4 h-4 w-4 text-muted transition group-hover:text-ink" />
                <div className="mt-4 text-sm font-semibold text-muted">{v.label}</div>
                <div className="text-2xl font-extrabold">{row?.count ?? 0}</div>
                <div className="text-xs text-muted">{formatINR(row?.revenuePaise ?? 0)} revenue</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
