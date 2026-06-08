import { CivilStatus, PatientStatus, Role, Sex } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { deleteUploadThingFile } from "../uploadthing.js";

const router = Router();
const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  profileImageUrl: z.string().optional().nullable(),
  profileImageKey: z.string().optional().nullable(),
  dateOfBirth: z.string(),
  sex: z.nativeEnum(Sex),
  civilStatus: z.nativeEnum(CivilStatus),
  nationality: z.string().min(1),
  address: z.string().min(1),
  contactNumber: z.string().optional().nullable(),
  emergencyContactName: z.string().optional().nullable(),
  emergencyContactNumber: z.string().optional().nullable(),
  attendingDoctorId: z.number().optional().nullable(),
  status: z.nativeEnum(PatientStatus).default("ADMITTED"),
  ward: z.string().min(1),
  admissionDate: z.string(),
  dischargeDate: z.string().optional().nullable(),
  dischargeReason: z.string().optional().nullable(),
  dischargeCondition: z.string().optional().nullable(),
  dischargeInstructions: z.string().optional().nullable(),
  dischargeMedications: z.string().optional().nullable(),
  dischargeFollowUp: z.string().optional().nullable(),
  dischargedBy: z.string().optional().nullable(),
});
const dischargeSchema = z.object({
  dischargeDate: z.string(),
  dischargeReason: z.string().min(1),
  dischargeCondition: z.string().min(1),
  dischargeInstructions: z.string().min(1),
  dischargeMedications: z.string().optional().nullable(),
  dischargeFollowUp: z.string().optional().nullable(),
  dischargedBy: z.string().min(1),
});

router.use(requireAuth);

router.get("/", async (req: AuthedRequest, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const doctorPatientFilter =
    req.user?.role === Role.DOCTOR
      ? { attendingDoctorId: req.user.linkedEmployeeId ?? -1 }
      : {};
  const patients = await prisma.patient.findMany({
    where: {
      ...doctorPatientFilter,
      ...(q
        ? {
            OR: [
              { firstName: { contains: q, mode: "insensitive" } },
              { lastName: { contains: q, mode: "insensitive" } },
              { ward: { contains: q, mode: "insensitive" } },
            ],
          }
        : {}),
    },
    include: { attendingDoctor: true },
    orderBy: { id: "asc" },
  });
  res.json({ data: patients });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = patientSchema.parse(req.body);
  const patient = await prisma.patient.create({
    data: {
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      admissionDate: new Date(input.admissionDate),
      dischargeDate: input.dischargeDate ? new Date(input.dischargeDate) : null,
      dischargeFollowUp: input.dischargeFollowUp ? new Date(input.dischargeFollowUp) : null,
    },
  });
  res.status(201).json({ data: patient });
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = patientSchema.parse(req.body);
  const patient = await prisma.patient.update({
    where: { id: Number(req.params.id) },
    data: {
      ...input,
      dateOfBirth: new Date(input.dateOfBirth),
      admissionDate: new Date(input.admissionDate),
      dischargeDate: input.dischargeDate ? new Date(input.dischargeDate) : null,
      dischargeFollowUp: input.dischargeFollowUp ? new Date(input.dischargeFollowUp) : null,
    },
  });
  res.json({ data: patient });
});

router.post("/:id/discharge", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = dischargeSchema.parse(req.body);
  const patientId = Number(req.params.id);
  const existing = await prisma.patient.findUnique({ where: { id: patientId }, select: { id: true, status: true } });
  if (!existing) {
    return res.status(404).json({ error: "Patient record not found" });
  }
  if (existing.status === PatientStatus.DISCHARGED) {
    return res.status(400).json({ error: "Patient is already discharged" });
  }
  const [patient, cancelledAppointments] = await prisma.$transaction(async (tx) => {
    const dischargedPatient = await tx.patient.update({
      where: { id: patientId },
      data: {
        status: PatientStatus.DISCHARGED,
        dischargeDate: new Date(input.dischargeDate),
        dischargeReason: input.dischargeReason,
        dischargeCondition: input.dischargeCondition,
        dischargeInstructions: input.dischargeInstructions,
        dischargeMedications: input.dischargeMedications ?? null,
        dischargeFollowUp: input.dischargeFollowUp ? new Date(input.dischargeFollowUp) : null,
        dischargedBy: input.dischargedBy,
      },
    });
    const scheduledAppointments = await tx.appointment.findMany({
      where: { patientId, status: "SCHEDULED" },
      select: { id: true },
    });
    const scheduledAppointmentIds = scheduledAppointments.map((appointment) => appointment.id);
    await tx.appointment.updateMany({
      where: { id: { in: scheduledAppointmentIds } },
      data: { status: "CANCELLED" },
    });
    const appointments = await tx.appointment.findMany({
      where: { id: { in: scheduledAppointmentIds } },
      orderBy: { startsAt: "asc" },
    });

    return [dischargedPatient, appointments];
  });
  res.json({ data: patient, cancelledAppointments });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const patient = await prisma.patient.findUniqueOrThrow({
    where: { id: Number(req.params.id) },
    select: { profileImageKey: true },
  });
  await prisma.patient.delete({ where: { id: Number(req.params.id) } });
  await deleteUploadThingFile(patient.profileImageKey);
  res.status(204).send();
});

export default router;
