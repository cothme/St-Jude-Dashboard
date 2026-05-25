export type Role = "Super admin" | "Staff" | "Doctor";

export interface User {
  id: number | string;
  name: string;
  email: string;
  profileImageUrl?: string;
  role: Role;
  status: "Active" | "Inactive";
  linkedEmployeeId?: number;
}

export interface Patient {
  id: number;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  dateOfBirth: string;
  sex: "Male" | "Female";
  civilStatus: "Single" | "Married" | "Widowed" | "Divorced";
  nationality: string;
  address: string;
  contactNumber: string;
  emergencyContactName: string;
  emergencyContactNumber: string;
  attendingDoctorId: number;
  status: "Admitted" | "Stable" | "Observation" | "Discharged";
  ward: string;
  admissionDate: string;
}

export interface CheckupRecord {
  id: number;
  patientId: number;
  doctorId: number;
  checkupDate: string;
  chiefComplaint: string;
  symptoms: string;
  diagnosis: string;
  prescriptions: string;
  bloodPressure: string;
  temperature?: number;
  heartRate?: number;
  weight?: number;
  height?: number;
  bmi?: number;
  notes: string;
  nextAppointment: string;
}

export interface Employee {
  id: number;
  employeeCode: string;
  firstName: string;
  lastName: string;
  profileImageUrl?: string;
  position: string;
  department: string;
  email: string;
  phone: string;
  hireDate: string;
  baseSalary: number;
  workDaysPerWeek: 5 | 6;
  status: "Active" | "Inactive";
}

export interface PayrollRecord {
  id: number;
  employeeId: number;
  payPeriodStart: string;
  payPeriodEnd: string;
  daysWorked: number;
  overtimeHours: number;
  grossPay: number;
  sss: number;
  philhealth: number;
  pagibig: number;
  tax: number;
  otherDeductions: number;
  totalDeductions: number;
  netPay: number;
  note?: string;
}

export type FormCategory = "Patient Care" | "Clinical" | "HR" | "Payroll" | "Operations";

export interface CareFormSubmission {
  id: number;
  templateId: string;
  title: string;
  category: FormCategory;
  submittedBy: string;
  submittedAt: string;
  status: "Draft" | "Submitted" | "Reviewed";
  fields: Record<string, string>;
}

export interface ActivityLog {
  id: number;
  actorId: number | string;
  actorName: string;
  actorRole: Role;
  action: string;
  entity: string;
  summary: string;
  details?: string[];
  timestamp: string;
  severity: "info" | "success" | "warning" | "danger";
}

export interface MedicationSchedule {
  id: number;
  patientId: number;
  medication: string;
  dosage: string;
  route: string;
  frequency: string;
  times: string[];
  startDate: string;
  endDate?: string;
  instructions?: string;
  prescribedBy: string;
  status: "Active" | "Paused" | "Completed";
}

export interface MedicationAdministration {
  id: number;
  scheduleId?: number;
  patientId: number;
  medication: string;
  dosage: string;
  administeredAt: string;
  administeredBy: string;
  status: "Given" | "Missed" | "Refused" | "Held";
  notes?: string;
}

export interface Appointment {
  id: number;
  patientId: number;
  doctorId: number;
  startsAt: string;
  durationMinutes: number;
  reason: string;
  location?: string;
  status: "Scheduled" | "Completed" | "Cancelled";
  notes?: string;
}

export interface AppData {
  patients: Patient[];
  checkups: CheckupRecord[];
  employees: Employee[];
  payrollRecords: PayrollRecord[];
  users: User[];
  forms: CareFormSubmission[];
  activityLogs: ActivityLog[];
  medicationSchedules: MedicationSchedule[];
  medicationAdministrations: MedicationAdministration[];
  appointments: Appointment[];
}
