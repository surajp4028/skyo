# SKYO — Travel booking platform (web)

Trains · Flights · Buses · Hotels · Packages. Next.js 16 (App Router) + MySQL/MariaDB (XAMPP / phpMyAdmin), raw SQL, no ORM, no auth library.

## Quick start

```bash
npm install
npm run db:setup       # fresh install: DB `skyo`, v2 tables, seeds admin@gmail.com / Password555@
npm run db:migrate-v2  # only for an existing v1 database (take a mysqldump first)
npm run dev            # http://localhost:3000
```

- Traveller login: http://localhost:3000/login (email **or** mobile → OTP, account auto-created)
- Full registration: http://localhost:3000/register (name + email OTP → mobile OTP → consent)
- Agent console: http://localhost:3000/login?as=agent → `/admin`

Config lives in `.env.local` (git-ignored). `.env.example` lists every key.
`OTP_DRY_RUN=true` (dev only) skips Fast2SMS/ZeptoMail and prints codes in the server console.

## Folder structure

```
src/
├─ proxy.ts                     # (Next 16 "middleware") CSP nonce, auth redirects
├─ app/
│  ├─ page.tsx                  # home (hero, 5-service search, offers, destinations…)
│  ├─ login/  register/  account/  privacy/  terms/
│  ├─ admin/                    # ⟵ ADMIN PAGES (separate)
│  │   layout.tsx, page.tsx, users/, users/[id]/, sessions/, audit/,
│  │   bookings/[service]/, staff/, settings/
│  └─ api/
│     ├─ auth/                  # otp/send, otp/verify, register/*, me, logout
│     ├─ account/               # profile, sessions (own devices)
│     ├─ public/settings        # site name etc. for any client (future mobile app)
│     └─ admin/                 # ⟵ ADMIN APIs (separate)
│         auth/*, stats, users, users/[id], sessions, bookings/[service],
│         staff, staff/[id], settings, audit
├─ components/
│  ├─ ui/                       # Aceternity-style: spotlight, aurora, flip-words,
│  │                            # moving-border, hover-effect, 3d-card, card-spotlight,
│  │                            # infinite-moving-cards, text-generate, animated-tabs, otp-input
│  ├─ site/                     # navbar, footer, search widget, home sections, account
│  ├─ auth/                     # login panel (Traveller | Agent), register flow, OTP step
│  └─ admin/                    # ⟵ ADMIN UI (separate): shell/sidebar, tables, views
└─ lib/
   ├─ permissions.ts            # permission catalog (admin vs staff)
   ├─ client/                   # fetch wrapper, providers (auth + site settings)
   └─ server/                   # server-only
      ├─ db.ts                  # mysql2 pool, query helpers (UTC)
      ├─ crypto.ts              # KMS envelope encryption, blind index, scrypt, tokens
      ├─ otp.ts  notify.ts      # OTP lifecycle, ZeptoMail + Fast2SMS
      ├─ session.ts             # user + agent sessions
      ├─ settings.ts  audit.ts  ratelimit.ts  request.ts  validators.ts  http.ts
      └─ admin/                 # ⟵ ADMIN queries + page guard (separate)
database/schema.sql             # v2 schema (db:setup applies it)
scripts/db-setup.mts            # fresh install + encrypted admin seed
scripts/migrate-v2.mts          # v1 → v2 re-encryption migration
```

## Security & compliance

| Area | What's implemented |
|---|---|
| Data at rest | **Every** personal value — customer & agent names, emails, phones, IPs, locations, devices, user-agents, audit details, booking trip/passenger data — is stored only as AWS KMS envelope ciphertext (AES-256-GCM). Full, unmasked values; decrypted in the app for authorised viewers. HMAC blind indexes allow exact search (SKYO ID, email, mobile, IP, full name). Rate-limit keys are hashed. |
| Customer ID | `SKYO` + 8 digits (e.g. `SKYO67682378`); bookings are mapped to it. |
| Contact change | Customers add/change email or mobile from My Account via OTP to the new value; values already used by another account are rejected. |
| Passwords | Agents only — scrypt (N=2¹⁵). Travellers are passwordless (OTP). |
| OTP | 6 digits, HMAC-hashed, 5-min TTL, 5 attempts (atomic), single use, resend cooldown, per-IP + per-identifier rate limits. |
| Sessions | 256-bit opaque tokens, only SHA-256 stored. Traveller: HttpOnly cookie, 180-day rolling ("logged in until logout"), profile snapshot in localStorage. Agent: browser-session cookie, 30-min idle + 12 h absolute, SameSite=Strict. |
| Web | Nonce CSP, HSTS, X-Frame-Options DENY, nosniff, Referrer & Permissions policy, CSRF (Origin + Sec-Fetch-Site + custom header). |
| Access control | Admin (all) / Staff (granular permissions) enforced on every API + page; admins see full PII, staff only with `users.contact`; force-logout per user or for everyone (typed confirmation); last-admin and self-demotion protection; lockout after 5 failed logins. |
| Audit | Logins, failures, lockouts, PII reveals, status/permission/settings changes. |
| DPDP 2023 | Consent captured with version + timestamp, privacy notice, grievance officer, device sign-out, masked PII by default in admin. |
| Mobile-ready | Send `X-Skyo-Client: android|ios` → APIs return a bearer token; use `Authorization: Bearer …`. |

