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
  provider     ENUM('razorpay','tripgic','skyo') NOT NULL,
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
