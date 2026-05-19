import { Employee } from "@prisma/client";

export interface PayrollInput {
  payPeriodStart: string;
  payPeriodEnd: string;
  daysWorked: number;
  overtimeHours?: number;
  otherDeductions?: number;
  includeSss?: boolean;
  includePhilhealth?: boolean;
  includePagibig?: boolean;
  note?: string;
}

export function calculatePayroll(employee: Employee, input: PayrollInput) {
  const overtimeHours = Number(input.overtimeHours ?? 0);
  const otherDeductions = Number(input.otherDeductions ?? 0);
  const daysPerMonth = employee.workDaysPerWeek === 5 ? 22 : 26;
  const dailyRate = Number(employee.baseSalary) / daysPerMonth;
  const grossPay = dailyRate * input.daysWorked + overtimeHours * (dailyRate / 8) * 1.25;
  const sss = input.includeSss === false ? 0 : 650;
  const philhealth = input.includePhilhealth === false ? 0 : 420;
  const pagibig = input.includePagibig === false ? 0 : 200;
  const tax = grossPay * 0.06;
  const totalDeductions = sss + philhealth + pagibig + tax + otherDeductions;
  const netPay = grossPay - totalDeductions;

  return {
    payPeriodStart: new Date(input.payPeriodStart),
    payPeriodEnd: new Date(input.payPeriodEnd),
    daysWorked: input.daysWorked,
    overtimeHours,
    grossPay,
    sss,
    philhealth,
    pagibig,
    tax,
    otherDeductions,
    totalDeductions,
    netPay,
    note: input.note,
  };
}
