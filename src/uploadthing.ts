import { generateUploadButton } from "@uploadthing/react";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3001/api";
const uploadThingApiUrl = `${API_BASE_URL}/uploadthing`;

export const UploadButton = generateUploadButton<any>({
  url: uploadThingApiUrl,
  fetch: (input, init) => {
    const target = typeof input === "string" || input instanceof URL ? String(input) : input.url;
    const isAppUploadRoute = target.startsWith(uploadThingApiUrl) || target.includes("/api/uploadthing");
    return fetch(input, {
      ...init,
      credentials: isAppUploadRoute ? "include" : "omit",
    });
  },
});
