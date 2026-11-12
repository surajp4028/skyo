"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AnimatePresence, motion } from "motion/react";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Copy,
  FileText,
  Heart,
  MapPin,
  Mountain,
  Share2,
  ShieldCheck,
  Sparkles,
  Ticket,
  Users,
  BusFront,
  X,
} from "lucide-react";
import type { PackageDay, PackageDeparture, TourPackage } from "@/lib/packages";
import { addDays, cancellationAt, cancellationWindows, packageQuote, todayIST, upcomingDepartures, withDeparturePrice } from "@/lib/packages";
import { api, ClientApiError, errMsg } from "@/lib/client/api";
import { openCheckout } from "@/lib/client/razorpay";
import { useAuth } from "@/lib/client/providers";
import { KedarnathRouteMap, type PackageGeoProp } from "./route-map";
import { TravellerSheet, type TripTraveller } from "./traveller-sheet";
import { cn } from "@/lib/utils";

type Tab = "Overview" | "Itinerary" | "Stays" | "Inclusions" | "Cancellation";
const TABS: Tab[] = ["Overview", "Itinerary", "Stays", "Inclusions", "Cancellation"];
const inr = (n: number) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(n);
/** "2027-05-14" → "Fri, 14 May" (+ year when asked). Dates are calendar dates, so format in UTC. */
const fmtDay = (d: string, year = false) =>
  new Date(`${d}T00:00:00Z`).toLocaleDateString("en-IN", { timeZone: "UTC", weekday: "short", day: "numeric", month: "short", ...(year ? { year: "numeric" } : {}) });
const fmtTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
};
const today = () => new Date(Date.now() + 330 * 60_000).toISOString().slice(0, 10);
type Quote =
  | {
      valid: true;
      units: number;
      original: number;
      subtotal: number;
      discount: number;
      total: number;
      upfront: number;
      remaining: number;
      couponCode: string | null;
    }
  | { valid: false; error: string };

