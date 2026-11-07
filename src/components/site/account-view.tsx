"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "motion/react";
import { toast } from "sonner";
import {
  AtSign, BadgeCheck, BusFront, Building2, Camera, Copy, Download, Globe, LayoutGrid, Loader2, LogOut, Monitor, Palmtree, Pencil, Phone, Plane, Radio, Receipt,
  ShieldCheck, Smartphone, Sparkles, TrainFront, Trash2, UserRound, Users, X,
} from "lucide-react";
import { useAuth, useSite, type Me } from "@/lib/client/providers";
import { api, errMsg } from "@/lib/client/api";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { OtpStep } from "@/components/auth/otp-step";
import { isServiceOn, isTrainLiveOn, type ServiceKey } from "@/lib/services";
import { useSearchParams } from "next/navigation";
import { PassengersManager } from "@/components/booking/passengers-manager";
import { MyTrips } from "@/components/booking/my-trips";
import { MyTransactions } from "@/components/booking/my-transactions";
import { BillingFields, billingValid, GstPanel, useGstProfile, type Billing } from "@/components/booking/gst-panel";
import { cn, timeAgo } from "@/lib/utils";

type Sess = { id: number; device: string; location: string | null; ip: string; client: string; created_at: string; last_seen_at: string; current: boolean };
type Section = "overview" | "profile" | "contact" | "travellers" | "trips" | "transactions" | "devices" | "privacy";

/** `short` = label on phones (the rest of `label` is shown from lg up). */
const NAV: { key: Section; label: string; short?: string; icon: typeof UserRound }[] = [
  { key: "overview", label: "Overview", icon: LayoutGrid },
  { key: "profile", label: "Profile", icon: UserRound },
  { key: "contact", label: "Contact & login", short: "Contact", icon: AtSign },
  { key: "travellers", label: "Travellers", icon: Users },
  { key: "trips", label: "My trips", icon: Plane },
  { key: "transactions", label: "Transactions", short: "Payments", icon: Receipt },
  { key: "devices", label: "Devices & security", short: "Devices", icon: ShieldCheck },
  { key: "privacy", label: "Privacy & data", short: "Privacy", icon: Download },
];

const SVCS: { key: ServiceKey; label: string; icon: typeof Plane; tone: string }[] = [
  { key: "train", label: "Trains", icon: TrainFront, tone: "from-orange-500 to-amber-400" },
  { key: "flight", label: "Flights", icon: Plane, tone: "from-sky-500 to-indigo-500" },
  { key: "bus", label: "Buses", icon: BusFront, tone: "from-emerald-500 to-teal-400" },
  { key: "hotel", label: "Hotels", icon: Building2, tone: "from-fuchsia-500 to-pink-400" },
  { key: "package", label: "Packages", icon: Palmtree, tone: "from-amber-500 to-yellow-400" },
];

