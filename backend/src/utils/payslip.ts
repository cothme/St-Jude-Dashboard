import { Employee, PayrollRecord } from "@prisma/client";
import PDFDocument from "pdfkit";

type PayrollWithEmployee = PayrollRecord & { employee: Employee };

const money = (value: unknown) =>
  Number(value).toLocaleString("en-PH", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const date = (value: Date) => {
  const day = String(value.getDate()).padStart(2, "0");
  const month = String(value.getMonth() + 1).padStart(2, "0");
  return `${day}-${month}-${value.getFullYear()}`;
};

export function renderPayslip(record: PayrollWithEmployee): Promise<Buffer> {
  return createPdf((doc) => {
    drawPayslip(doc, record, false);
  });
}

export function renderBulkPayslips(records: PayrollWithEmployee[]): Promise<Buffer> {
  return createPdf((doc) => {
    records.forEach((record, index) => {
      const positionOnPage = index % 3;
      if (index > 0 && positionOnPage === 0) doc.addPage();
      if (positionOnPage === 0) doc.y = doc.page.margins.top;
      drawPayslip(doc, record, true);
      if (positionOnPage < 2 && index < records.length - 1) {
        const y = doc.y + 8;
        doc.moveTo(doc.page.margins.left, y).lineTo(doc.page.width - doc.page.margins.right, y).dash(4, { space: 4 }).stroke();
        doc.undash();
        doc.y = y + 8;
      }
    });
  });
}

function createPdf(draw: (doc: PDFKit.PDFDocument) => void): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 14, size: "A4", layout: "portrait" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    draw(doc);
    doc.end();
  });
}

function drawPayslip(doc: PDFKit.PDFDocument, record: PayrollWithEmployee, compact: boolean) {
  const left = doc.page.margins.left;
  const top = doc.y;
  const width = doc.page.width - doc.page.margins.left - doc.page.margins.right;
  const halfWidth = width / 2;
  const centerX = left + halfWidth;
  const padding = compact ? 2 : 5;
  const fontSize = compact ? 6.5 : 9;
  const titleSize = compact ? 7.5 : 11;
  const rowHeight = compact ? 10 : 18;
  const companyHeaderHeight = compact ? 24 : 36;
  const infoTitleHeight = compact ? 13 : 20;
  const infoBodyHeight = rowHeight * 3;
  const bandHeight = compact ? 14 : 22;
  const columnHeaderHeight = compact ? 15 : 22;
  const detailHeight = compact ? 82 : 168;
  const totalHeight = compact ? 15 : 22;
  const netHeight = compact ? 15 : 22;
  const wordsHeight = compact ? 15 : 24;
  const amountWidth = compact ? 66 : 82;

  doc.lineWidth(1.1).strokeColor("black").fillColor("black");
  doc.rect(left, top, width, companyHeaderHeight).stroke();
  doc.font("Times-Bold").fontSize(titleSize).text("St. Jude Psychiatric and Custodial Home", left + padding, top + (compact ? 3 : 5), { width: width - padding * 2, align: "center" });
  doc.font("Times-Roman").fontSize(compact ? 5.5 : 7.5).text("Payroll Payslip", left + padding, top + (compact ? 13 : 22), { width: width - padding * 2, align: "center" });

  const employeeInfoTitleTop = top + companyHeaderHeight;
  doc.font("Times-Bold").fontSize(titleSize);
  doc.rect(left, employeeInfoTitleTop, width, infoTitleHeight).stroke();
  doc.text("Employee Information", left + padding, employeeInfoTitleTop + (compact ? 2 : 4), { width: width - padding * 2 });

  const infoTop = employeeInfoTitleTop + infoTitleHeight;
  doc.rect(left, infoTop, width, infoBodyHeight).stroke();
  const employee = record.employee;
  const name = `${employee.firstName} ${employee.lastName}`;
  const infoRows = [
    ["Employee Code", employee.employeeCode, "Employee Name", name],
    ["Pay Period From and To date", `${date(record.payPeriodStart)} To ${date(record.payPeriodEnd)}`, "Department Description", employee.department],
    ["Currency", "PHP", "Position", employee.position],
  ];
  const leftLabelX = left + padding;
  const leftValueX = left + halfWidth * 0.33;
  const rightLabelX = centerX + padding;
  const rightValueX = centerX + halfWidth * 0.5;
  doc.font("Times-Roman").fontSize(fontSize);
  infoRows.forEach((row, index) => {
    const y = infoTop + index * rowHeight + (compact ? 2 : 4);
    doc.font("Times-Roman").text(row[0], leftLabelX, y, { width: leftValueX - leftLabelX - padding });
    doc.font("Times-Bold").text(row[1], leftValueX, y, { width: centerX - leftValueX - padding });
    doc.font("Times-Roman").text(row[2], rightLabelX, y, { width: rightValueX - rightLabelX - padding });
    doc.font("Times-Bold").text(row[3], rightValueX, y, { width: left + width - rightValueX - padding });
  });

  const bandTop = infoTop + infoBodyHeight;
  doc.rect(left, bandTop, width, bandHeight).stroke();
  doc.font("Times-Bold").fontSize(titleSize).text("Earnings", left + padding, bandTop + (compact ? 2 : 4), { width: halfWidth - padding * 2 });
  doc.text("Deductions", centerX + padding, bandTop + (compact ? 2 : 4), { width: halfWidth - padding * 2, align: "center" });

  const headerTop = bandTop + bandHeight;
  doc.rect(left, headerTop, width, columnHeaderHeight).stroke();
  doc.moveTo(centerX, headerTop).lineTo(centerX, headerTop + columnHeaderHeight).stroke();
  doc.text("Earnings", left + padding, headerTop + (compact ? 2 : 4), { width: halfWidth - amountWidth - padding * 2 });
  doc.text("Amount", left + halfWidth - amountWidth - padding, headerTop + (compact ? 2 : 4), { width: amountWidth, align: "right" });
  doc.text("Deductions", centerX + padding, headerTop + (compact ? 2 : 4), { width: halfWidth - amountWidth - padding * 2 });
  doc.text("Amount", left + width - amountWidth - padding, headerTop + (compact ? 2 : 4), { width: amountWidth, align: "right" });

  const detailTop = headerTop + columnHeaderHeight;
  doc.rect(left, detailTop, width, detailHeight).stroke();
  doc.moveTo(centerX, detailTop).lineTo(centerX, detailTop + detailHeight + totalHeight + netHeight).stroke();
  const basePay = Number(record.grossPay) - Number(record.overtimeHours) * (Number(employee.baseSalary) / (employee.workDaysPerWeek === 5 ? 22 : 26) / 8) * 1.25;
  const overtimePay = Number(record.grossPay) - basePay;
  const earnings = [
    ["Basic pay", basePay],
    [`Overtime Pay (${money(record.overtimeHours)} hrs)`, overtimePay],
  ].filter((item) => Number(item[1]) !== 0);
  const deductions = [
    ["SSS Contribution", Number(record.sss)],
    ["PhilHealth", Number(record.philhealth)],
    ["Pag-IBIG", Number(record.pagibig)],
    ["Income Tax", Number(record.tax)],
    ["Other Deductions", Number(record.otherDeductions)],
  ].filter((item) => Number(item[1]) !== 0);

  let y = detailTop + (compact ? 3 : 8);
  earnings.forEach(([label, amount]) => {
    drawAmountRow(doc, String(label), Number(amount), left, y, halfWidth, amountWidth, padding, fontSize);
    y += rowHeight;
  });
  y = detailTop + (compact ? 3 : 8);
  deductions.forEach(([label, amount]) => {
    drawAmountRow(doc, String(label), Number(amount), centerX, y, halfWidth, amountWidth, padding, fontSize);
    y += rowHeight;
  });

  const totalTop = detailTop + detailHeight;
  doc.rect(left, totalTop, width, totalHeight).stroke();
  drawAmountRow(doc, "Gross Pay", Number(record.grossPay), left, totalTop + (compact ? 2 : 4), halfWidth, amountWidth, padding, titleSize, true);
  drawAmountRow(doc, "Gross Deduction", Number(record.totalDeductions), centerX, totalTop + (compact ? 2 : 4), halfWidth, amountWidth, padding, titleSize, true);

  const netTop = totalTop + totalHeight;
  doc.rect(left, netTop, width, netHeight).stroke();
  drawAmountRow(doc, "Net Pay", Number(record.netPay), centerX, netTop + (compact ? 2 : 4), halfWidth, amountWidth, padding, titleSize, true);

  const wordsTop = netTop + netHeight;
  doc.rect(left, wordsTop, width, wordsHeight).stroke();
  doc.font("Times-Bold").fontSize(titleSize).text("Amount in Words", left + padding, wordsTop + (compact ? 3 : 4), { width: compact ? 80 : 115 });
  doc.text(amountToWords(Number(record.netPay)), left + (compact ? 84 : 120), wordsTop + (compact ? 3 : 4), { width: width - (compact ? 90 : 130), align: "center" });
  doc.y = wordsTop + wordsHeight;
}

