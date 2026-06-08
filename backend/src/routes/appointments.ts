import { AppointmentStatus, Role } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

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

async function enforceDoctorAppointmentAccess(req: AuthedRequest, res: Response, patientId: number, doctorId: number) {
  if (req.user?.role !== Role.DOCTOR) return true;
  if (!req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctor account is not linked to an employee profile" });
    return false;
  }
  if (doctorId !== req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctors can only manage appointments under their own doctor profile" });
    return false;
  }
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: { attendingDoctorId: true },
  });
  if (patient.attendingDoctorId !== req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctors can only manage appointments for assigned patients" });
    return false;
  }
  return true;
}

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const appointments = await prisma.appointment.findMany({
    where: req.user?.role === Role.DOCTOR ? { doctorId: req.user.linkedEmployeeId ?? -1 } : undefined,
    include: { patient: true, doctor: true },
    orderBy: { startsAt: "asc" },
  });
  res.json({ data: appointments });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = appointmentSchema.parse(req.body);
  if (!(await enforceDoctorAppointmentAccess(req, res, input.patientId, input.doctorId))) return;
  const appointment = await prisma.appointment.create({
    data: { ...input, startsAt: new Date(input.startsAt) },
  });
  res.status(201).json({ data: appointment });
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = appointmentSchema.parse(req.body);
  if (req.user?.role === Role.DOCTOR) {
    const existing = await prisma.appointment.findUniqueOrThrow({
      where: { id: Number(req.params.id) },
      select: { doctorId: true },
    });
    if (existing.doctorId !== req.user.linkedEmployeeId) {
      return res.status(403).json({ error: "Doctors can only update their own appointments" });
    }
  }
  if (!(await enforceDoctorAppointmentAccess(req, res, input.patientId, input.doctorId))) return;
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
