import { Prisma, RecordStatus, Role, Sex } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { prisma } from "../db.js";
import { deleteUploadThingFile } from "../uploadthing.js";

const router = Router();
const employeeFieldsSchema = z.object({
  firstName: z.string().min(1),
  lastName: z.string().min(1),
  profileImageUrl: z.string().optional().nullable(),
  profileImageKey: z.string().optional().nullable(),
  sex: z.nativeEnum(Sex).default(Sex.MALE),
  position: z.string().min(1),
  department: z.string().min(1),
  email: z.string().email().optional().nullable(),
  phone: z.string().optional().nullable(),
  hireDate: z.string(),
  baseSalary: z.number().nonnegative(),
  workDaysPerWeek: z.union([z.literal(5), z.literal(6)]),
  status: z.nativeEnum(RecordStatus).default("ACTIVE"),
});
const employeeCreateSchema = employeeFieldsSchema.extend({
  employeeCode: z.preprocess(
    (value) => typeof value === "string" && value.trim() === "" ? undefined : value,
    z.string().trim().min(1).optional(),
  ),
});
const employeeUpdateSchema = employeeFieldsSchema.extend({
  employeeCode: z.string().min(1),
});

async function generateEmployeeCode() {
  const employees = await prisma.employee.findMany({ select: { employeeCode: true } });
  const nextNumber = employees.reduce((max, employee) => {
    const match = /^SJ-(\d+)$/i.exec(employee.employeeCode);
    return match ? Math.max(max, Number(match[1])) : max;
  }, 0) + 1;
  return `SJ-${String(nextNumber).padStart(3, "0")}`;
}

router.use(requireAuth);

router.get("/", async (_req, res) => {
  const employees = await prisma.employee.findMany({ orderBy: { id: "asc" } });
  res.json({ data: employees });
});

router.post("/", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = employeeCreateSchema.parse(req.body);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const employeeCode = input.employeeCode ?? await generateEmployeeCode();
    try {
      const employee = await prisma.employee.create({
        data: { ...input, employeeCode, hireDate: new Date(input.hireDate) },
      });
      res.status(201).json({ data: employee });
      return;
    } catch (error) {
      if (input.employeeCode || !(error instanceof Prisma.PrismaClientKnownRequestError) || error.code !== "P2002") {
        throw error;
      }
    }
  }
  throw new Error("Failed to generate a unique employee code");
});

router.put("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const input = employeeUpdateSchema.parse(req.body);
  const employee = await prisma.employee.update({
    where: { id: Number(req.params.id) },
    data: { ...input, hireDate: new Date(input.hireDate) },
  });
  res.json({ data: employee });
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN, Role.STAFF), async (req, res) => {
  const employee = await prisma.employee.findUniqueOrThrow({
    where: { id: Number(req.params.id) },
    select: { profileImageKey: true },
  });
  await prisma.employee.delete({ where: { id: Number(req.params.id) } });
  await deleteUploadThingFile(employee.profileImageKey);
  res.status(204).send();
});

export default router;