export function AccountView() {
  const { user, setUser, logout } = useAuth();
  const site = useSite();
  const asked = useSearchParams().get("tab") as Section | null;
  const [section, setSectionRaw] = useState<Section>(asked && NAV.some((n) => n.key === asked) ? asked : "overview");
  const contentRef = useRef<HTMLDivElement>(null);
  // Switching sections changes the content height; keep the user anchored at the top of the content.
  const setSection = (s: Section) => {
    setSectionRaw(s);
    const el = contentRef.current;
    if (el && el.getBoundingClientRect().top < 90) window.scrollTo({ top: el.getBoundingClientRect().top + window.scrollY - 100, behavior: "smooth" });
  };
  const [changing, setChanging] = useState<"email" | "phone" | null>(null);
  if (!user) return <div className="min-h-[60vh]" />;

  const checks = [
    { ok: !!user.name, label: "Add your name" },
    { ok: !!user.email && user.emailVerified, label: "Verify email" },
    { ok: !!user.phone && user.phoneVerified, label: "Verify mobile" },
  ];
  const pct = Math.round((checks.filter((c) => c.ok).length / checks.length) * 100);
  const services = SVCS.filter((s) => isServiceOn(site, s.key));

  return (
    <div className="overflow-x-clip">
      {/* sky header */}
      <section className="relative -mt-20 overflow-hidden pb-20 pt-24 sm:pb-24 sm:pt-28">
        <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden [contain:paint]">
          <div className="absolute inset-0 bg-[linear-gradient(180deg,#0057ff_0%,#1a82ff_55%,#6cbcff_100%)]" />
          <div className="absolute right-0 top-0 h-72 w-72 -translate-y-1/4 translate-x-1/4 rounded-full bg-[radial-gradient(circle,rgba(255,255,255,0.85),transparent_65%)]" />
        </div>
        <div className="relative mx-auto flex max-w-6xl flex-col justify-between gap-4 px-4 text-white sm:px-5 md:flex-row md:items-end md:gap-6">
          <div className="flex items-center gap-3 sm:gap-4">
            <div className="relative shrink-0 scale-[0.8] sm:scale-100">
              <Ring pct={pct} />
              <AvatarButton user={user} onChange={setUser} />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-extrabold sm:text-2xl md:text-3xl">{user.name || "Traveller"}</h1>
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs">
                <button onClick={() => navigator.clipboard?.writeText(user.uid).then(() => toast.success("SKYO ID copied"))} className="flex items-center gap-1.5 rounded-full bg-white/20 px-2.5 py-1 font-mono font-bold backdrop-blur hover:bg-white/30" title="All your bookings are linked to this ID">
                  {user.uid} <Copy className="h-3 w-3" />
                </button>
                <span className="text-white/80">Since {new Date(user.memberSince).toLocaleDateString("en-IN", { month: "short", year: "numeric" })}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button onClick={() => setSection(pct === 100 ? "profile" : checks.find((c) => !c.ok)?.label.includes("name") ? "profile" : "contact")} className="min-w-0 flex-1 rounded-2xl bg-white/15 px-4 py-2 text-left text-xs backdrop-blur md:flex-none">
              <div className="font-bold">Profile {pct}% complete</div>
              <div className="truncate text-white/75">{pct === 100 ? "You're all set ✨" : checks.find((c) => !c.ok)?.label}</div>
            </button>
            <Button variant="outline" className="shrink-0 border-white/30 bg-white/10 px-3 text-white hover:border-white/60 sm:px-4" onClick={async () => (await logout(), window.location.replace("/"))}>
              <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Log out</span>
            </Button>
          </div>
        </div>
      </section>

      <div ref={contentRef} className="relative z-10 mx-auto -mt-12 grid min-h-[80vh] max-w-6xl gap-4 px-3 pb-16 sm:-mt-14 sm:gap-5 sm:px-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        {/* phones: every section visible at once as a 4×2 grid · desktop: sticky side list */}
        <nav className="grid grid-cols-4 gap-1 rounded-3xl border border-line bg-white p-1.5 shadow-soft lg:sticky lg:top-24 lg:flex lg:flex-col lg:self-start lg:p-2">
          {NAV.map((n) => (
            <button key={n.key} onClick={() => setSection(n.key)} className={cn("relative flex flex-col items-center gap-1 rounded-2xl px-1 py-2.5 text-[10.5px] font-bold leading-tight transition lg:flex-row lg:gap-2.5 lg:px-3.5 lg:text-sm", section === n.key ? "text-white" : "text-ink/60 hover:text-ink")}>
              {section === n.key && <motion.span layoutId="acct-nav" className="absolute inset-0 rounded-2xl bg-ink" transition={{ type: "spring", bounce: 0.2, duration: 0.45 }} />}
              <n.icon className="relative h-[18px] w-[18px] lg:h-4 lg:w-4" />
              <span className="relative text-center lg:hidden">{n.short ?? n.label}</span>
              <span className="relative hidden lg:inline">{n.label}</span>
            </button>
          ))}
        </nav>

        <AnimatePresence mode="wait">
          <motion.div key={section} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} transition={{ duration: 0.2 }} className="min-w-0 space-y-5">
            {section === "overview" && (
              <>
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  <QuickCard icon={<Sparkles className="h-5 w-5" />} title="Plan a trip" text="Search trains, flights, buses and more." href="/#search" tone="from-brand to-brand-2" />
                  {isTrainLiveOn(site) && <QuickCard icon={<Radio className="h-5 w-5" />} title="Where's my train?" text="Live running status & delays." href="/trains/live" tone="from-sky-500 to-indigo-500" />}
                  <QuickCard icon={<ShieldCheck className="h-5 w-5" />} title="Security check-up" text="See devices signed in to your account." onClick={() => setSection("devices")} tone="from-emerald-500 to-teal-400" />
                </div>
                <Panel title="Complete your profile" sub="A complete profile makes bookings faster.">
                  <div className="space-y-2">
                    {checks.map((c) => (
                      <div key={c.label} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                        <span className="flex items-center gap-2 text-sm font-semibold"><BadgeCheck className={cn("h-5 w-5", c.ok ? "text-mint" : "text-ink/20")} />{c.label}</span>
                        {!c.ok && <button onClick={() => setSection(c.label.includes("name") ? "profile" : "contact")} className="text-xs font-bold text-brand">Do it</button>}
                      </div>
                    ))}
                  </div>
                </Panel>
                <TripsGrid services={services} />
              </>
            )}
            {section === "profile" && (
              <>
                <ProfileForm user={user} onSaved={setUser} />
                <TaxDetails />
              </>
            )}
            {section === "contact" && (
              <Panel title="Contact & login" sub="You log in with a one-time code sent to these. Changing one needs an OTP on the new email / number.">
                <div className="grid gap-3 md:grid-cols-2">
                  <ContactCard icon={<AtSign className="h-5 w-5" />} label="Email" value={user.email} verified={user.emailVerified} onEdit={() => setChanging("email")} />
                  <ContactCard icon={<Phone className="h-5 w-5" />} label="Mobile" value={user.phone} verified={user.phoneVerified} onEdit={() => setChanging("phone")} />
                </div>
              </Panel>
            )}
            {section === "travellers" && <PassengersManager />}
            {section === "trips" && (
              <Panel title="My trips" sub="Every booking linked to your SKYO ID — with PNR, berths and e-tickets.">
                <MyTrips />
              </Panel>
            )}
            {section === "transactions" && (
              <Panel title="Transactions" sub="Every payment you tried — successful, failed or pending. Quote the payment ID when you contact support.">
                <MyTransactions />
              </Panel>
            )}
            {section === "devices" && <Devices />}
            {section === "privacy" && <Privacy supportEmail={site.support_email} />}
          </motion.div>
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {changing && (
          <ChangeContact
            channel={changing}
            current={changing === "email" ? user.email : user.phone}
            onClose={() => setChanging(null)}
            onDone={(u) => {
              setUser(u);
              setChanging(null);
            }}
          />
        )}
      </AnimatePresence>
    </div>
  );
}

