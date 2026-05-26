import { Role } from "@prisma/client";
import { hashPassword, verifyPassword } from "@better-auth/utils/password";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { auth } from "../auth.js";

const router = Router();
const canonicalSuperAdminEmail = process.env.SUPER_ADMIN_EMAIL ?? "admin@stjude.local";
const canonicalSuperAdminName = "Cecille Cosme";
const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  profileImageUrl: z.string().nullable().optional(),
  role: z.nativeEnum(Role).optional(),
  linkedEmployeeId: z.number().nullable().optional(),
});
const userCreateSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  profileImageUrl: z.string().nullable().optional(),
  password: z.string().min(12),
  role: z.nativeEnum(Role).default(Role.STAFF),
  linkedEmployeeId: z.number().nullable().optional(),
});
const profileSchema = z.object({
  name: z.string().min(1),
  profileImageUrl: z.string().nullable().optional(),
});
const passwordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8),
});

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
    },
    select: { id: true, name: true, email: true, image: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
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
    select: { id: true, name: true, email: true, image: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: users });
});

router.post("/", async (req, res) => {
  const input = userCreateSchema.parse(req.body);
  if (input.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} is the only Super admin account` });
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
      linkedEmployeeId: input.linkedEmployeeId ?? null,
      emailVerified: true,
    },
    select: { id: true, name: true, email: true, image: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
  });
  res.status(201).json({ data: user });
});

router.put("/:id", async (req, res) => {
  const input = userUpdateSchema.parse(req.body);
  const currentUser = (req as AuthedRequest).user;
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { id: true, email: true, role: true },
  });
  const isCanonicalSuperAdmin = existing.email === canonicalSuperAdminEmail;

  if (!isCanonicalSuperAdmin && input.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} is the only Super admin account` });
  }

  if (currentUser?.id === req.params.id && input.role && input.role !== Role.SUPER_ADMIN) {
    return res.status(400).json({ error: "Cannot remove Super admin access from the current user" });
  }

  if (isCanonicalSuperAdmin && input.role && input.role !== Role.SUPER_ADMIN) {
    return res.status(400).json({ error: `${canonicalSuperAdminName} must remain the Super admin` });
  }

  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: isCanonicalSuperAdmin ? canonicalSuperAdminName : input.name,
      image: input.profileImageUrl,
      role: isCanonicalSuperAdmin ? Role.SUPER_ADMIN : input.role,
      linkedEmployeeId: input.linkedEmployeeId,
    },
    select: { id: true, name: true, email: true, image: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
  });
  res.json({ data: user });
});

router.delete("/:id", async (req, res) => {
  if ((req as AuthedRequest).user?.id === req.params.id) {
    return res.status(400).json({ error: "Cannot delete the current user" });
  }
  const existing = await prisma.user.findUniqueOrThrow({
    where: { id: req.params.id },
    select: { email: true, role: true },
  });
  if (existing.role === Role.SUPER_ADMIN) {
    return res.status(400).json({ error: "Super admin account cannot be deleted" });
  }
  await prisma.user.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

export default router;
