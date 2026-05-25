import { MedicationAdministrationStatus, MedicationScheduleStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const scheduleSchema = z.object({
  patientId: z.number(),
  medication: z.string().min(1),
  dosage: z.string().min(1),
  route: z.string().min(1),
  frequency: z.string().min(1),
  times: z.array(z.string()).min(1),
  startDate: z.string(),
  endDate: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
  prescribedBy: z.string().min(1),
  status: z.nativeEnum(MedicationScheduleStatus).default(MedicationScheduleStatus.ACTIVE),
});
const administrationSchema = z.object({
  scheduleId: z.number().optional().nullable(),
  patientId: z.number(),
  medication: z.string().min(1),
  dosage: z.string().min(1),
  administeredAt: z.string(),
  administeredBy: z.string().min(1),
  status: z.nativeEnum(MedicationAdministrationStatus).default(MedicationAdministrationStatus.GIVEN),
  notes: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/schedules", async (_req, res) => {
  const schedules = await prisma.medicationSchedule.findMany({
    include: { patient: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  res.json({ data: schedules });
});

router.post("/schedules", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req, res) => {
  const input = scheduleSchema.parse(req.body);
  const schedule = await prisma.medicationSchedule.create({
    data: {
      ...input,
      times: input.times,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  res.status(201).json({ data: schedule });
});

router.put("/schedules/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req, res) => {
  const input = scheduleSchema.parse(req.body);
  const schedule = await prisma.medicationSchedule.update({
    where: { id: Number(req.params.id) },
    data: {
      ...input,
      times: input.times,
      startDate: new Date(input.startDate),
      endDate: input.endDate ? new Date(input.endDate) : null,
    },
  });
  res.json({ data: schedule });
});

router.delete("/schedules/:id", requireRole(Role.SUPER_ADMIN), async (req, res) => {
  await prisma.medicationSchedule.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

router.get("/administrations", async (_req, res) => {
  const administrations = await prisma.medicationAdministration.findMany({
    include: { patient: true, schedule: true },
    orderBy: { administeredAt: "desc" },
  });
  res.json({ data: administrations });
});

router.post("/administrations", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req, res) => {
  const input = administrationSchema.parse(req.body);
  const administration = await prisma.medicationAdministration.create({
    data: {
      ...input,
      administeredAt: new Date(input.administeredAt),
    },
  });
  res.status(201).json({ data: administration });
});

export default router;
