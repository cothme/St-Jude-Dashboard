import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

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

router.use(requireAuth);

router.get("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (_req, res) => {
  const checkups = await prisma.checkupRecord.findMany({
    include: { patient: true, doctor: true },
    orderBy: { checkupDate: "desc" },
  });
  res.json({ data: checkups });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (req, res) => {
  const input = checkupSchema.parse(req.body);
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: input.patientId } });
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

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.DOCTOR), async (req, res) => {
  const input = checkupSchema.parse(req.body);
  const patient = await prisma.patient.findUniqueOrThrow({ where: { id: input.patientId } });
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
