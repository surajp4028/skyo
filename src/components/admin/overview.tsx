"use client";
import Link from "next/link";
import { useState } from "react";
import { motion } from "motion/react";
import { Activity, ArrowUpRight, BusFront, Building2, LogIn, Palmtree, Plane, TrainFront, UserPlus, Users } from "lucide-react";
import { useFetch } from "./use-fetch";
import { Avatar, Card, StatCard } from "./ui";
import { useAdmin } from "./admin-context";
import { formatINR, timeAgo } from "@/lib/utils";

type Stats = {
  users: { total: number; active: number; today: number; week: number };
  sessions: { live: number; logins24: number };
  byService: { service: string; count: number; revenuePaise: number }[];
  signups: { date: string; count: number }[];
  recent: { id: number; uid: string; name: string | null; email: string | null; phone: string | null; location: string | null; created_at: string }[];
};

const SVC = [
  { key: "train", label: "Trains", icon: TrainFront },
  { key: "flight", label: "Flights", icon: Plane },
  { key: "bus", label: "Buses", icon: BusFront },
  { key: "hotel", label: "Hotels", icon: Building2 },
  { key: "package", label: "Packages", icon: Palmtree },
] as const;

export function Overview() {
  const admin = useAdmin();
  const { data } = useFetch<{ stats: Stats }>("/api/admin/stats");
  const s = data?.stats;
  const [now] = useState(() => Date.now());
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * 86400_000).toISOString().slice(0, 10);
    return { d, n: s?.signups.find((x) => x.date === d)?.count || 0 };
  });
  const max = Math.max(1, ...days.map((d) => d.n));
  const hour = new Date(now).getHours();

  return (
    <>
      <div className="relative mb-8 overflow-hidden rounded-xl border border-neutral-200 bg-white px-6 py-7">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(#e5e5e5_1px,transparent_1px)] [background-size:16px_16px] [mask-image:radial-gradient(ellipse_at_top_right,black_20%,transparent_70%)]" />
        <div className="pointer-events-none absolute -right-10 -top-24 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
        <div className="relative">
          <p className="text-xs font-medium text-neutral-500">{new Date(now).toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</p>
          <h1 className="mt-1 text-2xl font-semibold tracking-tight">Good {hour < 12 ? "morning" : hour < 17 ? "afternoon" : "evening"}, {admin.name.split(" ")[0]}</h1>
          <p className="mt-1 text-sm text-neutral-500">Here&apos;s what&apos;s happening across trains, flights, buses, hotels and packages.</p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Total users" value={s?.users.total ?? "—"} hint={`${s?.users.active ?? 0} active accounts`} icon={<Users />} />
        <StatCard label="New today" value={s?.users.today ?? "—"} hint={`${s?.users.week ?? 0} in the last 7 days`} icon={<UserPlus />} tone="mint" />
        <StatCard label="Online now" value={s?.sessions.live ?? "—"} hint="active in last 30 min" icon={<Activity />} tone="sky" />
        <StatCard label="Logins (24h)" value={s?.sessions.logins24 ?? "—"} hint="new sessions" icon={<LogIn />} tone="iris" />
      </div>

      <div className="mt-3 grid gap-3 xl:grid-cols-3">
        <Card className="p-5 xl:col-span-2">
          <div className="flex items-start justify-between">
            <div>
              <h3 className="text-sm font-semibold">New sign-ups</h3>
              <p className="text-xs text-neutral-500">Last 14 days</p>
            </div>
            <span className="text-2xl font-semibold tabular-nums">{days.reduce((a, b) => a + b.n, 0)}</span>
          </div>
          <div className="mt-6 flex h-44 items-end gap-1.5">
            {days.map((d, i) => (
              <div key={d.d} className="group relative flex h-full flex-1 flex-col justify-end">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${Math.max(3, (d.n / max) * 100)}%` }}
                  transition={{ delay: i * 0.025, type: "spring", stiffness: 140, damping: 20 }}
                  className={`w-full rounded-[4px] ${d.n ? "bg-neutral-900 group-hover:bg-brand" : "bg-neutral-100"}`}
                />
                <span className="pointer-events-none absolute -top-7 left-1/2 z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-neutral-900 px-2 py-1 text-[10px] font-medium text-white opacity-0 transition group-hover:opacity-100">
                  {d.n} · {new Date(d.d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}
                </span>
              </div>
            ))}
          </div>
          <div className="mt-2 flex justify-between text-[11px] text-neutral-400">
            <span>{new Date(days[0].d).toLocaleDateString("en-IN", { day: "numeric", month: "short" })}</span>
            <span>Today</span>
          </div>
        </Card>

        <Card className="flex flex-col p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Newest travellers</h3>
            {admin.can("users.view") && <Link href="/admin/users" className="text-xs font-medium text-neutral-500 hover:text-neutral-900">View all →</Link>}
          </div>
          <div className="mt-4 flex-1 space-y-1">
            {(s?.recent || []).map((u) => (
              <Link key={u.uid} href={`/admin/users/${u.id}`} className="flex items-center gap-3 rounded-lg p-2 transition hover:bg-neutral-50">
                <Avatar name={u.name} />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[13px] font-medium">{u.name || "Unnamed traveller"}</div>
                  <div className="truncate text-xs text-neutral-500">{u.email || (u.phone ? `+91 ${u.phone}` : "—")}</div>
                </div>
                <div className="text-right">
                  <div className="font-mono text-[10px] text-neutral-500">{u.uid}</div>
                  <div className="text-[11px] text-neutral-400">{timeAgo(u.created_at)}</div>
                </div>
              </Link>
            ))}
            {s && s.recent.length === 0 && <p className="py-6 text-center text-sm text-neutral-400">No sign-ups yet.</p>}
          </div>
        </Card>
      </div>

      <h3 className="mb-3 mt-8 text-sm font-semibold">Bookings by service</h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {SVC.map((v) => {
          const row = s?.byService.find((b) => b.service === v.key);
          const allowed = admin.can(`bookings.${v.key}` as never);
          return (
            <Link key={v.key} href={allowed ? `/admin/bookings/${v.key}` : "#"} className={allowed ? "group" : "pointer-events-none opacity-50"}>
              <Card className="relative p-4 transition group-hover:border-neutral-300 group-hover:shadow-[0_4px_16px_-6px_rgba(0,0,0,0.1)]">
                <div className="flex items-center justify-between">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg border border-neutral-200 bg-neutral-50 text-neutral-700 transition group-hover:border-brand/30 group-hover:bg-brand-soft group-hover:text-brand"><v.icon className="h-4 w-4" /></div>
                  <ArrowUpRight className="h-4 w-4 text-neutral-300 transition group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-neutral-700" />
                </div>
                <div className="mt-4 text-xs text-neutral-500">{v.label}</div>
                <div className="text-xl font-semibold tabular-nums">{row?.count ?? 0}</div>
                <div className="text-[11px] text-neutral-400">{formatINR(row?.revenuePaise ?? 0)} revenue</div>
              </Card>
            </Link>
          );
        })}
      </div>
    </>
  );
}
