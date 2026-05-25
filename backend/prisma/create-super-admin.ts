import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
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
	const passwordHash = await hashPassword(password);

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

	const credentialAccount = await prisma.account.findFirst({
		where: {
			userId: user.id,
			providerId: "credential",
		},
	});

	if (credentialAccount) {
		await prisma.account.update({
			where: { id: credentialAccount.id },
			data: {
				accountId: user.id,
				password: passwordHash,
			},
		});
	} else {
		await prisma.account.create({
			data: {
				id: randomUUID(),
				userId: user.id,
				accountId: user.id,
				providerId: "credential",
				password: passwordHash,
			},
		});
	}

	console.log(`Super admin ready: ${user.email} (${user.role})`);
	console.log("Super admin password synced from SUPER_ADMIN_PASSWORD.");
}

main()
	.catch((error) => {
		console.error(error);
		process.exitCode = 1;
	})
	.finally(async () => {
		await prisma.$disconnect();
	});
