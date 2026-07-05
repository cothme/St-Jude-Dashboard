import { afterAll, describe, expect, it, beforeEach } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";
import { seedFreshTestData, signInAs, type TestFixtures } from "./helpers";

const app = createApp({ enableRequestLogging: false });

function patientPayload(doctorId: number) {
  return {
    firstName: "New",
    lastName: "Patient",
    dateOfBirth: "1980-01-01",
    sex: "MALE",
    civilStatus: "SINGLE",
    nationality: "Filipino",
    address: "Manila",
    attendingDoctorId: doctorId,
    status: "ADMITTED",
    ward: "C-101",
    admissionDate: "2026-07-01",
  };
}

function checkupPayload(fixtures: TestFixtures, overrides: Record<string, unknown> = {}) {
  return {
    patientId: fixtures.patients.assignedPatient.id,
    doctorId: fixtures.employees.doctor.id,
    appointmentId: fixtures.appointments.appointment.id,
    checkupDate: "2026-07-10",
    chiefComplaint: "Follow-up",
    symptoms: "Stable mood",
    diagnosis: "Improving",
    prescriptions: "Continue medication",
    bloodPressure: "120/80",
    temperature: 36.8,
    heartRate: 74,
    weight: 72,
    height: 180,
    notes: "Continue observation",
    nextAppointment: "2026-08-10",
    ...overrides,
  };
}

function appointmentPayload(fixtures: TestFixtures, overrides: Record<string, unknown> = {}) {
  return {
    patientId: fixtures.patients.assignedPatient.id,
    doctorId: fixtures.employees.doctor.id,
    startsAt: "2026-07-15T09:00:00.000Z",
    durationMinutes: 30,
    reason: "Medication review",
    status: "SCHEDULED",
    ...overrides,
  };
}

function medicationSchedulePayload(fixtures: TestFixtures, overrides: Record<string, unknown> = {}) {
  return {
    patientId: fixtures.patients.assignedPatient.id,
    medication: "Quetiapine",
    dosage: "25mg",
    route: "Oral",
    frequency: "HS",
    times: ["20:00"],
    startDate: "2026-07-01",
    prescribedBy: "Dr. Miguel Cruz",
    status: "ACTIVE",
    ...overrides,
  };
}

