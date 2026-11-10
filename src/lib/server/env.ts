import "server-only";

/** Centralised, typed access to environment variables. Never import in client code. */
function str(key: string, fallback = ""): string {
  const v = process.env[key];
  return v === undefined || v === null ? fallback : String(v).trim();
}
function int(key: string, fallback: number): number {
  const n = parseInt(str(key), 10);
  return Number.isFinite(n) ? n : fallback;
}

export const isProd = process.env.NODE_ENV === "production";

export const env = {
  appNameDefault: str("APP_NAME_DEFAULT", "SKYO"),
  appUrl: str("APP_URL", "http://localhost:3000"),

  db: {
    host: str("DB_HOST", "127.0.0.1"),
    port: int("DB_PORT", 3306),
    user: str("DB_USER", "root"),
    password: str("DB_PASS"),
    database: str("DB_NAME", "skyo"),
    ssl: str("DB_SSL") === "true",
    sslCa: str("DB_SSL_CA"),
  },

  hmacSecret: str("APP_HMAC_SECRET"),
  localDataKey: str("APP_LOCAL_DATA_KEY"),

  aws: {
    region: str("AWS_REGION", "ap-south-1"),
    accessKeyId: str("AWS_ACCESS_KEY_ID"),
    secretAccessKey: str("AWS_SECRET_ACCESS_KEY"),
    kmsKeyId: str("AWS_KMS_KEY_ID"),
  },

  zepto: {
    url: str("ZEPTO_MAIL_URL", "https://api.zeptomail.in/v1.1/email/template"),
    apiKey: str("ZEPTO_MAIL"),
    tplRegister: str("ZEPTO_REGISTER_EMAIL_OTP"),
    tplVerify: str("ZEPTO_VERIFY_EMAIL_OTP"),
    tplWelcome: str("ZEPTO_WELCOME_EMAIL_OTP"),
    fromEmail: str("ZEPTO_FROM_EMAIL", "no-reply@imoneypg.com"),
    fromName: str("ZEPTO_FROM_NAME", "SKYO"),
  },

  sms: {
    url: str("FAST_SMS_URL", "https://www.fast2sms.com/dev/bulkV2"),
    apiKey: str("FAST2SMS"),
    route: str("FAST2SMS_ROUTE", "dlt"),
    senderId: str("FAST2SMS_SENDER_ID"),
    templateId: str("FAST2SMS_TEMPLATE_ID"),
  },

  otpTtlSeconds: Math.max(60, int("OTP_TTL_SECONDS", 300)),
  otpDevEcho: !isProd && str("OTP_DEV_ECHO") === "true",
  /** Dev only: skip SMS/email providers entirely (codes printed to console). */
  otpDryRun: !isProd && str("OTP_DRY_RUN") === "true",
  userSessionDays: int("USER_SESSION_DAYS", 180),
  adminSessionHours: int("ADMIN_SESSION_HOURS", 12),
  adminIdleMinutes: int("ADMIN_IDLE_MINUTES", 30),
};

if (!env.hmacSecret || env.hmacSecret.length < 32) {
  throw new Error("APP_HMAC_SECRET missing or too short (need 32+ chars)");
}
