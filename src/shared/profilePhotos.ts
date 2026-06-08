import { backendApi } from "../services/apiClient";
import type { AppContextValue } from "../app/AppProvider";

export function discardDraftProfilePhoto(draftKey: string | undefined, savedKey: string | undefined, showToast: AppContextValue["showToast"]) {
  if (!draftKey || draftKey === savedKey) return;
  backendApi.deleteUpload(draftKey)
    .then(() => showToast("Discarded unsaved profile photo", "info"))
    .catch(() => showToast("Could not delete the unsaved profile photo", "error"));
}

export function deleteReplacedProfilePhoto(savedKey?: string, nextKey?: string) {
  if (!savedKey || savedKey === nextKey) return;
  backendApi.deleteUpload(savedKey).catch(() => undefined);
}
