/**
 * useKidSouvenirs — B-KID-96 v1: the child's souvenir ledger, in the per-child
 * store pattern (Firestore `users/{uid}/children/{childId}/kidSouvenirs`, or
 * local storage in the sandbox). Registered in CHILD_SUBCOLLECTIONS so it is
 * exported and erased with the child's data.
 */
import { useChildCollection } from "../../../hooks/useChildCollection";
import type { KidSouvenir } from "./kidSouvenirs";

export function useKidSouvenirs(childId: string) {
  // the literal name: childData.subcollections.test scans for it (= SOUVENIR_COLLECTION)
  return useChildCollection<KidSouvenir>(childId, "kidSouvenirs");
}
