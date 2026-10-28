/**
 * lib/planNarrationSource — PR C (Everyday Plans): what the parent-side plan
 * narration builder reads of a child's collections, through the same seams as
 * the kid shelf (useChildLibraryBooks): the `bookAssets` docs (the shared plan
 * sheet, the patterns' narration docs) and the `books` rows (the plans). A
 * Firebase build reads the cloud collections; the sandbox reads the device's
 * copies. Lives outside the kid surfaces (cosmeticsFirewall: no kid-surface
 * file talks to Firebase directly). Read only.
 */
import { collection, getDocs } from "firebase/firestore";
import { bookDocsOnDevice } from "./bookAssets";
import { auth, db } from "./firebase";
import type { BookAssetsDoc } from "./library/bookAssetPaths";
import { PLAN_BOOKS_COLLECTION } from "./library/plans/planBookDoc";

export interface PlanNarrationSource {
  docs: BookAssetsDoc[];
  plans: unknown[];
}

function localList(key: string): unknown[] {
  try {
    const raw: unknown = JSON.parse(localStorage.getItem(key) ?? "[]");
    return Array.isArray(raw) ? raw : [];
  } catch {
    return [];
  }
}

/** The sandbox keeps the collections on the device (the builder's local commits). */
export const planDocsOnDevice = (): boolean => bookDocsOnDevice();

export async function readPlanNarrationSource(childId: string): Promise<PlanNarrationSource> {
  if (planDocsOnDevice()) return { docs: localList(`arbor.bookAssets.${childId}`) as BookAssetsDoc[], plans: localList(`arbor.${PLAN_BOOKS_COLLECTION}.${childId}`) };
  const uid = auth?.currentUser?.uid;
  if (!uid || !db) throw new Error("signed out");
  const [docs, plans] = await Promise.all([
    getDocs(collection(db, `users/${uid}/children/${childId}/bookAssets`)),
    getDocs(collection(db, `users/${uid}/children/${childId}/${PLAN_BOOKS_COLLECTION}`)),
  ]);
  return { docs: docs.docs.map((d) => d.data() as BookAssetsDoc), plans: plans.docs.map((d) => d.data()) };
}
