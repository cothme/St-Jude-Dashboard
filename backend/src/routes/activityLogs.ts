import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { config } from "../config.js";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const activityLogSchema = z.object({
  action: z.string().trim().min(1).max(80),
  entity: z.string().trim().min(1).max(80),
  summary: z.string().trim().min(1).max(240),
  details: z.array(z.string().trim().max(240)).max(20).optional(),
  severity: z.enum(["info", "success", "warning", "danger"]).default("info"),
});

let lastCleanupAt = 0;

async function enforceActivityLogRetention() {
  const now = Date.now();
  if (now - lastCleanupAt < config.activityLogs.cleanupIntervalMs) return;
  lastCleanupAt = now;

  const cutoff = new Date(now - config.activityLogs.retentionDays * 24 * 60 * 60 * 1000);
  await prisma.activityLog.deleteMany({
    where: { timestamp: { lt: cutoff } },
  });

  const totalLogs = await prisma.activityLog.count();
  const excessLogs = totalLogs - config.activityLogs.maxRows;
  if (excessLogs <= 0) return;

  const oldestLogs = await prisma.activityLog.findMany({
    orderBy: [{ timestamp: "asc" }, { id: "asc" }],
    take: excessLogs,
    select: { id: true },
  });

  if (oldestLogs.length > 0) {
    await prisma.activityLog.deleteMany({
      where: { id: { in: oldestLogs.map((log) => log.id) } },
    });
  }
}

router.use(requireAuth);

router.get("/", requireRole(Role.SUPER_ADMIN), async (_req, res) => {
  const logs = await prisma.activityLog.findMany({
    orderBy: { timestamp: "desc" },
    take: 500,
  });
  res.json({ data: logs });
});

router.post("/", async (req, res) => {
  const input = activityLogSchema.parse(req.body);
  const actor = (req as AuthedRequest).user;
  const log = await prisma.activityLog.create({
    data: {
      ...input,
      details: input.details ?? [],
      actorId: actor?.id,
      actorName: actor?.name ?? "Unknown user",
      actorRole: actor?.role ?? Role.STAFF,
    },
  });
  void enforceActivityLogRetention().catch((error) => {
    console.error("Failed to enforce activity log retention", error);
  });
  res.status(201).json({ data: log });
});

export default router;
