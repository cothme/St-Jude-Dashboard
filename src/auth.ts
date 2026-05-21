import { Role } from "./types";

export const rolePermissions: Record<Role, string[]> = {
  "Super admin": ["dashboard", "patients", "checkups", "forms", "employees", "payroll", "users", "activityLogs"],
  Staff: ["dashboard", "patients", "checkups", "forms", "employees"],
  Doctor: ["dashboard", "patients", "checkups", "forms"],
};

export const canAccess = (role: Role, permission: string) =>
  rolePermissions[role].includes(permission);
