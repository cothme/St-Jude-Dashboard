const isProduction = process.env.NODE_ENV === "production";

function readCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function readPositiveNumber(value: string | undefined, fallback: number, minimum: number) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(minimum, parsed) : fallback;
}

const devClientOrigins = ["http://localhost:5173", "http://127.0.0.1:5173"];
const configuredClientOrigins = readCsv(process.env.CLIENT_ORIGIN);
const clientOrigins = Array.from(
  new Set(isProduction ? configuredClientOrigins : [...configuredClientOrigins, ...devClientOrigins]),
);

const authSecret = process.env.BETTER_AUTH_SECRET ?? "development-only-change-before-production";
const sessionMaxAgeMinutes = Number(process.env.SESSION_MAX_AGE_MINUTES ?? 60);
const sessionRefreshAgeMinutes = Number(process.env.SESSION_REFRESH_AGE_MINUTES ?? 5);
const sessionMaxAgeSeconds = Math.max(5, sessionMaxAgeMinutes) * 60;
const rxNavCacheHours = Number(process.env.RXNAV_CACHE_HOURS ?? 12);
const rxNavTimeoutMs = Number(process.env.RXNAV_TIMEOUT_MS ?? 6000);
const authRateLimitWindowMs = readPositiveNumber(process.env.AUTH_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 1000);
const authRateLimitMax = readPositiveNumber(process.env.AUTH_RATE_LIMIT_MAX, 40, 1);
const apiWriteRateLimitWindowMs = readPositiveNumber(process.env.API_WRITE_RATE_LIMIT_WINDOW_MS, 15 * 60 * 1000, 1000);
const apiWriteRateLimitMax = readPositiveNumber(process.env.API_WRITE_RATE_LIMIT_MAX, 300, 1);
const medicineLookupRateLimitWindowMs = readPositiveNumber(process.env.MEDICINE_LOOKUP_RATE_LIMIT_WINDOW_MS, 60 * 1000, 1000);
const medicineLookupRateLimitMax = readPositiveNumber(process.env.MEDICINE_LOOKUP_RATE_LIMIT_MAX, 120, 1);
const rateLimitCleanupIntervalMs = readPositiveNumber(process.env.RATE_LIMIT_CLEANUP_INTERVAL_MS, 5 * 60 * 1000, 1000);
const isWeakAuthSecret =
  authSecret === "replace-with-a-long-random-secret" ||
  authSecret === "development-only-change-before-production" ||
  authSecret.length < 32;

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required.");
}

if (isProduction && clientOrigins.length === 0) {
  throw new Error("CLIENT_ORIGIN must be configured in production.");
}

if (isProduction && isWeakAuthSecret) {
  throw new Error("BETTER_AUTH_SECRET must be a strong random value with at least 32 characters in production.");
}

if (!isProduction && isWeakAuthSecret) {
  console.warn("BETTER_AUTH_SECRET is using a development-only value. Replace it before production.");
}

export const config = {
  isProduction,
  port: Number(process.env.PORT ?? 3001),
  clientOrigins,
  authBaseUrl: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  authSecret,
  sessionMaxAgeSeconds,
  sessionRefreshAgeSeconds: Math.min(Math.max(1, sessionRefreshAgeMinutes) * 60, sessionMaxAgeSeconds - 60),
  rxNavCacheTtlMs: Math.max(1, rxNavCacheHours) * 60 * 60 * 1000,
  rxNavTimeoutMs: Math.max(1000, rxNavTimeoutMs),
  jsonLimit: process.env.JSON_BODY_LIMIT ?? "2mb",
  rateLimits: {
    cleanupIntervalMs: rateLimitCleanupIntervalMs,
    auth: {
      windowMs: authRateLimitWindowMs,
      max: authRateLimitMax,
    },
    apiWrite: {
      windowMs: apiWriteRateLimitWindowMs,
      max: apiWriteRateLimitMax,
    },
    medicineLookup: {
      windowMs: medicineLookupRateLimitWindowMs,
      max: medicineLookupRateLimitMax,
    },
  },
};
