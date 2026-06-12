const isProduction = process.env.NODE_ENV === "production";

function readCsv(value?: string) {
  return (value ?? "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
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
};
