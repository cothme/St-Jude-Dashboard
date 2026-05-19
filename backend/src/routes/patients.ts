import { CivilStatus, PatientStatus, Role, Sex } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const patientSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
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
});

router.use(requireAuth);

router.get("/", async (req, res) => {
  const q = typeof req.query.q === "string" ? req.query.q : "";
  const patients = await prisma.patient.findMany({
    where: q
      ? {
          OR: [
            { firstName: { contains: q, mode: "insensitive" } },
            { lastName: { contains: q, mode: "insensitive" } },
            { ward: { contains: q, mode: "insensitive" } },
          ],
        }
      : undefined,
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
    },
  });
  res.json({ data: patient });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  await prisma.patient.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