export function PackageDetail({ pkg, geo = null, availability = {} }: { pkg: TourPackage; geo?: PackageGeoProp; availability?: Record<string, number> }) {
  const { user } = useAuth();
  const router = useRouter();
  const [tab, setTab] = useState<Tab>("Overview");
  const [photo, setPhoto] = useState(0);
  const [day, setDay] = useState(1);
  const [date, setDate] = useState("");
  // fixed departures set by the admin; the first one with seats is pre-selected
  const departures = upcomingDepartures(pkg);
  const hasDepartures = (pkg.departures || []).length > 0;
  const [depId, setDepId] = useState<string>(() => departures.find((d) => (availability[d.id] ?? d.seats) > 0)?.id || "");
  const dep: PackageDeparture | null = departures.find((d) => d.id === depId) || null;
  const priced = withDeparturePrice(pkg, dep);
  const seatsLeft = dep ? (availability[dep.id] ?? dep.seats) : null;
  const trip = pkg.tripInfo || {};
  const [guests, setGuests] = useState(1);
  // never ask for more travellers than the chosen departure has seats
  const maxGuests = Math.max(1, Math.min(12, seatsLeft ?? 12));
  const guestsShown = Math.min(guests, maxGuests);
  const [coupon, setCoupon] = useState("");
  const [applied, setApplied] = useState("");
  const [quote, setQuote] = useState<Quote>(() => packageQuote(pkg, 1));
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [success, setSuccess] = useState<{ ref: string; voucher: string; invoice: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [mobileBookingOpen, setMobileBookingOpen] = useState(false);
  const [travellerSheet, setTravellerSheet] = useState(false);
  const photos = [pkg.coverPhoto, ...pkg.images].filter(Boolean);
  const isKedarnath = /kedarnath/i.test(pkg.slug);
  const video = videoEmbed(pkg.videoLink);
  const remaining = quote.valid ? quote.remaining : 0;
  const share = async () => {
    const url = window.location.href;
    try {
      if (navigator.share) await navigator.share({ title: pkg.title, text: pkg.shortDescription, url });
      else {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      }
    } catch {
      try {
        await navigator.clipboard.writeText(url);
        setCopied(true);
        window.setTimeout(() => setCopied(false), 1800);
      } catch {
        toast.error("Could not copy this link.");
      }
    }
  };

  useEffect(() => {
    let live = true;
    const timer = window.setTimeout(() => {
      setQuoteLoading(true);
      api<{ quote: Exclude<typeof quote, { valid: false }> }>("/api/packages/quote", {
        body: { slug: pkg.slug, guests: guestsShown, couponCode: applied, departureId: depId || undefined },
      })
        .then((r) => live && setQuote(r.quote))
        .catch((e) => live && setQuote({ valid: false, error: errMsg(e) }))
        .finally(() => live && setQuoteLoading(false));
    }, 150);
    return () => {
      live = false;
      window.clearTimeout(timer);
    };
  }, [pkg.slug, guestsShown, applied, depId]);

  // step 1: logged in + date chosen → "Who's travelling?"; step 2 (book) runs from that sheet
  const startBooking = () => {
    if (!user) {
      toast.info("Log in to book — we'll bring you right back.");
      router.push(`/login?next=${encodeURIComponent(`/packages/${pkg.slug}`)}`);
      return;
    }
    if (hasDepartures ? !dep : !date) {
      toast.error("Choose your travel date first.");
      return;
    }
    setMobileBookingOpen(false);
    setTravellerSheet(true);
  };

  const book = async (travellers: TripTraveller[]) => {
    setBusy(true);
    try {
      const order = await api<{ bookingRef: string; checkout: Record<string, unknown> }>("/api/payments/order", {
        body: {
          slug: pkg.slug,
          travelDate: dep ? dep.startDate : date,
          departureId: dep?.id,
          guests: guestsShown,
          travellers,
          couponCode: applied,
          paymentType: "upfront",
        },
      });
      await openCheckout(order.checkout, {
        failurePath: null,
        onSuccess: async (resp) => {
          try {
            const result = await api<{ result: { bookingRef: string; remainingPaise: number; voucherUrl: string; invoiceUrl: string } }>(
              "/api/payments/verify",
              { body: { bookingRef: order.bookingRef, ...resp } },
            );
            setTravellerSheet(false);
            setSuccess({ ref: result.result.bookingRef, voucher: result.result.voucherUrl, invoice: result.result.invoiceUrl });
            toast.success("Your tour booking is confirmed.");
          } catch (e) {
            toast.error(errMsg(e));
          }
          setBusy(false);
        },
        onFailed: (failure) => {
          toast.error(failure.error.description || "Payment failed.");
          setBusy(false);
        },
        onDismiss: () => setBusy(false),
      });
    } catch (e) {
      if (e instanceof ClientApiError && e.status === 401) router.push(`/login?next=${encodeURIComponent(`/packages/${pkg.slug}`)}`);
      else toast.error(errMsg(e));
      setBusy(false);
    }
  };

  const bookingWidget = (compact = false) => (
    <div
      className={cn(
        "rounded-[26px] border border-line bg-white p-5 shadow-[0_22px_60px_-35px_rgba(20,35,65,.42)] sm:p-6",
        compact && "border-0 p-0 shadow-none",
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-bold text-muted">
            {pkg.pricingType === "per_person" ? "Price per person" : "Price per couple"}{" "}
            <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wide text-emerald-700">
              Best available
            </span>
          </div>
          <div className="mt-1 flex items-baseline gap-2">
            <span className="text-3xl font-black tracking-tight text-ink">{inr(priced.discountedPrice)}</span>
            {priced.originalPrice > priced.discountedPrice && (
              <span className="text-sm font-semibold text-muted line-through">{inr(priced.originalPrice)}</span>
            )}
          </div>
        </div>
        <div className="rounded-2xl bg-orange-50 p-2.5 text-brand">
          <Ticket className="h-5 w-5" />
        </div>
      </div>
      {pkg.priceNotes && (
        <p className="mt-3 rounded-xl bg-amber-50 px-3 py-2 text-[11px] leading-relaxed text-amber-900">{pkg.priceNotes}</p>
      )}
      {hasDepartures ? (
        <div className="mt-4">
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-muted">
            Departure
            <select
              value={depId}
              onChange={(e) => setDepId(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
            >
              {!departures.length && <option value="">No upcoming departures</option>}
              {departures.map((d) => {
                const left = availability[d.id] ?? d.seats;
                return (
                  <option key={d.id} value={d.id} disabled={left <= 0}>
                    {fmtDay(d.startDate)} → {fmtDay(d.endDate, true)} · {left > 0 ? `${left} seats` : "Full"}
                  </option>
                );
              })}
            </select>
          </label>
          {dep && (
            <div className="mt-2 grid grid-cols-2 gap-2 rounded-xl bg-surface p-2.5 text-[11px]">
              <div>
                <div className="font-bold uppercase tracking-wider text-muted">Leave</div>
                <div className="font-extrabold text-ink">{fmtDay(dep.startDate)}</div>
                <div className="text-muted">{fmtTime(dep.startTime)}{trip.origin ? ` · ${trip.origin}` : ""}</div>
              </div>
              <div>
                <div className="font-bold uppercase tracking-wider text-muted">Return</div>
                <div className="font-extrabold text-ink">{fmtDay(dep.endDate)}</div>
                <div className="text-muted">{fmtTime(dep.endTime)}{trip.returnPoint ? ` · ${trip.returnPoint}` : ""}</div>
              </div>
            </div>
          )}
        </div>
      ) : null}
      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {!hasDepartures && (
          <label className="block text-[10px] font-extrabold uppercase tracking-wider text-muted">
            Travel date
            <input
              type="date"
              min={today()}
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
            />
          </label>
        )}
        <label className="block text-[10px] font-extrabold uppercase tracking-wider text-muted">
          Travellers
          <select
            value={guestsShown}
            onChange={(e) => setGuests(Number(e.target.value))}
            className="mt-1.5 h-11 w-full rounded-xl border border-line bg-white px-3 text-sm font-semibold text-ink outline-none focus:border-brand"
          >
            {Array.from({ length: maxGuests }, (_, i) => i + 1).map((n) => (
              <option key={n} value={n}>
                {n} {n === 1 ? "guest" : "guests"}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="mt-3 flex items-center gap-2.5 rounded-xl bg-surface px-3 py-2.5 text-[11px] leading-snug text-muted">
        <Users className="h-4 w-4 shrink-0 text-brand" />
        {user ? (
          <span>Next you&apos;ll add <b className="text-ink">{guestsShown} traveller name{guestsShown === 1 ? "" : "s"}</b> — pick from your saved travellers in one tap.</span>
        ) : (
          <span><b className="text-ink">Log in to book</b> — your saved travellers fill in automatically.</span>
        )}
      </div>
      <div className="mt-3 flex gap-2">
        <input
          value={coupon}
          onChange={(e) => setCoupon(e.target.value.toUpperCase())}
          placeholder="Coupon code"
          className="h-11 min-w-0 flex-1 rounded-xl border border-line px-3 text-sm font-semibold uppercase outline-none focus:border-brand"
        />
        <button
          type="button"
          onClick={() => setApplied(coupon.trim())}
          disabled={!coupon.trim()}
          className="rounded-xl border border-brand/30 px-3 text-xs font-extrabold text-brand disabled:opacity-40"
        >
          Apply
        </button>
      </div>
      {quote.valid && (
        <div className="mt-4 space-y-2 border-t border-dashed border-line pt-4 text-xs">
          <div className="flex justify-between text-muted">
            <span>
              {pkg.pricingType === "per_couple"
                ? `${quote.units} couple rate${quote.units === 1 ? "" : "s"}`
                : `${guestsShown} traveller${guestsShown === 1 ? "" : "s"}`}{" "}
              × {inr(priced.discountedPrice)}
            </span>
            <span>{inr(quote.subtotal)}</span>
          </div>
          {quote.discount > 0 && (
            <div className="flex justify-between font-semibold text-emerald-700">
              <span>Coupon savings{quote.couponCode ? ` · ${quote.couponCode}` : ""}</span>
              <span>−{inr(quote.discount)}</span>
            </div>
          )}
          <div className="flex justify-between border-t border-line pt-2 text-sm font-extrabold text-ink">
            <span>Total trip price</span>
            <span>{inr(quote.total)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Pay now · booking token</span>
            <span className="font-bold text-ink">{inr(quote.upfront)}</span>
          </div>
          <div className="flex justify-between text-muted">
            <span>Pay later</span>
            <span className="font-bold text-ink">{inr(remaining)}</span>
          </div>
        </div>
      )}
      {!quote.valid && applied && <p className="mt-2 text-xs font-semibold text-red-600">{quote.error}</p>}
      <button
        type="button"
        onClick={startBooking}
        disabled={busy || quoteLoading || !quote.valid || (hasDepartures && (!dep || !seatsLeft))}
        className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[#ff5a1f] to-[#ff8734] text-sm font-extrabold text-white shadow-[0_12px_30px_-12px_rgba(255,90,31,.7)] transition hover:-translate-y-0.5 hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-60"
      >
        {busy ? (
          <span className="animate-pulse">Opening secure checkout…</span>
        ) : (
          <>
            Book this trip <ArrowRight className="h-4 w-4" />
          </>
        )}
      </button>
      <div className="mt-3 flex items-center justify-center gap-1.5 text-[10px] font-medium text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> Secure Razorpay checkout · price shown before payment
      </div>
      {user && (
        <div className="mt-3 rounded-xl bg-surface px-3 py-2 text-[10px] leading-relaxed text-muted">
          Booking as <b className="text-ink">{user.name || user.email || user.phone}</b>. We&apos;ll save this trip in your SKYO account.
        </div>
      )}
    </div>
  );

  const facts = [
    { icon: Clock3, label: "Duration", value: `${pkg.durationDays} days · ${pkg.durationNights} nights`, tone: "bg-sky-50 text-sky-700" },
    { icon: Users, label: "Price is", value: pkg.pricingType === "per_person" ? "Per person" : "Per couple · 2 guests", tone: "bg-orange-50 text-brand" },
    departures[0]
      ? { icon: CalendarDays, label: "Next departure", value: fmtDay(departures[0].startDate, true), tone: "bg-violet-50 text-violet-700" }
      : { icon: MapPin, label: "Route", value: `${pkg.destinations.length} stops`, tone: "bg-violet-50 text-violet-700" },
    trip.origin
      ? { icon: MapPin, label: "Starts from", value: trip.origin, tone: "bg-emerald-50 text-emerald-700" }
      : isKedarnath
      ? { icon: BusFront, label: "Travel by", value: "Mini Traveller + trek", tone: "bg-emerald-50 text-emerald-700" }
      : { icon: CalendarDays, label: "Itinerary", value: `${pkg.itinerary.length} planned days`, tone: "bg-emerald-50 text-emerald-700" },
  ];
  useEffect(() => {
    // warm the next and previous photo so arrows feel instant
    for (const d of [1, -1]) {
      const src = photos[(photo + d + photos.length) % Math.max(1, photos.length)];
      if (src) new window.Image().src = src;
    }
  }, [photo, photos]);

  return (
    <main className="-mt-20 min-h-screen bg-[linear-gradient(180deg,#dcecff_0px,#eef6ff_260px,#f6f7fb_620px)] pb-28 pt-20 text-ink lg:pb-14">
      <div className="mx-auto max-w-7xl px-4 pt-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between py-3">
          <Link href="/packages" className="inline-flex items-center gap-2 rounded-full bg-white/70 px-3 py-1.5 text-xs font-bold text-ink/70 ring-1 ring-line backdrop-blur transition hover:text-ink">
            <ArrowLeft className="h-4 w-4" /> All trips
          </Link>
          <button
            onClick={share}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-line bg-white px-3.5 text-xs font-bold text-ink shadow-sm transition hover:border-brand/30 hover:text-brand"
          >
            <Share2 className="h-4 w-4" />
            {copied ? "Link copied" : "Share trip"}
            <Copy className="ml-0.5 h-3.5 w-3.5 text-muted" />
          </button>
        </div>

        {/* title block — light, no overlay */}
        <motion.header initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45 }} className="pt-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-white px-3 py-1 text-[11px] font-bold text-brand shadow-soft ring-1 ring-orange-100">
              <Sparkles className="h-3.5 w-3.5" /> SKYO curated journey
            </span>
            <span className="rounded-full bg-sky-50 px-3 py-1 text-[11px] font-extrabold text-sky-700 ring-1 ring-sky-100">
              {pkg.durationDays}D / {pkg.durationNights}N
            </span>
            {pkg.featured && <span className="rounded-full bg-amber-100 px-3 py-1 text-[11px] font-extrabold text-amber-800">★ Popular</span>}
          </div>
          <h1 className="mt-3 max-w-3xl text-3xl font-lux font-bold leading-[1.1] tracking-[-0.01em] sm:text-[40px]">{pkg.title}</h1>
          <div className="mt-2 flex flex-wrap items-center gap-x-1.5 gap-y-1 text-sm font-semibold text-ink/70">
            <MapPin className="h-4 w-4 text-brand" />
            {pkg.destinations.map((d, i) => (
              <span key={d} className="inline-flex items-center gap-1.5">
                {d}
                {i < pkg.destinations.length - 1 && <ArrowRight className="h-3 w-3 text-ink/30" />}
              </span>
            ))}
          </div>
          <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted sm:text-base">{pkg.shortDescription}</p>
        </motion.header>

        {/* gallery — bright photos, arrows + swipe, shimmer while each photo loads */}
        <section className="mt-5 grid h-[300px] grid-cols-1 gap-2.5 sm:h-[420px] md:grid-cols-[2fr_1fr_1fr] md:grid-rows-2">
          <div className="group relative overflow-hidden rounded-[26px] bg-sky-100 md:row-span-2">
            <GalleryPhoto src={photos[photo] || pkg.coverPhoto} alt={`${pkg.title} — photo ${photo + 1}`} onSwipe={(d) => setPhoto((photo + d + photos.length) % Math.max(1, photos.length))} />
            {photos.length > 1 && (
              <>
                {[-1, 1].map((d) => (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setPhoto((photo + d + photos.length) % photos.length)}
                    aria-label={d < 0 ? "Previous photo" : "Next photo"}
                    className={cn(
                      "absolute top-1/2 z-10 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-full bg-white/90 text-ink shadow-lg backdrop-blur transition hover:scale-105 hover:bg-white sm:opacity-0 sm:group-hover:opacity-100",
                      d < 0 ? "left-3" : "right-3",
                    )}
                  >
                    {d < 0 ? <ChevronLeft className="h-5 w-5" /> : <ChevronRight className="h-5 w-5" />}
                  </button>
                ))}
                <span className="absolute bottom-3 left-3 z-10 flex gap-1.5 rounded-full bg-white/85 px-2.5 py-1.5 shadow backdrop-blur">
                  {photos.map((_, i) => (
                    <button key={i} type="button" onClick={() => setPhoto(i)} aria-label={`Photo ${i + 1}`} className={cn("h-1.5 rounded-full transition-all", i === photo ? "w-5 bg-brand" : "w-1.5 bg-ink/25 hover:bg-ink/50")} />
                  ))}
                </span>
              </>
            )}
            <span className="absolute bottom-3 right-3 z-10 rounded-full bg-white/85 px-3 py-1.5 text-[11px] font-bold text-ink shadow backdrop-blur">
              {photo + 1} / {photos.length} photos
            </span>
          </div>
          {photos.slice(1, 5).map((src, k) => (
            <button
              key={src + k}
              type="button"
              onClick={() => setPhoto(k + 1)}
              aria-label={`Show photo ${k + 2}`}
              className={cn("relative hidden overflow-hidden rounded-[20px] bg-sky-100 md:block", photo === k + 1 && "ring-[3px] ring-brand ring-offset-2 ring-offset-[#eef6ff]")}
            >
              <GalleryPhoto src={src} alt="" thumb />
              {k === 3 && photos.length > 5 && (
                <span className="absolute inset-0 flex items-center justify-center bg-ink/40 text-sm font-extrabold text-white">+{photos.length - 5} more</span>
              )}
            </button>
          ))}
          {photos.length < 5 &&
            Array.from({ length: 5 - Math.max(1, photos.length) }).map((_, k) => (
              <div key={`fill${k}`} className="hidden items-center justify-center rounded-[20px] bg-gradient-to-br from-sky-100 to-orange-50 text-xs font-bold text-ink/40 md:flex">
                <Mountain className="mr-1.5 h-4 w-4" /> More photos soon
              </div>
            ))}
        </section>

        {/* quick facts */}
        <div className="mt-4 grid grid-cols-2 gap-2.5 md:grid-cols-4">
          {facts.map((f) => (
            <div key={f.label} className="flex items-center gap-3 rounded-2xl bg-white p-3 shadow-soft ring-1 ring-line">
              <span className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl", f.tone)}>
                <f.icon className="h-[18px] w-[18px]" />
              </span>
              <div className="min-w-0">
                <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{f.label}</div>
                <div className="text-[13px] font-extrabold leading-tight sm:text-sm">{f.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-6 grid gap-6 lg:grid-cols-[minmax(0,1fr)_370px] lg:gap-8">
          <div className="min-w-0">
            {hasDepartures && (
              <section className="mb-6 rounded-[26px] border border-line bg-white p-5 shadow-soft sm:p-6">
                <div className="flex flex-wrap items-end justify-between gap-2">
                  <div>
                    <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
                      <CalendarDays className="h-3.5 w-3.5" /> Fixed departures
                    </div>
                    <h2 className="mt-1.5 text-xl font-lux font-bold tracking-[-0.01em]">Pick your departure</h2>
                  </div>
                  <span className="text-xs font-semibold text-muted">{departures.length} upcoming {departures.length === 1 ? "date" : "dates"}</span>
                </div>
                <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
                  {departures.length === 0 && <p className="text-sm text-muted sm:col-span-2">No upcoming departures right now — new dates are added soon.</p>}
                  {departures.map((d) => {
                    const left = availability[d.id] ?? d.seats;
                    const on = d.id === depId;
                    const full = left <= 0;
                    return (
                      <button
                        key={d.id}
                        type="button"
                        disabled={full}
                        onClick={() => setDepId(d.id)}
                        className={cn(
                          "relative rounded-2xl border p-3.5 text-left transition",
                          on ? "border-brand bg-orange-50/60 shadow-[0_10px_30px_-18px_rgba(255,90,31,.8)]" : "border-line bg-white hover:border-brand/40",
                          full && "cursor-not-allowed opacity-50",
                        )}
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm font-extrabold">
                            {fmtDay(d.startDate)} → {fmtDay(d.endDate)}
                          </span>
                          <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-extrabold", full ? "bg-slate-100 text-slate-500" : left <= 4 ? "bg-rose-50 text-rose-600" : "bg-emerald-50 text-emerald-700")}>
                            {full ? "Full" : left <= 4 ? `Only ${left} left` : `${left} seats`}
                          </span>
                        </div>
                        <div className="mt-1.5 grid grid-cols-2 gap-2 text-[11px] text-muted">
                          <span>
                            <b className="text-ink">Leave</b> {fmtTime(d.startTime)}
                          </span>
                          <span>
                            <b className="text-ink">Back</b> {fmtTime(d.endTime)}
                          </span>
                        </div>
                        <div className="mt-2 flex items-center justify-between text-[11px]">
                          <span className="font-semibold text-muted">{d.note || new Date(`${d.startDate}T00:00:00Z`).getUTCFullYear()}</span>
                          <span className="font-extrabold text-ink">
                            {inr(d.price || pkg.discountedPrice)} <span className="font-semibold text-muted">/ {pkg.pricingType === "per_person" ? "person" : "couple"}</span>
                          </span>
                        </div>
                        {on && <Check className="absolute -right-1.5 -top-1.5 h-5 w-5 rounded-full bg-brand p-0.5 text-white" />}
                      </button>
                    );
                  })}
                </div>
                {(trip.reportingPoint || trip.travelMode || trip.mealPlan) && (
                  <div className="mt-4 grid gap-2 rounded-2xl bg-surface p-3 text-xs sm:grid-cols-2 lg:grid-cols-4">
                    {[
                      ["Reporting point", trip.reportingPoint],
                      ["Drop-off", trip.returnPoint],
                      ["Travel mode", trip.travelMode],
                      ["Meals", trip.mealPlan],
                    ]
                      .filter(([, v]) => v)
                      .map(([k, v]) => (
                        <div key={k}>
                          <div className="text-[10px] font-bold uppercase tracking-wider text-muted">{k}</div>
                          <div className="font-bold text-ink">{v}</div>
                        </div>
                      ))}
                  </div>
                )}
              </section>
            )}
            {pkg.destinations.length > 1 && <KedarnathRouteMap destinations={pkg.destinations} itinerary={pkg.itinerary} geo={geo} />}

            <div className="mt-6 rounded-[24px] border border-line bg-white p-1.5 shadow-soft">
              <div className="no-scrollbar flex gap-1 overflow-x-auto">
                {TABS.map((t) => (
                  <button
                    key={t}
                    onClick={() => setTab(t)}
                    className={cn(
                      "shrink-0 rounded-[17px] px-4 py-3 text-xs font-extrabold transition sm:px-6",
                      tab === t ? "bg-gradient-to-r from-brand to-brand-2 text-white shadow-[0_8px_20px_-10px_rgba(255,90,31,.9)]" : "text-muted hover:bg-surface hover:text-ink",
                    )}
                  >
                    {t}
                    {t === "Itinerary" && <span className="ml-1.5 opacity-60">{pkg.itinerary.length}</span>}
                  </button>
                ))}
              </div>
            </div>
            {video && (
              <section className="mt-4 overflow-hidden rounded-[26px] border border-line bg-white p-4 shadow-soft sm:p-5">
                <div className="mb-3 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-brand" />
                  <h2 className="text-sm font-extrabold">See the journey</h2>
                </div>
                <div className="aspect-video overflow-hidden rounded-2xl bg-ink">
                  <iframe
                    src={video}
                    title={`${pkg.title} video`}
                    className="h-full w-full"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    allowFullScreen
                    referrerPolicy="strict-origin-when-cross-origin"
                  />
                </div>
              </section>
            )}
            <section className="mt-4 min-h-[250px] rounded-[26px] border border-line bg-white p-5 shadow-soft sm:p-8">
              {tab === "Overview" && (
                <>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
                    <Sparkles className="h-3.5 w-3.5" /> The experience
                  </div>
                  <h2 className="mt-2 text-2xl font-lux font-bold tracking-[-0.01em]">A little more than a getaway</h2>
                  <Markdown text={pkg.detailedDescription} />
                  <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {pkg.destinations.map((d, i) => (
                      <div key={d} className="rounded-2xl bg-[#f7f8fc] p-4">
                        <span className="text-[10px] font-extrabold uppercase tracking-widest text-brand">STOP 0{i + 1}</span>
                        <div className="mt-1 font-extrabold">{d}</div>
                        <div className="mt-1 text-[11px] text-muted">
                          {i === 0
                            ? "Your journey begins"
                            : i === pkg.destinations.length - 1
                              ? "The highlight of the trip"
                              : "A memorable halt"}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              )}
              {tab === "Itinerary" && (
                <>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
                    <CalendarDays className="h-3.5 w-3.5" /> Day by day
                  </div>
                  <h2 className="mt-2 text-2xl font-lux font-bold tracking-[-0.01em]">The journey, thoughtfully paced</h2>
                  {dep && (
                    <p className="mt-1 text-xs font-semibold text-muted">
                      Dates for the {fmtDay(dep.startDate, true)} departure · leave {fmtTime(dep.startTime)}
                      {trip.origin ? ` from ${trip.origin}` : ""}, back {fmtDay(dep.endDate)} {fmtTime(dep.endTime)}
                    </p>
                  )}
                  <div className="mt-5 space-y-2.5">
                    {pkg.itinerary.map((d) => (
                      <ItineraryDay
                        key={d.dayNumber}
                        item={d}
                        date={dep ? fmtDay(addDays(dep.startDate, d.dayNumber - 1)) : null}
                        open={day === d.dayNumber}
                        onClick={() => setDay(day === d.dayNumber ? 0 : d.dayNumber)}
                      />
                    ))}
                  </div>
                </>
              )}
              {tab === "Stays" && (
                <>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
                    <Mountain className="h-3.5 w-3.5" /> Places to rest
                  </div>
                  <h2 className="mt-2 text-2xl font-lux font-bold tracking-[-0.01em]">Stays & accommodation</h2>
                  {pkg.accommodations.length ? (
                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      {pkg.accommodations.map((s, i) => (
                        <div key={i} className="rounded-2xl border border-line p-4">
                          <div className="flex items-center justify-between">
                            <h3 className="font-extrabold">{s.hotelName}</h3>
                            <span className="text-amber-500">{"★".repeat(s.starRating)}</span>
                          </div>
                          <p className="mt-1 text-xs text-muted">
                            {s.city ? `${s.city} · ` : ""}
                            {s.roomType}
                          </p>
                          <div className="mt-3 flex flex-wrap gap-1.5">
                            {s.amenities.map((a) => (
                              <span key={a} className="rounded-full bg-surface px-2.5 py-1 text-[10px] font-semibold text-muted">
                                {a}
                              </span>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-relaxed text-amber-950">
                      {pkg.priceNotes || "Accommodation details are being confirmed. Please check what is included before you pay."}
                    </div>
                  )}
                </>
              )}
              {tab === "Inclusions" && (
                <>
                  <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
                    <ShieldCheck className="h-3.5 w-3.5" /> Know before you go
                  </div>
                  <h2 className="mt-2 text-2xl font-lux font-bold tracking-[-0.01em]">What&apos;s included in your trip</h2>
                  <div className="mt-5 grid gap-5 sm:grid-cols-2">
                    <InclusionList title="Included" items={pkg.inclusions} good />
                    <InclusionList title="Not included" items={pkg.exclusions} />
                  </div>
                </>
              )}
              {tab === "Cancellation" && (
                <CancellationTab pkg={pkg} dep={dep} total={quote.valid ? quote.total : priced.discountedPrice} />
              )}
            </section>
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <ShieldCheck className="h-4 w-4 text-emerald-600" /> Your payment, protected
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  Pay securely with Razorpay. Your booking reference, payment status and documents stay in your SKYO account.
                </p>
              </div>
              <div className="rounded-2xl border border-line bg-white p-4">
                <div className="flex items-center gap-2 text-sm font-extrabold">
                  <Heart className="h-4 w-4 text-brand" /> Need a hand?
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-muted">
                  {pkg.supportContact?.name || "SKYO Package Desk"} · {pkg.supportContact?.email || "support@skyo.in"}
                  {pkg.supportContact?.phone ? ` · ${pkg.supportContact.phone}` : ""}
                </p>
              </div>
            </div>
          </div>
          <aside className="hidden lg:block">
            <div className="sticky top-24">{bookingWidget()}</div>
          </aside>
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/60 bg-white/90 p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))] shadow-[0_-12px_38px_-24px_rgba(10,15,31,.3)] backdrop-blur-xl lg:hidden">
        <div className="mx-auto flex max-w-7xl items-center gap-3">
          <div className="min-w-0 flex-1">
            <div className="text-[10px] font-semibold text-muted">
              From · {pkg.pricingType === "per_person" ? "per person" : "per couple"}
            </div>
            <div className="truncate text-xl font-black">
              {inr(pkg.discountedPrice)}{" "}
              <span className="text-[10px] font-bold text-muted">/ {pkg.pricingType === "per_person" ? "person" : "couple"}</span>
            </div>
          </div>
          <button
            onClick={() => setMobileBookingOpen(true)}
            disabled={busy}
            className="flex h-12 min-w-[156px] items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-brand to-brand-2 px-5 text-sm font-extrabold text-white shadow-lg disabled:opacity-60"
          >
            Book this trip
            <ArrowRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      {mobileBookingOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-end bg-ink/45 p-0 backdrop-blur-sm lg:hidden"
          onClick={() => setMobileBookingOpen(false)}
        >
          <div
            className="max-h-[90dvh] w-full overflow-y-auto rounded-t-[28px] bg-[#f6f7fb] p-4 pb-[calc(1rem+env(safe-area-inset-bottom))]"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="mx-auto mb-3 flex max-w-md items-center justify-between">
              <div>
                <div className="text-[10px] font-extrabold uppercase tracking-[.18em] text-brand">Book your trip</div>
                <h2 className="mt-0.5 text-lg font-extrabold">Choose date & travellers</h2>
              </div>
              <button onClick={() => setMobileBookingOpen(false)} aria-label="Close booking" className="rounded-full bg-white p-2">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="mx-auto max-w-md rounded-[26px] border border-line bg-white p-4 shadow-xl">{bookingWidget(true)}</div>
          </div>
        </div>
      )}
      {travellerSheet && user && (
        <TravellerSheet
          guests={guestsShown}
          me={{ name: user.name, email: user.email, phone: user.phone }}
          busy={busy}
          priceLabel={quote.valid ? inr(quote.upfront) : ""}
          onClose={() => !busy && setTravellerSheet(false)}
          onContinue={book}
        />
      )}
      {success && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-[#071326]/65 p-4 backdrop-blur-sm">
          <motion.div
            initial={{ opacity: 0, y: 14, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            className="w-full max-w-md rounded-[28px] bg-white p-6 text-center shadow-2xl sm:p-8"
          >
            <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-50 text-emerald-600">
              <Check className="h-7 w-7" />
            </span>
            <div className="mt-4 text-[10px] font-extrabold uppercase tracking-[.2em] text-emerald-700">You&apos;re going places</div>
            <h2 className="mt-2 text-2xl font-lux font-bold">Booking confirmed</h2>
            <p className="mt-2 text-sm text-muted">
              Reference <b className="font-mono text-ink">{success.ref}</b>. You can find every detail in My Trips.
            </p>
            <div className="mt-5 grid grid-cols-2 gap-2">
              <a
                href={success.voucher}
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-ink px-3 py-3 text-xs font-extrabold text-white"
              >
                <Mountain className="h-4 w-4" />
                Voucher PDF
              </a>
              <a
                href={success.invoice}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-line px-3 py-3 text-xs font-extrabold"
              >
                <FileText className="h-4 w-4" />
                Invoice PDF
              </a>
            </div>
            <Link
              href="/account#trips"
              className="mt-3 inline-flex w-full justify-center rounded-xl bg-surface px-4 py-3 text-xs font-bold"
            >
              Go to My Trips
            </Link>
          </motion.div>
        </div>
      )}
    </main>
  );
}

function ItineraryDay({ item, open, onClick, date }: { item: PackageDay; open: boolean; onClick: () => void; date?: string | null }) {
  return (
    <article
      className={cn(
        "overflow-hidden rounded-2xl border transition",
        open ? "border-orange-200 bg-orange-50/60" : "border-line bg-white hover:border-ink/15",
      )}
    >
      <button onClick={onClick} className="flex w-full items-center gap-3 p-4 text-left">
        <span
          className={cn(
            "flex h-11 w-11 shrink-0 flex-col items-center justify-center rounded-xl text-[9px] font-extrabold uppercase",
            open ? "bg-brand text-white" : "bg-surface text-muted",
          )}
        >
          <span>DAY</span>
          <span className="text-base leading-none">{String(item.dayNumber).padStart(2, "0")}</span>
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {date && <span className="rounded-md bg-sky-50 px-1.5 py-0.5 text-[10px] font-extrabold text-sky-700">{date}</span>}
            {item.time && <span className="rounded-md bg-surface px-1.5 py-0.5 text-[10px] font-bold text-ink/70">{item.time}</span>}
          </span>
          <span className="mt-1 block text-sm font-extrabold">{item.title}</span>
          <span className="mt-0.5 block truncate text-xs text-muted">{item.description}</span>
        </span>
        <ChevronDown className={cn("h-4 w-4 shrink-0 text-muted transition", open && "rotate-180")} />
      </button>
      {open && (
        <div className="border-t border-orange-100 px-4 pb-4 pl-[4.5rem]">
          <p className="pt-3 text-sm leading-relaxed text-ink/75">{item.description}</p>
          {item.activityDetails.length > 0 && (
            <ul className="mt-3 space-y-2">
              {item.activityDetails.map((a) => (
                <li key={a} className="flex gap-2 text-xs leading-relaxed text-muted">
                  <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-brand" />
                  {a}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </article>
  );
}
function InclusionList({ title, items, good = false }: { title: string; items: string[]; good?: boolean }) {
  return (
    <div className="rounded-2xl border border-line p-4">
      <h3 className="font-extrabold">{title}</h3>
      {items.length ? (
        <ul className="mt-3 space-y-2.5">
          {items.map((x, i) => (
            <li key={i} className="flex gap-2 text-sm leading-relaxed">
              <span
                className={cn(
                  "mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
                  good ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-600",
                )}
              >
                <Check className="h-3 w-3" />
              </span>
              {x}
            </li>
          ))}
        </ul>
      ) : (
        <p className="mt-2 text-sm text-muted">No details listed. Please ask us before booking.</p>
      )}
    </div>
  );
}
function Markdown({ text }: { text: string }) {
  return (
    <div className="mt-3 space-y-2 text-sm leading-relaxed text-ink/70">
      {text
        .split("\n")
        .filter(Boolean)
        .map((line, i) => {
          const clean = line.replace(/^#{1,4}\s/, "").replace(/^[-*]\s/, "");
          return (
            <p key={i}>
              {clean.split(/(\*\*.*?\*\*)/g).map((part, j) =>
                part.startsWith("**") && part.endsWith("**") ? (
                  <strong key={j} className="font-extrabold text-ink">
                    {part.slice(2, -2)}
                  </strong>
                ) : (
                  part
                ),
              )}
            </p>
          );
        })}
    </div>
  );
}
function videoEmbed(value: string | null) {
  if (!value) return null;
  try {
    const u = new URL(value);
    if (u.hostname === "youtu.be") return `https://www.youtube-nocookie.com/embed/${u.pathname.slice(1)}`;
    if (u.hostname.endsWith("youtube.com")) {
      const id = u.searchParams.get("v") || u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://www.youtube-nocookie.com/embed/${id}` : null;
    }
    if (u.hostname.endsWith("vimeo.com")) {
      const id = u.pathname.split("/").filter(Boolean).pop();
      return id ? `https://player.vimeo.com/video/${id}` : null;
    }
  } catch {}
  return null;
}

function CancellationTab({ pkg, dep, total }: { pkg: TourPackage; dep: PackageDeparture | null; total: number }) {
  const rules = pkg.cancellationRules || [];
  const rows = dep ? cancellationWindows(rules, dep.startDate) : [];
  const now = dep ? cancellationAt(rules, dep.startDate, todayIST()) : null;
  const plain = (d: string) => fmtDay(d, true);
  return (
    <>
      <div className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[.2em] text-brand">
        <ShieldCheck className="h-3.5 w-3.5" /> If plans change
      </div>
      <h2 className="mt-2 text-2xl font-lux font-bold tracking-[-0.01em]">Cancellation charges</h2>
      {rules.length ? (
        <>
          <p className="mt-1 text-xs font-semibold text-muted">
            {dep ? `For the ${plain(dep.startDate)} departure · refunds on a trip price of ${inr(total)}` : "Pick a departure to see exact dates."}
          </p>
          {now && (
            <div className={cn("mt-4 flex items-center gap-3 rounded-2xl p-3.5 text-sm", now.deductionPct >= 100 ? "bg-rose-50 text-rose-800" : "bg-emerald-50 text-emerald-800")}>
              <ShieldCheck className="h-5 w-5 shrink-0" />
              <span>
                Cancel today ({now.daysLeft} days before): <b>{now.deductionPct}% deducted</b>, refund <b>{inr(Math.round((total * (100 - now.deductionPct)) / 100))}</b>
              </span>
            </div>
          )}
          <div className="mt-4 overflow-hidden rounded-2xl border border-line">
            <table className="w-full text-left text-sm">
              <thead className="bg-surface text-[10px] uppercase tracking-wider text-muted">
                <tr>
                  <th className="px-4 py-2.5">When you cancel</th>
                  <th className="px-4 py-2.5">Deduction</th>
                  <th className="px-4 py-2.5 text-right">You get back</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {(dep ? rows : [...rules].sort((a, b) => b.daysBefore - a.daysBefore).map((r, i, a) => ({ ...r, upTo: i ? a[i - 1].daysBefore - 1 : null, fromDate: null, toDate: "" }))).map((r) => (
                  <tr key={r.daysBefore}>
                    <td className="px-4 py-3">
                      <div className="font-bold text-ink">
                        {r.upTo == null ? `${r.daysBefore}+ days before` : r.daysBefore === r.upTo ? `${r.daysBefore} days before` : `${r.daysBefore}–${r.upTo} days before`}
                        {r.daysBefore === 0 && r.upTo != null ? " (or on the day)" : ""}
                      </div>
                      {dep && "toDate" in r && r.toDate && (
                        <div className="text-[11px] text-muted">{r.fromDate ? `${plain(r.fromDate)} – ${plain(r.toDate)}` : `On or before ${plain(r.toDate)}`}</div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className={cn("rounded-full px-2.5 py-1 text-xs font-extrabold", r.deductionPct >= 100 ? "bg-rose-50 text-rose-700" : r.deductionPct >= 50 ? "bg-amber-50 text-amber-700" : "bg-emerald-50 text-emerald-700")}>
                        {r.deductionPct}%
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right font-extrabold">{inr(Math.round((total * (100 - r.deductionPct)) / 100))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[11px] text-muted">No-show or cancelling after departure: no refund. Refunds go back to the original payment method.</p>
        </>
      ) : (
        <p className="mt-3 text-sm text-muted">Cancellation charges are shared before you pay.</p>
      )}
      {pkg.cancellationPolicy && (
        <div className="mt-5 rounded-2xl bg-surface p-4">
          <h3 className="font-extrabold">Cancellation & date-change notes</h3>
          <p className="mt-1 whitespace-pre-line text-sm leading-relaxed text-muted">{pkg.cancellationPolicy}</p>
        </div>
      )}
    </>
  );
}

/** A photo that shows a shimmer until it has loaded, then fades in; the main one can be swiped. */
function GalleryPhoto({ src, alt, thumb, onSwipe }: { src: string; alt: string; thumb?: boolean; onSwipe?: (dir: number) => void }) {
  const [loaded, setLoaded] = useState<string | null>(null);
  const ready = loaded === src;
  const imgRef = useRef<HTMLImageElement | null>(null);
  // a cached photo can finish loading before React attaches onLoad — check `complete` too, and never hide a photo forever
  useEffect(() => {
    const id = requestAnimationFrame(() => {
      const el = imgRef.current;
      if (el && el.complete && el.naturalWidth > 0) setLoaded(src);
    });
    const t = setTimeout(() => setLoaded(src), 4000);
    return () => {
      cancelAnimationFrame(id);
      clearTimeout(t);
    };
  }, [src]);
  return (
    <>
      {!ready && (
        <span aria-hidden className="absolute inset-0 overflow-hidden bg-gradient-to-br from-sky-100 via-white to-orange-50">
          <span className="absolute inset-0 -translate-x-full animate-[shimmer-x_1.4s_ease-in-out_infinite] bg-gradient-to-r from-transparent via-white/80 to-transparent" />
          {!thumb && <Mountain className="absolute left-1/2 top-1/2 h-8 w-8 -translate-x-1/2 -translate-y-1/2 text-sky-300" />}
        </span>
      )}
      <AnimatePresence initial={false}>
        <motion.img
          key={src}
          ref={imgRef}
          src={src}
          alt={alt}
          draggable={false}
          onLoad={() => setLoaded(src)}
          initial={{ opacity: 0, scale: thumb ? 1 : 1.04 }}
          animate={{ opacity: ready ? 1 : 0, scale: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          drag={onSwipe ? "x" : false}
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.25}
          onDragEnd={(_, info) => {
            if (onSwipe && Math.abs(info.offset.x) > 60) onSwipe(info.offset.x < 0 ? 1 : -1);
          }}
          className={cn("absolute inset-0 h-full w-full select-none object-cover", thumb ? "transition duration-700 hover:scale-105" : "cursor-grab active:cursor-grabbing")}
        />
      </AnimatePresence>
    </>
  );
}
