import { Patient, Prescription } from "@prisma/client";
import fs from "node:fs";
import path from "node:path";
import PDFDocument from "pdfkit";

type PrescriptionWithPatient = Prescription & { patient: Patient };

type PrescriptionItem = {
  medication: string;
  dosage: string;
  frequency: string;
  duration?: string;
  quantity?: string;
  instructions?: string;
};

const headerName = "St. Jude's Psychiatric and Custodial Home";
const headerAddress = "Lot 2 & 3 Blk. 5 Rodriguez St. Brgy. San Isidro Taytay, Rizal";
const headerContact = "Tel. No. (02) 8 230-4355 / Cell No. 0999-2206013";
const logoPath = path.join(process.cwd(), "assets", "stjude-logo.png");

export function renderPrescription(record: PrescriptionWithPatient): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ margin: 36, size: "A5", layout: "portrait" });
    const chunks: Buffer[] = [];
    doc.on("data", (chunk) => chunks.push(chunk));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
    drawPrescription(doc, record);
    doc.end();
  });
}

function drawPrescription(doc: PDFKit.PDFDocument, record: PrescriptionWithPatient) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;
  const patient = record.patient;
  const items = normalizeItems(record.items);

  doc.fillColor("black").strokeColor("black").lineWidth(1);
  const rxFont = registerSymbolFont(doc);
  const logoSize = 48;
  const headerTextLeft = fs.existsSync(logoPath) ? left + logoSize + 8 : left;
  const headerTextWidth = fs.existsSync(logoPath) ? width - (logoSize + 8) : width;
  if (fs.existsSync(logoPath)) {
    doc.image(logoPath, left, 30, { fit: [logoSize, logoSize], align: "center", valign: "center" });
  }
  doc.font("Times-Bold").fontSize(16).text(headerName, headerTextLeft, 36, { width: headerTextWidth, align: "center" });
  doc.font("Times-Roman").fontSize(7.8).text(headerAddress, headerTextLeft, 56, { width: headerTextWidth, align: "center" });
  doc.font("Times-Roman").fontSize(8).text(headerContact, headerTextLeft, 67, { width: headerTextWidth, align: "center" });
  doc.moveTo(left - 2, 90).lineTo(right + 2, 90).stroke();
  doc.moveTo(left - 2, 94).lineTo(right + 2, 94).stroke();

  const infoTop = 112;
  drawLabelLine(doc, "Name:", `${patient.firstName} ${patient.lastName}`, left, infoTop, 235);
  drawLabelLine(doc, "Date:", formatDate(record.prescriptionDate), right - 118, infoTop - 3, 118);
  drawLabelLine(doc, "Address:", patient.address ?? "", left, infoTop + 26, 260);
  drawLabelLine(doc, "Age:", String(age(patient.dateOfBirth)), right - 118, infoTop + 23, 118);

  doc.font(rxFont).fontSize(54).text(rxFont === "RxSymbol" ? "℞" : "Rx", left + 4, 178);

  let y = 188;
  const textLeft = left + 78;
  items.forEach((item, index) => {
    const line = [
      item.medication,
      item.dosage,
      item.frequency,
      item.duration ? `for ${item.duration}` : "",
      item.quantity ? `# ${item.quantity}` : "",
    ].filter(Boolean).join(" - ");
    doc.font("Times-Bold").fontSize(11).text(`${index + 1}. ${line}`, textLeft, y, { width: right - textLeft, lineGap: 2 });
    y = doc.y + 4;
    if (item.instructions) {
      doc.font("Times-Roman").fontSize(9.5).text(item.instructions, textLeft + 14, y, { width: right - textLeft - 14, lineGap: 2 });
      y = doc.y + 8;
    }
  });

  if (record.notes) {
    doc.font("Times-Roman").fontSize(9.5).text(record.notes, textLeft, y + 4, { width: right - textLeft, lineGap: 2 });
  }

  const signatureTop = doc.page.height - 158;
  const signatureLeft = right - 178;
  doc.moveTo(signatureLeft, signatureTop).lineTo(right, signatureTop).stroke();
  doc.font("Times-Roman").fontSize(8).text("Signature", signatureLeft, signatureTop + 3, { width: right - signatureLeft, align: "center" });
  doc.font("Times-Bold").fontSize(9).text(record.prescribedBy, signatureLeft, signatureTop + 20, { width: right - signatureLeft, align: "center" });

  drawCredential(doc, "Lic. No.", signatureLeft, signatureTop + 48, right);
  drawCredential(doc, "PTR No.", signatureLeft, signatureTop + 67, right);
  drawCredential(doc, "S2 No.", signatureLeft, signatureTop + 86, right);
}

function drawLabelLine(doc: PDFKit.PDFDocument, label: string, value: string, x: number, y: number, width: number) {
  const labelWidth = label === "Address:" ? 49 : 36;
  doc.font("Times-Bold").fontSize(10).text(label, x, y, { width: labelWidth });
  doc.font("Times-Roman").fontSize(10).text(value, x + labelWidth, y, { width: width - labelWidth });
}

function drawCredential(doc: PDFKit.PDFDocument, label: string, x: number, y: number, right: number) {
  doc.font("Times-Roman").fontSize(9).text(label, x, y, { width: 45 });
  doc.moveTo(x + 50, y + 10).lineTo(right, y + 10).stroke();
}

function registerSymbolFont(doc: PDFKit.PDFDocument) {
  const fontPaths = [
    "C:/Windows/Fonts/seguisym.ttf",
    "C:/Windows/Fonts/arial.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
  ];
  const fontPath = fontPaths.find((item) => fs.existsSync(item));
  if (fontPath) {
    doc.registerFont("RxSymbol", fontPath);
    return "RxSymbol";
  }
  return "Times-Bold";
}

function normalizeItems(value: unknown): PrescriptionItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((item) => ({
      medication: String((item as PrescriptionItem).medication ?? "").trim(),
      dosage: String((item as PrescriptionItem).dosage ?? "").trim(),
      frequency: String((item as PrescriptionItem).frequency ?? "").trim(),
      duration: optional((item as PrescriptionItem).duration),
      quantity: optional((item as PrescriptionItem).quantity),
      instructions: optional((item as PrescriptionItem).instructions),
    }))
    .filter((item) => item.medication);
}

function optional(value: unknown) {
  const text = String(value ?? "").trim();
  return text || undefined;
}

function formatDate(value: Date) {
  return value.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "2-digit" });
}

function age(dateOfBirth: Date) {
  const today = new Date();
  let years = today.getFullYear() - dateOfBirth.getFullYear();
  const monthDelta = today.getMonth() - dateOfBirth.getMonth();
  if (monthDelta < 0 || (monthDelta === 0 && today.getDate() < dateOfBirth.getDate())) years -= 1;
  return years;
}
