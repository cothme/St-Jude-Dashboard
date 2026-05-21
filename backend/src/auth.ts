import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { prisma } from "./db.js";

export const auth = betterAuth({
  baseURL: process.env.BETTER_AUTH_URL ?? "http://localhost:3001",
  trustedOrigins: [
    process.env.CLIENT_ORIGIN ?? "http://127.0.0.1:5173",
    "http://localhost:5173",
    "http://127.0.0.1:5173",
  ],
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  emailAndPassword: {
    enabled: true,
  },
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "STAFF",
        input: false,
      },
      linkedEmployeeId: {
        type: "number",
        required: false,
        input: false,
      },
    },
  },
});
