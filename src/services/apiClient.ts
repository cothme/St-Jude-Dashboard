import { ActivityLog, AppData, Appointment, CheckupRecord, Employee, MedicationAdministration, MedicationSchedule, Patient, PatientDischargeInput, PayrollRecord, Role, User } from "../types";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";

type BackendRole = "SUPER_ADMIN" | "STAFF" | "DOCTOR";

const roleFromApi = (role: BackendRole): Role => {
  if (role === "SUPER_ADMIN") return "Super admin";
  if (role === "DOCTOR") return "Doctor";
  return "Staff";
};

const roleToApi = (role: Role): BackendRole => {
  if (role === "Super admin") return "SUPER_ADMIN";
  if (role === "Doctor") return "DOCTOR";
  return "STAFF";
};

const statusFromApi = (status: string) => {
  const normalized = status.toLowerCase().replace(/_/g, " ");
  return normalized.replace(/\b\w/g, (char) => char.toUpperCase());
};

const statusToApi = (status: string) => status.toUpperCase().replace(/\s+/g, "_");

async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options?.headers,
    },
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: "Request failed" }));
    throw new Error(error.error ?? "Request failed");
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

export const backendAuth = {
  signIn: (email: string, password: string) =>
    apiFetch<any>("/auth/sign-in/email", {
      method: "POST",
      body: JSON.stringify({ email, password, rememberMe: true }),
    }),
  signOut: () => apiFetch<any>("/auth/sign-out", { method: "POST" }),
  getSession: () => apiFetch<any>("/auth/get-session"),
  updateProfile: (profile: { name: string; profileImageUrl?: string; profileImageKey?: string }) => apiFetch<{ data: any }>("/users/me", { method: "PUT", body: JSON.stringify({ name: profile.name, profileImageUrl: profile.profileImageUrl || null, profileImageKey: profile.profileImageKey || null }) }),
  changePassword: (currentPassword: string, newPassword: string) => apiFetch<{ data: any }>("/users/me/password", { method: "PUT", body: JSON.stringify({ currentPassword, newPassword }) }),
};

