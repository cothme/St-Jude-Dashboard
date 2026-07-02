import { afterAll, describe, expect, it } from "vitest";
import request from "supertest";
import { createApp } from "../src/app";
import { prisma } from "../src/db";

const app = createApp({ enableRequestLogging: false });

describe("Express app security smoke tests", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("returns health status without authentication", async () => {
    await request(app)
      .get("/api/health")
      .expect(200)
      .expect(({ body }) => {
        expect(body).toEqual({ ok: true });
      });
  });

  it("blocks public email sign-up", async () => {
    await request(app)
      .post("/api/auth/sign-up/email")
      .send({ email: "new-user@example.com", password: "Password123!" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe("Public sign-up is disabled");
      });
  });

  it("rejects unsafe API requests from untrusted browser origins before route handlers run", async () => {
    await request(app)
      .post("/api/activity-logs")
      .set("Origin", "https://evil.example")
      .send({ action: "Probe", entity: "ActivityLog", summary: "Should not pass origin check" })
      .expect(403)
      .expect(({ body }) => {
        expect(body.error).toBe("Invalid origin");
      });
  });
});
