import { Role } from "@prisma/client";
import { fromNodeHeaders } from "better-auth/node";
import { NextFunction, Request, Response } from "express";
import { auth } from "../auth.js";
import { prisma } from "../db.js";

export interface AuthedRequest extends Request {
  user?: {
    id: string;
    name: string;
    email: string;
    role: Role;
    linkedEmployeeId: number | null;
  };
}

export async function requireAuth(req: AuthedRequest, res: Response, next: NextFunction) {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });

  if (!session?.user?.id) {
    return res.status(401).json({ error: "Authentication required" });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.user.id },
    select: { id: true, name: true, email: true, role: true, linkedEmployeeId: true },
  });

  if (!user) {
    return res.status(401).json({ error: "User not found" });
  }

  req.user = user;
  return next();
}

export function requireRole(...roles: Role[]) {
  return (req: AuthedRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: "Authentication required" });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: "Insufficient permissions" });
    }

    return next();
  };
}
