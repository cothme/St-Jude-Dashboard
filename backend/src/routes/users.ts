import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";
import { auth } from "../auth.js";

const router = Router();
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
  password: z.string().min(8).default("Password123!"),
  role: z.nativeEnum(Role).default(Role.STAFF),
  linkedEmployeeId: z.number().nullable().optional(),
});

router.use(requireAuth, requireRole(Role.SUPER_ADMIN));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, image: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: users });
});

router.post("/", async (req, res) => {
  const input = userCreateSchema.parse(req.body);
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
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: {
      name: input.name,
      image: input.profileImageUrl,
      role: input.role,
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
  await prisma.user.delete({ where: { id: req.params.id } });
  return res.status(204).send();
});

export default router;
