import { beforeEach, describe, expect, it, vi } from "vitest";
import { ApiError, backendApi, backendAuth } from "../src/services/apiClient";

function jsonResponse(body: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    json: async () => body,
  } as Response;
}

describe("apiClient", () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal("fetch", fetchMock);
  });

  it("maps backend records into UI data and falls back for optional failed collections", async () => {
    fetchMock.mockImplementation((url: string) => {
      const endpoint = url.replace("http://localhost:3001/api", "");
      const responses: Record<string, Response> = {
        "/patients": jsonResponse({ data: [{
          id: 1,
          firstName: "Ramon",
          lastName: "Villanueva",
          dateOfBirth: "1978-08-12T00:00:00.000Z",
          sex: "MALE",
          civilStatus: "SINGLE",
          nationality: "Filipino",
          address: "Quezon City",
          attendingDoctorId: 7,
          status: "OBSERVATION",
          ward: "A-102",
          admissionDate: "2026-01-01T00:00:00.000Z",
        }] }),
        "/employees": jsonResponse({ data: [{
          id: 7,
          employeeCode: "EMP-0007",
          firstName: "Miguel",
          lastName: "Cruz",
          sex: "MALE",
          position: "Psychiatrist",
          department: "Clinical",
          hireDate: "2022-01-10T00:00:00.000Z",
          baseSalary: "68000",
          workDaysPerWeek: 5,
          status: "ACTIVE",
        }] }),
        "/forms": jsonResponse({ data: [{
          id: 3,
          templateId: "daily-note",
          title: "Daily Note",
          category: "Patient Care",
          submittedBy: "Ana",
          submittedAt: "2026-07-05T08:00:00.000Z",
          status: "REVIEWED",
          fields: { mood: "Stable" },
        }] }),
        "/medications/schedules": jsonResponse({ data: [{
          id: 4,
          patientId: 1,
          medication: "Sertraline",
          dosage: "50mg",
          route: "Oral",
          frequency: "OD",
          times: ["08:00"],
          startDate: "2026-07-01T00:00:00.000Z",
          status: "ACTIVE",
          prescribedBy: "Dr. Miguel Cruz",
        }] }),
        "/medications/administrations": jsonResponse({ data: [{
          id: 5,
          scheduleId: 4,
          patientId: 1,
          medication: "Sertraline",
          dosage: "50mg",
          administeredAt: "2026-07-05T08:00:00.000Z",
          administeredBy: "Ana",
          status: "GIVEN",
        }] }),
        "/medications/prescriptions": jsonResponse({ data: [{
          id: 6,
          patientId: 1,
          prescriptionDate: "2026-07-05T00:00:00.000Z",
          items: [{ medication: "Sertraline", dosage: "50mg", frequency: "OD" }],
          prescribedBy: "Dr. Miguel Cruz",
        }] }),
        "/appointments": jsonResponse({ data: [{
          id: 9,
          patientId: 1,
          doctorId: 7,
          startsAt: "2026-07-10T09:00:00.000Z",
          durationMinutes: 30,
          reason: "Follow-up",
          status: "SCHEDULED",
        }] }),
      };
      return Promise.resolve(responses[endpoint] ?? jsonResponse({ error: "Optional collection failed" }, 500));
    });

    const data = await backendApi.loadAppData();

    expect(data.patients?.[0]).toMatchObject({
      firstName: "Ramon",
      sex: "Male",
      civilStatus: "Single",
      status: "Observation",
      admissionDate: "2026-01-01",
    });
    expect(data.employees?.[0]).toMatchObject({ sex: "Male", status: "Active", baseSalary: 68000 });
    expect(data.forms?.[0]).toMatchObject({ status: "Reviewed" });
    expect(data.medicationSchedules?.[0]).toMatchObject({ status: "Active", startDate: "2026-07-01" });
    expect(data.medicationAdministrations?.[0]).toMatchObject({ status: "Given" });
    expect(data.prescriptions?.[0].items).toEqual([{ medication: "Sertraline", dosage: "50mg", frequency: "OD" }]);
    expect(data.appointments?.[0]).toMatchObject({ status: "Scheduled" });
    expect(data.checkups).toEqual([]);
    expect(data.users).toEqual([]);
  });

  it("raises a network ApiError when fetch fails", async () => {
    fetchMock.mockRejectedValueOnce(new Error("offline"));

    await expect(backendAuth.signIn("admin@stjude.local", "Password123!")).rejects.toMatchObject({
      name: "ApiError",
      code: "network",
      message: "Network connection failed",
    } satisfies Partial<ApiError>);
  });

  it("serializes UI values to backend enum and nullable shapes", async () => {
    fetchMock.mockResolvedValueOnce(jsonResponse({ data: { id: 10 } }, 201));

    await backendApi.createPatient({
      firstName: "Ramon",
      lastName: "Villanueva",
      dateOfBirth: "1978-08-12",
      sex: "Male",
      civilStatus: "Single",
      nationality: "Filipino",
      address: "Quezon City",
      contactNumber: "",
      emergencyContactName: "",
      emergencyContactNumber: "",
      attendingDoctorId: 0,
      status: "Admitted",
      ward: "A-102",
      admissionDate: "2026-01-01",
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(JSON.parse(options.body)).toMatchObject({
      sex: "MALE",
      civilStatus: "SINGLE",
      status: "ADMITTED",
      attendingDoctorId: null,
      dischargeDate: null,
      dischargedBy: null,
    });
  });
});