export const backendApi = {
  async loadAppData(): Promise<Partial<AppData>> {
    const [patients, checkups, employees, payrollRecords, forms, users, activityLogs, medicationSchedules, medicationAdministrations, appointments] = await Promise.all([
      apiFetch<{ data: any[] }>("/patients"),
      apiFetch<{ data: any[] }>("/checkups").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/employees"),
      apiFetch<{ data: any[] }>("/payroll").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/forms"),
      apiFetch<{ data: any[] }>("/users").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/activity-logs").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/medications/schedules").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/medications/administrations").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/appointments").catch(() => ({ data: [] })),
    ]);

    return {
      employees: employees.data.map(employeeFromApi),
      patients: patients.data.map(patientFromApi),
      checkups: checkups.data.map(checkupFromApi),
      payrollRecords: payrollRecords.data.map(payrollFromApi),
      forms: forms.data.map((item) => ({
        id: item.id,
        templateId: item.templateId,
        title: item.title,
        category: item.category,
        submittedBy: item.submittedBy,
        submittedAt: item.submittedAt,
        status: statusFromApi(item.status) as "Draft" | "Submitted" | "Reviewed",
        fields: item.fields,
      })),
      users: users.data.map(userFromApi),
      activityLogs: activityLogs.data.map(activityLogFromApi),
      medicationSchedules: medicationSchedules.data.map(medicationScheduleFromApi),
      medicationAdministrations: medicationAdministrations.data.map(medicationAdministrationFromApi),
      appointments: appointments.data.map(appointmentFromApi),
    };
  },
  createPatient: (patient: Omit<Patient, "id">) => apiFetch<{ data: any }>("/patients", { method: "POST", body: JSON.stringify(patientToApi(patient)) }),
  updatePatient: (patient: Patient) => apiFetch<{ data: any }>(`/patients/${patient.id}`, { method: "PUT", body: JSON.stringify(patientToApi(patient)) }),
  dischargePatient: (id: number, discharge: PatientDischargeInput) => apiFetch<{ data: any }>(`/patients/${id}/discharge`, { method: "POST", body: JSON.stringify(discharge) }),
  deletePatient: (id: number) => apiFetch<void>(`/patients/${id}`, { method: "DELETE" }),
  createEmployee: (employee: Omit<Employee, "id">) => apiFetch<{ data: any }>("/employees", { method: "POST", body: JSON.stringify(employeeToApi(employee)) }),
  updateEmployee: (employee: Employee) => apiFetch<{ data: any }>(`/employees/${employee.id}`, { method: "PUT", body: JSON.stringify(employeeToApi(employee)) }),
  deleteEmployee: (id: number) => apiFetch<void>(`/employees/${id}`, { method: "DELETE" }),
  createCheckup: (checkup: Omit<CheckupRecord, "id" | "bmi">) => apiFetch<{ data: any }>("/checkups", { method: "POST", body: JSON.stringify(checkupToApi(checkup)) }),
  updateCheckup: (checkup: CheckupRecord) => apiFetch<{ data: any }>(`/checkups/${checkup.id}`, { method: "PUT", body: JSON.stringify(checkupToApi(checkup)) }),
  deleteCheckup: (id: number) => apiFetch<void>(`/checkups/${id}`, { method: "DELETE" }),
  createPayroll: (record: Omit<PayrollRecord, "id">) => apiFetch<{ data: any }>("/payroll", { method: "POST", body: JSON.stringify(payrollToApi(record)) }),
  createBulkPayroll: (records: Array<Omit<PayrollRecord, "id">>) => {
    const first = records[0];
    if (!first) return Promise.resolve({ data: [] });
    return apiFetch<{ data: any[] }>("/payroll/bulk", {
      method: "POST",
      body: JSON.stringify({
        employeeIds: records.map((record) => record.employeeId),
        payPeriodStart: first.payPeriodStart,
        payPeriodEnd: first.payPeriodEnd,
        daysWorked: first.daysWorked,
        overtimeHours: first.overtimeHours,
        otherDeductions: first.otherDeductions,
        includeSss: first.sss > 0,
        includePhilhealth: first.philhealth > 0,
        includePagibig: first.pagibig > 0,
        note: first.note,
      }),
    });
  },
  payslipUrl: (id: number) => `${API_BASE_URL}/payroll/${id}/payslip`,
  bulkPayslipUrl: () => `${API_BASE_URL}/payroll/payslips/bulk`,
  deletePayroll: (id: number) => apiFetch<void>(`/payroll/${id}`, { method: "DELETE" }),
  async createUser(user: Omit<User, "id"> & { password?: string }) {
    const result = await apiFetch<{ data: any }>("/users", { method: "POST", body: JSON.stringify({ name: user.name, email: user.email, profileImageUrl: user.profileImageUrl || null, profileImageKey: user.profileImageKey || null, password: user.password, role: roleToApi(user.role), linkedEmployeeId: user.linkedEmployeeId ?? null }) });
    return result;
  },
  async updateUser(user: User) {
    return apiFetch<{ data: any }>(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ name: user.name, profileImageUrl: user.profileImageUrl || null, profileImageKey: user.profileImageKey || null, role: roleToApi(user.role), linkedEmployeeId: user.linkedEmployeeId ?? null }) });
  },
  deleteUser: (id: number | string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
  createActivityLog: (activity: Omit<ActivityLog, "id" | "actorId" | "actorName" | "actorRole" | "timestamp">) => apiFetch<{ data: any }>("/activity-logs", { method: "POST", body: JSON.stringify(activity) }),
  createMedicationSchedule: (schedule: Omit<MedicationSchedule, "id">) => apiFetch<{ data: any }>("/medications/schedules", { method: "POST", body: JSON.stringify(medicationScheduleToApi(schedule)) }),
  updateMedicationSchedule: (schedule: MedicationSchedule) => apiFetch<{ data: any }>(`/medications/schedules/${schedule.id}`, { method: "PUT", body: JSON.stringify(medicationScheduleToApi(schedule)) }),
  deleteMedicationSchedule: (id: number) => apiFetch<void>(`/medications/schedules/${id}`, { method: "DELETE" }),
  createMedicationAdministration: (record: Omit<MedicationAdministration, "id">) => apiFetch<{ data: any }>("/medications/administrations", { method: "POST", body: JSON.stringify(medicationAdministrationToApi(record)) }),
  createAppointment: (appointment: Omit<Appointment, "id">) => apiFetch<{ data: any }>("/appointments", { method: "POST", body: JSON.stringify(appointmentToApi(appointment)) }),
  updateAppointment: (appointment: Appointment) => apiFetch<{ data: any }>(`/appointments/${appointment.id}`, { method: "PUT", body: JSON.stringify(appointmentToApi(appointment)) }),
  deleteAppointment: (id: number) => apiFetch<void>(`/appointments/${id}`, { method: "DELETE" }),
  deleteUpload: (key: string) => apiFetch<{ data: { success: boolean; deletedCount: number } }>(`/uploads/files/${encodeURIComponent(key)}`, { method: "DELETE" }),
};

