import { AppointmentStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const appointmentSchema = z.object({
  patientId: z.number(),
  doctorId: z.number(),
  startsAt: z.string(),
  durationMinutes: z.number().int().min(15).max(240).default(30),
  reason: z.string().min(1),
  location: z.string().optional().nullable(),
  status: z.nativeEnum(AppointmentStatus).default(AppointmentStatus.SCHEDULED),
  notes: z.string().optional().nullable(),
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const appointments = await prisma.appointment.findMany({
    include: { patient: true, doctor: true },
    orderBy: { startsAt: "asc" },
  });
  res.json({ data: appointments });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req, res) => {
  const input = appointmentSchema.parse(req.body);
  const appointment = await prisma.appointment.create({
    data: { ...input, startsAt: new Date(input.startsAt) },
  });
  res.status(201).json({ data: appointment });
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req, res) => {
  const input = appointmentSchema.parse(req.body);
  const appointment = await prisma.appointment.update({
    where: { id: Number(req.params.id) },
    data: { ...input, startsAt: new Date(input.startsAt) },
  });
  res.json({ data: appointment });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN), async (req, res) => {
  await prisma.appointment.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
