import type { AppData, Appointment, CheckupRecord, Employee, MedicationAdministration, MedicationSchedule, Patient, PayrollRecord, User } from "../types";
import { formatCurrency, formatDate } from "../utils";
import { doctorName, employeeName, patientName } from "./names";

export function changedFields<T extends object>(before: T | undefined, after: T, fields: Array<[keyof T, string]>) {
  const valueFrom = (source: T, key: keyof T) => source[key] as unknown;
  if (!before) return fields.map(([key, label]) => `${label}: ${displayLogValue(valueFrom(after, key))}`).filter((line) => !line.endsWith(": N/A"));
  return fields
    .filter(([key]) => valueFrom(before, key) !== valueFrom(after, key))
    .map(([key, label]) => `${label}: ${displayLogValue(valueFrom(before, key))} -> ${displayLogValue(valueFrom(after, key))}`);
}

export function patientLogDetails(patient: Patient | Omit<Patient, "id">, previous?: Patient) {
  return changedFields(previous, patient, [
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["status", "Status"],
    ["ward", "Ward / room"],
    ["attendingDoctorId", "Doctor ID"],
    ["contactNumber", "Contact"],
    ["emergencyContactName", "Emergency contact"],
    ["emergencyContactNumber", "Emergency number"],
    ["address", "Address"],
  ]);
}

export function patientDischargeLogDetails(patient: Patient) {
  return [
    `Discharge date: ${patient.dischargeDate ? formatDate(patient.dischargeDate) : "N/A"}`,
    `Reason: ${patient.dischargeReason || "N/A"}`,
    `Final condition: ${patient.dischargeCondition || "N/A"}`,
    `Instructions: ${patient.dischargeInstructions || "N/A"}`,
    `Medications: ${patient.dischargeMedications || "N/A"}`,
    `Follow-up: ${patient.dischargeFollowUp ? formatDate(patient.dischargeFollowUp) : "Not scheduled"}`,
    `Approved by: ${patient.dischargedBy || "N/A"}`,
  ];
}

export function employeeLogDetails(employee: Employee | Omit<Employee, "id">, previous?: Employee) {
  return changedFields(previous, employee, [
    ["employeeCode", "Employee code"],
    ["firstName", "First name"],
    ["lastName", "Last name"],
    ["position", "Position"],
    ["department", "Department"],
    ["baseSalary", "Base salary"],
    ["workDaysPerWeek", "Work days/week"],
    ["status", "Status"],
  ]);
}

export function userLogDetails(user: User | Omit<User, "id">, previous?: User) {
  return changedFields(previous, user, [
    ["name", "Name"],
    ["email", "Email"],
    ["role", "Role"],
    ["status", "Status"],
    ["linkedEmployeeId", "Linked employee ID"],
  ]);
}

export function checkupLogDetails(checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">, data: AppData, previous?: CheckupRecord) {
  return [
    `Patient: ${patientName(data, checkup.patientId)}`,
    `Doctor: ${doctorName(data, checkup.doctorId)}`,
    ...changedFields(previous, checkup, [
      ["checkupDate", "Checkup date"],
      ["chiefComplaint", "Chief complaint"],
      ["symptoms", "Symptoms"],
      ["diagnosis", "Diagnosis"],
      ["prescriptions", "Prescriptions"],
      ["bloodPressure", "Blood pressure"],
      ["temperature", "Temperature"],
      ["heartRate", "Heart rate"],
      ["weight", "Weight"],
      ["height", "Height"],
      ["notes", "Notes"],
      ["nextAppointment", "Next appointment"],
    ]),
  ];
}

export function payrollLogDetails(record: PayrollRecord | Omit<PayrollRecord, "id">, data: AppData) {
  return [
    `Employee: ${employeeName(data, record.employeeId)}`,
    `Pay period: ${formatDate(record.payPeriodStart)} - ${formatDate(record.payPeriodEnd)}`,
    `Days worked: ${record.daysWorked}`,
    `Overtime hours: ${record.overtimeHours}`,
    `Gross pay: ${formatCurrency(record.grossPay)}`,
    `Deductions: ${formatCurrency(record.totalDeductions)}`,
    `Net pay: ${formatCurrency(record.netPay)}`,
  ];
}

export function appointmentLogDetails(appointment: Appointment | Omit<Appointment, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, appointment.patientId)}`,
    `Doctor: ${doctorName(data, appointment.doctorId)}`,
    `Starts: ${formatDate(appointment.startsAt)}`,
    `Duration: ${appointment.durationMinutes} minutes`,
    `Reason: ${appointment.reason}`,
    `Location: ${appointment.location || "N/A"}`,
    `Status: ${appointment.status}`,
  ];
}

export function medicationScheduleLogDetails(schedule: MedicationSchedule | Omit<MedicationSchedule, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, schedule.patientId)}`,
    `Medication: ${schedule.medication}`,
    `Dosage: ${schedule.dosage}`,
    `Route: ${schedule.route}`,
    `Frequency: ${schedule.frequency}`,
    `Times: ${schedule.times.join(", ")}`,
    `Status: ${schedule.status}`,
  ];
}

export function medicationAdministrationLogDetails(record: MedicationAdministration | Omit<MedicationAdministration, "id">, data: AppData) {
  return [
    `Patient: ${patientName(data, record.patientId)}`,
    `Medication: ${record.medication}`,
    `Dosage: ${record.dosage}`,
    `Status: ${record.status}`,
    `Administered by: ${record.administeredBy}`,
    `Notes: ${record.notes || "N/A"}`,
  ];
}

export function displayLogValue(value: unknown) {
  if (value === undefined || value === null || value === "") return "N/A";
  if (typeof value === "number") return Number.isFinite(value) ? String(value) : "N/A";
  return String(value);
}
