import type { AppData, Employee } from "../types";

export function patientName(data: AppData, id: number) {
  const patient = data.patients.find((item) => item.id === id);
  return patient ? `${patient.firstName} ${patient.lastName}` : "Unknown patient";
}

export function employeeName(data: AppData, id: number) {
  const employee = data.employees.find((item) => item.id === id);
  return employee ? `${employee.firstName} ${employee.lastName}` : "Unknown employee";
}

export function doctorName(data: AppData, id: number) {
  const employee = data.employees.find((item) => item.id === id);
  return employee ? doctorNameFromEmployee(employee) : "Unassigned";
}

export function doctorNameFromEmployee(employee: Employee) {
  return employee.position === "Psychiatrist" ? `${doctorTitleFromEmployee(employee)} ${employee.firstName} ${employee.lastName}` : `${employee.firstName} ${employee.lastName}`;
}

export function doctorTitle(data: AppData, id: number) {
  const employee = data.employees.find((item) => item.id === id);
  return employee ? doctorTitleFromEmployee(employee) : "Dr.";
}

export function doctorTitleFromEmployee(employee: Employee) {
  return employee.sex === "Female" ? "Dra." : "Dr.";
}
