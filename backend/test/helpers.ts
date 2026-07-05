import { Role } from "@prisma/client";
import type { Express } from "express";
import request from "supertest";
import { auth } from "../src/auth";
import { prisma } from "../src/db";

const testPassword = "Password123!";

export type TestFixtures = Awaited<ReturnType<typeof seedTestData>>;

export function assertTestDatabase() {
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) throw new Error("DATABASE_URL is required for integration tests.");

  const databaseName = new URL(databaseUrl).pathname.replace(/^\//, "");
  if (!databaseName.includes("test")) {
    throw new Error(`Refusing to reset non-test database "${databaseName}". Use a DATABASE_URL with a test database.`);
  }
}

export async function resetTestDatabase() {
  assertTestDatabase();
  await prisma.$transaction([
    prisma.rateLimitBucket.deleteMany(),
    prisma.verification.deleteMany(),
    prisma.medicationAdministration.deleteMany(),
    prisma.medicationSchedule.deleteMany(),
    prisma.prescription.deleteMany(),
    prisma.checkupRecord.deleteMany(),
    prisma.appointment.deleteMany(),
    prisma.payrollRecord.deleteMany(),
    prisma.activityLog.deleteMany(),
    prisma.formSubmission.deleteMany(),
    prisma.patient.deleteMany(),
    prisma.session.deleteMany(),
    prisma.account.deleteMany(),
    prisma.user.deleteMany(),
    prisma.employee.deleteMany(),
  ]);
}

async function createUser(name: string, email: string, role: Role, linkedEmployeeId?: number) {
  await auth.api.signUpEmail({
    body: {
      name,
      email,
      password: testPassword,
    },
  });

  return prisma.user.update({
    where: { email },
    data: { role, linkedEmployeeId, emailVerified: true },
  });
}

export async function seedTestData() {
  const doctor = await prisma.employee.create({
    data: {
      employeeCode: "TEST-DR-001",
      firstName: "Miguel",
      lastName: "Cruz",
      sex: "MALE",
      position: "Psychiatrist",
      department: "Clinical",
      email: "miguel.cruz@test.local",
      phone: "0917 100 0001",
      hireDate: new Date("2022-01-10"),
      baseSalary: 68000,
      workDaysPerWeek: 5,
    },
  });
  const otherDoctor = await prisma.employee.create({
    data: {
      employeeCode: "TEST-DR-002",
      firstName: "Lena",
      lastName: "Dizon",
      sex: "FEMALE",
      position: "Psychiatrist",
      department: "Clinical",
      email: "lena.dizon@test.local",
      phone: "0917 100 0002",
      hireDate: new Date("2022-02-10"),
      baseSalary: 66000,
      workDaysPerWeek: 5,
    },
  });
  const inactiveDoctor = await prisma.employee.create({
    data: {
      employeeCode: "TEST-DR-003",
      firstName: "Noel",
      lastName: "Garcia",
      sex: "MALE",
      position: "Psychiatrist",
      department: "Clinical",
      email: "noel.garcia@test.local",
      phone: "0917 100 0003",
      hireDate: new Date("2020-02-10"),
      baseSalary: 60000,
      workDaysPerWeek: 5,
      status: "INACTIVE",
    },
  });
  const staffEmployee = await prisma.employee.create({
    data: {
      employeeCode: "TEST-ST-001",
      firstName: "Ana",
      lastName: "Reyes",
      sex: "FEMALE",
      position: "Nursing Attendant",
      department: "Administration",
      email: "ana.reyes@test.local",
      phone: "0917 100 0100",
      hireDate: new Date("2023-04-03"),
      baseSalary: 28000,
      workDaysPerWeek: 6,
    },
  });

  const adminUser = await createUser("Cecille Cosme", "admin@stjude.local", Role.SUPER_ADMIN);
  const staffUser = await createUser("Ana Reyes", "staff@test.local", Role.STAFF, staffEmployee.id);
  const doctorUser = await createUser("Dr. Miguel Cruz", "doctor@test.local", Role.DOCTOR, doctor.id);
  const otherDoctorUser = await createUser("Dra. Lena Dizon", "other-doctor@test.local", Role.DOCTOR, otherDoctor.id);

  const assignedPatient = await prisma.patient.create({
    data: {
      firstName: "Ramon",
      lastName: "Villanueva",
      dateOfBirth: new Date("1978-08-12"),
      sex: "MALE",
      civilStatus: "SINGLE",
      nationality: "Filipino",
      address: "Quezon City",
      contactNumber: "0918 100 8801",
      emergencyContactName: "Elena Villanueva",
      emergencyContactNumber: "0918 100 8802",
      attendingDoctorId: doctor.id,
      status: "STABLE",
      ward: "A-102",
      admissionDate: new Date("2025-12-04"),
    },
  });
  const unassignedPatient = await prisma.patient.create({
    data: {
      firstName: "Bianca",
      lastName: "Santos",
      dateOfBirth: new Date("1984-03-20"),
      sex: "FEMALE",
      civilStatus: "MARRIED",
      nationality: "Filipino",
      address: "Pasig City",
      attendingDoctorId: otherDoctor.id,
      status: "ADMITTED",
      ward: "B-201",
      admissionDate: new Date("2026-01-08"),
    },
  });

  const appointment = await prisma.appointment.create({
    data: {
      patientId: assignedPatient.id,
      doctorId: doctor.id,
      startsAt: new Date("2026-07-10T09:00:00Z"),
      durationMinutes: 30,
      reason: "Follow-up",
      status: "SCHEDULED",
    },
  });
  const otherAppointment = await prisma.appointment.create({
    data: {
      patientId: unassignedPatient.id,
      doctorId: otherDoctor.id,
      startsAt: new Date("2026-07-11T09:00:00Z"),
      durationMinutes: 30,
      reason: "Follow-up",
      status: "SCHEDULED",
    },
  });
  const schedule = await prisma.medicationSchedule.create({
    data: {
      patientId: assignedPatient.id,
      medication: "Sertraline",
      dosage: "50mg",
      route: "Oral",
      frequency: "OD",
      times: ["08:00"],
      startDate: new Date("2026-07-01"),
      prescribedBy: "Dr. Miguel Cruz",
      status: "ACTIVE",
    },
  });

  return {
    password: testPassword,
    employees: { doctor, otherDoctor, inactiveDoctor, staffEmployee },
    users: { adminUser, staffUser, doctorUser, otherDoctorUser },
    patients: { assignedPatient, unassignedPatient },
    appointments: { appointment, otherAppointment },
    schedules: { schedule },
  };
}

export async function seedFreshTestData() {
  await resetTestDatabase();
  return seedTestData();
}

export async function signInAs(app: Express, email: string, password = testPassword) {
  const agent = request.agent(app);
  await agent
    .post("/api/auth/sign-in/email")
    .send({ email, password, rememberMe: true })
    .expect(200);
  return agent;
}
