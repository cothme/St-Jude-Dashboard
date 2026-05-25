import "dotenv/config";
import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../src/auth.js";

const prisma = new PrismaClient();

const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@stjude.local";
const name = process.env.SUPER_ADMIN_NAME ?? "Maria Santos";
const password = process.env.SUPER_ADMIN_PASSWORD ?? "Password123!";

async function main() {
	if (password.length < 8) {
		throw new Error("SUPER_ADMIN_PASSWORD must be at least 8 characters.");
	}

	const existing = await prisma.user.findUnique({ where: { email } });

	if (!existing) {
		await auth.api.signUpEmail({
			body: {
				name,
				email,
				password,
			},
		});
	}

	const user = await prisma.user.update({
		where: { email },
		data: {
			name,
			role: Role.SUPER_ADMIN,
			emailVerified: true,
		},
		select: {
			id: true,
			name: true,
			email: true,
			role: true,
		},
	});

	console.log(`Super admin ready: ${user.email} (${user.role})`);
	if (existing) {
		console.log("Existing user was promoted/verified. Password was not changed.");
	}
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
