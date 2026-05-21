import { AppData, CheckupRecord, Employee, Patient, PayrollRecord, Role, User } from "../types";

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
};

export const backendApi = {
  async loadAppData(): Promise<Partial<AppData>> {
    const [patients, checkups, employees, payrollRecords, forms, users] = await Promise.all([
      apiFetch<{ data: any[] }>("/patients"),
      apiFetch<{ data: any[] }>("/checkups"),
      apiFetch<{ data: any[] }>("/employees"),
      apiFetch<{ data: any[] }>("/payroll").catch(() => ({ data: [] })),
      apiFetch<{ data: any[] }>("/forms"),
      apiFetch<{ data: any[] }>("/users").catch(() => ({ data: [] })),
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
    };
  },
  createPatient: (patient: Omit<Patient, "id">) => apiFetch<{ data: any }>("/patients", { method: "POST", body: JSON.stringify(patientToApi(patient)) }),
  updatePatient: (patient: Patient) => apiFetch<{ data: any }>(`/patients/${patient.id}`, { method: "PUT", body: JSON.stringify(patientToApi(patient)) }),
  deletePatient: (id: number) => apiFetch<void>(`/patients/${id}`, { method: "DELETE" }),
  createEmployee: (employee: Omit<Employee, "id">) => apiFetch<{ data: any }>("/employees", { method: "POST", body: JSON.stringify(employeeToApi(employee)) }),
  updateEmployee: (employee: Employee) => apiFetch<{ data: any }>(`/employees/${employee.id}`, { method: "PUT", body: JSON.stringify(employeeToApi(employee)) }),
  deleteEmployee: (id: number) => apiFetch<void>(`/employees/${id}`, { method: "DELETE" }),
  createCheckup: (checkup: Omit<CheckupRecord, "id" | "bmi">) => apiFetch<{ data: any }>("/checkups", { method: "POST", body: JSON.stringify(checkupToApi(checkup)) }),
  updateCheckup: (checkup: CheckupRecord) => apiFetch<{ data: any }>(`/checkups/${checkup.id}`, { method: "PUT", body: JSON.stringify(checkupToApi(checkup)) }),
  deleteCheckup: (id: number) => apiFetch<void>(`/checkups/${id}`, { method: "DELETE" }),
  createPayroll: (record: Omit<PayrollRecord, "id">) => apiFetch<{ data: any }>("/payroll", { method: "POST", body: JSON.stringify(payrollToApi(record)) }),
  createBulkPayroll: (records: Array<Omit<PayrollRecord, "id">>) => Promise.all(records.map((record) => backendApi.createPayroll(record))),
  payslipUrl: (id: number) => `${API_BASE_URL}/payroll/${id}/payslip`,
  bulkPayslipUrl: () => `${API_BASE_URL}/payroll/payslips/bulk`,
  deletePayroll: (id: number) => apiFetch<void>(`/payroll/${id}`, { method: "DELETE" }),
  async createUser(user: Omit<User, "id"> & { password?: string }) {
    const result = await apiFetch<{ data: any }>("/users", { method: "POST", body: JSON.stringify({ name: user.name, email: user.email, password: user.password ?? "Password123!", role: roleToApi(user.role), linkedEmployeeId: user.linkedEmployeeId ?? null }) });
    rememberUserPhoto(result.data.id, result.data.email, user.profileImageUrl);
    return result;
  },
  async updateUser(user: User) {
    rememberUserPhoto(user.id, user.email, user.profileImageUrl);
    return apiFetch<{ data: any }>(`/users/${user.id}`, { method: "PUT", body: JSON.stringify({ name: user.name, role: roleToApi(user.role), linkedEmployeeId: user.linkedEmployeeId ?? null }) });
  },
  deleteUser: (id: number | string) => apiFetch<void>(`/users/${id}`, { method: "DELETE" }),
};

function employeeFromApi(item: any): Employee {
  return {
    id: item.id,
    employeeCode: item.employeeCode,
    firstName: item.firstName,
    lastName: item.lastName,
    profileImageUrl: item.profileImageUrl ?? undefined,
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
  };
}

function checkupFromApi(item: any): CheckupRecord {
  return {
    id: item.id,
    patientId: item.patientId,
    doctorId: item.doctorId,
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
    profileImageUrl: getStoredUserPhoto(item.id, item.email) ?? undefined,
    role: roleFromApi(item.role),
    status: "Active",
    linkedEmployeeId: item.linkedEmployeeId ?? undefined,
  };
}

function getStoredUserPhotos() {
  if (typeof localStorage === "undefined") return {};
  try {
    return JSON.parse(localStorage.getItem("stjude-user-photos") ?? "{}") as Record<string, string>;
  } catch {
    return {};
  }
}

function getStoredUserPhoto(id: number | string, email: string) {
  const photos = getStoredUserPhotos();
  return photos[String(id)] ?? photos[`email:${email}`];
}

function rememberUserPhoto(id: number | string, email: string, value?: string) {
  if (typeof localStorage === "undefined") return;
  const photos = getStoredUserPhotos();
  const keys = [String(id), `email:${email}`];
  for (const key of keys) {
    if (value) photos[key] = value;
    else delete photos[key];
  }
  localStorage.setItem("stjude-user-photos", JSON.stringify(photos));
}

function patientToApi(patient: Patient | Omit<Patient, "id">) {
  return {
    ...patient,
    profileImageUrl: patient.profileImageUrl || null,
    sex: patient.sex.toUpperCase(),
    civilStatus: patient.civilStatus.toUpperCase(),
    status: patient.status.toUpperCase(),
    attendingDoctorId: patient.attendingDoctorId || null,
  };
}

function employeeToApi(employee: Employee | Omit<Employee, "id">) {
  return {
    ...employee,
    profileImageUrl: employee.profileImageUrl || null,
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
