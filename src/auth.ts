import { Role } from "./types";

export const rolePermissions: Record<Role, string[]> = {
  "Super admin": ["dashboard", "patients", "checkups", "forms", "employees", "payroll", "users", "activityLogs", "medications", "appointments"],
  Staff: ["dashboard", "patients", "forms", "employees", "payroll", "medications", "appointments"],
  Doctor: ["dashboard", "patients", "checkups", "forms", "medications", "appointments"],
};

export const canAccess = (role: Role, permission: string) =>
  rolePermissions[role].includes(permission);