function employeeFromApi(item: any): Employee {
  return {
    id: item.id,
    employeeCode: item.employeeCode,
    firstName: item.firstName,
    lastName: item.lastName,
    profileImageUrl: item.profileImageUrl ?? undefined,
    profileImageKey: item.profileImageKey ?? undefined,
    position: item.position,
    department: item.department,
    email: item.email ?? "",
    phone: item.phone ?? "",
    hireDate: item.hireDate?.slice(0, 10),
    baseSalary: Number(item.baseSalary),
    workDaysPerWeek: item.workDaysPerWeek,
    status: item.status === "ACTIVE" ? "Active" : "Inactive",
  };
}

function patientFromApi(item: any): Patient {
  return {
    id: item.id,
    firstName: item.firstName,
    lastName: item.lastName,
    profileImageUrl: item.profileImageUrl ?? undefined,
    profileImageKey: item.profileImageKey ?? undefined,
    dateOfBirth: item.dateOfBirth?.slice(0, 10),
    sex: item.sex === "FEMALE" ? "Female" : "Male",
    civilStatus: statusFromApi(item.civilStatus) as Patient["civilStatus"],
    nationality: item.nationality,
    address: item.address,
    contactNumber: item.contactNumber ?? "",
    emergencyContactName: item.emergencyContactName ?? "",
    emergencyContactNumber: item.emergencyContactNumber ?? "",
    attendingDoctorId: item.attendingDoctorId ?? 0,
    status: statusFromApi(item.status) as Patient["status"],
    ward: item.ward,
    admissionDate: item.admissionDate?.slice(0, 10),
    dischargeDate: item.dischargeDate?.slice(0, 10) ?? undefined,
    dischargeReason: item.dischargeReason ?? undefined,
    dischargeCondition: item.dischargeCondition ?? undefined,
    dischargeInstructions: item.dischargeInstructions ?? undefined,
    dischargeMedications: item.dischargeMedications ?? undefined,
    dischargeFollowUp: item.dischargeFollowUp?.slice(0, 10) ?? undefined,
    dischargedBy: item.dischargedBy ?? undefined,
  };
}

function checkupFromApi(item: any): CheckupRecord {
  return {
    id: item.id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    appointmentId: item.appointmentId ?? undefined,
    checkupDate: item.checkupDate?.slice(0, 10),
    chiefComplaint: item.chiefComplaint ?? "",
    symptoms: item.symptoms ?? "",
    diagnosis: item.diagnosis ?? "",
    prescriptions: item.prescriptions ?? "",
    bloodPressure: item.bloodPressure ?? "",
    temperature: item.temperature ? Number(item.temperature) : undefined,
    heartRate: item.heartRate ?? undefined,
    weight: item.weight ? Number(item.weight) : undefined,
    height: item.height ? Number(item.height) : undefined,
    bmi: item.bmi ? Number(item.bmi) : undefined,
    notes: item.notes ?? "",
    nextAppointment: item.nextAppointment?.slice(0, 10) ?? "",
  };
}

function payrollFromApi(item: any): PayrollRecord {
  return {
    id: item.id,
    employeeId: item.employeeId,
    payPeriodStart: item.payPeriodStart?.slice(0, 10),
    payPeriodEnd: item.payPeriodEnd?.slice(0, 10),
    daysWorked: item.daysWorked,
    overtimeHours: Number(item.overtimeHours),
    grossPay: Number(item.grossPay),
    sss: Number(item.sss),
    philhealth: Number(item.philhealth),
    pagibig: Number(item.pagibig),
    tax: Number(item.tax),
    otherDeductions: Number(item.otherDeductions),
    totalDeductions: Number(item.totalDeductions),
    netPay: Number(item.netPay),
    note: item.note ?? undefined,
  };
}

function userFromApi(item: any): User {
  return {
    id: item.id,
    name: item.name,
    email: item.email,
    profileImageUrl: item.image ?? undefined,
    profileImageKey: item.profileImageKey ?? undefined,
    role: roleFromApi(item.role),
    status: "Active",
    linkedEmployeeId: item.linkedEmployeeId ?? undefined,
  };
}