## Trains — RailCore integration

Live data from [RailCore](https://railcore.tech/docs) (`RK_LIVE`, `RK_BASE_URL` in `.env.local`).

```
src/lib/server/train/
  config.ts      plan, daily cap, official credit price list per operation
  client.ts      the only code that calls RailCore: daily cap, balance floor, plan gate,
                 kill switch, request coalescing, documented retry policy, credit ledger
  service.ts     one function per RailCore v1 endpoint (stations, trains, journeys,
                 availability, fares, charts)
  guard.ts       /api/train/* wrapper: validation, login for live endpoints, rate limits
  validators.ts  station / train / class / quota / date contracts
  types.ts       typed RailCore schemas
src/lib/train/   client-safe helpers + major-station list
src/lib/server/train/stations-india.json  ~9,000 stations (datameet/railways, CC0) for 0-credit autocomplete
src/app/api/train/…        SKYO train API      src/app/trains/…   results, train detail, live status
postman/SKYO-Train-API.postman_collection.json + postman/train-api-curl.md
```

| Plan (Free) | 2,500 credits/month · 20 req/min · 300 req/day |
|---|---|
| Costs | trains-between 5 · seat availability 5 · live status 5 · calendar 4 · station board 4 · fares/classes 3 · schedule/coach 2 · search 1 |
| Guards | `RK_DAILY_CREDIT_CAP` (default 80/day, editable in Admin → Settings), kill switch, login for availability/live, per-user rate limits, chart endpoints blocked locally unless `RK_PLAN=scale` |
| Not available | PNR status (not in RailCore v1) · chart/vacant-berth endpoints (Scale plan) |
| Service switches | Admin → Settings → Services: Trains / Flights / Buses / Hotels / Packages and Train live status. Off = hidden from home, nav, dock, footer; pages show "unavailable"; APIs return 404. |

RailCore's terms forbid caching/mirroring their data, so nothing is cached — only a credit ledger (`rail_api_calls`) is stored. Usage is visible in Admin → Dashboard / Trains.

## Booking & payments (trains)

```
Book → POST /api/bookings/train/initiate   (browser sends WHAT to book — never the amount)
        server: live seat availability (RailCore, 5 credits) → price per passenger
                (incl. food = total_fare, excl. food = base fare) × passengers → paise
        → INSERT booking (SKT########, 15-min hold) → Razorpay POST /v1/orders → order_id
     → Razorpay Checkout (checkout.js) → user pays
     → POST /api/bookings/train/verify  HMAC(order_id|payment_id) with OUR stored order_id,
        then GET /v1/payments/{id} from Razorpay (amount + status must match)
     → POST /api/payments/razorpay/webhook   (source of truth in production;
        X-Razorpay-Signature over the raw body, de-duplicated by x-razorpay-event-id)
     → both paths are idempotent: first one to mark the booking paid issues the ticket
     → Tripgic issueTicket (PNR, ticket no., berth / RAC / WL) → My trips + PDF e-ticket
```

| Piece | Where |
|---|---|
| Razorpay order / fetch / capture / signatures | `src/lib/server/payments/razorpay.ts` |
| Request/response log (KMS-encrypted, ms timestamps) | `payment_logs` · `src/lib/server/payments/log.ts` · Admin → Transactions (`payments.view`) |
| Booking flow, pricing, idempotent confirm | `src/lib/server/booking/train-booking.ts` |
| Tripgic | `src/lib/server/booking/tripgic.ts` — `TRIPGIC_MODE=mock` until their API docs/keys arrive |
| Saved travellers (max from Admin → Settings, default 20) | `/account?tab=travellers` · `src/lib/server/booking/passengers.ts` |
| Sample PDF e-ticket | `GET /api/bookings/[ref]/ticket` · `src/lib/server/booking/ticket-pdf.ts` |

### Charges (Admin → Settings → Trains)

`src/lib/train/charges.ts` is the single formula used by the server (Razorpay order) and the booking sheet (preview):
ticket fare × passengers + IRCTC convenience fee per ticket (AC / non-AC × UPI / Card-NetBanking) + GST + SKYO service fee
per passenger + GST + optional travel insurance per passenger + payment-gateway % of all of that + GST on the gateway fee.
The customer picks UPI or Card/NetBanking before paying; Razorpay Checkout then shows only those methods.

### Coupons (Admin → Settings → Coupons, and on each customer's page)

WooCommerce-style: **percent** or **fixed ₹** off the **base fare**, the **SKYO service charge** or the **total**, or
**zero service fee**. Options: max discount (percent), minimum booking, uses per customer, total uses, start/expiry,
pause, and "only for SKYO ID" (personal codes such as `SKYOSURAJ10`). Defaults: `SKYO10` (10% off total, 5 per customer)
and `SKYOZERO` (service fee ₹0) — they can be paused/edited but not deleted. "Max coupons" (default 20) caps how many exist.

The discount is applied in `src/lib/train/charges.ts` before gateway charges. At booking the server validates the code
first (before any RailCore credit is spent), then reserves it under a row lock (`coupon_redemptions`); it counts as used
once the payment is captured, and a reservation is freed automatically when the 15-minute hold expires unpaid.
Admins see used / pending / left / total discount and "who used it"; customers see offers (incl. personal ones) in the booking sheet.

### Refunds, retries & notifications

- **Automatic refund** — if a paid booking can't be ticketed (or the amount doesn't match), the full amount is refunded
  via Razorpay (`POST /v1/payments/{id}/refund`) and the customer gets an email (and SMS when no DLT template is set).
