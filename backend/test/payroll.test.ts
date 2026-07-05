import { describe, expect, it } from "vitest";
import type { Employee } from "@prisma/client";
import { calculatePayroll } from "../src/utils/payroll";

function employee(overrides: Partial<Employee> = {}): Employee {
  return {
    id: 1,
    employeeCode: "EMP-0001",
    firstName: "Test",
    lastName: "Employee",
    profileImageUrl: null,
    profileImageKey: null,
    sex: "MALE",
    position: "Nursing Attendant",
    department: "Care",
    email: null,
    phone: null,
    hireDate: new Date("2026-01-01T00:00:00Z"),
    baseSalary: 26000 as unknown as Employee["baseSalary"],
    workDaysPerWeek: 6,
    status: "ACTIVE",
    createdAt: new Date("2026-01-01T00:00:00Z"),
    updatedAt: new Date("2026-01-01T00:00:00Z"),
    ...overrides,
  };
}

describe("calculatePayroll", () => {
  it("calculates gross pay, statutory deductions, tax, and net pay for a 6-day schedule", () => {
    const payroll = calculatePayroll(employee(), {
      payPeriodStart: "2026-06-01",
      payPeriodEnd: "2026-06-15",
      daysWorked: 13,
      overtimeHours: 8,
      otherDeductions: 300,
    });

    expect(payroll.grossPay).toBe(14250);
    expect(payroll.sss).toBe(650);
    expect(payroll.philhealth).toBe(420);
    expect(payroll.pagibig).toBe(200);
    expect(payroll.tax).toBe(855);
    expect(payroll.totalDeductions).toBe(2425);
    expect(payroll.netPay).toBe(11825);
  });

  it("uses 22 work days per month for a 5-day schedule", () => {
    const payroll = calculatePayroll(employee({ baseSalary: 22000 as unknown as Employee["baseSalary"], workDaysPerWeek: 5 }), {
      payPeriodStart: "2026-06-01",
      payPeriodEnd: "2026-06-15",
      daysWorked: 10,
      includeSss: false,
      includePhilhealth: false,
      includePagibig: false,
    });

    expect(payroll.grossPay).toBe(10000);
    expect(payroll.totalDeductions).toBe(600);
    expect(payroll.netPay).toBe(9400);
  });
});
