import { describe, expect, it } from "vitest";
import { canAccess } from "../src/auth";

describe("canAccess", () => {
  it("allows super admin access to administrative modules", () => {
    expect(canAccess("Super admin", "users")).toBe(true);
    expect(canAccess("Super admin", "activityLogs")).toBe(true);
  });

  it("keeps staff away from super-admin-only modules", () => {
    expect(canAccess("Staff", "users")).toBe(false);
    expect(canAccess("Staff", "activityLogs")).toBe(false);
  });

  it("allows doctors into clinical modules but not payroll", () => {
    expect(canAccess("Doctor", "patients")).toBe(true);
    expect(canAccess("Doctor", "checkups")).toBe(true);
    expect(canAccess("Doctor", "payroll")).toBe(false);
  });
});
