import { RequestHandler } from "express";
import { createHash } from "node:crypto";
import { prisma } from "../db.js";

type RateLimitOptions = {
  name?: string;
  windowMs: number;
  max: number;
  message?: string;
  cleanupIntervalMs?: number;
};

type RateLimitBucket = {
  count: number;
  resetAt: Date;
};

function bucketKey(name: string, req: Parameters<RequestHandler>[0]) {
  const rawKey = `${name}:${req.ip}:${req.method}:${req.path}`;
  return `${name}:${createHash("sha256").update(rawKey).digest("hex")}`;
}

export function createRateLimiter({
  name = "default",
  windowMs,
  max,
  message = "Too many requests",
  cleanupIntervalMs = 5 * 60 * 1000,
}: RateLimitOptions): RequestHandler {
  let lastCleanupAt = 0;

  return async (req, res, next) => {
    const nowMs = Date.now();
    const now = new Date(nowMs);
    const resetAt = new Date(nowMs + windowMs);
    const key = bucketKey(name, req);

    try {
      const [bucket] = await prisma.$queryRaw<RateLimitBucket[]>`
        INSERT INTO "RateLimitBucket" ("key", "count", "resetAt", "updatedAt")
        VALUES (${key}, 1, ${resetAt}, ${now})
        ON CONFLICT ("key") DO UPDATE SET
          "count" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN 1
            ELSE "RateLimitBucket"."count" + 1
          END,
          "resetAt" = CASE
            WHEN "RateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
            ELSE "RateLimitBucket"."resetAt"
          END,
          "updatedAt" = ${now}
        RETURNING "count", "resetAt"
      `;

      if (bucket.count > max) {
        res.setHeader("Retry-After", Math.ceil((bucket.resetAt.getTime() - nowMs) / 1000));
        return res.status(429).json({ error: message });
      }

      if (nowMs - lastCleanupAt >= cleanupIntervalMs) {
        lastCleanupAt = nowMs;
        void prisma.$executeRaw`DELETE FROM "RateLimitBucket" WHERE "resetAt" <= ${now}`
          .catch((error) => {
            console.warn("Failed to clean up expired rate limit buckets", error);
          });
      }

      return next();
    } catch (error) {
      return next(error);
    }
  };
}
