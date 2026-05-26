import { RecordStatus, Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma } from "../db.js";

const router = Router();
const employeeSchema = z.object({
  employeeCode: z.string().min(1),
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  profileImageUrl: z.string().optional().nullable(),
  profileImageKey: z.string().optional().nullable(),
  position: z.string().min(1),
  department: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  hireDate: z.string(),
  baseSalary: z.number().nonnegative(),
  workDaysPerWeek: z.union([z.literal(5), z.literal(6)]),
  status: z.nativeEnum(RecordStatus).default("ACTIVE"),
});

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
  res.json({ data: employees });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = employeeSchema.parse(req.body);
  const employee = await prisma.employee.create({
    data: { ...input, hireDate: new Date(input.hireDate) },
  });
  res.status(201).json({ data: employee });
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = employeeSchema.parse(req.body);
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { ...input, hireDate: new Date(input.hireDate) },
  });
  res.json({ data: employee });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  await prisma.employee.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
