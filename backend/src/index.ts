import "dotenv/config";
import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { toNodeHandler } from "better-auth/node";
import { createRouteHandler } from "uploadthing/express";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import { config } from "./config.js";
import { createRateLimiter } from "./middleware/rateLimit.js";
import activityLogRoutes from "./routes/activityLogs.js";
import appointmentRoutes from "./routes/appointments.js";
import checkupRoutes from "./routes/checkups.js";
import employeeRoutes from "./routes/employees.js";
import formRoutes from "./routes/forms.js";
import medicationRoutes from "./routes/medications.js";
import patientRoutes from "./routes/patients.js";
import payrollRoutes from "./routes/payroll.js";
import userRoutes from "./routes/users.js";
import { uploadManagementRouter, uploadRouter } from "./uploadthing.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const authRateLimit = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 40,
	message: "Too many authentication requests. Please try again later.",
});

app.use(
	cors({
		origin(origin, callback) {
			if (!origin || config.clientOrigins.includes(origin)) {
				return callback(null, true);
			}

			const error = new Error("Invalid origin") as Error & { status: number };
			error.status = 403;
			return callback(error);
		},
		credentials: true,
	}),
);
app.use(helmet());
app.use(morgan(config.isProduction ? "combined" : "dev"));

if (config.isProduction) {
	app.set("trust proxy", 1);
}

app.all("/api/auth/*splat", authRateLimit, toNodeHandler(auth));
app.use(
	"/api/uploadthing",
	createRouteHandler({
		router: uploadRouter,
		config: {
			callbackUrl: process.env.UPLOADTHING_CALLBACK_URL,
		},
	}),
);

app.use(express.json({ limit: config.jsonLimit }));

app.get("/api/health", (_req, res) => {
	res.json({ ok: true });
});
app.use("/api/employees", employeeRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/checkups", checkupRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/users", userRoutes);
app.use("/api/activity-logs", activityLogRoutes);
app.use("/api/medications", medicationRoutes);
app.use("/api/appointments", appointmentRoutes);
app.use("/api/uploads", uploadManagementRouter);

if (config.isProduction) {
	const staticDir = path.resolve(__dirname, "../../public");
	app.use(express.static(staticDir));
	app.get(/^(?!\/api\/).*/, (_req, res) => {
		res.sendFile(path.join(staticDir, "index.html"));
	});
}

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	if (error instanceof ZodError) {
		return res
			.status(400)
			.json({ error: "Validation failed", details: error.flatten() });
	}

	const status = typeof error.status === "number" ? error.status : 500;
	if (status >= 500) {
		console.error(error);
	}
	return res.status(status).json({ error: status === 500 ? "Internal server error" : error.message });
};

app.use(errorHandler);

app.listen(config.port, () => {
	console.log(`St. Jude API listening on http://localhost:${config.port}`);
});
