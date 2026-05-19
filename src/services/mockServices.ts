import { AppData, CheckupRecord, Employee, Patient, PayrollRecord, User } from "../types";

const delay = <T>(value: T) => new Promise<T>((resolve) => window.setTimeout(() => resolve(value), 120));

export const patientService = {
  list: (data: AppData) => delay(data.patients),
  checkups: (data: AppData, patientId: number) => delay(data.checkups.filter((item) => item.patientId === patientId)),
  create: (patient: Omit<Patient, "id">) => delay(patient),
  update: (patient: Patient) => delay(patient),
  remove: (id: number) => delay({ id }),
};

export const checkupService = {
  list: (data: AppData) => delay(data.checkups),
  save: (checkup: CheckupRecord) => delay(checkup),
};

export const employeeService = {
  list: (data: AppData) => delay(data.employees),
  create: (employee: Omit<Employee, "id">) => delay(employee),
  update: (employee: Employee) => delay(employee),
  remove: (id: number) => delay({ id }),
};

export const payrollService = {
  list: (data: AppData) => delay(data.payrollRecords),
  save: (record: PayrollRecord) => delay(record),
};

export const authService = {
  users: (data: AppData) => delay(data.users),
  create: (user: Omit<User, "id">) => delay(user),
  update: (user: User) => delay(user),
  remove: (id: number) => delay({ id }),
};
