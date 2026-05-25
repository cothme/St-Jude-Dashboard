import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { requireAuth, requireRole } from "../middleware/auth.js";
import { calculatePayroll } from "../utils/payroll.js";
import { renderBulkPayslips, renderPayslip } from "../utils/payslip.js";

const router = Router();
const payrollSchema = z.object({
  employeeId: z.number(),
  payPeriodStart: z.string(),
  payPeriodEnd: z.string(),
  daysWorked: z.number().int().nonnegative(),
  overtimeHours: z.number().nonnegative().default(0),
  otherDeductions: z.number().nonnegative().default(0),
  includeSss: z.boolean().default(true),
  includePhilhealth: z.boolean().default(true),
  includePagibig: z.boolean().default(true),
  note: z.string().optional(),
});
const bulkSchema = payrollSchema.omit({ employeeId: true }).extend({
  employeeIds: z.array(z.number()).min(1),
});

router.use(requireAuth, requireRole(Role.SUPER_ADMIN, Role.STAFF));

router.get("/", async (_req, res) => {
  const records = await prisma.payrollRecord.findMany({
    include: { employee: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: records });
});

router.post("/", async (req, res) => {
  const input = payrollSchema.parse(req.body);
  const employee = await prisma.employee.findUniqueOrThrow({ where: { id: input.employeeId } });
  const calculation = calculatePayroll(employee, input);
  const record = await prisma.payrollRecord.create({
    data: { employeeId: employee.id, ...calculation },
  });
  res.status(201).json({ data: record });
});

router.post("/bulk", async (req, res) => {
  const input = bulkSchema.parse(req.body);
  const employees = await prisma.employee.findMany({ where: { id: { in: input.employeeIds } } });
  const records = await prisma.$transaction(
    employees.map((employee) =>
      prisma.payrollRecord.create({
        data: {
          employeeId: employee.id,
          ...calculatePayroll(employee, { ...input, note: input.note ?? "Bulk payroll batch" }),
        },
      }),
    ),
  );
  res.status(201).json({ data: records });
});

router.post("/payslips/bulk", async (req, res) => {
  const input = z.object({ ids: z.array(z.number()).min(1) }).parse(req.body);
  const records = await prisma.payrollRecord.findMany({
    where: { id: { in: input.ids } },
    include: { employee: true },
    orderBy: { payPeriodEnd: "desc" },
  });
  const pdf = await renderBulkPayslips(records);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="payslips-bulk-${new Date().toISOString().slice(0, 10)}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.send(pdf);
});

router.get("/:id/payslip", async (req, res) => {
  const record = await prisma.payrollRecord.findUniqueOrThrow({
    where: { id: Number(req.params.id) },
    include: { employee: true },
  });
  const pdf = await renderPayslip(record);
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", `attachment; filename="payslip-${record.employee.employeeCode}-${record.id}.pdf"`);
  res.setHeader("Content-Length", pdf.length);
  res.send(pdf);
});

router.delete("/:id", requireRole(Role.SUPER_ADMIN), async (req, res) => {
  await prisma.payrollRecord.delete({ where: { id: Number(req.params.id) } });
  res.status(204).send();
});

export default router;
