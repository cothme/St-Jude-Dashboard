import "dotenv/config";
import cors from "cors";
import express, { ErrorRequestHandler } from "express";
import helmet from "helmet";
import morgan from "morgan";
import { toNodeHandler } from "better-auth/node";
import { ZodError } from "zod";
import { auth } from "./auth.js";
import checkupRoutes from "./routes/checkups.js";
import employeeRoutes from "./routes/employees.js";
import formRoutes from "./routes/forms.js";
import patientRoutes from "./routes/patients.js";
import payrollRoutes from "./routes/payroll.js";
import userRoutes from "./routes/users.js";

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(
	cors({
		origin: process.env.CLIENT_ORIGIN ?? "http://localhost:5173",
		credentials: true,
	}),
);
app.use(helmet());
app.use(morgan("dev"));

app.all("/api/auth/*splat", toNodeHandler(auth));

app.use(express.json());

app.get("/api/health", (_req, res) => {
	res.json({ ok: true });
});
app.use("/api/employees", employeeRoutes);
app.use("/api/patients", patientRoutes);
app.use("/api/checkups", checkupRoutes);
app.use("/api/payroll", payrollRoutes);
app.use("/api/forms", formRoutes);
app.use("/api/users", userRoutes);

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
	if (error instanceof ZodError) {
		return res
			.status(400)
			.json({ error: "Validation failed", details: error.flatten() });
	}

	console.error(error);
	return res.status(500).json({ error: "Internal server error" });
};

app.use(errorHandler);

app.listen(port, () => {
	console.log(`St. Jude API listening on http://localhost:${port}`);
});