describe("backend route integration tests", () => {
  let fixtures: TestFixtures;

  beforeEach(async () => {
    fixtures = await seedFreshTestData();
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("requires authentication and enforces role-only modules", async () => {
    await request(app).get("/api/patients").expect(401);

    const staff = await signInAs(app, "staff@test.local");
    await staff.get("/api/checkups").expect(403);
    await staff.delete(`/api/payroll/${fixtures.employees.staffEmployee.id}`).expect(403);
  });

  it("filters patient, appointment, checkup, and medication reads to the signed-in doctor's patients", async () => {
    await prisma.checkupRecord.create({
      data: {
        patientId: fixtures.patients.assignedPatient.id,
        doctorId: fixtures.employees.doctor.id,
        checkupDate: new Date("2026-07-10"),
        chiefComplaint: "Assigned",
        bmi: 22.22,
      },
    });
    await prisma.checkupRecord.create({
      data: {
        patientId: fixtures.patients.unassignedPatient.id,
        doctorId: fixtures.employees.otherDoctor.id,
        checkupDate: new Date("2026-07-11"),
        chiefComplaint: "Unassigned",
      },
    });
    await prisma.medicationSchedule.create({
      data: {
        patientId: fixtures.patients.unassignedPatient.id,
        medication: "Lithium",
        dosage: "300mg",
        route: "Oral",
        frequency: "BID",
        times: ["08:00", "20:00"],
        startDate: new Date("2026-07-01"),
        prescribedBy: "Dra. Lena Dizon",
        status: "ACTIVE",
      },
    });

    const doctor = await signInAs(app, "doctor@test.local");

    await doctor.get("/api/patients").expect(200).expect(({ body }) => {
      expect(body.data.map((patient: { id: number }) => patient.id)).toEqual([fixtures.patients.assignedPatient.id]);
    });
    await doctor.get("/api/appointments").expect(200).expect(({ body }) => {
      expect(body.data.map((appointment: { id: number }) => appointment.id)).toEqual([fixtures.appointments.appointment.id]);
    });
    await doctor.get("/api/checkups").expect(200).expect(({ body }) => {
      expect(body.data.map((checkup: { patientId: number }) => checkup.patientId)).toEqual([fixtures.patients.assignedPatient.id]);
    });
    await doctor.get("/api/medications/schedules").expect(200).expect(({ body }) => {
      expect(body.data.map((schedule: { patientId: number }) => schedule.patientId)).toEqual([fixtures.patients.assignedPatient.id]);
    });
  });

  it("lets doctors create checkups only for assigned patients and completes linked appointments", async () => {
    const doctor = await signInAs(app, "doctor@test.local");

    await doctor
      .post("/api/checkups")
      .send(checkupPayload(fixtures))
      .expect(201)
      .expect(({ body }) => {
        expect(Number(body.data.bmi)).toBe(22.22);
      });

    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: fixtures.appointments.appointment.id } }))
      .resolves.toMatchObject({ status: "COMPLETED" });

    await doctor
      .post("/api/checkups")
      .send(checkupPayload(fixtures, {
        patientId: fixtures.patients.unassignedPatient.id,
        doctorId: fixtures.employees.doctor.id,
        appointmentId: null,
      }))
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe("Doctors can only create checkups for assigned patients");
      });
  });

  it("lets doctors manage appointments and medication schedules only for assigned patients", async () => {
    const doctor = await signInAs(app, "doctor@test.local");

    await doctor.post("/api/appointments").send(appointmentPayload(fixtures)).expect(201);
    await doctor
      .post("/api/appointments")
      .send(appointmentPayload(fixtures, {
        patientId: fixtures.patients.unassignedPatient.id,
        doctorId: fixtures.employees.doctor.id,
      }))
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe("Doctors can only manage appointments for assigned patients");
      });

    await doctor.post("/api/medications/schedules").send(medicationSchedulePayload(fixtures)).expect(201);
    await doctor
      .post("/api/medications/schedules")
      .send(medicationSchedulePayload(fixtures, { patientId: fixtures.patients.unassignedPatient.id }))
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe("Doctors can only manage medications for assigned patients");
      });
  });

  it("discharges patients and cancels their scheduled appointments", async () => {
    const staff = await signInAs(app, "staff@test.local");

    await staff
      .post(`/api/patients/${fixtures.patients.assignedPatient.id}/discharge`)
      .send({
        dischargeDate: "2026-07-05",
        dischargeReason: "Family care transfer",
        dischargeCondition: "Stable",
        dischargeInstructions: "Continue outpatient follow-up",
        dischargeMedications: "Continue Sertraline",
        dischargeFollowUp: "2026-08-05",
        dischargedBy: "Ana Reyes",
      })
      .expect(200)
      .expect(({ body }) => {
        expect(body.data.status).toBe("DISCHARGED");
        expect(body.cancelledAppointments.map((appointment: { id: number }) => appointment.id)).toEqual([fixtures.appointments.appointment.id]);
      });

    await expect(prisma.appointment.findUniqueOrThrow({ where: { id: fixtures.appointments.appointment.id } }))
      .resolves.toMatchObject({ status: "CANCELLED" });
  });

  it("applies prescription doctor defaults for staff and doctors", async () => {
    const staff = await signInAs(app, "staff@test.local");
    await staff
      .post("/api/medications/prescriptions")
      .send({
        patientId: fixtures.patients.assignedPatient.id,
        prescriptionDate: "2026-07-05",
        prescribedBy: "Manual Name",
        items: [{ medication: "Sertraline", dosage: "50mg", frequency: "OD" }],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.prescribedBy).toBe("Dr. Miguel Cruz");
      });

    const doctor = await signInAs(app, "doctor@test.local");
    await doctor
      .post("/api/medications/prescriptions")
      .send({
        patientId: fixtures.patients.assignedPatient.id,
        prescriptionDate: "2026-07-05",
        prescribedBy: "Manual Name",
        items: [{ medication: "Quetiapine", dosage: "25mg", frequency: "HS" }],
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.prescribedBy).toBe("Dr. Miguel Cruz");
      });
  });

  it("protects user admin invariants and invalidates sessions on password reset", async () => {
    const admin = await signInAs(app, "admin@stjude.local");
    const staff = await signInAs(app, "staff@test.local");

    await admin
      .post("/api/users")
      .send({
        name: "Extra Admin",
        email: "extra-admin@test.local",
        password: "Password123!",
        role: "SUPER_ADMIN",
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("Cecille Cosme is the only Super admin account");
      });

    await admin
      .post("/api/users")
      .send({
        name: "Inactive Doctor",
        email: "inactive-doctor@test.local",
        password: "Password123!",
        role: "DOCTOR",
        linkedEmployeeId: fixtures.employees.inactiveDoctor.id,
      })
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("Doctor accounts must be linked to an active psychiatrist employee");
      });

    await admin
      .put(`/api/users/${fixtures.users.staffUser.id}`)
      .send({
        name: "Ana Reyes",
        role: "STAFF",
        linkedEmployeeId: fixtures.employees.staffEmployee.id,
        password: "NewPassword123!",
      })
      .expect(200);

    await expect(prisma.session.count({ where: { userId: fixtures.users.staffUser.id } })).resolves.toBe(0);
    await staff.get("/api/patients").expect(401);

    await admin
      .delete(`/api/users/${fixtures.users.adminUser.id}`)
      .expect(400)
      .expect(({ body }) => {
        expect(body.error).toBe("Cannot delete the current user");
      });
  });

  it("persists payroll records and limits payroll access to admin or staff", async () => {
    const doctor = await signInAs(app, "doctor@test.local");
    await doctor.get("/api/payroll").expect(403);

    const staff = await signInAs(app, "staff@test.local");
    const createResponse = await staff
      .post("/api/payroll")
      .send({
        employeeId: fixtures.employees.staffEmployee.id,
        payPeriodStart: "2026-07-01",
        payPeriodEnd: "2026-07-15",
        daysWorked: 13,
        overtimeHours: 8,
        otherDeductions: 300,
      })
      .expect(201);

    expect(Number(createResponse.body.data.grossPay)).toBe(15346.15);
    expect(Number(createResponse.body.data.netPay)).toBeGreaterThan(0);

    await staff
      .post("/api/payroll/bulk")
      .send({
        employeeIds: [fixtures.employees.doctor.id, fixtures.employees.staffEmployee.id],
        payPeriodStart: "2026-07-01",
        payPeriodEnd: "2026-07-15",
        daysWorked: 10,
        overtimeHours: 0,
        otherDeductions: 0,
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data).toHaveLength(2);
      });

    await staff
      .get(`/api/payroll/${createResponse.body.data.id}/payslip`)
      .expect(200)
      .expect("Content-Type", /application\/pdf/);
  });

  it("records activity logs, validates payloads, restricts listing, and triggers retention cleanup", async () => {
    const staff = await signInAs(app, "staff@test.local");
    await prisma.activityLog.create({
      data: {
        actorName: "Old Actor",
        actorRole: "STAFF",
        action: "Old action",
        entity: "OldEntity",
        summary: "Old log",
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
    });

    await staff.get("/api/activity-logs").expect(403);
    await staff
      .post("/api/activity-logs")
      .send({
        action: "Created",
        entity: "Patient",
        summary: "Created a patient",
        details: ["Patient created from test"],
        severity: "success",
      })
      .expect(201)
      .expect(({ body }) => {
        expect(body.data.actorName).toBe("Ana Reyes");
        expect(body.data.actorRole).toBe("STAFF");
      });

    await staff
      .post("/api/activity-logs")
      .send({ action: "", entity: "Patient", summary: "Invalid" })
      .expect(400);

    await viWaitFor(async () => {
      const oldLogCount = await prisma.activityLog.count({ where: { summary: "Old log" } });
      expect(oldLogCount).toBe(0);
    });

    const admin = await signInAs(app, "admin@stjude.local");
    await admin.get("/api/activity-logs").expect(200).expect(({ body }) => {
      expect(body.data.some((log: { summary: string }) => log.summary === "Created a patient")).toBe(true);
    });
  });
});

async function viWaitFor(assertion: () => Promise<void>, attempts = 20) {
  let lastError: unknown;
  for (let index = 0; index < attempts; index += 1) {
    try {
      await assertion();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
  }
  throw lastError;
}
