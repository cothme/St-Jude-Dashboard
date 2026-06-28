import { Role } from "@prisma/client";
import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { auth } from "../auth.js";
import { deleteUploadThingFile } from "../uploadthing.js";

const router = Router();
const canonicalSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@stjude.local";
const canonicalSuperAdminName = "Cecille Cosme";
const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  profileImageUrl: z.string().nullable().optional(),
  profileImageKey: z.string().nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  linkedEmployeeId: z.number().nullable().optional(),
  password: z.string().min(12).optional(),
});
const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  profileImageUrl: z.string().nullable().optional(),
  profileImageKey: z.string().nullable().optional(),
  password: z.string().min(12),
  role: z.nativeEnum(Role).default(Role.STAFF),
  linkedEmployeeId: z.number().nullable().optional(),
});
const profileSchema = z.object({
  name: z.string().min(1),
  profileImageUrl: z.string().nullable().optional(),
  profileImageKey: z.string().nullable().optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(12),
});
const userSelect = { id: true, name: true, email: true, image: true, profileImageKey: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true } as any;

async function isActivePsychiatristEmployee(employeeId: number | null | undefined) {
  if (!employeeId) return false;
  const employee = await prisma.employee.findFirst({
    where: { id: employeeId, position: "Psychiatrist", status: "ACTIVE" },
    select: { id: true },
  });
  return Boolean(employee);
}

router.use(requireAuth);

router.put("/me", async (req, res) => {
  const input = profileSchema.parse(req.body);
  const currentUser = (req as AuthedRequest).user;
  if (!currentUser) return res.status(401).json({ error: "Authentication required" });
  const isCanonicalSuperAdmin = currentUser.email === canonicalSuperAdminEmail;
  const user = await prisma.user.update({
    where: { id: currentUser.id },
    data: {
      name: isCanonicalSuperAdmin ? canonicalSuperAdminName : input.name,
      image: input.profileImageUrl ?? null,
      profileImageKey: input.profileImageKey ?? null,
    } as any,
    select: userSelect,
  });
  res.json({ data: user });
});

router.put("/me/password", async (req, res) => {
  const input = passwordSchema.parse(req.body);
  const currentUser = (req as AuthedRequest).user;
  if (!currentUser) return res.status(401).json({ error: "Authentication required" });
  const account = await prisma.account.findFirst({ where: { userId: currentUser.id, providerId: "credential" } });
  if (!account?.password) return res.status(400).json({ error: "Password account not found" });
  const valid = await verifyPassword(account.password, input.currentPassword);
  if (!valid) return res.status(400).json({ error: "Current password is incorrect" });
  await prisma.account.update({ where: { id: account.id }, data: { password: await hashPassword(input.newPassword) } });
  res.json({ data: { ok: true } });
});

router.use(requireRole(Role.SUPER_ADMIN));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: userSelect,
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: users });
});

router.post("/", async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  if (input.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} is the only Super admin account` });
  }
  if (input.role === Role.DOCTOR && !(await isActivePsychiatristEmployee(input.linkedEmployeeId))) {
    return res.status(400).json({ error: "Doctor accounts must be linked to an active psychiatrist employee" });
  }
  await auth.api.signUpEmail({
    body: {
      name: input.name,
      email: input.email,
      password: input.password,
    },
  });
  const user = await prisma.user.update({
    where: { email: input.email },
    data: {
      role: input.role,
      image: input.profileImageUrl ?? null,
      profileImageKey: input.profileImageKey ?? null,
      linkedEmployeeId: input.linkedEmployeeId ?? null,
      emailVerified: true,
    } as any,
    select: userSelect,
  });
  res.status(201).json({ data: user });
});

router.put("/:id", async (req, res) => {
  const input = userUpdateSchema.parse(req.body);
  const currentUser = (req as AuthedRequest).user;
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { id: true, email: true, role: true, linkedEmployeeId: true },
  });
  const isCanonicalSuperAdmin = existing.email === canonicalSuperAdminEmail;
  const nextRole = isCanonicalSuperAdmin ? Role.SUPER_ADMIN : input.role ?? existing.role;
  const nextLinkedEmployeeId = input.linkedEmployeeId === undefined ? existing.linkedEmployeeId : input.linkedEmployeeId;

  if (!isCanonicalSuperAdmin && input.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} is the only Super admin account` });
  }

  if (currentUser?.id === req.params.id && input.role && input.role !== Role.SUPER_ADMIN) {
    return res.status(400).json({ error: "Cannot remove Super admin access from the current user" });
  }

  if (isCanonicalSuperAdmin && input.role && input.role !== Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} must remain the Super admin` });
  }

  if (isCanonicalSuperAdmin && input.password) {
    return res.status(400).json({ error: "Use Change Password to update the Super admin password" });
  }

  if (nextRole === Role.DOCTOR && !(await isActivePsychiatristEmployee(nextLinkedEmployeeId))) {
    return res.status(400).json({ error: "Doctor accounts must be linked to an active psychiatrist employee" });
  }

  const credentialAccount = input.password
    ? await prisma.account.findFirst({ where: { userId: req.params.id, providerId: "credential" }, select: { id: true } })
    : null;
  if (input.password && !credentialAccount) {
    return res.status(400).json({ error: "Password account not found" });
  }
  const passwordHash = input.password ? await hashPassword(input.password) : null;
  const user = await prisma.$transaction(async (transaction) => {
    const updatedUser = await transaction.user.update({
      where: { id: req.params.id },
      data: {
        name: isCanonicalSuperAdmin ? canonicalSuperAdminName : input.name,
        image: input.profileImageUrl,
        profileImageKey: input.profileImageKey,
        role: isCanonicalSuperAdmin ? Role.SUPER_ADMIN : input.role,
        linkedEmployeeId: input.linkedEmployeeId,
      } as any,
      select: userSelect,
    });
    if (credentialAccount && passwordHash) {
      await transaction.account.update({
        where: { id: credentialAccount.id },
        data: { password: passwordHash },
      });
      await transaction.session.deleteMany({
        where: { userId: req.params.id },
      });
    }
    return updatedUser;
  });
  res.json({ data: user });
});

router.delete("/:id", async (req, res) => {
  if ((req as AuthedRequest).user?.id === req.params.id) {
    return res.status(400).json({ error: "Cannot delete the current user" });
  }
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { email: true, profileImageKey: true, role: true },
  });
  if (existing.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: "Super admin account cannot be deleted" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  await deleteUploadThingFile(existing.profileImageKey);
  return res.status(204).send();
});

export default router;
