-- =====================================================================
-- SKYO — MySQL / MariaDB schema (utf8mb4, InnoDB)
-- Run with:  npm run db:setup   (creates DB, tables, seeds admin)
-- or import this file in phpMyAdmin.
--
-- Security notes
--   * email / phone are stored ENCRYPTED (AES-256-GCM envelope, KMS data key).
--   * *_bidx columns are HMAC-SHA256 blind indexes used for exact lookups.
--   * OTPs, session tokens and passwords are never stored in plain text.
-- =====================================================================

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key   VARCHAR(64)  NOT NULL PRIMARY KEY,
  setting_value TEXT         NULL,
  updated_by    INT UNSIGNED NULL,
  updated_at    TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Customers (travellers)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
  id                 INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  uid                CHAR(26)      NOT NULL,                 -- public id (ULID-like)
  name               VARCHAR(100)  NULL,
  email_enc          TEXT          NULL,
  email_bidx         CHAR(64)      NULL,
  email_masked       VARCHAR(120)  NULL,
  email_verified_at  DATETIME      NULL,
  phone_enc          TEXT          NULL,
  phone_bidx         CHAR(64)      NULL,
  phone_masked       VARCHAR(20)   NULL,
  phone_verified_at  DATETIME      NULL,
  status             ENUM('active','inactive','blocked') NOT NULL DEFAULT 'active',
  signup_method      ENUM('register','otp_login') NOT NULL DEFAULT 'otp_login',
  consent_at         DATETIME      NULL,                     -- DPDP consent timestamp
  consent_version    VARCHAR(16)   NULL,
  signup_ip          VARCHAR(45)   NULL,
  last_login_at      DATETIME      NULL,
  last_login_ip      VARCHAR(45)   NULL,
  last_location      VARCHAR(160)  NULL,
  last_device        VARCHAR(160)  NULL,
  created_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at         TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_users_uid (uid),
  UNIQUE KEY uq_users_email (email_bidx),
  UNIQUE KEY uq_users_phone (phone_bidx),
  KEY idx_users_status (status),
  KEY idx_users_created (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Agents: admin (full access) + staff (permission based)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS admins (
  id                INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  name              VARCHAR(100) NOT NULL,
  email             VARCHAR(190) NOT NULL,
  password_hash     VARCHAR(255) NOT NULL,                  -- scrypt$N$r$p$salt$hash
  role              ENUM('admin','staff') NOT NULL DEFAULT 'staff',
  permissions       JSON         NULL,                      -- ["users.view", ...] for staff
  status            ENUM('active','inactive') NOT NULL DEFAULT 'active',
  failed_attempts   INT UNSIGNED NOT NULL DEFAULT 0,
  locked_until      DATETIME     NULL,
  last_login_at     DATETIME     NULL,
  last_login_ip     VARCHAR(45)  NULL,
  password_changed_at DATETIME   NULL,
  created_by        INT UNSIGNED NULL,
  created_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at        TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_admins_email (email)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Sessions (opaque token, only SHA-256 hash stored)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS user_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id         INT UNSIGNED  NOT NULL,
  token_hash      CHAR(64)      NOT NULL,
  ip              VARCHAR(45)   NULL,
  location        VARCHAR(160)  NULL,
  user_agent      VARCHAR(400)  NULL,
  device          VARCHAR(160)  NULL,
  client          ENUM('web','android','ios') NOT NULL DEFAULT 'web',
  login_method    VARCHAR(32)   NULL,
  created_at      DATETIME      NOT NULL,
  last_seen_at    DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  revoked_at      DATETIME      NULL,
  revoked_reason  VARCHAR(64)   NULL,
  UNIQUE KEY uq_user_sessions_token (token_hash),
  KEY idx_user_sessions_user (user_id, revoked_at),
  KEY idx_user_sessions_created (created_at),
  CONSTRAINT fk_user_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS admin_sessions (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  admin_id        INT UNSIGNED  NOT NULL,
  token_hash      CHAR(64)      NOT NULL,
  ip              VARCHAR(45)   NULL,
  location        VARCHAR(160)  NULL,
  user_agent      VARCHAR(400)  NULL,
  device          VARCHAR(160)  NULL,
  created_at      DATETIME      NOT NULL,
  last_seen_at    DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  revoked_at      DATETIME      NULL,
  revoked_reason  VARCHAR(64)   NULL,
  UNIQUE KEY uq_admin_sessions_token (token_hash),
  KEY idx_admin_sessions_admin (admin_id, revoked_at),
  CONSTRAINT fk_admin_sessions_admin FOREIGN KEY (admin_id) REFERENCES admins(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- OTP challenges (HMAC hashed code, attempt-limited, single use)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS otp_challenges (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  challenge_id    CHAR(32)      NOT NULL,
  channel         ENUM('email','phone') NOT NULL,
  purpose         ENUM('login','register_email','register_phone') NOT NULL,
  identifier_bidx CHAR(64)      NOT NULL,
  identifier_enc  TEXT          NOT NULL,
  code_hash       CHAR(64)      NOT NULL,
  attempts        TINYINT UNSIGNED NOT NULL DEFAULT 0,
  max_attempts    TINYINT UNSIGNED NOT NULL DEFAULT 5,
  ip              VARCHAR(45)   NULL,
  created_at      DATETIME      NOT NULL,
  expires_at      DATETIME      NOT NULL,
  consumed_at     DATETIME      NULL,
  UNIQUE KEY uq_otp_challenge (challenge_id),
  KEY idx_otp_identifier (identifier_bidx, purpose, created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Short-lived proof that an email/phone was verified during registration
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

-- Fixed-window rate limiting
CREATE TABLE IF NOT EXISTS rate_limits (
  bucket        VARCHAR(191) NOT NULL PRIMARY KEY,
  hits          INT UNSIGNED NOT NULL DEFAULT 0,
  window_start  DATETIME     NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Bookings (all 5 services share one table; details JSON per service)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS bookings (
  id              BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  booking_ref     VARCHAR(20)   NOT NULL,
  user_id         INT UNSIGNED  NOT NULL,
  service         ENUM('train','flight','bus','hotel','package') NOT NULL,
  status          ENUM('pending','confirmed','cancelled','failed','refunded') NOT NULL DEFAULT 'pending',
  payment_status  ENUM('unpaid','paid','refunded','failed') NOT NULL DEFAULT 'unpaid',
  title           VARCHAR(190)  NOT NULL,                  -- e.g. "NDLS → BCT · 12952"
  origin          VARCHAR(120)  NULL,
  destination     VARCHAR(120)  NULL,
  travel_date     DATE          NULL,
  return_date     DATE          NULL,
  travellers      SMALLINT UNSIGNED NOT NULL DEFAULT 1,
  amount_paise    BIGINT UNSIGNED NOT NULL DEFAULT 0,      -- money in paise, never float
  currency        CHAR(3)       NOT NULL DEFAULT 'INR',
  provider        VARCHAR(64)   NULL,
  provider_ref    VARCHAR(128)  NULL,
  details         JSON          NULL,
  created_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at      TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_booking_ref (booking_ref),
  KEY idx_bookings_service (service, created_at),
  KEY idx_bookings_user (user_id),
  CONSTRAINT fk_bookings_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- ---------------------------------------------------------------------
-- Audit trail (admin + security events). Append-only from the app.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS audit_logs (
  id            BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  actor_type    ENUM('user','admin','system') NOT NULL,
  actor_id      INT UNSIGNED  NULL,
  action        VARCHAR(64)   NOT NULL,
  target_type   VARCHAR(32)   NULL,
  target_id     VARCHAR(64)   NULL,
  ip            VARCHAR(45)   NULL,
  user_agent    VARCHAR(400)  NULL,
  meta          JSON          NULL,
  created_at    TIMESTAMP     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  KEY idx_audit_created (created_at),
  KEY idx_audit_actor (actor_type, actor_id),
  KEY idx_audit_action (action)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