- **Agent actions** (permission `payments.refund`) in the booking panel: **Refund** (full or partial, with reason),
  **Retry ticketing** (paid + ticket failed + nothing refunded yet), **Resend SMS / email**.
  "Re-check with Razorpay" pulls every refund on the payment (`GET /v1/payments/{id}/refunds`, incl. Dashboard refunds).
  Webhook events `refund.created` / `refund.processed` / `refund.failed` are matched to the booking by payment id and
  re-read from Razorpay before being trusted. A booking shows "refunded" only once Razorpay has **processed** it.
- **Admin → Disputes / Refunds** lists every payment without a valid ticket (ticket failed, paid > 10 min after the hold,
  amount mismatch) and every refund, with Needs action / Refund pending / Refunded filters.
- Late payments (> 10 min after the 15-minute hold) are never ticketed — they're refunded automatically. Razorpay
  Checkout also gets a `timeout` equal to the time left on the hold.
- Refunds are stored in `refunds`; customers see them in My trips and My account → Transactions. Total refunded can never
  exceed the amount paid; a full refund releases a reserved coupon.
- Unpaid bookings 30 minutes past their 15-minute hold become "cancelled" automatically.
- Booking SMS needs a Fast2SMS **DLT template** (`FAST2SMS_BOOKING_TEMPLATE_ID`, variables `ref|pnr|amount`) — the
  Quick SMS route is disabled on the current account. Email goes to the account email, or the e-ticket email given at booking.

### GST, billing state & invoices

- **GST details (optional)** — customers add them in My account → Profile or on the booking sheet. Admin → Settings →
  Travellers → "GST details input": **fetch** (GSTIN → Digio lookup, `DIGIO_BASE_URL` + `DIGIO_AUTH`, same API as the
  iMoney project), **manual**, or **both**. GSTINs are checksum-validated; data is KMS-encrypted (`user_gst`); every
  Digio call is logged in Transactions as provider `digio`. Admins see it on the customer's page.
- **Billing state** (+ optional pincode / address) — collapsed section on the booking sheet, also in Profile;
  "Detect my state" uses the free ipwho.is lookup. Stored per booking and sent to Tripgic with the auto-upgradation choice.
- **Invoice** — `GET /api/bookings/[ref]/invoice`: logo, billed-to (GST company or customer), every charge, SKYO total,
  GST, payment / order IDs and times. Without GST it works as a receipt alongside the e-ticket.
- **IRCTC ticket** — when Tripgic returns the real ticket PDF (`ticketPdfBase64`), it is stored at
  `<SKYO ID>/train/<ref>_<date>_irctc.pdf` and an "IRCTC ticket" button appears next to the e-ticket.

### Agent profile

`/admin/profile` — every agent can change their display name, password (other sessions are signed out) and photo
(`<prefix>admins/ADM<id>/profile_<4 digits>.<ext>`). The photo shows in the console header and sidebar.
Customer photos show in Admin → Users and on each customer's page.

