import { ref, uploadString, getDownloadURL } from "firebase/storage";
import { storage } from "./firebase";

/**
 * Upload a (downscaled) data-URL image to Firebase Storage and return its
 * download URL. Throws if Storage is unavailable/uninitialized so callers can
 * fall back to inlining the data URL (A5, with graceful degradation).
 */
export async function uploadChildPhoto(uid: string, childId: string, dataUrl: string): Promise<string> {
  if (!storage) throw new Error("storage-unavailable");
  const path = `users/${uid}/children/${childId}/photos/${Date.now()}.jpg`;
  const r = ref(storage, path);
  await uploadString(r, dataUrl, "data_url");
  return getDownloadURL(r);
}
