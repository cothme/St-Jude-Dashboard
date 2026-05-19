import { Employee, PayrollRecord } from "@prisma/client";

const money = (value: unknown) =>
  new Intl.NumberFormat("en-PH", { style: "currency", currency: "PHP" }).format(Number(value));

const date = (value: Date) =>
  new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(value);

const esc = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char] ?? char);

export function renderPayslip(record: PayrollRecord, employee: Employee) {
  const rows = [
    ["Gross Pay", money(record.grossPay)],
    ["SSS", money(record.sss)],
    ["PhilHealth", money(record.philhealth)],
    ["Pag-IBIG", money(record.pagibig)],
    ["Withholding Tax", money(record.tax)],
    ["Other Deductions", money(record.otherDeductions)],
    ["Total Deductions", money(record.totalDeductions)],
    ["Net Pay", money(record.netPay)],
  ];

  return `<!doctype html><html><head><meta charset="utf-8"><title>Payslip</title><style>
body{font-family:Arial,sans-serif;color:#132A13;background:#f5f8e8;padding:32px}.payslip{background:#fffff7;border:1px solid #dfe8ae;border-radius:8px;max-width:760px;margin:auto;padding:28px}
header{display:flex;justify-content:space-between;gap:24px;border-bottom:3px solid #31572C;padding-bottom:18px}.muted{color:#627047;font-size:13px}h1,h2,p{margin:0}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:10px;margin:22px 0}.box{background:#f6f9df;border-radius:8px;padding:12px}
table{border-collapse:collapse;width:100%}td{border-bottom:1px solid #dfe8ae;padding:12px 8px}td:last-child{text-align:right;font-weight:700}tr:last-child td{border-bottom:0;color:#31572C;font-size:18px;font-weight:800}
@media print{body{background:white;padding:0}.payslip{border:0}}</style></head><body><main class="payslip">
<header><div><p class="muted">St. Jude Psychiatric and Custodial Home</p><h1>Employee Payslip</h1></div><div><p class="muted">Pay Period</p><h2>${esc(date(record.payPeriodStart))} - ${esc(date(record.payPeriodEnd))}</h2></div></header>
<section class="grid"><div class="box"><p class="muted">Employee</p><h2>${esc(employee.firstName)} ${esc(employee.lastName)}</h2></div><div class="box"><p class="muted">Employee ID</p><h2>${esc(employee.employeeCode)}</h2></div><div class="box"><p class="muted">Position</p><h2>${esc(employee.position)}</h2></div><div class="box"><p class="muted">Department</p><h2>${esc(employee.department)}</h2></div><div class="box"><p class="muted">Days Worked</p><h2>${record.daysWorked}</h2></div><div class="box"><p class="muted">Overtime Hours</p><h2>${record.overtimeHours}</h2></div></section>
<table><tbody>${rows.map(([label, value]) => `<tr><td>${esc(label)}</td><td>${esc(value)}</td></tr>`).join("")}</tbody></table>
</main></body></html>`;
}
