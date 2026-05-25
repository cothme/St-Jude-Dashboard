import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const activityLogSchema = z.object({
  action: z.string().min(1),
  entity: z.string().min(1),
  summary: z.string().min(1),
  details: z.array(z.string()).optional(),
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
