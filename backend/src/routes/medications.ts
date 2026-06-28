import { MedicationAdministrationStatus, MedicationScheduleStatus, Role } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { createRateLimiter } from "../middleware/rateLimit.js";
import { searchMedicines } from "../utils/medicineLookup.js";
import { renderPrescription } from "../utils/prescription.js";

const router = Router();
const scheduleSchema = z.object({
  patientId: z.number().int().positive(),
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
const prescriptionItemSchema = z.object({
  medication: z.string().min(1),
  dosage: z.string().min(1),
  frequency: z.string().min(1),
  duration: z.string().optional().nullable(),
  quantity: z.string().optional().nullable(),
  instructions: z.string().optional().nullable(),
});
const prescriptionSchema = z.object({
  patientId: z.number().int().positive(),
  prescriptionDate: z.string(),
  items: z.array(prescriptionItemSchema).min(1),
  notes: z.string().optional().nullable(),
  prescribedBy: z.string().min(1),
  licenseNo: z.string().optional().nullable(),
  ptrNo: z.string().optional().nullable(),
  s2No: z.string().optional().nullable(),
});
const medicineLookupSchema = z.object({
  q: z.string().trim().min(3).max(100),
});
const medicineLookupRateLimit = createRateLimiter({
  windowMs: 60 * 1000,
  max: 120,
  message: "Too many medicine lookup requests. Please wait a moment and try again.",
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

function prescriptionDoctorName(employee: { firstName: string; lastName: string; sex: string }) {
  return `${employee.sex === "FEMALE" ? "Dra." : "Dr."} ${employee.firstName} ${employee.lastName}`;
}

router.use(requireAuth);

router.get("/lookup", medicineLookupRateLimit, async (req, res) => {
  const { q } = medicineLookupSchema.parse(req.query);
  const lookup = await searchMedicines(q);
  res.setHeader("Cache-Control", "private, max-age=300");
  res.json({ data: lookup.results, meta: { cached: lookup.cached } });
});

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

router.get("/prescriptions", async (req: AuthedRequest, res) => {
  const prescriptions = await prisma.prescription.findMany({
    where: doctorPatientWhere(req),
    include: { patient: true },
    orderBy: { prescriptionDate: "desc" },
  });
  res.json({ data: prescriptions });
});

router.post("/prescriptions", requireRole(Role.SUPER_ADMIN, Role.DOCTOR, Role.STAFF), async (req: AuthedRequest, res) => {
  const input = prescriptionSchema.parse(req.body);
  if (!(await enforceDoctorMedicationAccess(req, res, input.patientId))) return;
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: input.patientId },
    select: {
      attendingDoctor: {
        select: { id: true, firstName: true, lastName: true, sex: true, position: true, status: true },
      },
    },
  });
  let prescribedBy = input.prescribedBy.trim();
  if (req.user?.role === Role.DOCTOR) {
    const signedInDoctor = await prisma.employee.findFirst({
      where: { id: req.user.linkedEmployeeId ?? -1, position: "Psychiatrist", status: "ACTIVE" },
      select: { firstName: true, lastName: true, sex: true },
    });
    if (!signedInDoctor) {
      return res.status(403).json({ error: "Doctor account is not linked to an active psychiatrist profile" });
    }
    prescribedBy = prescriptionDoctorName(signedInDoctor);
  } else if (req.user?.role === Role.STAFF) {
    const attendingDoctor = patient.attendingDoctor;
    if (!attendingDoctor || attendingDoctor.position !== "Psychiatrist" || attendingDoctor.status !== "ACTIVE") {
      return res.status(400).json({ error: "Selected patient does not have an active attending psychiatrist" });
    }
    prescribedBy = prescriptionDoctorName(attendingDoctor);
  }
  const prescription = await prisma.prescription.create({
    data: {
      ...input,
      prescribedBy,
      prescriptionDate: new Date(input.prescriptionDate),
      items: input.items,
    },
  });
  res.status(201).json({ data: prescription });
});

router.get("/prescriptions/:id/pdf", async (req: AuthedRequest, res) => {
  const prescription = await prisma.prescription.findUniqueOrThrow({
    where: { id: Number(req.params.id) },
    include: { patient: true },
  });
  if (!(await enforceDoctorMedicationAccess(req, res, prescription.patientId))) return;
  const pdf = await renderPrescription(prescription);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="prescription-${prescription.patientId}-${prescription.id}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.send(pdf);
});

export default router;
