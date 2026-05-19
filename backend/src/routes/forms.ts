import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const formSchema = z.object({
  templateId: z.string().min(1),
  title: z.string().min(1),
  category: z.string().min(1),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED"]).default("SUBMITTED"),
  fields: z.record(z.string(), z.string()),
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const forms = await prisma.formSubmission.findMany({ orderBy: { submittedAt: "desc" } });
  res.json({ data: forms });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.STAFF, Role.DOCTOR), async (req, res) => {
  const input = formSchema.parse(req.body);
  const form = await prisma.formSubmission.create({
    data: {
      ...input,
      submittedBy: (req as AuthedRequest).user?.name ?? "Unknown user",
    },
  });
  res.status(201).json({ data: form });
});

router.put("/:id/review", requireRole(Role.SUPER_ADMIN), async (req, res) => {
  const form = await prisma.formSubmission.update({
    where: { id: Number(req.params.id) },
    data: { status: "REVIEWED" },
  });
  res.json({ data: form });
});

export default router;
