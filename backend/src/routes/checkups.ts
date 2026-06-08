import { Role } from "@prisma/client";
import { Response, Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const checkupSchema = z.object({
  patientId: z.number(),
  doctorId: z.number(),
  appointmentId: z.number().optional().nullable(),
  checkupDate: z.string(),
  chiefComplaint: z.string().optional().nullable(),
  symptoms: z.string().optional().nullable(),
  diagnosis: z.string().optional().nullable(),
  prescriptions: z.string().optional().nullable(),
  bloodPressure: z.string().optional().nullable(),
  temperature: z.number().optional().nullable(),
  heartRate: z.number().optional().nullable(),
  weight: z.number().optional().nullable(),
  height: z.number().optional().nullable(),
  notes: z.string().optional().nullable(),
  nextAppointment: z.string().optional().nullable(),
});

const bmi = (weight?: number | null, height?: number | null) => {
  if (!weight || !height) return null;
  const meters = height / 100;
  return Number((weight / (meters * meters)).toFixed(2));
};

function currentDoctorEmployeeId(req: AuthedRequest, res: Response) {
  if (req.user?.role !== Role.DOCTOR) return null;
  if (!req.user.linkedEmployeeId) {
    res.status(403).json({ error: "Doctor account is not linked to an employee profile" });
    return false;
  }
  return req.user.linkedEmployeeId;
}

router.use(requireAuth);

router.get("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (req: AuthedRequest, res) => {
  const doctorId = currentDoctorEmployeeId(req, res);
  if (doctorId === false) return;
  const checkups = await prisma.checkupRecord.findMany({
    where: doctorId ? { doctorId } : undefined,
    include: { patient: true, doctor: true },
    orderBy: { checkupDate: "desc" },
  });
  res.json({ data: checkups });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (req: AuthedRequest, res) => {
  const input = checkupSchema.parse(req.body);
  const doctorId = currentDoctorEmployeeId(req, res);
  if (doctorId === false) return;
  if (doctorId && input.doctorId !== doctorId) {
    return res.status(403).json({ error: "Doctors can only create checkups under their own doctor profile" });
  }
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: input.patientId } });
  if (doctorId && patient.attendingDoctorId !== doctorId) {
    return res.status(403).json({ error: "Doctors can only create checkups for assigned patients" });
  }
  if (patient.status === "DISCHARGED") {
    return res.status(400).json({ error: "Discharged patients cannot receive routine checkups" });
  }
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } });
    if (appointment.patientId !== input.patientId || appointment.doctorId !== input.doctorId) {
      return res.status(400).json({ error: "Appointment does not match the selected patient and doctor" });
    }
    if (appointment.status !== "SCHEDULED") {
      return res.status(400).json({ error: "Only scheduled appointments can be conducted" });
    }
  }
  const checkup = await prisma.checkupRecord.create({
    data: {
      ...input,
      checkupDate: new Date(input.checkupDate),
      nextAppointment: input.nextAppointment ? new Date(input.nextAppointment) : null,
      bmi: bmi(input.weight, input.height),
    },
  });
  if (input.appointmentId) {
    await prisma.appointment.update({ where: { id: input.appointmentId }, data: { status: "COMPLETED" } });
  }
  res.status(201).json({ data: checkup });
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (req: AuthedRequest, res) => {
  const input = checkupSchema.parse(req.body);
  const doctorId = currentDoctorEmployeeId(req, res);
  if (doctorId === false) return;
  const existingCheckup = await prisma.checkupRecord.findUniqueOrThrow({
    where: { id: Number(req.params.id) },
    select: { doctorId: true },
  });
  if (doctorId && existingCheckup.doctorId !== doctorId) {
    return res.status(403).json({ error: "Doctors can only update their own checkups" });
  }
  if (doctorId && input.doctorId !== doctorId) {
    return res.status(403).json({ error: "Doctors can only save checkups under their own doctor profile" });
  }
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: input.patientId } });
  if (doctorId && patient.attendingDoctorId !== doctorId) {
    return res.status(403).json({ error: "Doctors can only update checkups for assigned patients" });
  }
  if (patient.status === "DISCHARGED") {
    return res.status(400).json({ error: "Discharged patients cannot receive routine checkups" });
  }
  if (input.appointmentId) {
    const appointment = await prisma.appointment.findUniqueOrThrow({ where: { id: input.appointmentId } });
    if (appointment.patientId !== input.patientId || appointment.doctorId !== input.doctorId) {
      return res.status(400).json({ error: "Appointment does not match the selected patient and doctor" });
    }
  }
  const checkup = await prisma.checkupRecord.update({
    where: { id: Number(req.params.id) },
    data: {
      ...input,
      checkupDate: new Date(input.checkupDate),
      nextAppointment: input.nextAppointment ? new Date(input.nextAppointment) : null,
      bmi: bmi(input.weight, input.height),
    },
  });
  if (input.appointmentId) {
    await prisma.appointment.update({ where: { id: input.appointmentId }, data: { status: "COMPLETED" } });
  }
  res.json({ data: checkup });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN), async (req, res) => {
  await prisma.checkupRecord.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
