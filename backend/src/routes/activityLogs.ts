import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
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
  res.status(201).json({ data: log });
});

export default router;