function Ring({ pct }: { pct: number }) {
  const R = 36;
  const C = 2 * Math.PI * R;
  return (
    <svg viewBox="0 0 80 80" className="h-20 w-20 -rotate-90">
      <circle cx="40" cy="40" r={R} fill="none" stroke="rgba(255,255,255,0.25)" strokeWidth="5" />
      <motion.circle cx="40" cy="40" r={R} fill="none" stroke="#ffd166" strokeWidth="5" strokeLinecap="round" strokeDasharray={C} initial={{ strokeDashoffset: C }} animate={{ strokeDashoffset: C - (pct / 100) * C }} transition={{ duration: 1 }} />
    </svg>
  );
}

function Panel({ title, sub, children, action }: { title: string; sub?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-3xl border border-line bg-white p-4 shadow-soft sm:p-6">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3 sm:mb-5">
        <div>
          <h2 className="text-lg font-extrabold">{title}</h2>
          {sub && <p className="mt-0.5 text-sm text-muted">{sub}</p>}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function QuickCard({ icon, title, text, href, onClick, tone }: { icon: ReactNode; title: string; text: string; href?: string; onClick?: () => void; tone: string }) {
  const body = (
    <motion.div whileHover={{ y: -4 }} className="group relative h-full overflow-hidden rounded-3xl border border-line bg-white p-5 shadow-soft">
      <div className={`pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-gradient-to-br ${tone} opacity-15 blur-2xl transition group-hover:opacity-30`} />
      <span className={`flex h-11 w-11 items-center justify-center rounded-2xl bg-gradient-to-br ${tone} text-white shadow-lg`}>{icon}</span>
      <div className="mt-4 font-extrabold">{title}</div>
      <div className="text-sm text-muted">{text}</div>
    </motion.div>
  );
  return href ? <Link href={href}>{body}</Link> : <button onClick={onClick} className="text-left">{body}</button>;
}

function TripsGrid({ services, big }: { services: typeof SVCS; big?: boolean }) {
  return (
    <Panel title="My trips" sub="Bookings linked to your SKYO ID appear here with live status and e-tickets.">
      <div className={cn("grid gap-3", services.length >= 5 ? "grid-cols-2 md:grid-cols-5" : "grid-cols-2 md:grid-cols-4")}>
        {services.map((s, i) => (
          <motion.div key={s.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.05 }} className="rounded-2xl border border-line p-4 text-center">
            <span className={`mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${s.tone} text-white`}><s.icon className="h-5 w-5" /></span>
            <div className="mt-2 text-2xl font-extrabold">0</div>
            <div className="text-xs font-semibold text-muted">{s.label}</div>
          </motion.div>
        ))}
      </div>
      {big && (
        <div className="mt-5 rounded-2xl bg-surface p-8 text-center">
          <div className="text-4xl">🧳</div>
          <p className="mt-2 font-bold">No trips yet</p>
          <p className="text-sm text-muted">When you book, your tickets show up here.</p>
          <Link href="/#search" className="mt-4 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-bold text-white">Plan a trip</Link>
        </div>
      )}
    </Panel>
  );
}

/** Uploads a profile photo (jpg/png/webp ≤ 2 MB) → stored privately in S3 under the SKYO ID folder. */
async function uploadAvatar(file: File): Promise<string> {
  if (!/^image\/(jpeg|png|webp)$/.test(file.type)) throw new Error("Use a JPG, PNG or WebP image.");
  if (file.size > 2 * 1024 * 1024) throw new Error("Photo must be 2 MB or smaller.");
  const fd = new FormData();
  fd.append("file", file);
  const res = await fetch("/api/account/avatar", { method: "POST", body: fd, headers: { "X-Requested-With": "skyo" }, credentials: "same-origin" });
  const j = (await res.json().catch(() => ({}))) as { avatar?: string; error?: { message?: string } };
  if (!res.ok || !j.avatar) throw new Error(j.error?.message || "Upload failed. Please try again.");
  return j.avatar;
}

function useAvatarUpload(user: Me, onChange: (u: Me) => void) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const pick = () => input.current?.click();
  const el = (
    <input
      ref={input}
      type="file"
      accept="image/jpeg,image/png,image/webp"
      className="hidden"
      onChange={async (e) => {
        const f = e.target.files?.[0];
        e.target.value = "";
        if (!f) return;
        setBusy(true);
        try {
          const avatar = await uploadAvatar(f);
          onChange({ ...user, avatar });
          toast.success("Profile photo updated");
        } catch (err) {
          toast.error((err as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    />
  );
  const remove = async () => {
    setBusy(true);
    try {
      await api("/api/account/avatar", { method: "DELETE" });
      onChange({ ...user, avatar: null });
      toast.success("Profile photo removed");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setBusy(false);
    }
  };
  return { pick, remove, busy, el };
}

function AvatarImg({ user, className }: { user: Me; className?: string }) {
  return user.avatar ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={user.avatar} alt="Profile photo" className={cn("rounded-full object-cover", className)} />
  ) : (
    <div className={cn("flex items-center justify-center rounded-full bg-gradient-to-br from-brand to-iris font-extrabold text-white", className)}>{(user.name || "T")[0].toUpperCase()}</div>
  );
}

function AvatarButton({ user, onChange }: { user: Me; onChange: (u: Me) => void }) {
  const up = useAvatarUpload(user, onChange);
  return (
    <>
      {up.el}
      <button onClick={up.pick} title="Change profile photo" className="group absolute inset-[7px] overflow-hidden rounded-full">
        <AvatarImg user={user} className="h-full w-full text-2xl" />
        <span className={cn("absolute inset-0 flex items-center justify-center bg-black/45 transition", up.busy ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
          {up.busy ? <Loader2 className="h-5 w-5 animate-spin" /> : <Camera className="h-5 w-5" />}
        </span>
      </button>
    </>
  );
}

function ProfileForm({ user, onSaved }: { user: Me; onSaved: (u: Me) => void }) {
  const [name, setName] = useState(user.name || "");
  const [saving, setSaving] = useState(false);
  const up = useAvatarUpload(user, onSaved);
  return (
    <Panel title="Profile" sub="Use your name exactly as on your government ID — it's printed on tickets.">
      {up.el}
      <div className="mb-6 flex items-center gap-4 rounded-2xl bg-surface p-4">
        <AvatarImg user={user} className="h-16 w-16 text-xl" />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-bold">Profile photo</div>
          <div className="text-xs text-muted">JPG, PNG or WebP · up to 2 MB · stored privately</div>
        </div>
        <div className="flex gap-2">
          <Button type="button" variant="outline" loading={up.busy} onClick={up.pick}><Camera className="h-4 w-4" /> {user.avatar ? "Change" : "Upload"}</Button>
          {user.avatar && <Button type="button" variant="outline" disabled={up.busy} onClick={up.remove}><Trash2 className="h-4 w-4" /></Button>}
        </div>
      </div>
      <form
        className="max-w-md space-y-4"
        onSubmit={async (e) => {
          e.preventDefault();
          setSaving(true);
          try {
            const r = await api<{ user: Me }>("/api/account/profile", { method: "PATCH", body: { name } });
            onSaved(r.user);
            toast.success("Profile updated");
          } catch (e) {
            toast.error(errMsg(e));
          } finally {
            setSaving(false);
          }
        }}
      >
        <Field label="Full name" name="name" value={name} onChange={(e) => setName(e.target.value)} placeholder="Your name as on ID" icon={<UserRound className="h-4 w-4" />} />
        <Button type="submit" loading={saving} disabled={name.trim().length < 2 || name === user.name}>Save changes</Button>
      </form>
    </Panel>
  );
}

function TaxDetails() {
  const [gp, setGp] = useGstProfile();
  const [bill, setBill] = useState<Billing | null>(null);
  const [saving, setSaving] = useState(false);
  const b = bill ?? gp?.billing ?? { state: "", pincode: null, address: null };
  const saveBilling = async () => {
    setSaving(true);
    try {
      const r = await api<{ billing: Billing }>("/api/account/billing", { method: "PUT", body: b });
      if (gp) setGp({ ...gp, billing: r.billing });
      setBill(null);
      toast.success("Billing state saved");
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  return (
    <>
      <Panel title="Billing state" sub="Used on invoices and sent with your train bookings. Pincode and address are optional.">
        {!gp ? <div className="h-24 animate-pulse rounded-2xl bg-surface" /> : (
          <div className="max-w-xl space-y-4">
            <BillingFields value={b} onChange={setBill} />
            <Button onClick={saveBilling} loading={saving} disabled={!bill || !billingValid(b)}>Save billing state</Button>
          </div>
        )}
      </Panel>
      <Panel title="GST details" sub="Optional — add your company GSTIN to get a GST invoice and claim input tax credit.">
        {!gp ? <div className="h-24 animate-pulse rounded-2xl bg-surface" /> : <div className="max-w-xl"><GstPanel gst={gp.gst} mode={gp.mode} onChange={(g) => setGp({ ...gp, gst: g })} /></div>}
      </Panel>
    </>
  );
}

function ContactCard({ icon, label, value, verified, onEdit }: { icon: ReactNode; label: string; value: string | null; verified: boolean; onEdit: () => void }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-line p-4">
      <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-brand-soft text-brand">{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-muted">{label} {value && verified && <BadgeCheck className="h-3.5 w-3.5 text-mint" />}</div>
        <div className="truncate font-bold text-ink">{value || "Not added"}</div>
      </div>
      <button onClick={onEdit} className="flex shrink-0 items-center gap-1 rounded-xl px-3 py-2 text-xs font-bold text-brand hover:bg-brand-soft"><Pencil className="h-3.5 w-3.5" /> {value ? "Change" : "Add"}</button>
    </div>
  );
}

function Devices() {
  const [sessions, setSessions] = useState<Sess[] | null>(null);
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let alive = true;
    api<{ sessions: Sess[] }>("/api/account/sessions").then((r) => alive && setSessions(r.sessions)).catch(() => {});
    return () => {
      alive = false;
    };
  }, [tick]);
  const reload = () => setTick((t) => t + 1);
  return (
    <Panel
      title="Devices & security"
      sub="Devices where you're signed in. Log out any you don't recognise."
      action={sessions && sessions.length > 1 ? <Button variant="danger" size="sm" onClick={async () => (await api("/api/account/sessions", { body: { all: true } }), toast.success("Logged out from all other devices"), reload())}>Log out all others</Button> : undefined}
    >
      <div className="space-y-2">
        {(sessions || []).map((s, i) => (
          <motion.div key={s.id} initial={{ opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.04 }} className={cn("flex flex-wrap items-center gap-4 rounded-2xl border p-4", s.current ? "border-mint/40 bg-mint/5" : "border-line")}>
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-surface">{s.device.startsWith("Mobile") ? <Smartphone className="h-5 w-5" /> : <Monitor className="h-5 w-5" />}</span>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-sm font-bold">{s.device}{s.current && <span className="rounded-full bg-mint/15 px-2 py-0.5 text-[10px] font-bold text-mint">THIS DEVICE</span>}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-xs text-muted"><Globe className="h-3 w-3" /> {s.location || "Unknown location"} · {s.ip} · active {timeAgo(s.last_seen_at)}</div>
            </div>
            {!s.current && <button onClick={async () => (await api("/api/account/sessions", { body: { id: s.id } }), reload())} className="rounded-xl px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-50">Log out</button>}
          </motion.div>
        ))}
        {!sessions && <div className="h-16 animate-shimmer rounded-2xl bg-[linear-gradient(90deg,#eef0f6_0%,#f8f9fc_40%,#eef0f6_80%)] bg-[length:200%_100%]" />}
      </div>
    </Panel>
  );
}

function Privacy({ supportEmail }: { supportEmail: string }) {
  return (
    <Panel title="Privacy & data" sub="Your rights under India's DPDP Act, 2023.">
      <div className="grid gap-3 md:grid-cols-2">
        <a href={`mailto:${supportEmail}?subject=${encodeURIComponent("Data access request")}`} className="rounded-2xl border border-line p-5 transition hover:border-brand">
          <Download className="h-5 w-5 text-brand" />
          <div className="mt-3 font-bold">Request a copy of my data</div>
          <div className="text-sm text-muted">We&apos;ll email it within 30 days.</div>
        </a>
        <a href={`mailto:${supportEmail}?subject=${encodeURIComponent("Account deletion request")}`} className="rounded-2xl border border-line p-5 transition hover:border-red-300">
          <Trash2 className="h-5 w-5 text-red-500" />
          <div className="mt-3 font-bold">Delete my account</div>
          <div className="text-sm text-muted">Booking records we must keep by law are retained.</div>
        </a>
      </div>
      <p className="mt-4 text-xs text-muted">Your email, mobile and login details are encrypted with AWS KMS. Read our <Link href="/privacy" className="font-semibold underline">Privacy Policy</Link>.</p>
    </Panel>
  );
}

/** Add / change email or mobile: OTP to the new value; server rejects values used by another account. */
function ChangeContact({ channel, current, onClose, onDone }: { channel: "email" | "phone"; current: string | null; onClose: () => void; onDone: (u: Me) => void }) {
  const [value, setValue] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [challenge, setChallenge] = useState<{ challengeId: string; sentTo: string; resendIn: number } | null>(null);
  const isEmail = channel === "email";
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);
  const send = async () => {
    const r = await api<{ challengeId: string; sentTo: string; resendIn: number }>("/api/account/contact/send", { body: { channel, value } });
    setChallenge(r);
    return r.resendIn;
  };
  return (
    <motion.div className="fixed inset-0 z-[70] flex items-end justify-center p-0 sm:items-center sm:p-4" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
      <div className="absolute inset-0 bg-ink/50 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ y: 40, opacity: 0, scale: 0.98 }}
        animate={{ y: 0, opacity: 1, scale: 1 }}
        exit={{ y: 40, opacity: 0 }}
        transition={{ type: "spring", stiffness: 320, damping: 30 }}
        className="relative w-full max-w-md rounded-t-3xl bg-white p-6 shadow-lift sm:rounded-3xl"
      >
        <button onClick={onClose} className="absolute right-4 top-4 rounded-lg p-2 text-muted hover:bg-surface" aria-label="Close"><X className="h-5 w-5" /></button>
        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-soft text-brand">{isEmail ? <AtSign className="h-6 w-6" /> : <Phone className="h-6 w-6" />}</div>
        <h3 className="text-xl font-extrabold">{current ? `Change ${isEmail ? "email" : "mobile number"}` : `Add ${isEmail ? "email" : "mobile number"}`}</h3>
        <p className="mt-1 text-sm text-muted">{current ? <>Current: <b className="text-ink">{current}</b>. </> : null}We&apos;ll send a code to the new {isEmail ? "email" : "number"} to confirm it&apos;s yours.</p>
        <div className="mt-6">
          {!challenge ? (
            <form
              className="space-y-4"
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                setErr(null);
                try {
                  await send();
                } catch (e) {
                  setErr(errMsg(e));
                } finally {
                  setBusy(false);
                }
              }}
            >
              {isEmail ? (
                <Field label="New email" name="new-email" type="email" autoFocus autoComplete="email" icon={<AtSign className="h-4 w-4" />} value={value} onChange={(e) => setValue(e.target.value.slice(0, 190))} error={err || undefined} />
              ) : (
                <Field label="New mobile number" name="new-phone" type="tel" inputMode="numeric" autoFocus prefix="+91" icon={<Phone className="h-4 w-4" />} value={value} onChange={(e) => setValue(e.target.value.replace(/\D/g, "").slice(0, 10))} error={err || undefined} />
              )}
              <Button type="submit" className="w-full" size="lg" loading={busy} disabled={isEmail ? !value.includes("@") : value.length !== 10}>Send OTP</Button>
            </form>
          ) : (
            <OtpStep
              sentTo={challenge.sentTo}
              resendIn={challenge.resendIn}
              onBack={() => setChallenge(null)}
              onResend={send}
              cta={`Verify & update ${isEmail ? "email" : "mobile"}`}
              onVerify={async (code) => {
                try {
                  const r = await api<{ user: Me }>("/api/account/contact/verify", { body: { challengeId: challenge.challengeId, code } });
                  toast.success(`${isEmail ? "Email" : "Mobile number"} updated`);
                  onDone(r.user);
                } catch (e) {
                  throw new Error(errMsg(e));
                }
              }}
            />
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}
