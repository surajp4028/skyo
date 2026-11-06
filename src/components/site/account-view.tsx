"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { toast } from "sonner";
import { BadgeCheck, BusFront, Building2, Globe, LogOut, Monitor, Palmtree, Plane, ShieldCheck, Smartphone, TrainFront, UserRound } from "lucide-react";
import { useAuth } from "@/lib/client/providers";
import { api, errMsg } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { timeAgo } from "@/lib/utils";

type Sess = { id: number; device: string; location: string | null; ip: string; client: string; created_at: string; last_seen_at: string; current: boolean };

export function AccountView() {
  const { user, setUser, logout } = useAuth();
  const [sessions, setSessions] = useState<Sess[]>([]);
  const [name, setName] = useState(user?.name || "");
  const [saving, setSaving] = useState(false);

  const [tick, setTick] = useState(0);
  const load = () => setTick((t) => t + 1);
  useEffect(() => {
    let alive = true;
    api<{ sessions: Sess[] }>("/api/account/sessions")
      .then((r) => alive && setSessions(r.sessions))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);

  if (!user) return <div className="min-h-[60vh]" />;

  return (
    <main className="mx-auto max-w-6xl px-5 py-10">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="relative overflow-hidden rounded-[28px] bg-ink p-8 text-white">
        <div className="bg-grid absolute inset-0 opacity-50" />
        <div className="absolute -right-20 -top-20 h-72 w-72 rounded-full bg-brand/30 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-6 md:flex-row md:items-center">
          <div className="flex items-center gap-4">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-brand to-iris text-2xl font-extrabold">{(user.name || "T")[0].toUpperCase()}</div>
            <div>
              <h1 className="text-2xl font-extrabold">{user.name || "Traveller"}</h1>
              <p className="text-sm text-white/60">Member since {new Date(user.memberSince).toLocaleDateString("en-IN", { month: "long", year: "numeric" })}</p>
            </div>
          </div>
          <Button
            variant="outline"
            className="border-white/20 bg-white/10 text-white hover:border-white/40"
            onClick={async () => {
              await logout();
              window.location.replace("/");
            }}
          >
            <LogOut className="h-4 w-4" /> Log out
          </Button>
        </div>
      </motion.div>

      <div className="mt-6 grid gap-6 lg:grid-cols-3">
        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft lg:col-span-1">
          <h2 className="flex items-center gap-2 text-lg font-bold"><UserRound className="h-5 w-5 text-brand" /> Profile</h2>
          <form
            className="mt-5 space-y-4"
            onSubmit={async (e) => {
              e.preventDefault();
              setSaving(true);
              try {
                const r = await api<{ user: typeof user }>("/api/account/profile", { method: "PATCH", body: { name } });
                setUser(r.user);
                toast.success("Profile updated");
              } catch (e) {
                toast.error(errMsg(e));
              } finally {
                setSaving(false);
              }
            }}
          >
            <Field label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as on ID" />
            <Contact label="Email" value={user.email} verified={user.emailVerified} />
            <Contact label="Mobile" value={user.phone} verified={user.phoneVerified} />
            <Button type="submit" className="w-full" loading={saving} disabled={name.trim().length < 2 || name === user.name}>Save changes</Button>
          </form>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft lg:col-span-2">
          <h2 className="text-lg font-bold">My trips</h2>
          <div className="mt-5 grid grid-cols-2 gap-3 md:grid-cols-5">
            {[["Trains", TrainFront], ["Flights", Plane], ["Buses", BusFront], ["Hotels", Building2], ["Packages", Palmtree]].map(([l, I]) => {
              const Icon = I as typeof Plane;
              return (
                <div key={l as string} className="rounded-2xl border border-line p-4 text-center">
                  <Icon className="mx-auto h-5 w-5 text-brand" />
                  <div className="mt-2 text-2xl font-extrabold">0</div>
                  <div className="text-xs font-semibold text-muted">{l as string}</div>
                </div>
              );
            })}
          </div>
          <div className="mt-6 rounded-2xl bg-surface p-8 text-center">
            <p className="font-semibold text-ink">No trips yet</p>
            <p className="mt-1 text-sm text-muted">Your bookings will appear here with live status and e-tickets.</p>
            <Link href="/#search" className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Plan a trip</Link>
          </div>
        </section>

        <section className="rounded-3xl border border-line bg-white p-6 shadow-soft lg:col-span-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 text-lg font-bold"><ShieldCheck className="h-5 w-5 text-mint" /> Logged-in devices</h2>
            {sessions.length > 1 && (
              <Button
                variant="danger"
                size="sm"
                onClick={async () => {
                  await api("/api/account/sessions", { body: { all: true } });
                  toast.success("Logged out from all other devices");
                  load();
                }}
              >
                Log out all other devices
              </Button>
            )}
          </div>
          <div className="mt-4 divide-y divide-line">
            {sessions.map((s) => (
              <div key={s.id} className="flex flex-wrap items-center gap-4 py-4">
                <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">{s.device.startsWith("Mobile") ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}</div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 text-sm font-bold text-ink">
                    {s.device}
                    {s.current && <span className="rounded-full bg-mint/10 px-2 py-0.5 text-[11px] font-bold text-mint">This device</span>}
                  </div>
                  <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Globe className="h-3 w-3" /> {s.location || "Unknown location"} · {s.ip} · active {timeAgo(s.last_seen_at)}</div>
                </div>
                {!s.current && (
                  <button
                    className="text-sm font-bold text-red-600 hover:underline"
                    onClick={async () => {
                      await api("/api/account/sessions", { body: { id: s.id } });
                      load();
                    }}
                  >
                    Log out
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      </div>
    </main>
  );
}

function Contact({ label, value, verified }: { label: string; value: string | null; verified: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-line px-4 py-3">
      <div>
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
        <div className="text-sm font-semibold text-ink">{value || "Not added"}</div>
      </div>
      {value && verified && <BadgeCheck className="h-5 w-5 text-mint" />}
    </div>
  );
}
