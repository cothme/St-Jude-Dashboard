import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { config } from "./config.js";
import { prisma } from "./db.js";

export const auth = betterAuth({
  baseURL: config.authBaseUrl,
  secret: config.authSecret,
  trustedOrigins: config.clientOrigins,
  database: prismaAdapter(prisma, {
    provider: "postgresql",
  }),
  advanced: {
    useSecureCookies: config.isProduction,
  },
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
