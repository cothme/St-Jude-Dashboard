import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const formSchema = z.object({
  templateId: z.string().trim().min(1).max(80),
  title: z.string().trim().min(1).max(120),
  category: z.string().trim().min(1).max(80),
  status: z.enum(["DRAFT", "SUBMITTED", "REVIEWED"]).default("SUBMITTED"),
  fields: z.record(z.string().trim().min(1).max(80), z.string().max(2000)),
});
const formTemplates: Record<string, { title: string; category: string; roles: Role[] }> = {
  "patient-admission": { title: "Patient Admission Form", category: "Patient Care", roles: [Role.SUPER_ADMIN, Role.STAFF] },
  "doctor-checkup": { title: "Doctor Checkup Form", category: "Clinical", roles: [Role.SUPER_ADMIN, Role.DOCTOR] },
  "incident-report": { title: "Incident Report", category: "Operations", roles: [Role.SUPER_ADMIN, Role.STAFF, Role.DOCTOR] },
  "medication-log": { title: "Medication Log", category: "Clinical", roles: [Role.SUPER_ADMIN, Role.STAFF, Role.DOCTOR] },
  "employee-onboarding": { title: "Employee Onboarding Form", category: "HR", roles: [Role.SUPER_ADMIN, Role.STAFF] },
  "payroll-adjustment": { title: "Payroll Adjustment Request", category: "Payroll", roles: [Role.SUPER_ADMIN] },
};

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const user = req.user;
  const forms = await prisma.formSubmission.findMany({
    where: user?.role === Role.DOCTOR ? { submittedBy: user.name } : undefined,
    orderBy: { submittedAt: "desc" },
  });
  res.json({ data: forms });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.STAFF, Role.DOCTOR), async (req, res) => {
  const input = formSchema.parse(req.body);
  const user = (req as AuthedRequest).user;
  const template = formTemplates[input.templateId];
  if (!template) {
    return res.status(400).json({ error: "Unknown form template" });
  }
  if (!user || !template.roles.includes(user.role)) {
    return res.status(403).json({ error: "Insufficient permissions for this form template" });
  }
  const form = await prisma.formSubmission.create({
    data: {
      ...input,
      title: template.title,
      category: template.category,
      submittedBy: user.name,
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
