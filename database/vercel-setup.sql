-- ============================================================================
-- SKYO — setup for a fresh / older database (e.g. the Vercel deployment's DB)
-- Run the whole file once in MySQL Workbench (Query → Execute All, ⚡).
-- Safe to re-run: every statement is CREATE TABLE IF NOT EXISTS — existing tables and data are NOT touched.
-- Part 1 = all base tables (database/schema.sql). Part 2 = tour packages, with departures / trip info /
-- cancellation slabs already included. No sample packages — import them with Admin → Packages → Import CSV.
-- ============================================================================

SET NAMES utf8mb4;

-- ---------------------------------------------------------------- Part 1 · base tables
-- =====================================================================
-- SKYO — MySQL / MariaDB schema v2 (utf8mb4, InnoDB)
-- Apply with:  npm run db:setup     (fresh install, seeds admin)
-- Upgrade v1:  npm run db:migrate-v2 (backs up + re-encrypts existing data)
--
-- Encryption model
--   * Every personal / business value is stored ONLY as AWS-KMS envelope
--     ciphertext (*_enc columns, AES-256-GCM, data key from KMS) — full,
--     unmasked values; decryption happens in the app for authorised viewers.
--   * *_bidx columns are HMAC-SHA256 blind indexes for exact-match lookups.
--   * OTPs, session tokens and passwords are one-way hashes.
--   * Plain columns are limited to ids, statuses, enums, money, dates.
-- =====================================================================

CREATE TABLE IF NOT EXISTS schema_meta (
  meta_key   VARCHAR(64) NOT NULL PRIMARY KEY,
  meta_value VARCHAR(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(64)  NOT NULL PRIMARY KEY,
  setting_value TEXT         NULL,
  updated_by    INT UNSIGNED NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Customers. Public id = SKYO + 8 digits (e.g. SKYO67682378).
-- Bookings reference this id.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid                 CHAR(12)     NOT NULL,
  name_enc            TEXT         NULL,
  name_bidx           CHAR(64)     NULL,
  email_enc           TEXT         NULL,
  email_bidx          CHAR(64)     NULL,
  email_verified_at   DATETIME     NULL,
  phone_enc           TEXT         NULL,
  phone_bidx          CHAR(64)     NULL,
  phone_verified_at   DATETIME     NULL,
  status              ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  signup_method       ENUM('register','otp_login') NOT NULL DEFAULT 'otp_login',
  consent_at          DATETIME     NULL,
  consent_version     VARCHAR(16)  NULL,
  signup_ip_enc       TEXT         NULL,
  last_login_at       DATETIME     NULL,
  last_login_ip_enc   TEXT         NULL,
  last_login_ip_bidx  CHAR(64)     NULL,
  last_location_enc   TEXT         NULL,
  last_device_enc     TEXT         NULL,
  avatar_key_enc      TEXT         NULL,
  avatar_updated_at   DATETIME     NULL,
  billing_enc         TEXT         NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_uid (uid),
  UNIQUE KEY uq_users_email (email_bidx),
  UNIQUE KEY uq_users_phone (phone_bidx),
  KEY idx_users_name (name_bidx),
  KEY idx_users_ip (last_login_ip_bidx),
  KEY idx_users_status (status),
  KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Agents: admin (full access) + staff (permission based)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id                  INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name_enc            TEXT         NOT NULL,
  email_enc           TEXT         NOT NULL,
  email_bidx          CHAR(64)     NOT NULL,
  password_hash       VARCHAR(255) NOT NULL,
  role                ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  permissions         JSON         NULL,
  status              ENUM('active','inactive') NOT NULL DEFAULT 'active',
  failed_attempts     INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until        DATETIME     NULL,
  last_login_at       DATETIME     NULL,
  last_login_ip_enc   TEXT         NULL,
  password_changed_at DATETIME     NULL,
  avatar_key_enc      TEXT         NULL,
  avatar_updated_at   DATETIME     NULL,
  created_by          INT UNSIGNED NULL,
  created_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at          TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admins_email (email_bidx)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sessions (opaque token; only SHA-256 stored)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  token_hash      CHAR(64)      NOT NULL,
  ip_enc          TEXT          NULL,
  ip_bidx         CHAR(64)      NULL,
  location_enc    TEXT          NULL,
  user_agent_enc  TEXT          NULL,
  device_enc      TEXT          NULL,
  client          ENUM('web','android','ios') NOT NULL DEFAULT 'web',
  login_method    VARCHAR(32)   NULL,
  created_at      DATETIME      NOT NULL,
  last_seen_at    DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  revoked_at      DATETIME      NULL,
  revoked_reason  VARCHAR(64)   NULL,
  UNIQUE KEY uq_user_sessions_token (token_hash),
  KEY idx_user_sessions_user (user_id, revoked_at),
  KEY idx_user_sessions_ip (ip_bidx),
  KEY idx_user_sessions_created (created_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id        INT UNSIGNED  NOT NULL,
  token_hash      CHAR(64)      NOT NULL,
  ip_enc          TEXT          NULL,
  ip_bidx         CHAR(64)      NULL,
  location_enc    TEXT          NULL,
  user_agent_enc  TEXT          NULL,
  device_enc      TEXT          NULL,
  created_at      DATETIME      NOT NULL,
  last_seen_at    DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  revoked_at      DATETIME      NULL,
  revoked_reason  VARCHAR(64)   NULL,
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY idx_admin_sessions_admin (admin_id, revoked_at),
  KEY idx_admin_sessions_ip (ip_bidx),
  CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- OTP challenges (HMAC hashed code, attempt-limited, single use)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_challenges (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  challenge_id    CHAR(32)      NOT NULL,
  channel         ENUM('email','phone') NOT NULL,
  purpose         ENUM('login','register_email','register_phone','change_email','change_phone') NOT NULL,
  subject_user_id INT UNSIGNED  NULL,                 -- for change_* purposes
  identifier_bidx CHAR(64)      NOT NULL,
  identifier_enc  TEXT          NOT NULL,
  code_hash       CHAR(64)      NOT NULL,
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts    TINYINT UNSIGNED NOT NULL DEFAULT 5,
  ip_enc          TEXT          NULL,
  created_at      DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  consumed_at     DATETIME      NULL,
  UNIQUE KEY uq_otp_challenge (challenge_id),
  KEY idx_otp_identifier (identifier_bidx, purpose, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS verification_tickets (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ticket_hash     CHAR(64)      NOT NULL,
  channel         ENUM('email','phone') NOT NULL,
  identifier_enc  TEXT          NOT NULL,
  identifier_bidx CHAR(64)      NOT NULL,
  created_at      DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  used_at         DATETIME      NULL,
  UNIQUE KEY uq_ticket (ticket_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Fixed-window rate limiting. Bucket keys are SHA-256 hashed (no raw IPs).
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        CHAR(64)     NOT NULL PRIMARY KEY,
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  window_start  DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Bookings — mapped to the customer's SKYO id. Trip / passenger data encrypted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id                 BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref        VARCHAR(20)   NOT NULL,
  user_uid           CHAR(12)      NOT NULL,
  service            ENUM('train','flight','bus','hotel','package') NOT NULL,
  status             ENUM('pending','confirmed','cancelled','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_status     ENUM('unpaid','paid','refunded','failed') NOT NULL DEFAULT 'unpaid',
  title_enc          TEXT          NOT NULL,
  origin_enc         TEXT          NULL,
  destination_enc    TEXT          NULL,
  details_enc        MEDIUMTEXT    NULL,          -- passengers, PNR, seats… (JSON, encrypted)
  provider           VARCHAR(64)   NULL,
  provider_ref_enc   TEXT          NULL,
  provider_ref_bidx  CHAR(64)      NULL,
  travel_date        DATE          NULL,
  return_date        DATE          NULL,
  travellers         SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  amount_paise       BIGINT UNSIGNED NOT NULL DEFAULT 0,
  currency           CHAR(3)       NOT NULL DEFAULT 'INR',
  pay_provider       VARCHAR(16)   NULL,
  pay_order_id       VARCHAR(64)   NULL,
  pay_payment_id     VARCHAR(64)   NULL,
  paid_at            DATETIME      NULL,
  ticket_status      ENUM('not_issued','issued','failed') NOT NULL DEFAULT 'not_issued',
  pnr_enc            TEXT          NULL,
  issued_at          DATETIME      NULL,
  hold_expires_at    DATETIME      NULL,
  ticket_key_enc     TEXT          NULL,
  charges_enc        TEXT          NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_ref (booking_ref),
  UNIQUE KEY uq_booking_pay_order (pay_order_id),
  KEY idx_bookings_service (service, created_at),
  KEY idx_bookings_user (user_uid),
  KEY idx_bookings_provider_ref (provider_ref_bidx),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_uid) REFERENCES users(uid) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Audit trail
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type      ENUM('user','admin','system') NOT NULL,
  actor_id        INT UNSIGNED  NULL,
  action          VARCHAR(64)   NOT NULL,
  target_type     VARCHAR(32)   NULL,
  target_id       VARCHAR(64)   NULL,
  ip_enc          TEXT          NULL,
  user_agent_enc  TEXT          NULL,
  meta_enc        TEXT          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_type, actor_id),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- RailCore API ledger: every upstream call, its credit cost and the
-- balance RailCore reports. Used for the daily credit cap + admin usage.
-- (No responses are stored — RailCore forbids caching its data.)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS rail_api_calls (
  id                BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  operation         VARCHAR(48)   NOT NULL,
  http_status       SMALLINT      NOT NULL,
  error_code        VARCHAR(48)   NULL,
  credits_cost      INT           NOT NULL DEFAULT 0,
  credits_remaining INT           NULL,
  day_remaining     INT           NULL,
  latency_ms        INT           NOT NULL DEFAULT 0,
  request_id        VARCHAR(64)   NULL,
  user_id           INT UNSIGNED  NULL,
  created_at        TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_rail_calls_created (created_at),
  KEY idx_rail_calls_op (operation, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Contact form messages (all personal content KMS-encrypted)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS contact_messages (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  ref           CHAR(10)      NOT NULL,
  topic         ENUM('booking','refund','account','partnership','grievance','other') NOT NULL DEFAULT 'other',
  name_enc      TEXT          NOT NULL,
  email_enc     TEXT          NOT NULL,
  phone_enc     TEXT          NULL,
  message_enc   TEXT          NOT NULL,
  user_id       INT UNSIGNED  NULL,
  ip_enc        TEXT          NULL,
  status        ENUM('new','in_progress','closed') NOT NULL DEFAULT 'new',
  handled_by    INT UNSIGNED  NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_contact_ref (ref),
  KEY idx_contact_status (status, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Saved travellers (per customer). Whole record KMS-encrypted.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS saved_passengers (
  id          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id     INT UNSIGNED NOT NULL,
  data_enc    TEXT         NOT NULL,            -- {name, age, gender, berth, nationality}
  created_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at  TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY idx_passengers_user (user_id),
  CONSTRAINT fk_passengers_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Provider transaction log: every request we send to / receive from
-- Razorpay & Tripgic (orders, verification, captures, webhooks, ticketing).
-- Bodies are KMS-encrypted; secrets/authorization headers are never stored.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS payment_logs (
  id           BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref  VARCHAR(20)   NULL,
  provider     ENUM('razorpay','tripgic','skyo','digio','aviationstack') NOT NULL,
  direction    ENUM('outbound','inbound') NOT NULL,
  action       VARCHAR(48)   NOT NULL,
  http_status  SMALLINT      NULL,
  outcome      ENUM('ok','error') NOT NULL DEFAULT 'ok',
  external_id  VARCHAR(64)   NULL,
  event_id     VARCHAR(64)   NULL,
  amount_paise BIGINT UNSIGNED NULL,
  latency_ms   INT           NULL,
  request_enc  MEDIUMTEXT    NULL,
  response_enc MEDIUMTEXT    NULL,
  created_at   TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_logs_event (event_id),
  KEY idx_payment_logs_booking (booking_ref),
  KEY idx_payment_logs_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Every Razorpay payment attempt for a booking (success or failure), latest provider payload KMS-encrypted.
CREATE TABLE IF NOT EXISTS payment_attempts (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref   VARCHAR(20)   NOT NULL,
  user_uid      VARCHAR(16)   NOT NULL,
  provider      VARCHAR(16)   NOT NULL DEFAULT 'razorpay',
  order_id      VARCHAR(64)   NULL,
  payment_id    VARCHAR(64)   NULL,
  status        VARCHAR(16)   NOT NULL,
  method        VARCHAR(24)   NULL,
  amount_paise  BIGINT UNSIGNED NULL,
  error_code    VARCHAR(64)   NULL,
  error_desc    VARCHAR(300)  NULL,
  verified      TINYINT(1)    NOT NULL DEFAULT 0,
  source        VARCHAR(24)   NOT NULL,
  data_enc      MEDIUMTEXT    NULL,
  created_at    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_payment_attempt (payment_id),
  KEY idx_attempt_booking (booking_ref),
  KEY idx_attempt_user (user_uid, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Coupons (WooCommerce-style). value = percent (0–100) or fixed ₹; zero_service waives the SKYO service fee.
CREATE TABLE IF NOT EXISTS coupons (
  id              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code            VARCHAR(32)   NOT NULL,
  title           VARCHAR(100)  NULL,
  discount_type   ENUM('percent','fixed','zero_service') NOT NULL,
  value           DECIMAL(10,2) NOT NULL DEFAULT 0,
  apply_on        ENUM('base_fare','service_fee','total') NOT NULL DEFAULT 'total',
  max_discount    DECIMAL(10,2) NULL,
  min_order       DECIMAL(10,2) NULL,
  service         VARCHAR(16)   NOT NULL DEFAULT 'train',
  per_user_limit  INT UNSIGNED  NULL,
  total_limit     INT UNSIGNED  NULL,
  user_uid        VARCHAR(16)   NULL,
  status          ENUM('active','paused') NOT NULL DEFAULT 'active',
  starts_at       DATETIME      NULL,
  expires_at      DATETIME      NULL,
  is_default      TINYINT(1)    NOT NULL DEFAULT 0,
  used_count      INT UNSIGNED  NOT NULL DEFAULT 0,
  created_by      INT UNSIGNED  NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_coupon_code (code),
  KEY idx_coupon_user (user_uid)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One row per booking that used a coupon. 'reserved' while the booking awaits payment, 'used' once paid.
CREATE TABLE IF NOT EXISTS coupon_redemptions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  coupon_id       INT UNSIGNED  NOT NULL,
  code            VARCHAR(32)   NOT NULL,
  user_uid        VARCHAR(16)   NOT NULL,
  booking_ref     VARCHAR(20)   NOT NULL,
  discount_paise  BIGINT UNSIGNED NOT NULL,
  status          ENUM('reserved','used','released') NOT NULL DEFAULT 'reserved',
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  used_at         DATETIME      NULL,
  UNIQUE KEY uq_redemption_booking (booking_ref),
  KEY idx_redemption_coupon (coupon_id, status),
  KEY idx_redemption_user (user_uid, coupon_id),
  CONSTRAINT fk_redemption_coupon FOREIGN KEY (coupon_id) REFERENCES coupons(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Customer GST details for tax invoices (one per account). Company/address/GSTIN encrypted.
CREATE TABLE IF NOT EXISTS user_gst (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id       INT UNSIGNED  NOT NULL,
  gstin_enc     TEXT          NOT NULL,
  gstin_bidx    CHAR(64)      NOT NULL,
  company_enc   TEXT          NOT NULL,
  address_enc   TEXT          NULL,
  pincode       CHAR(6)       NULL,
  state         VARCHAR(60)   NULL,
  gst_status    VARCHAR(40)   NULL,
  source        ENUM('fetch','manual') NOT NULL,
  raw_enc       MEDIUMTEXT    NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_gst_user (user_id),
  KEY idx_user_gst_bidx (gstin_bidx),
  CONSTRAINT fk_user_gst_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Razorpay refunds (automatic when ticketing fails, or by an agent). Latest provider payload encrypted.
CREATE TABLE IF NOT EXISTS refunds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref   VARCHAR(20)   NOT NULL,
  payment_id    VARCHAR(64)   NOT NULL,
  refund_id     VARCHAR(64)   NULL,
  amount_paise  BIGINT UNSIGNED NOT NULL,
  status        VARCHAR(16)   NOT NULL,
  reason        VARCHAR(200)  NULL,
  initiated_by  VARCHAR(32)   NOT NULL,
  data_enc      MEDIUMTEXT    NULL,
  created_at    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  updated_at    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3) ON UPDATE CURRENT_TIMESTAMP(3),
  UNIQUE KEY uq_refund_id (refund_id),
  KEY idx_refund_booking (booking_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Flights (aviationstack). Free plan = 100 requests / month, so every
-- upstream call is metered here and route schedules are cached.
-- ---------------------------------------------------------------------
-- Every aviationstack request (the access key is never stored).
CREATE TABLE IF NOT EXISTS flight_api_calls (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  endpoint      VARCHAR(32)   NOT NULL,
  params        VARCHAR(255)  NOT NULL,
  http_status   SMALLINT      NOT NULL,
  error_code    VARCHAR(48)   NULL,
  billable      TINYINT(1)    NOT NULL DEFAULT 0,
  result_count  INT           NOT NULL DEFAULT 0,
  result_total  INT           NULL,
  latency_ms    INT           NOT NULL DEFAULT 0,
  reason        VARCHAR(32)   NULL,
  user_id       INT UNSIGNED  NULL,
  admin_id      INT UNSIGNED  NULL,
  response_enc  MEDIUMTEXT    NULL,
  created_at    TIMESTAMP(3)  NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  KEY idx_flight_calls_created (created_at),
  KEY idx_flight_calls_endpoint (endpoint, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- One cached daily schedule per route (operating flights, codeshares folded in).
CREATE TABLE IF NOT EXISTS flight_routes (
  id            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  dep_iata      CHAR(3)       NOT NULL,
  arr_iata      CHAR(3)       NOT NULL,
  flights       SMALLINT UNSIGNED NOT NULL DEFAULT 0,
  upstream_total INT          NULL,
  pages         TINYINT UNSIGNED NOT NULL DEFAULT 1,
  source_date   DATE          NULL,
  data_enc      MEDIUMTEXT    NOT NULL,
  searches      INT UNSIGNED  NOT NULL DEFAULT 0,
  fetched_at    DATETIME      NOT NULL,
  last_search_at DATETIME     NULL,
  UNIQUE KEY uq_flight_route (dep_iata, arr_iata),
  KEY idx_flight_routes_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Live status per flight + day (short cache so tracking doesn't burn requests).
CREATE TABLE IF NOT EXISTS flight_status_cache (
  flight_iata   VARCHAR(10)   NOT NULL,
  flight_date   DATE          NOT NULL,
  data_enc      MEDIUMTEXT    NOT NULL,
  fetched_at    DATETIME      NOT NULL,
  PRIMARY KEY (flight_iata, flight_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Seats sold / held on SKYO. One row per seat; rows of dead bookings are cleared before a new hold.
CREATE TABLE IF NOT EXISTS flight_seat_holds (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  flight_key    VARCHAR(10)   NOT NULL,
  flight_date   DATE          NOT NULL,
  cabin         ENUM('economy','business') NOT NULL,
  seat          VARCHAR(4)    NOT NULL,
  booking_ref   VARCHAR(20)   NOT NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_flight_seat (flight_key, flight_date, seat),
  KEY idx_flight_seat_booking (booking_ref)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Airport live board (departures / arrivals) per airport, cached so a refresh doesn't spend a request.
CREATE TABLE IF NOT EXISTS flight_board_cache (
  airport_iata  CHAR(3)       NOT NULL,
  board_type    ENUM('departure','arrival') NOT NULL,
  data_enc      MEDIUMTEXT    NOT NULL,
  fetched_at    DATETIME      NOT NULL,
  PRIMARY KEY (airport_iata, board_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- RailKit PNR lookups: one row per upstream call (the PNR itself is stored only as a keyed hash + last 4 digits).
CREATE TABLE IF NOT EXISTS pnr_api_calls (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  pnr_hash      CHAR(64)      NOT NULL,
  pnr_last4     CHAR(4)       NOT NULL,
  http_status   SMALLINT      NULL,
  error_code    VARCHAR(64)   NULL,
  billable      TINYINT(1)    NOT NULL DEFAULT 0,
  latency_ms    INT UNSIGNED  NULL,
  user_id       INT UNSIGNED  NULL,
  ip_hash       CHAR(64)      NULL,
  response_enc  MEDIUMTEXT    NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_pnr_calls_created (created_at),
  KEY idx_pnr_calls_user (user_id, created_at),
  KEY idx_pnr_calls_ip (ip_hash, created_at),
  KEY idx_pnr_calls_hash (pnr_hash)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Last PNR status per PNR (encrypted), so a refresh within the cache window doesn't spend a request.
CREATE TABLE IF NOT EXISTS pnr_cache (
  pnr_hash      CHAR(64)      NOT NULL PRIMARY KEY,
  data_enc      MEDIUMTEXT    NOT NULL,
  journey_at    DATETIME      NULL,
  fetched_at    DATETIME      NOT NULL,
  KEY idx_pnr_cache_fetched (fetched_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- PNRs a logged-in traveller has checked, shown as "Your PNRs" on the home page (max 10 per user).
CREATE TABLE IF NOT EXISTS user_pnrs (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  pnr_hash        CHAR(64)      NOT NULL,
  pnr_enc         TEXT          NOT NULL,
  snapshot_enc    MEDIUMTEXT    NULL,
  fetched_at      DATETIME      NULL,
  journey_at      DATETIME      NULL,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY uq_user_pnr (user_id, pnr_hash),
  KEY idx_user_pnrs_user (user_id, updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------- Part 2 · tour packages
CREATE TABLE IF NOT EXISTS tour_packages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  slug VARCHAR(160) NOT NULL,
  title VARCHAR(180) NOT NULL,
  short_description VARCHAR(320) NOT NULL,
  detailed_description MEDIUMTEXT NOT NULL,
  duration_days SMALLINT UNSIGNED NOT NULL,
  duration_nights SMALLINT UNSIGNED NOT NULL,
  destinations JSON NOT NULL,
  categories JSON NULL,
  itinerary JSON NOT NULL,
  departures JSON NULL,
  trip_info JSON NULL,
  accommodations JSON NOT NULL,
  original_price INT UNSIGNED NOT NULL,
  discounted_price INT UNSIGNED NOT NULL,
  pricing_type ENUM('per_person','per_couple') NOT NULL DEFAULT 'per_person',
  upfront_token_amount INT UNSIGNED NOT NULL DEFAULT 0,
  cover_photo VARCHAR(1000) NOT NULL,
  images JSON NOT NULL,
  video_link VARCHAR(1000) NULL,
  inclusions JSON NOT NULL,
  exclusions JSON NOT NULL,
  coupons JSON NOT NULL,
  cancellation_policy MEDIUMTEXT NOT NULL,
  cancellation_rules JSON NULL,
  price_notes VARCHAR(1000) NULL,
  support_contact JSON NULL,
  status ENUM('draft','published','archived') NOT NULL DEFAULT 'draft',
  featured TINYINT(1) NOT NULL DEFAULT 0,
  created_by INT UNSIGNED NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tour_packages_slug (slug),
  KEY idx_tour_packages_status (status, featured, updated_at),
  CONSTRAINT fk_tour_packages_admin FOREIGN KEY (created_by) REFERENCES admins(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tour_package_bookings (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) NOT NULL,
  core_booking_ref VARCHAR(20) NOT NULL,
  package_id BIGINT UNSIGNED NOT NULL,
  package_title VARCHAR(180) NOT NULL,
  package_slug VARCHAR(160) NOT NULL,
  user_uid CHAR(12) NOT NULL,
  user_details_enc MEDIUMTEXT NOT NULL,
  travel_date DATE NOT NULL,
  departure_id VARCHAR(24) NULL,
  return_date DATE NULL,
  total_guests SMALLINT UNSIGNED NOT NULL,
  pricing_type ENUM('per_person','per_couple') NOT NULL,
  package_price_paise BIGINT UNSIGNED NOT NULL,
  discount_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  coupon_code VARCHAR(40) NULL,
  total_amount_paise BIGINT UNSIGNED NOT NULL,
  upfront_amount_paise BIGINT UNSIGNED NOT NULL,
  amount_paid_paise BIGINT UNSIGNED NOT NULL DEFAULT 0,
  payment_status ENUM('pending','partially_paid','paid','failed','refunded') NOT NULL DEFAULT 'pending',
  booking_status ENUM('pending','confirmed','cancelled') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_tour_package_booking_ref (booking_ref),
  UNIQUE KEY uq_tour_package_core_booking_ref (core_booking_ref),
  KEY idx_tour_package_booking_user (user_uid, created_at),
  KEY idx_tour_package_booking_package (package_id, created_at),
  KEY idx_tour_package_booking_departure (package_id, departure_id, booking_status),
  KEY idx_tour_package_booking_status (payment_status, booking_status, created_at),
  CONSTRAINT fk_tour_package_booking_package FOREIGN KEY (package_id) REFERENCES tour_packages(id),
  CONSTRAINT fk_tour_package_core_booking FOREIGN KEY (core_booking_ref) REFERENCES bookings(booking_ref) ON DELETE CASCADE,
  CONSTRAINT fk_tour_package_booking_user FOREIGN KEY (user_uid) REFERENCES users(uid) ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS tour_package_payments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
  booking_ref VARCHAR(20) NOT NULL,
  razorpay_order_id VARCHAR(64) NOT NULL,
  razorpay_payment_id VARCHAR(64) NULL,
  amount_paise BIGINT UNSIGNED NOT NULL,
  payment_type ENUM('upfront','balance','full') NOT NULL,
  status ENUM('pending','paid','failed') NOT NULL DEFAULT 'pending',
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  paid_at DATETIME NULL,
  UNIQUE KEY uq_tour_package_order (razorpay_order_id),
  KEY idx_tour_package_payment_booking (booking_ref, status),
  CONSTRAINT fk_tour_package_payment_booking FOREIGN KEY (booking_ref) REFERENCES tour_package_bookings(booking_ref) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
