import { AppData } from "../types";

export const initialData: AppData = {
  users: [
    { id: 1, name: "Cecille Cosme", email: "admin@stjude.local", role: "Super admin", status: "Active" },
    { id: 2, name: "Ana Reyes", email: "staff@stjude.local", role: "Staff", status: "Active", linkedEmployeeId: 3 },
    { id: 3, name: "Dr. Miguel Cruz", email: "doctor@stjude.local", role: "Doctor", status: "Active", linkedEmployeeId: 1 },
  ],
  employees: [
    { id: 1, employeeCode: "SJ-001", firstName: "Miguel", lastName: "Cruz", sex: "Male", position: "Psychiatrist", department: "Clinical", email: "mcruz@stjude.local", phone: "0917 222 0101", hireDate: "2022-01-10", baseSalary: 68000, workDaysPerWeek: 5, status: "Active" },
    { id: 2, employeeCode: "SJ-002", firstName: "Lena", lastName: "Dizon", sex: "Female", position: "Nurse", department: "Custodial Care", email: "ldizon@stjude.local", phone: "0917 222 0102", hireDate: "2021-09-18", baseSalary: 34000, workDaysPerWeek: 6, status: "Active" },
    { id: 3, employeeCode: "SJ-003", firstName: "Ana", lastName: "Reyes", sex: "Female", position: "Care Staff", department: "Administration", email: "areyes@stjude.local", phone: "0917 222 0103", hireDate: "2023-04-03", baseSalary: 28000, workDaysPerWeek: 6, status: "Active" },
    { id: 4, employeeCode: "SJ-004", firstName: "Paolo", lastName: "Garcia", sex: "Male", position: "Cook", department: "Operations", email: "pgarcia@stjude.local", phone: "0917 222 0104", hireDate: "2020-11-20", baseSalary: 24000, workDaysPerWeek: 6, status: "Active" },
  ],
  patients: [
    { id: 1, firstName: "Ramon", lastName: "Villanueva", dateOfBirth: "1978-08-12", sex: "Male", civilStatus: "Single", nationality: "Filipino", address: "Quezon City", contactNumber: "0918 100 8801", emergencyContactName: "Elena Villanueva", emergencyContactNumber: "0918 100 8802", attendingDoctorId: 1, status: "Stable", ward: "A-102", admissionDate: "2025-12-04" },
    { id: 2, firstName: "Carmen", lastName: "Lopez", dateOfBirth: "1965-02-27", sex: "Female", civilStatus: "Widowed", nationality: "Filipino", address: "Caloocan City", contactNumber: "0918 100 8803", emergencyContactName: "Leo Lopez", emergencyContactNumber: "0918 100 8804", attendingDoctorId: 1, status: "Observation", ward: "B-205", admissionDate: "2026-01-14" },
    { id: 3, firstName: "Nestor", lastName: "Lim", dateOfBirth: "1989-05-06", sex: "Male", civilStatus: "Married", nationality: "Filipino", address: "Marikina City", contactNumber: "0918 100 8805", emergencyContactName: "Mina Lim", emergencyContactNumber: "0918 100 8806", attendingDoctorId: 1, status: "Admitted", ward: "A-107", admissionDate: "2026-03-01" },
  ],
  checkups: [
    { id: 1, patientId: 1, doctorId: 1, checkupDate: "2026-05-11", chiefComplaint: "Sleep disturbance", symptoms: "Insomnia, restlessness", diagnosis: "Anxiety symptoms under monitoring", prescriptions: "Continue current medication", bloodPressure: "120/80", temperature: 98.2, heartRate: 74, weight: 67, height: 168, bmi: 23.74, notes: "Stable mood during interview.", nextAppointment: "2026-05-25" },
    { id: 2, patientId: 2, doctorId: 1, checkupDate: "2026-05-15", chiefComplaint: "Low appetite", symptoms: "Fatigue, reduced intake", diagnosis: "Needs nutritional observation", prescriptions: "Meal monitoring and hydration", bloodPressure: "118/78", temperature: 98.6, heartRate: 80, weight: 54, height: 158, bmi: 21.63, notes: "Coordinate with care staff.", nextAppointment: "2026-05-22" },
  ],
  payrollRecords: [
    { id: 1, employeeId: 2, payPeriodStart: "2026-05-01", payPeriodEnd: "2026-05-15", daysWorked: 13, overtimeHours: 4, grossPay: 18307.69, sss: 650, philhealth: 420, pagibig: 200, tax: 980, otherDeductions: 0, totalDeductions: 2250, netPay: 16057.69 },
  ],
  forms: [
    {
      id: 1,
      templateId: "patient-admission",
      title: "Patient Admission Form",
      category: "Patient Care",
      submittedBy: "Ana Reyes",
      submittedAt: "2026-05-18T09:20:00",
      status: "Reviewed",
      fields: {
        "Patient name": "Nestor Lim",
        "Ward / room": "A-107",
        "Primary concern": "New admission intake",
      },
    },
  ],
  activityLogs: [
    {
      id: 1,
      actorId: 1,
      actorName: "Cecille Cosme",
      actorRole: "Super admin",
      action: "Reviewed",
      entity: "Role access",
      summary: "Reviewed Super admin, Staff, and Doctor access scopes.",
      timestamp: "2026-05-18T10:15:00",
      severity: "info",
    },
    {
      id: 2,
      actorId: 2,
      actorName: "Ana Reyes",
      actorRole: "Staff",
      action: "Updated",
      entity: "Patient",
      summary: "Updated observation details for Carmen Lopez.",
      timestamp: "2026-05-19T14:30:00",
      severity: "success",
    },
    {
      id: 3,
      actorId: 1,
      actorName: "Cecille Cosme",
      actorRole: "Super admin",
      action: "Created",
      entity: "Payroll",
      summary: "Created payroll records for the latest cut-off period.",
      timestamp: "2026-05-20T16:05:00",
      severity: "success",
    },
  ],
  medicationSchedules: [
    { id: 1, patientId: 1, medication: "Sertraline", dosage: "50 mg", route: "Oral", frequency: "Once daily", times: ["08:00"], startDate: "2026-05-01", prescribedBy: "Dr. Miguel Cruz", status: "Active", instructions: "Give after breakfast." },
    { id: 2, patientId: 2, medication: "Quetiapine", dosage: "25 mg", route: "Oral", frequency: "At bedtime", times: ["20:00"], startDate: "2026-05-10", prescribedBy: "Dr. Miguel Cruz", status: "Active", instructions: "Monitor sedation." },
  ],
  medicationAdministrations: [
    { id: 1, scheduleId: 1, patientId: 1, medication: "Sertraline", dosage: "50 mg", administeredAt: "2026-05-25T08:04:00", administeredBy: "Lena Dizon", status: "Given", notes: "Taken with water." },
  ],
  prescriptions: [],
  appointments: [
    { id: 1, patientId: 1, doctorId: 1, startsAt: "2026-05-26T09:00:00", durationMinutes: 30, reason: "Follow-up checkup", location: "Consultation Room 1", status: "Scheduled", notes: "Review sleep pattern." },
    { id: 2, patientId: 2, doctorId: 1, startsAt: "2026-05-26T10:00:00", durationMinutes: 45, reason: "Medication review", location: "Consultation Room 1", status: "Scheduled" },
  ],
};
