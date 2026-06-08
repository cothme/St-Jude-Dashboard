import { MedicationAdministrationStatus, MedicationScheduleStatus, Role } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

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

function doctorPatientWhere(req: AuthedRequest) {
  return req.user?.role === Role.DOCTOR
    ? { patient: { attendingDoctorId: req.user.linkedEmployeeId ?? -1 } }
    : {};
}

async function enforceDoctorMedicationAccess(req: AuthedRequest, res: Response, patientId: number) {
  if (req.user?.role !== Role.DOCTOR) return true;
  if (!req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctor account is not linked to an employee profile" });
    return false;
  }
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: patientId },
    select: { attendingDoctorId: true },
  });
  if (patient.attendingDoctorId !== req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctors can only manage medications for assigned patients" });
    return false;
  }
  return true;
}

router.use(requireAuth);

router.get("/schedules", async (req: AuthedRequest, res) => {
  const schedules = await prisma.medicationSchedule.findMany({
    where: doctorPatientWhere(req),
    include: { patient: true },
    orderBy: [{ status: "asc" }, { startDate: "desc" }],
  });
  res.json({ data: schedules });
});

router.post("/schedules", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = scheduleSchema.parse(req.body);
  if (!(await enforceDoctorMedicationAccess(req, res, input.patientId))) return;
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

router.put("/schedules/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = scheduleSchema.parse(req.body);
  if (req.user?.role === Role.DOCTOR) {
    const existing = await prisma.medicationSchedule.findUniqueOrThrow({
      where: { id: Number(req.params.id) },
      select: { patient: { select: { attendingDoctorId: true } } },
    });
    if (existing.patient.attendingDoctorId !== req.user.linkedEmployeeId) {
      return res.status(403).json({ error: "Doctors can only update medication schedules for assigned patients" });
    }
  }
  if (!(await enforceDoctorMedicationAccess(req, res, input.patientId))) return;
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

router.get("/administrations", async (req: AuthedRequest, res) => {
  const administrations = await prisma.medicationAdministration.findMany({
    where: doctorPatientWhere(req),
    include: { patient: true, schedule: true },
    orderBy: { administeredAt: "desc" },
  });
  res.json({ data: administrations });
});

router.post("/administrations", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = administrationSchema.parse(req.body);
  if (!(await enforceDoctorMedicationAccess(req, res, input.patientId))) return;
  if (input.scheduleId) {
    const schedule = await prisma.medicationSchedule.findUniqueOrThrow({
      where: { id: input.scheduleId },
      select: { patientId: true },
    });
    if (schedule.patientId !== input.patientId) {
      return res.status(400).json({ error: "Medication schedule does not match the selected patient" });
    }
  }
  const administration = await prisma.medicationAdministration.create({
    data: {
      ...input,
      administeredAt: new Date(input.administeredAt),
    },
  });
  res.status(201).json({ data: administration });
});

export default router;