function activityLogFromApi(item: any): ActivityLog {
  return {
    id: item.id,
    actorId: item.actorId ?? "system",
    actorName: item.actorName,
    actorRole: roleFromApi(item.actorRole),
    action: item.action,
    entity: item.entity,
    summary: item.summary,
    details: Array.isArray(item.details) ? item.details : [],
    timestamp: item.timestamp,
    severity: item.severity ?? "info",
  };
}

function medicationScheduleFromApi(item: any): MedicationSchedule {
  return {
    id: item.id,
    patientId: item.patientId,
    medication: item.medication,
    dosage: item.dosage,
    route: item.route,
    frequency: item.frequency,
    times: Array.isArray(item.times) ? item.times : [],
    startDate: item.startDate?.slice(0, 10),
    endDate: item.endDate?.slice(0, 10) ?? undefined,
    instructions: item.instructions ?? undefined,
    prescribedBy: item.prescribedBy,
    status: statusFromApi(item.status) as MedicationSchedule["status"],
  };
}

function medicationAdministrationFromApi(item: any): MedicationAdministration {
  return {
    id: item.id,
    scheduleId: item.scheduleId ?? undefined,
    patientId: item.patientId,
    medication: item.medication,
    dosage: item.dosage,
    administeredAt: item.administeredAt,
    administeredBy: item.administeredBy,
    status: statusFromApi(item.status) as MedicationAdministration["status"],
    notes: item.notes ?? undefined,
  };
}

function appointmentFromApi(item: any): Appointment {
  return {
    id: item.id,
    patientId: item.patientId,
    doctorId: item.doctorId,
    startsAt: item.startsAt,
    durationMinutes: item.durationMinutes,
    reason: item.reason,
    location: item.location ?? undefined,
    status: statusFromApi(item.status) as Appointment["status"],
    notes: item.notes ?? undefined,
  };
}

function patientToApi(patient: Patient | Omit<Patient, "id">) {
  return {
    ...patient,
    profileImageUrl: patient.profileImageUrl || null,
    profileImageKey: patient.profileImageKey || null,
    sex: patient.sex.toUpperCase(),
    civilStatus: patient.civilStatus.toUpperCase(),
    status: patient.status.toUpperCase(),
    attendingDoctorId: patient.attendingDoctorId || null,
    dischargeDate: patient.dischargeDate || null,
    dischargeReason: patient.dischargeReason || null,
    dischargeCondition: patient.dischargeCondition || null,
    dischargeInstructions: patient.dischargeInstructions || null,
    dischargeMedications: patient.dischargeMedications || null,
    dischargeFollowUp: patient.dischargeFollowUp || null,
    dischargedBy: patient.dischargedBy || null,
  };
}

function employeeToApi(employee: Employee | Omit<Employee, "id">) {
  return {
    ...employee,
    profileImageUrl: employee.profileImageUrl || null,
    profileImageKey: employee.profileImageKey || null,
    status: employee.status.toUpperCase(),
  };
}

function checkupToApi(checkup: CheckupRecord | Omit<CheckupRecord, "id" | "bmi">) {
  return checkup;
}

function payrollToApi(record: Omit<PayrollRecord, "id">) {
  return {
    employeeId: record.employeeId,
    payPeriodStart: record.payPeriodStart,
    payPeriodEnd: record.payPeriodEnd,
    daysWorked: record.daysWorked,
    overtimeHours: record.overtimeHours,
    otherDeductions: record.otherDeductions,
    includeSss: record.sss > 0,
    includePhilhealth: record.philhealth > 0,
    includePagibig: record.pagibig > 0,
    note: record.note,
  };
}

function medicationScheduleToApi(schedule: Omit<MedicationSchedule, "id"> | MedicationSchedule) {
  return {
    ...schedule,
    endDate: schedule.endDate || null,
    instructions: schedule.instructions || null,
    status: statusToApi(schedule.status),
  };
}

function medicationAdministrationToApi(record: Omit<MedicationAdministration, "id">) {
  return {
    ...record,
    scheduleId: record.scheduleId ?? null,
    notes: record.notes || null,
    status: statusToApi(record.status),
  };
}

function appointmentToApi(appointment: Omit<Appointment, "id"> | Appointment) {
  return {
    ...appointment,
    location: appointment.location || null,
    notes: appointment.notes || null,
    status: statusToApi(appointment.status),
  };
}