### Files on S3 (private, served only through SKYO APIs)

```
<SKYO_S3_PREFIX><SKYO ID>/profile_<4 digits>.<jpg|png|webp>     profile photo (POST/GET/DELETE /api/account/avatar)
<SKYO_S3_PREFIX><SKYO ID>/train/<booking ref>_<YYYYMMDD>.pdf    e-ticket (uploaded right after issue)
```
`SKYO_S3_PREFIX` defaults to `AWS_BUCKET_FOLDER + "skyo/"`. Objects use SSE-KMS (`AWS_KMS_KEY_ID`), falling back to SSE-S3.

### Double validation & reconciliation

- Webhook: signature check **and** a fresh `GET /v1/payments/{id}` — only Razorpay's own record confirms a booking.
- Checkout: signature over our stored order id, then the same API fetch.
- Admin → Train bookings → open a booking → **Re-check with Razorpay** (`GET /v1/orders/{id}/payments`) syncs every attempt
  and confirms a captured payment SKYO missed.
- Every attempt is stored in `payment_attempts` (customer sees it in My account → Transactions; admin sees the full payload).

### Notifications after ticketing

SMS via Fast2SMS (`FAST2SMS_BOOKING_TEMPLATE_ID` for DLT, otherwise Quick SMS text) and email via Resend
(`RESEND_API_KEY`, `RESEND_FROM`) with the PDF attached. Both are logged in Transactions as `notify.sms` / `notify.email`.
`OTP_DRY_RUN=true` (dev) logs them without sending.

**Env (`.env.local`)**: `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, `TRIPGIC_MODE`, `TRIPGIC_BASE_URL`, `TRIPGIC_API_KEY`.

**Razorpay Dashboard → Webhooks**: URL `https://<your-domain>/api/payments/razorpay/webhook`, secret = `RAZORPAY_WEBHOOK_SECRET`,
events `payment.captured`, `payment.failed`, `order.paid`. Razorpay can't call `localhost` — for local testing expose the app
with a tunnel (e.g. `zrok share public http://localhost:3000`) and use that https URL; without it the Checkout verify path
still confirms bookings.

