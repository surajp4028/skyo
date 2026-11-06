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

## Still to do

- Train search / booking integration (IRCTC partner) — UI & `bookings` table are ready.
- Fast2SMS DLT template / sender (`FAST2SMS_SENDER_ID`, `FAST2SMS_TEMPLATE_ID`) and ZeptoMail templates are copied from the iMoney project — register SKYO-branded ones before launch.
- Have Privacy Policy / Terms reviewed by counsel.
