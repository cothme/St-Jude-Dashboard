import { Role } from "@prisma/client";
import { fromNodeHeaders } from "better-auth/node";
import { randomUUID } from "node:crypto";
import { Router } from "express";
import { createUploadthing, type FileRouter, UTFiles } from "uploadthing/express";
import { UTApi, UploadThingError } from "uploadthing/server";
import { auth } from "./auth.js";
import { prisma } from "./db.js";
import { AuthedRequest, requireAuth } from "./middleware/auth.js";

if (!process.env.UPLOADTHING_TOKEN) {
  console.warn("UPLOADTHING_TOKEN is not configured. Profile image uploads will fail.");
}

const f = createUploadthing({
  errorFormatter: (error) => ({
    message: error.message,
    code: error.code,
    cause: process.env.NODE_ENV === "production" ? undefined : String(error.cause ?? ""),
  }),
});

export const uploadRouter = {
  profileImage: f({
    image: {
      maxFileSize: "4MB",
      maxFileCount: 1,
    },
  })
    .middleware(async ({ req, files }) => {
      const session = await auth.api.getSession({
        headers: fromNodeHeaders(req.headers),
      });

      if (!session?.user?.id) {
        throw new UploadThingError("Authentication required");
      }

      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true, role: true },
      });

      if (!user) {
        throw new UploadThingError("User not found");
      }

      return {
        uploadedBy: user.id,
        role: user.role,
        [UTFiles]: files.map((file) => ({
          ...file,
          customId: `profile-${user.id}-${randomUUID()}`,
        })),
      };
    })
    .onUploadComplete(({ file, metadata }) => ({
      uploadedBy: metadata.uploadedBy,
      role: metadata.role as Role,
      url: file.ufsUrl,
      key: file.key,
      customId: file.customId,
      name: file.name,
    })),
} satisfies FileRouter;

export type UploadRouter = typeof uploadRouter;

const utapi = new UTApi();

export async function deleteUploadThingFile(key?: string | null) {
  const fileKey = key?.trim();
  if (!fileKey) return;

  try {
    await utapi.deleteFiles(fileKey);
  } catch (error) {
    console.error(`Failed to delete UploadThing file ${fileKey}`, error);
  }
}

export const uploadManagementRouter = Router();

uploadManagementRouter.use(requireAuth);
uploadManagementRouter.delete("/files/:key", async (req: AuthedRequest, res) => {
  const key = String(req.params.key ?? "");
  if (!key) return res.status(400).json({ error: "File key is required" });

  const user = req.user;
  if (!user) return res.status(401).json({ error: "Authentication required" });

  if (user.role === Role.DOCTOR) {
    const ownProfile = await prisma.user.findFirst({
      where: { id: user.id, profileImageKey: key },
      select: { id: true },
    });
    if (!ownProfile) {
      return res.status(403).json({ error: "Insufficient permissions to delete this file" });
    }
  } else if (user.role !== Role.SUPER_ADMIN && user.role !== Role.STAFF) {
    return res.status(403).json({ error: "Insufficient permissions" });
  }

  const result = await utapi.deleteFiles(key);
  res.json({ data: result });
});
