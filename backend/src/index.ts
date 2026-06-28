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
const unsafeMethods = new Set(["DELETE", "PATCH", "POST", "PUT"]);
const apiWriteRateLimit = createRateLimiter({
	windowMs: 15 * 60 * 1000,
	max: 300,
	message: "Too many requests. Please slow down and try again later.",
});

morgan.token("safe-url", (req) => {
	const url = (req as { originalUrl?: string; url?: string }).originalUrl ?? req.url ?? "";
	return url.split("?")[0] || "/";
});
const requestLogFormat = config.isProduction
	? ':remote-addr - :remote-user [:date[clf]] ":method :safe-url HTTP/:http-version" :status :res[content-length] ":referrer" ":user-agent"'
	: ":method :safe-url :status :response-time ms - :res[content-length]";

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
app.use(helmet({
	contentSecurityPolicy: {
		directives: {
			defaultSrc: ["'self'"],
			baseUri: ["'self'"],
			connectSrc: ["'self'", "https://*.ingest.uploadthing.com", "https://ingest.uploadthing.com", "https://*.ufs.sh"],
			imgSrc: ["'self'", "data:", "blob:", "https://*.ufs.sh", "https://utfs.io", "https://*.utfs.io"],
			scriptSrc: ["'self'"],
			styleSrc: ["'self'", "'unsafe-inline'"],
			fontSrc: ["'self'", "data:"],
			objectSrc: ["'none'"],
			frameAncestors: ["'self'"],
			upgradeInsecureRequests: config.isProduction ? [] : null,
		},
	},
}));
app.use(morgan(requestLogFormat));

if (config.isProduction) {
	app.set("trust proxy", 1);
}

app.post("/api/auth/sign-up/email", (_req, res) => {
	res.status(403).json({ error: "Public sign-up is disabled" });
});
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
app.use("/api", (req, res, next) => {
	if (!unsafeMethods.has(req.method)) return next();

	const origin = req.headers.origin;
	if (origin && config.clientOrigins.includes(origin)) return next();
	if (!config.isProduction && !origin) return next();

	return res.status(403).json({ error: "Invalid request origin" });
});
app.use("/api", (req, res, next) => {
	if (!unsafeMethods.has(req.method)) return next();
	return apiWriteRateLimit(req, res, next);
});

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
		console.error(error instanceof Error ? { message: error.message, name: error.name } : error);
	}
	return res.status(status).json({ error: status === 500 ? "Internal server error" : error.message });
};

app.use(errorHandler);

app.listen(config.port, () => {
	console.log(`St. Jude API listening on http://localhost:${config.port}`);
});