**Test mode**: domestic test card `5267 3181 8797 5449`, any future expiry/CVV, any OTP. (`4111 1111 1111 1111` is treated as an
international card and fails if international payments aren't enabled.) Cashfree is not implemented.

## Flights — aviationstack integration

**Provider.** [aviationstack](https://docs.apilayer.com/aviationstack/docs/aviationstack-api-v-1-0-0) gives flight
**schedules and live status** — not fares or seat inventory. `AVIATION_KEY` lives only in `.env.local` and is used only by
`src/lib/server/flight/aviationstack.ts` (never logged, never sent to the browser).

**Free plan = 100 requests / month** (real-time `/v1/flights` + catalog endpoints; `flightsFuture`, `timetable`, `routes`,
historical and autocomplete need Basic). How SKYO stays inside it:

| Guard | Where |
|---|---|
| One request = a whole route's daily schedule (`/flights?dep_iata&arr_iata&limit=100`), cached in `flight_routes` for `flight_cache_hours` (default 7 days) and projected onto any date | `flight/search.ts` |
| Codeshare rows folded into the operating flight (≈ 2/3 of rows on Indian routes) | `normalizeRoute()` |
| Monthly cap (`flight_monthly_cap`, default 95) counted from the ledger; errors aren't billed by aviationstack and aren't counted | `aviationstack.ts` |
| Kill switch `flight_api`, plan gate for paid-only endpoints (`AVIATION_PLAN`) | `aviationstack.ts` |
| New routes per visitor per day: 2 anonymous / 6 logged-in; identical requests coalesced | `/api/flight/search` |
| Connections built only from cached hub legs (0 requests) unless `flight_connection_fetch` > 0 | `searchFlights()` |
| Live status: login only, 12/hour per user, cached per flight `flight_live_cache_min` | `flight/status.ts` |
| Dev mode `flight_dev_single_result` (default on) shows 1 result | Settings → Flights / usage card toggle |

Every call is stored in `flight_api_calls` (endpoint, params without the key, status, rows, latency, reason, full response
encrypted). Admin → Bookings → Flights and Settings → Flights show the meter, why requests were spent, cached routes
(refresh = 1 request, drop = free) and each call's full response.

**Times.** aviationstack stamps local airport time as `+00:00` — SKYO reads the clock time as local and converts with the
airport's IANA zone for durations.

**Fares (until Tripgic sends real ones).** `src/lib/flight/model.ts` — base + per-km, full-service premium, business /
international multipliers, days-to-departure curve, peak-hour premium, ±7 % per flight, connection discount; then airport
fees, GST (5 % economy / 12 % business), seat fees, SKYO service fee + GST, insurance, coupon, gateway fee + GST — all
admin-editable with a live preview. The server always re-prices; the browser only previews.

**Travellers.** Type by age at booking: adult 12+, child 2–11 (base fare − `flight_child_discount_pct`, default 10 %,
gets a seat), infant under 2 (on an adult's lap: flat `flight_infant_fee`, default ₹1,500, no seat, no airport fee). At least
one adult per booking and at most one infant per adult. Search carries `adults`, `children`, `infants`.

**Connections.** 1- and 2-stop itineraries are built from EVERY cached route (0 requests; minimum connection 70 min,
maximum wait 12 h). A route with no direct flight looks for connections automatically on its first search (max 3
requests, stops at the first hub that works, skips onward legs when the first leg has no flights, never uses the last 10
requests of the period); travellers can also press "Find connecting flights" (max 4, login, 3/day). Hubs are ranked by
detour — abroad, big international hubs (PEK, ICN, DXB, IST, FRA…) first. Small airports get a "fly to the nearest major
airport instead" suggestion (same country first, e.g. Ulaangom → Ulaanbaatar). Routes with no flights are re-checked
after 24 h (small airports fly only on some days). Airports: ~7,900 worldwide from the open mwgg/Airports dataset (MIT),
searchable by city, code, airport or country.

**International trips.** When any leg leaves India the booking sheet asks each traveller's passport number, expiry and
nationality; the server rejects missing / expired passports. Stored only inside the encrypted booking details and shown
masked to agents without the contact permission.

**Retention.** `runFlightMaintenance()` (every 6 h, piggy-backing on searches; or Admin → Flights usage card → "Clean up
old data"): aviationstack responses cleared after `flight_log_retention_days` (30), request rows deleted after
`flight_log_keep_days` (365), live-status cache after 2 days, dead seat holds released, old empty routes dropped.
The request meter counts from `flight_quota_reset_day` — the day your aviationstack plan renews.

**Seats.** Aircraft layout by airline + distance (A320/A321 3-3, Air India with business 2-2, ATR 2-2, 787/777 wide-body),
occupancy that rises towards departure, plus seats held on SKYO (`flight_seat_holds`, unique per flight/date/seat, held in
the same transaction as the booking). Window / aisle / middle / front / extra-legroom prices; unpicked seats are auto-assigned
free at ticketing.

**Booking.** `POST /api/bookings/flight/initiate` → Razorpay order (same verify / webhook / refund / disputes pipeline as trains,
refs `SKT…`) → `issueFlightForBooking()` (Tripgic **mock**: PNR, airline PNR per segment, e-ticket numbers, seats) → flight
e-ticket PDF to S3 `<SKYO ID>/flight/<ref>_<date>.pdf`, SMS + email. Coupons can target `flight`; seeded `SKYOFLY` (₹300 off).

**Pages.** `/flights` results (filters, sort, date strip, flight details) → booking sheet (travellers → dark seat map →
review & pay) · `/flights/status` live tracking with route map · My trips flight cards with seats, e-ticket, invoice, Track live.

**Postman.** `postman/SKYO-Flights.postman_collection.json` (every aviationstack v1 endpoint with all parameters + SKYO
flight / admin APIs) and `postman/SKYO-local.postman_environment.json` — put your key in the environment's
`aviationstack_key`, not in the collection.

> The free plan is "non-commercial use". Move to aviationstack Basic (10,000 requests, `flightsFuture`) before going live.

## Pages

`/` home · `/flights` flight results · `/flights/status` live flight status · `/trains` results (route/live/coaches drawer) · `/trains/[number]` train page · `/trains/live` train tools
(live status, station board, vacant berths, unreserved fare) · `/account` · `/about` · `/contact` (encrypted inbox → Admin → Messages)

## Still to do

- Tripgic live API (`TRIPGIC_MODE=live`) — waiting for their docs/keys; train and flight ticketing are mocked.
- Flights: real fares + live seat inventory come from Tripgic; aviationstack Basic plan for `flightsFuture` (exact future schedules) and commercial use.
- Infant (under 2) flight bookings.
- Refund flow when payment succeeds but ticket issue fails (booking is marked `failed`, refund is manual today).
- Fast2SMS DLT template / sender (`FAST2SMS_SENDER_ID`, `FAST2SMS_TEMPLATE_ID`) and ZeptoMail templates are copied from the iMoney project — register SKYO-branded ones before launch.
- Have Privacy Policy / Terms reviewed by counsel.
