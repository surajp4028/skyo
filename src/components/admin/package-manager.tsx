"use client";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  ArrowUpRight,
  CalendarDays,
  CircleDollarSign,
  ClipboardList,
  ExternalLink,
  FileText,
  ImagePlus,
  Loader2,
  MapPin,
  PackageCheck,
  Palmtree,
  Pencil,
  Plus,
  Save,
  Search,
  Trash2,
  X,
} from "lucide-react";
import type { CancellationRule, PackageCoupon, PackageDay, PackageDeparture, PackageStay, TourPackage } from "@/lib/packages";
import { addDays, sortedRules, todayIST } from "@/lib/packages";
import { api, errMsg } from "@/lib/client/api";
import { formatINR } from "@/lib/utils";
import { cn } from "@/lib/utils";
import { Btn, Card } from "./ui";

type Booking = {
  ref: string;
  title: string;
  slug: string;
  userUid: string;
  customer: {
    name: string;
    email: string;
    phone: string;
    package?: { title: string; route: string[] };
    guests: number;
    travelDate: string;
    pricingType: string;
    packagePrice: number;
    discount: number;
    total: number;
    upfront: number;
  };
  travelDate: string;
  guests: number;
  pricingType: string;
  subtotalPaise: number;
  discountPaise: number;
  couponCode: string | null;
  totalPaise: number;
  upfrontPaise: number;
  paidPaise: number;
  remainingPaise: number;
  paymentStatus: string;
  bookingStatus: string;
  createdAt: string;
  invoiceUrl: string;
};
type Data = { packages: TourPackage[]; metrics: { totalPackages: number; totalBookings: number; revenuePaise: number } };
type Tab = "packages" | "bookings";
const blank = (): Partial<TourPackage> => ({
  slug: "",
  title: "",
  shortDescription: "",
  detailedDescription: "",
  durationDays: 3,
  durationNights: 2,
  destinations: [""],
  itinerary: [{ dayNumber: 1, title: "", description: "", activityDetails: [] }],
  departures: [],
  tripInfo: { origin: "", reportingPoint: "", returnPoint: "", travelMode: "", mealPlan: "" },
  cancellationRules: [
    { daysBefore: 30, deductionPct: 10 },
    { daysBefore: 15, deductionPct: 25 },
    { daysBefore: 7, deductionPct: 50 },
    { daysBefore: 0, deductionPct: 100 },
  ],
  accommodations: [],
  originalPrice: 10000,
  discountedPrice: 10000,
  pricingType: "per_person",
  upfrontTokenAmount: 0,
  coverPhoto: "",
  images: [],
  videoLink: null,
  inclusions: [],
  exclusions: [],
  coupons: [],
  cancellationPolicy: "",
  priceNotes: "",
  supportContact: { name: "SKYO Package Desk", email: "support@skyo.in", phone: "" },
  status: "draft",
  featured: false,
});
const money = (p: number) => formatINR(p);
const slugify = (v: string) =>
  v
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export function PackageManager() {
  const [tab, setTab] = useState<Tab>("packages");
  const [data, setData] = useState<Data | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<Partial<TourPackage> | null>(null);
  const [saving, setSaving] = useState(false);
  const [q, setQ] = useState("");
  const [tick, setTick] = useState(0);
  useEffect(() => {
    let live = true;
    Promise.all([api<Data>("/api/admin/packages"), api<{ bookings: Booking[] }>("/api/admin/package-bookings")])
      .then(([d, b]) => {
        if (live) {
          setData(d);
          setBookings(b.bookings);
        }
      })
      .catch((e) => toast.error(errMsg(e)))
      .finally(() => live && setLoading(false));
    return () => {
      live = false;
    };
  }, [tick]);
  const packages = useMemo(() => data?.packages ?? [], [data]);
  const filtered = useMemo(
    () => packages.filter((p) => `${p.title} ${p.slug} ${p.destinations.join(" ")}`.toLowerCase().includes(q.toLowerCase())),
    [packages, q],
  );
  const persist = async () => {
    if (!editing) return;
    setSaving(true);
    try {
      const payload = {
        ...editing,
        slug: editing.slug || slugify(editing.title || ""),
        destinations: (editing.destinations || []).filter(Boolean),
        images: (editing.images || []).filter(Boolean),
        videoLink: editing.videoLink || null,
        priceNotes: editing.priceNotes || null,
      };
      await api(editing.id ? `/api/admin/packages/${editing.id}` : "/api/admin/packages", { method: editing.id ? "PUT" : "POST", body: payload });
      toast.success(editing.id ? "Package updated" : "Package created");
      setEditing(null);
      setTick((v) => v + 1);
    } catch (e) {
      toast.error(errMsg(e));
    } finally {
      setSaving(false);
    }
  };
  const archive = async (p: TourPackage) => {
    if (!confirm(`Archive “${p.title}”? Existing bookings will remain available.`)) return;
    try {
      await api(`/api/admin/packages/${p.id}`, { method: "DELETE" });
      toast.success("Package archived");
      setTick((v) => v + 1);
    } catch (e) {
      toast.error(errMsg(e));
    }
  };
  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-3xl bg-[linear-gradient(120deg,#0a0f1f,#182957_62%,#3a2850)] p-5 text-white sm:p-7">
        <div className="absolute -right-12 -top-20 h-64 w-64 rounded-full bg-brand/25 blur-3xl" />
        <div className="relative flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.18em] text-white/60">
              <Palmtree className="h-4 w-4 text-brand-2" /> Package operations
            </div>
            <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Trips worth remembering.</h1>
            <p className="mt-2 max-w-xl text-sm text-white/65">Manage every itinerary, offer and traveller payment from one console.</p>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[
              ["Packages", data?.metrics.totalPackages ?? "—"],
              ["Bookings", data?.metrics.totalBookings ?? "—"],
              ["Revenue collected", money(data?.metrics.revenuePaise ?? 0)],
            ].map(([l, v]) => (
              <div key={l} className="min-w-24 rounded-2xl border border-white/10 bg-white/[.06] px-3 py-3">
                <div className="text-lg font-extrabold tabular-nums sm:text-xl">{v}</div>
                <div className="mt-0.5 text-[9px] font-bold text-white/50 sm:text-[10px]">{l}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex rounded-xl border border-line bg-white p-1 shadow-sm">
          {(
            [
              ["packages", "Packages", Palmtree],
              ["bookings", "Bookings", ClipboardList],
            ] as const
          ).map(([k, label, Icon]) => (
            <button
              key={k}
              onClick={() => setTab(k)}
              className={cn(
                "inline-flex items-center gap-2 rounded-lg px-4 py-2 text-xs font-extrabold transition",
                tab === k ? "bg-ink text-white" : "text-muted hover:text-ink",
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
              {k === "bookings" && bookings.length > 0 && <span className="rounded-full bg-white/15 px-1.5 text-[10px]">{bookings.length}</span>}
            </button>
          ))}
        </div>
        {tab === "packages" && (
          <Btn variant="dark" onClick={() => setEditing(blank())}>
            <Plus className="h-4 w-4" /> New package
          </Btn>
        )}
      </div>
      {tab === "packages" ? (
        <>
          <div className="flex items-center gap-2 rounded-xl border border-line bg-white px-3">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search by trip, slug or destination"
              className="h-11 min-w-0 flex-1 bg-transparent text-sm outline-none"
            />
          </div>
          {loading && !data ? (
            <div className="p-10 text-center text-sm text-muted">
              <Loader2 className="mx-auto mb-2 h-5 w-5 animate-spin" />
              Loading your packages…
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {filtered.map((p) => (
                <Card key={p.id} className="overflow-hidden">
                  <div className="grid sm:grid-cols-[200px_1fr]">
                    <div
                      className="min-h-48 bg-cover bg-center"
                      style={{ backgroundImage: `linear-gradient(0deg,rgba(6,20,42,.45),transparent),url("${p.coverPhoto}")` }}
                    />
                    <div className="min-w-0 p-4 sm:p-5">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-[9px] font-extrabold uppercase tracking-wider",
                              p.status === "published"
                                ? "bg-emerald-50 text-emerald-700"
                                : p.status === "draft"
                                  ? "bg-amber-50 text-amber-700"
                                  : "bg-slate-100 text-slate-600",
                            )}
                          >
                            {p.status}
                          </span>
                          <h2 className="mt-2 text-lg font-extrabold leading-tight">{p.title}</h2>
                        </div>
                        <button
                          onClick={() => setEditing({ ...p })}
                          className="rounded-lg p-2 text-muted hover:bg-surface hover:text-ink"
                          aria-label={`Edit ${p.title}`}
                        >
                          <Pencil className="h-4 w-4" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-[10px] font-semibold text-muted">
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          {p.destinations.join(" · ")}
                        </span>
                        <span>
                          {p.durationDays}D / {p.durationNights}N
                        </span>
                        <span>
                          {money(p.discountedPrice)} / {p.pricingType === "per_person" ? "person" : "couple"}
                        </span>
                      </div>
                      <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-muted">{p.shortDescription}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <button onClick={() => setEditing({ ...p })} className="rounded-lg bg-ink px-3 py-2 text-[10px] font-extrabold text-white">
                          Edit package
                        </button>
                        {p.status === "published" && (
                          <Link
                            href={`/packages/${p.slug}`}
                            target="_blank"
                            className="inline-flex items-center gap-1 rounded-lg border border-line px-3 py-2 text-[10px] font-extrabold"
                          >
                            Preview <ExternalLink className="h-3 w-3" />
                          </Link>
                        )}
                        <button
                          onClick={() => archive(p)}
                          className="ml-auto inline-flex items-center gap-1 rounded-lg px-2 py-2 text-[10px] font-bold text-red-600 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                          Archive
                        </button>
                      </div>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </>
      ) : (
        <div className="space-y-3">
          {loading && !bookings.length ? (
            <div className="p-10 text-center text-sm text-muted">Loading package bookings…</div>
          ) : bookings.length === 0 ? (
            <Card className="p-12 text-center">
              <PackageCheck className="mx-auto h-8 w-8 text-muted" />
              <h3 className="mt-3 font-extrabold">No package bookings yet</h3>
              <p className="mt-1 text-sm text-muted">New bookings will show here with traveller and payment details.</p>
            </Card>
          ) : (
            bookings.map((b) => (
              <Card key={b.ref} className="p-4 sm:p-5">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-[11px] font-extrabold">{b.ref}</span>
                      <span
                        className={cn(
                          "rounded-full px-2 py-1 text-[9px] font-extrabold uppercase",
                          b.paymentStatus === "paid"
                            ? "bg-emerald-50 text-emerald-700"
                            : b.paymentStatus === "partially_paid"
                              ? "bg-amber-50 text-amber-700"
                              : "bg-slate-100 text-slate-600",
                        )}
                      >
                        {b.paymentStatus.replace("_", " ")}
                      </span>
                      <span className="rounded-full bg-sky-50 px-2 py-1 text-[9px] font-extrabold uppercase text-sky-700">{b.bookingStatus}</span>
                    </div>
                    <h2 className="mt-2 text-lg font-extrabold">{b.title}</h2>
                    <p className="mt-1 text-xs text-muted">
                      {b.customer.package?.route?.join(" → ") || b.slug} · {b.travelDate} · {b.guests} travellers · {b.pricingType.replace("_", " ")}
                    </p>
                  </div>
                  <Link href={`/packages/${b.slug}`} target="_blank" className="inline-flex items-center gap-1 text-[10px] font-bold text-brand">
                    Package <ArrowUpRight className="h-3 w-3" />
                  </Link>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Info label="Traveller" value={b.customer.name} />
                  <Info label="Email / mobile" value={`${b.customer.email} · ${b.customer.phone}`} />
                  <Info label="SKYO ID" value={b.userUid} />
                  <Info label="Coupon / promo" value={b.couponCode || "—"} />
                </div>
                <div className="mt-4 rounded-2xl bg-surface p-3.5">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-extrabold">
                      <CircleDollarSign className="h-4 w-4 text-brand" />
                      Payment breakdown
                    </div>
                    <span className="text-[10px] font-semibold text-muted">Razorpay · {b.paymentStatus}</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Amount label="Package total" value={money(b.totalPaise)} />
                    <Amount label="Token due" value={money(b.upfrontPaise)} />
                    <Amount label="Paid" value={money(b.paidPaise)} green />
                    <Amount label="Remaining" value={money(b.remainingPaise)} orange />
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={`/api/package-bookings/${b.ref}/invoice`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[10px] font-extrabold"
                  >
                    <FileText className="h-3.5 w-3.5" />
                    Invoice PDF
                  </a>
                  <a
                    href={`/api/package-bookings/${b.ref}/voucher`}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-ink px-3 py-2 text-[10px] font-extrabold text-white"
                  >
                    <CalendarDays className="h-3.5 w-3.5" />
                    Travel voucher
                  </a>
                  <Link
                    href={`/admin/bookings/package?q=${encodeURIComponent(b.ref)}`}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-2 text-[10px] font-extrabold"
                  >
                    Full booking record
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </Card>
            ))
          )}
        </div>
      )}
      {editing && <PackageEditor initial={editing} busy={saving} onClose={() => setEditing(null)} onChange={setEditing} onSave={persist} />}
    </div>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <div className="text-[9px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className="mt-0.5 break-words text-xs font-semibold">{value || "—"}</div>
    </div>
  );
}
function Amount({ label, value, green, orange }: { label: string; value: string; green?: boolean; orange?: boolean }) {
  return (
    <div>
      <div className="text-[9px] font-semibold text-muted">{label}</div>
      <div className={cn("mt-0.5 text-sm font-extrabold", green && "text-emerald-700", orange && "text-orange-700")}>{value}</div>
    </div>
  );
}

function PackageEditor({
  initial,
  busy,
  onClose,
  onChange,
  onSave,
}: {
  initial: Partial<TourPackage>;
  busy: boolean;
  onClose: () => void;
  onChange: (v: Partial<TourPackage>) => void;
  onSave: () => void;
}) {
  const f = { ...blank(), ...initial };
  const set = <K extends keyof TourPackage>(k: K, v: TourPackage[K]) => onChange({ ...f, [k]: v });
  const days = f.itinerary || [];
  const images = f.images || [];
  const stays = f.accommodations || [];
  const coupons = f.coupons || [];
  const deps = f.departures || [];
  const rules = f.cancellationRules || [];
  const trip = f.tripInfo || {};
  const updateDep = (i: number, patch: Partial<PackageDeparture>) =>
    set(
      "departures",
      deps.map((d, n) => (n === i ? { ...d, ...patch } : d)),
    );
  const addDeparture = () => {
    const last = [...deps].sort((a, b) => a.startDate.localeCompare(b.startDate)).pop();
    const start = last ? addDays(last.startDate, 7) : addDays(todayIST(), 14);
    const id = `${(f.slug || "trip").slice(0, 10)}-${start.replace(/-/g, "").slice(2)}`.replace(/[^a-z0-9-]/g, "");
    set("departures", [
      ...deps,
      {
        id,
        startDate: start,
        startTime: last?.startTime || "06:00",
        endDate: addDays(start, Math.max(0, (f.durationDays || 1) - 1)),
        endTime: last?.endTime || "19:00",
        seats: last?.seats || 12,
        price: null,
        status: "open",
        note: "",
      },
    ]);
  };
  const updateRule = (i: number, patch: Partial<CancellationRule>) =>
    set(
      "cancellationRules",
      rules.map((r, n) => (n === i ? { ...r, ...patch } : r)),
    );
  const updateDay = (i: number, patch: Partial<PackageDay>) =>
    set(
      "itinerary",
      days.map((d, n) => (n === i ? { ...d, ...patch } : d)),
    );
  const updateStay = (i: number, patch: Partial<PackageStay>) =>
    set(
      "accommodations",
      stays.map((d, n) => (n === i ? { ...d, ...patch } : d)),
    );
  const updateCoupon = (i: number, patch: Partial<PackageCoupon>) =>
    set(
      "coupons",
      coupons.map((d, n) => (n === i ? { ...d, ...patch } : d)),
    );
  const input = "h-10 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-brand";
  const area = "w-full rounded-xl border border-line bg-white px-3 py-2.5 text-sm leading-relaxed outline-none focus:border-brand";
  return (
    <div className="fixed inset-0 z-[95] flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onClick={onClose}>
      <div
        className="flex max-h-[96dvh] w-full max-w-4xl flex-col overflow-hidden rounded-t-[26px] bg-[#f5f6fa] shadow-2xl sm:max-h-[92vh] sm:rounded-[26px]"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="flex items-center justify-between border-b border-line bg-white px-5 py-4 sm:px-7">
          <div>
            <div className="text-[9px] font-extrabold uppercase tracking-[.18em] text-brand">Package editor</div>
            <h2 className="mt-0.5 text-lg font-extrabold">{initial.id ? `Edit ${initial.title}` : "Create a tour package"}</h2>
          </div>
          <button onClick={onClose} aria-label="Close editor" className="rounded-full border border-line p-2">
            <X className="h-4 w-4" />
          </button>
        </header>
        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <SectionTitle n="01" title="Trip identity" sub="The destination story travellers see first" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Package title">
                <input
                  className={input}
                  value={f.title || ""}
                  onChange={(e) => onChange({ ...f, title: e.target.value, slug: initial.id ? f.slug : slugify(e.target.value) })}
                  placeholder="Kedarnath mountain journey"
                />
              </Field>
              <Field label="URL slug">
                <input
                  className={input}
                  value={f.slug || ""}
                  onChange={(e) => set("slug", e.target.value as TourPackage["slug"])}
                  placeholder="kedarnath-4d"
                />
              </Field>
              <Field label="Short description" full>
                <input
                  className={input}
                  maxLength={320}
                  value={f.shortDescription || ""}
                  onChange={(e) => set("shortDescription", e.target.value as TourPackage["shortDescription"])}
                  placeholder="A quick, honest summary for package cards"
                />
              </Field>
              <Field label="Detailed description · Markdown" full>
                <textarea
                  className={`${area} min-h-32`}
                  value={f.detailedDescription || ""}
                  onChange={(e) => set("detailedDescription", e.target.value as TourPackage["detailedDescription"])}
                  placeholder="## The trip\nTell travellers what makes this journey special."
                />
              </Field>
              <Field label="Destinations · comma separated" full>
                <input
                  className={input}
                  value={(f.destinations || []).join(", ")}
                  onChange={(e) =>
                    set(
                      "destinations",
                      e.target.value
                        .split(",")
                        .map((v) => v.trim())
                        .filter(Boolean) as TourPackage["destinations"],
                    )
                  }
                  placeholder="Haridwar, Rudraprayag, Guptkashi, Kedarnath"
                />
              </Field>
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <SectionTitle n="02" title="Duration & pricing" sub="Show the full trip amount and payment plan clearly" />
            <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
              <Field label="Days">
                <input
                  type="number"
                  min={1}
                  className={input}
                  value={f.durationDays || 1}
                  onChange={(e) => set("durationDays", Number(e.target.value) as TourPackage["durationDays"])}
                />
              </Field>
              <Field label="Nights">
                <input
                  type="number"
                  min={0}
                  className={input}
                  value={f.durationNights || 0}
                  onChange={(e) => set("durationNights", Number(e.target.value) as TourPackage["durationNights"])}
                />
              </Field>
              <Field label="Original price · ₹">
                <input
                  type="number"
                  min={1}
                  className={input}
                  value={f.originalPrice || ""}
                  onChange={(e) => set("originalPrice", Number(e.target.value) as TourPackage["originalPrice"])}
                />
              </Field>
              <Field label="Offer price · ₹">
                <input
                  type="number"
                  min={1}
                  className={input}
                  value={f.discountedPrice || ""}
                  onChange={(e) => set("discountedPrice", Number(e.target.value) as TourPackage["discountedPrice"])}
                />
              </Field>
              <Field label="Pricing applies">
                <select className={input} value={f.pricingType} onChange={(e) => set("pricingType", e.target.value as TourPackage["pricingType"])}>
                  <option value="per_person">Per person</option>
                  <option value="per_couple">Per couple</option>
                </select>
              </Field>
              <Field label="Booking token · ₹ (0 = full payment)">
                <input
                  type="number"
                  min={0}
                  className={input}
                  value={f.upfrontTokenAmount || 0}
                  onChange={(e) => set("upfrontTokenAmount", Number(e.target.value) as TourPackage["upfrontTokenAmount"])}
                />
              </Field>
              <Field label="Price notes" full>
                <textarea
                  className={`${area} min-h-20`}
                  value={f.priceNotes || ""}
                  onChange={(e) => set("priceNotes", e.target.value as TourPackage["priceNotes"])}
                />
              </Field>
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle n="02b" title="Departures & schedule" sub="Fixed dates travellers can book — start and return day, date and time, seats per date" />
              <button onClick={addDeparture} className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-[10px] font-extrabold text-brand">
                <Plus className="h-3.5 w-3.5" /> Add departure
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Starts from (origin city)">
                <input className={input} value={trip.origin || ""} onChange={(e) => set("tripInfo", { ...trip, origin: e.target.value })} placeholder="Haridwar" />
              </Field>
              <Field label="Reporting point">
                <input className={input} value={trip.reportingPoint || ""} onChange={(e) => set("tripInfo", { ...trip, reportingPoint: e.target.value })} placeholder="Haridwar Railway Station, main gate" />
              </Field>
              <Field label="Drop-off on return">
                <input className={input} value={trip.returnPoint || ""} onChange={(e) => set("tripInfo", { ...trip, returnPoint: e.target.value })} placeholder="Haridwar Railway Station" />
              </Field>
              <Field label="Travel mode / meal plan">
                <div className="flex gap-2">
                  <input className={input} value={trip.travelMode || ""} onChange={(e) => set("tripInfo", { ...trip, travelMode: e.target.value })} placeholder="Mini Traveller + trek" />
                  <input className={input} value={trip.mealPlan || ""} onChange={(e) => set("tripInfo", { ...trip, mealPlan: e.target.value })} placeholder="Breakfast & dinner" />
                </div>
              </Field>
            </div>
            <div className="mt-4 space-y-2.5">
              {deps.length === 0 && (
                <p className="rounded-xl border border-dashed border-line bg-surface/60 px-4 py-3 text-xs text-muted">
                  No fixed departures yet — travellers will pick any date. Add departures to sell set dates with seats.
                </p>
              )}
              {deps.map((d, i) => (
                <div key={i} className={cn("rounded-xl border p-3", d.status === "open" ? "border-line bg-surface/50" : "border-dashed border-line bg-white opacity-70")}>
                  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                    <b className="text-xs">
                      Departure {i + 1}
                      {d.startDate && d.startDate <= todayIST() && <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-bold text-slate-500">past · hidden</span>}
                    </b>
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => updateDep(i, { status: d.status === "open" ? "closed" : "open" })}
                        className={cn("rounded-full px-2.5 py-1 text-[10px] font-extrabold", d.status === "open" ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-600")}
                      >
                        {d.status === "open" ? "Open for booking" : "Closed"}
                      </button>
                      <button onClick={() => set("departures", deps.filter((_, n) => n !== i))} aria-label="Remove departure" className="rounded-lg p-1.5 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    <Field label="Leave · date">
                      <input
                        type="date"
                        className={input}
                        value={d.startDate}
                        onChange={(e) => updateDep(i, { startDate: e.target.value, endDate: e.target.value ? addDays(e.target.value, Math.max(0, (f.durationDays || 1) - 1)) : d.endDate })}
                      />
                    </Field>
                    <Field label="Leave · time">
                      <input type="time" className={input} value={d.startTime} onChange={(e) => updateDep(i, { startTime: e.target.value })} />
                    </Field>
                    <Field label="Return · date">
                      <input type="date" min={d.startDate} className={input} value={d.endDate} onChange={(e) => updateDep(i, { endDate: e.target.value })} />
                    </Field>
                    <Field label="Return · time">
                      <input type="time" className={input} value={d.endTime} onChange={(e) => updateDep(i, { endTime: e.target.value })} />
                    </Field>
                    <Field label="Seats">
                      <input type="number" min={1} className={input} value={d.seats} onChange={(e) => updateDep(i, { seats: Math.max(1, Number(e.target.value) || 1) })} />
                    </Field>
                    <Field label="Price for this date · ₹ (blank = offer price)">
                      <input
                        type="number"
                        min={1}
                        className={input}
                        value={d.price ?? ""}
                        onChange={(e) => updateDep(i, { price: e.target.value ? Number(e.target.value) : null })}
                        placeholder={String(f.discountedPrice || "")}
                      />
                    </Field>
                    <Field label="Label (optional)">
                      <input className={input} maxLength={80} value={d.note || ""} onChange={(e) => updateDep(i, { note: e.target.value })} placeholder="Peak season" />
                    </Field>
                    <Field label="Id (internal)">
                      <input
                        className={input}
                        value={d.id}
                        onChange={(e) => updateDep(i, { id: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 24) })}
                      />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle n="03" title="Day-wise itinerary" sub="Dates are filled in from each departure (Day 1 = leave date); activity notes are comma separated" />
              <button
                onClick={() => set("itinerary", [...days, { dayNumber: days.length + 1, title: "", description: "", activityDetails: [] }])}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-[10px] font-extrabold text-brand"
              >
                <Plus className="h-3.5 w-3.5" /> Add day
              </button>
            </div>
            <div className="mt-4 space-y-3">
              {days.map((d, i) => (
                <div key={i} className="rounded-xl border border-line bg-surface/50 p-3">
                  <div className="mb-2 flex items-center justify-between">
                    <b className="text-xs">Day {i + 1}</b>
                    <button
                      onClick={() =>
                        set(
                          "itinerary",
                          days.filter((_, n) => n !== i).map((x, n) => ({ ...x, dayNumber: n + 1 })),
                        )
                      }
                      aria-label="Remove day"
                      className="rounded-lg p-1.5 text-red-600 hover:bg-red-50"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="grid gap-2">
                    <div className="grid gap-2 sm:grid-cols-[1fr_220px]">
                      <input className={input} value={d.title} onChange={(e) => updateDay(i, { title: e.target.value })} placeholder="Day title" />
                      <input
                        className={input}
                        maxLength={80}
                        value={d.time || ""}
                        onChange={(e) => updateDay(i, { time: e.target.value })}
                        placeholder="Time · e.g. 06:00 depart, 18:00 arrive"
                      />
                    </div>
                    <textarea
                      className={`${area} min-h-20`}
                      value={d.description}
                      onChange={(e) => updateDay(i, { description: e.target.value })}
                      placeholder="Describe the route and experience"
                    />
                    <input
                      className={input}
                      value={d.activityDetails.join(", ")}
                      onChange={(e) =>
                        updateDay(i, {
                          activityDetails: e.target.value
                            .split(",")
                            .map((x) => x.trim())
                            .filter(Boolean),
                        })
                      }
                      placeholder="Activities, transfer, meal notes…"
                    />
                  </div>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <div className="flex items-start justify-between gap-3">
              <SectionTitle n="04" title="Stays & media" sub="Add accommodation details, real photos and a tour video" />
              <button
                onClick={() => set("accommodations", [...stays, { hotelName: "", starRating: 3, roomType: "", amenities: [] }])}
                className="inline-flex shrink-0 items-center gap-1 rounded-lg bg-orange-50 px-3 py-2 text-[10px] font-extrabold text-brand"
              >
                <Plus className="h-3.5 w-3.5" /> Add stay
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Cover photo URL" full>
                <input
                  className={input}
                  value={f.coverPhoto || ""}
                  onChange={(e) => set("coverPhoto", e.target.value as TourPackage["coverPhoto"])}
                  placeholder="https://…"
                />
              </Field>
              <Field label="Video link · YouTube/Vimeo" full>
                <input
                  className={input}
                  value={f.videoLink || ""}
                  onChange={(e) => set("videoLink", e.target.value as TourPackage["videoLink"])}
                  placeholder="https://youtu.be/…"
                />
              </Field>
            </div>
            <div className="mt-3 space-y-2">
              {images.map((im, i) => (
                <div key={i} className="flex gap-2">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-orange-50 text-brand">
                    <ImagePlus className="h-4 w-4" />
                  </span>
                  <input
                    className={input}
                    value={im}
                    onChange={(e) =>
                      set(
                        "images",
                        images.map((x, n) => (n === i ? e.target.value : x)),
                      )
                    }
                    placeholder="Gallery image URL"
                  />
                  <button
                    onClick={() =>
                      set(
                        "images",
                        images.filter((_, n) => n !== i),
                      )
                    }
                    aria-label="Remove image"
                    className="rounded-lg p-2 text-red-600"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              ))}
              <button
                onClick={() => set("images", [...images, ""])}
                className="rounded-lg border border-dashed border-line px-3 py-2 text-[10px] font-bold text-muted"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Add gallery image
              </button>
            </div>
            <div className="mt-4 space-y-2">
              {stays.map((s, i) => (
                <div key={i} className="grid gap-2 rounded-xl border border-line p-3 sm:grid-cols-2">
                  <input
                    className={input}
                    value={s.hotelName}
                    onChange={(e) => updateStay(i, { hotelName: e.target.value })}
                    placeholder="Hotel / stay name"
                  />
                  <input className={input} value={s.city || ""} onChange={(e) => updateStay(i, { city: e.target.value })} placeholder="City" />
                  <input className={input} value={s.roomType} onChange={(e) => updateStay(i, { roomType: e.target.value })} placeholder="Room type" />
                  <div className="flex gap-2">
                    <select className={input} value={s.starRating} onChange={(e) => updateStay(i, { starRating: Number(e.target.value) })}>
                      {[1, 2, 3, 4, 5].map((x) => (
                        <option key={x} value={x}>
                          {x} star
                        </option>
                      ))}
                    </select>
                    <button
                      onClick={() =>
                        set(
                          "accommodations",
                          stays.filter((_, n) => n !== i),
                        )
                      }
                      className="rounded-lg p-2 text-red-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <input
                    className={`${input} sm:col-span-2`}
                    value={s.amenities.join(", ")}
                    onChange={(e) =>
                      updateStay(i, {
                        amenities: e.target.value
                          .split(",")
                          .map((x) => x.trim())
                          .filter(Boolean),
                      })
                    }
                    placeholder="Amenities, comma separated"
                  />
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <SectionTitle n="05" title="Inclusions, coupons & policy" sub="Keep exclusions and cancellation terms visible before checkout" />
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <Field label="Included · one per line">
                <textarea
                  className={`${area} min-h-24`}
                  value={(f.inclusions || []).join("\n")}
                  onChange={(e) =>
                    set(
                      "inclusions",
                      e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <Field label="Not included · one per line">
                <textarea
                  className={`${area} min-h-24`}
                  value={(f.exclusions || []).join("\n")}
                  onChange={(e) =>
                    set(
                      "exclusions",
                      e.target.value
                        .split("\n")
                        .map((x) => x.trim())
                        .filter(Boolean),
                    )
                  }
                />
              </Field>
              <div className="sm:col-span-2">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-[10px] font-extrabold uppercase tracking-wider text-muted">Cancellation charges · slabs</span>
                  <button
                    onClick={() => set("cancellationRules", [...rules, { daysBefore: 0, deductionPct: 100 }])}
                    className="inline-flex items-center gap-1 rounded-lg bg-orange-50 px-2.5 py-1.5 text-[10px] font-extrabold text-brand"
                  >
                    <Plus className="h-3 w-3" /> Add slab
                  </button>
                </div>
                <div className="space-y-2">
                  {rules.map((r, i) => (
                    <div key={i} className="flex flex-wrap items-center gap-2 rounded-xl border border-line bg-surface/50 px-3 py-2 text-xs font-semibold">
                      <span>Cancel</span>
                      <input
                        type="number"
                        min={0}
                        className="h-9 w-20 rounded-lg border border-line bg-white px-2 text-sm font-bold"
                        value={r.daysBefore}
                        onChange={(e) => updateRule(i, { daysBefore: Math.max(0, Number(e.target.value) || 0) })}
                      />
                      <span>or more days before departure →</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        className="h-9 w-20 rounded-lg border border-line bg-white px-2 text-sm font-bold"
                        value={r.deductionPct}
                        onChange={(e) => updateRule(i, { deductionPct: Math.min(100, Math.max(0, Number(e.target.value) || 0)) })}
                      />
                      <span>% deducted · {100 - r.deductionPct}% refunded</span>
                      <button onClick={() => set("cancellationRules", rules.filter((_, n) => n !== i))} aria-label="Remove slab" className="ml-auto rounded-lg p-1.5 text-red-600 hover:bg-red-50">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                  {rules.length > 0 && (
                    <p className="rounded-xl bg-sky-50 px-3 py-2 text-[11px] leading-relaxed text-sky-900">
                      Travellers see:{" "}
                      {sortedRules(rules)
                        .map((r, i, a) => (i === 0 ? `${r.daysBefore}+ days before → ${r.deductionPct}%` : `${r.daysBefore}–${a[i - 1].daysBefore - 1} days → ${r.deductionPct}%`))
                        .join(" · ")}
                      {sortedRules(rules).at(-1)?.daysBefore ? " · after that → 100%" : ""}
                    </p>
                  )}
                </div>
              </div>
              <Field label="Cancellation & date-change notes" full>
                <textarea
                  className={`${area} min-h-24`}
                  value={f.cancellationPolicy || ""}
                  onChange={(e) => set("cancellationPolicy", e.target.value as TourPackage["cancellationPolicy"])}
                />
              </Field>
              <Field label="Support name">
                <input
                  className={input}
                  value={f.supportContact?.name || ""}
                  onChange={(e) => set("supportContact", { ...f.supportContact, name: e.target.value })}
                />
              </Field>
              <Field label="Support email / phone">
                <div className="flex gap-2">
                  <input
                    className={input}
                    value={f.supportContact?.email || ""}
                    onChange={(e) => set("supportContact", { ...f.supportContact, email: e.target.value })}
                    placeholder="email"
                  />
                  <input
                    className={input}
                    value={f.supportContact?.phone || ""}
                    onChange={(e) => set("supportContact", { ...f.supportContact, phone: e.target.value })}
                    placeholder="phone"
                  />
                </div>
              </Field>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-extrabold">Package coupons</h3>
                <p className="text-[10px] text-muted">Coupon discounts are validated and calculated on the server.</p>
              </div>
              <button
                onClick={() => set("coupons", [...coupons, { code: "", discountType: "percentage", discountValue: 10, isActive: true }])}
                className="rounded-lg border border-line px-3 py-2 text-[10px] font-bold"
              >
                <Plus className="mr-1 inline h-3.5 w-3.5" /> Add coupon
              </button>
            </div>
            <div className="mt-2 space-y-2">
              {coupons.map((c, i) => (
                <div key={i} className="grid items-center gap-2 rounded-xl bg-surface p-2 sm:grid-cols-[1fr_130px_100px_auto_auto]">
                  <input
                    className={input}
                    value={c.code}
                    onChange={(e) => updateCoupon(i, { code: e.target.value.toUpperCase() })}
                    placeholder="CODE"
                  />
                  <select
                    className={input}
                    value={c.discountType}
                    onChange={(e) => updateCoupon(i, { discountType: e.target.value as PackageCoupon["discountType"] })}
                  >
                    <option value="percentage">Percent</option>
                    <option value="flat">Flat ₹</option>
                  </select>
                  <input
                    type="number"
                    className={input}
                    value={c.discountValue}
                    onChange={(e) => updateCoupon(i, { discountValue: Number(e.target.value) })}
                  />
                  <button
                    onClick={() => updateCoupon(i, { isActive: !c.isActive })}
                    className={cn(
                      "rounded-lg px-3 py-2 text-[10px] font-extrabold",
                      c.isActive ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500",
                    )}
                  >
                    {c.isActive ? "Active" : "Paused"}
                  </button>
                  <button
                    onClick={() =>
                      set(
                        "coupons",
                        coupons.filter((_, n) => n !== i),
                      )
                    }
                    className="rounded-lg p-2 text-red-600"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          </section>
          <section className="rounded-2xl border border-line bg-white p-4 sm:p-5">
            <SectionTitle n="06" title="Publish controls" sub="Drafts stay private until the package terms are ready" />
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <select className={`${input} max-w-48`} value={f.status} onChange={(e) => set("status", e.target.value as TourPackage["status"])}>
                <option value="draft">Draft · private</option>
                <option value="published">Published · bookable</option>
                <option value="archived">Archived</option>
              </select>
              <label className="inline-flex items-center gap-2 text-xs font-bold">
                <input
                  type="checkbox"
                  checked={!!f.featured}
                  onChange={(e) => set("featured", e.target.checked as TourPackage["featured"])}
                  className="accent-orange-500"
                />{" "}
                Feature on homepage
              </label>
            </div>
          </section>
        </div>
        <footer className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-white px-5 py-3 sm:px-7">
          <span className="text-[10px] text-muted">Changes save to SKYO&apos;s database.</span>
          <div className="flex gap-2">
            <button onClick={onClose} className="rounded-xl border border-line px-4 py-2 text-xs font-bold">
              Cancel
            </button>
            <button
              onClick={onSave}
              disabled={busy}
              className="inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand to-brand-2 px-4 py-2 text-xs font-extrabold text-white disabled:opacity-50"
            >
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
              {busy ? "Saving…" : initial.id ? "Save changes" : "Create package"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
function Field({ label, children, full }: { label: string; children: ReactNode; full?: boolean }) {
  return (
    <label className={cn("block min-w-0 text-[10px] font-extrabold uppercase tracking-wider text-muted", full && "sm:col-span-2")}>
      {label}
      <div className="mt-1.5 normal-case tracking-normal">{children}</div>
    </label>
  );
}
function SectionTitle({ n, title, sub }: { n: string; title: string; sub: string }) {
  return (
    <div>
      <div className="text-[9px] font-extrabold tracking-[.18em] text-brand">{n} / PACKAGE DETAILS</div>
      <h3 className="mt-1 text-sm font-extrabold">{title}</h3>
      <p className="mt-0.5 text-[10px] leading-relaxed text-muted">{sub}</p>
    </div>
  );
}
