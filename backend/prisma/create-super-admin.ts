import "dotenv/config";
import { randomUUID } from "node:crypto";
import { hashPassword } from "@better-auth/utils/password";
import { PrismaClient, Role } from "@prisma/client";
import { auth } from "../src/auth.js";

const prisma = new PrismaClient();

const email = process.env.SUPER_ADMIN_EMAIL ?? "admin@stjude.local";
const name = "Cecille Cosme";
const isProduction = process.env.NODE_ENV === "production";
const configuredPassword = process.env.SUPER_ADMIN_PASSWORD;
const password = configuredPassword ?? (isProduction ? undefined : "Password123!");

async function main() {
	const existing = await prisma.user.findUnique({ where: { email } });
	const needsPassword = !existing || Boolean(configuredPassword);
	if (needsPassword && !password) {
		throw new Error("SUPER_ADMIN_PASSWORD is required to create or rotate the Super admin password.");
	}
	if (password && password.length < 12) {
		throw new Error("SUPER_ADMIN_PASSWORD must be at least 12 characters.");
	}

	if (!existing) {
		await auth.api.signUpEmail({
			body: {
				name,
				email,
				password: password!,
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

	const demoted = await prisma.user.updateMany({
		where: {
			role: Role.SUPER_ADMIN,
			id: { not: user.id },
		},
		data: {
			role: Role.STAFF,
		},
	});

	const credentialAccount = await prisma.account.findFirst({
		where: {
			userId: user.id,
			providerId: "credential",
		},
	});
	const shouldSyncPassword = needsPassword || !credentialAccount;
	if (shouldSyncPassword && !password) {
		throw new Error("SUPER_ADMIN_PASSWORD is required to create or repair the Super admin credential account.");
	}

	if (shouldSyncPassword && credentialAccount) {
		await prisma.account.update({
			where: { id: credentialAccount.id },
			data: {
				accountId: user.id,
				password: await hashPassword(password!),
			},
		});
	} else if (shouldSyncPassword) {
		await prisma.account.create({
			data: {
				id: randomUUID(),
				userId: user.id,
				accountId: user.id,
				providerId: "credential",
				password: await hashPassword(password!),
			},
		});
	}

	console.log(`Super admin ready: ${user.email} (${user.role})`);
	console.log(shouldSyncPassword ? "Super admin password synced from SUPER_ADMIN_PASSWORD." : "Super admin password unchanged.");
	if (demoted.count > 0) {
		console.log(`Demoted ${demoted.count} extra Super admin account(s).`);
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
