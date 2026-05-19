import { Role } from "@prisma/client";
import { Router } from "express";
import { z } from "zod";
import { prisma } from "../db.js";
import { AuthedRequest, requireAuth, requireRole } from "../middleware/auth.js";

const router = Router();
const userUpdateSchema = z.object({
  name: z.string().min(1).optional(),
  role: z.nativeEnum(Role).optional(),
  linkedEmployeeId: z.number().nullable().optional(),
});

router.use(requireAuth, requireRole(Role.SUPER_ADMIN));

router.get("/", async (_req, res) => {
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
    orderBy: { createdAt: "desc" },
  });
  res.json({ data: users });
});

router.put("/:id", async (req, res) => {
  const input = userUpdateSchema.parse(req.body);
  const user = await prisma.user.update({
    where: { id: req.params.id },
    data: input,
    select: { id: true, name: true, email: true, role: true, linkedEmployeeId: true, createdAt: true, updatedAt: true },
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