function drawAmountRow(doc: PDFKit.PDFDocument, label: string, amount: number, x: number, y: number, width: number, amountWidth: number, padding: number, fontSize: number, bold = false) {
  doc.font(bold ? "Times-Bold" : "Times-Roman").fontSize(fontSize);
  doc.text(label, x + padding, y, { width: width - amountWidth - padding * 3 });
  doc.text(money(amount), x + width - amountWidth - padding, y, { width: amountWidth, align: "right" });
}

function amountToWords(value: number) {
  const pesos = Math.floor(Math.abs(value));
  const centavos = Math.round((Math.abs(value) - pesos) * 100);
  const words = titleCase(numberToWords(pesos));
  return centavos === 0 ? `${words} Philippine Pesos Only.` : `${words} Philippine Pesos And ${titleCase(numberToWords(centavos))} Centavos Only.`;
}

function numberToWords(value: number): string {
  const ones = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
  const tens = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
  if (value < 20) return ones[value];
  if (value < 100) return `${tens[Math.floor(value / 10)]}${value % 10 ? ` ${ones[value % 10]}` : ""}`;
  if (value < 1000) return `${ones[Math.floor(value / 100)]} hundred${value % 100 ? ` ${numberToWords(value % 100)}` : ""}`;
  for (const unit of [{ value: 1000000000, label: "billion" }, { value: 1000000, label: "million" }, { value: 1000, label: "thousand" }]) {
    if (value >= unit.value) return `${numberToWords(Math.floor(value / unit.value))} ${unit.label}${value % unit.value ? ` ${numberToWords(value % unit.value)}` : ""}`;
  }
  return "zero";
}

function titleCase(value: string) {
  return value.replace(/\w\S*/g, (word) => word.charAt(0).toUpperCase() + word.slice(1));
}
