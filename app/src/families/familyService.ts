import { randomUUID } from "crypto";

/** Pre-OWN-1 memory appends stamped this shared literal; such a child has no real owner yet. */
const LEGACY_FAMILY_ID = "default-family";

/** B-GA-09 round 5: `erasedChildren/{childId}` = { childId, familyId, erasedAt, expireAt }, written by
 *  the per-child erase before it deletes anything (FirestoreMemoryStore.eraseChild). Ids only, no child
 *  data; Firestore's TTL policy on `expireAt` removes it (docs/compliance/child-data-register.md). */
export const ERASED_CHILDREN_COLLECTION = "erasedChildren";
export const ERASE_TOMBSTONE_DAYS = 30;

/** A Firestore Timestamp, Date or ISO string → epoch ms (NaN when absent). */
const toMillis = (v: unknown): number =>
  v instanceof Date ? v.getTime()
  : typeof v === "string" ? Date.parse(v)
  : v && typeof (v as { toMillis?: unknown }).toMillis === "function" ? (v as { toMillis: () => number }).toMillis()
  : NaN;

export class FamilyService {
  constructor(private readonly db: FirebaseFirestore.Firestore) {}

  async ensureFamilyForUser(uid: string): Promise<{ familyId: string }> {
    const existing = await this.db.collectionGroup("members").where("userId", "==", uid).limit(1).get();
    const familyId = existing.docs[0]?.ref.parent.parent?.id;
    if (familyId) return { familyId };

    const nextFamilyId = randomUUID();
    const now = new Date().toISOString();
    await this.db.runTransaction(async (transaction) => {
      const familyRef = this.db.collection("families").doc(nextFamilyId);
      const memberRef = familyRef.collection("members").doc(uid);
      transaction.set(familyRef, { familyId: nextFamilyId, createdAt: now, updatedAt: now }, { merge: true });
      transaction.set(memberRef, { userId: uid, role: "parent", createdAt: now, updatedAt: now }, { merge: true });
    });

    return { familyId: nextFamilyId };
  }

  async ensureFamilyMembership(familyId: string, uid: string) {
    const now = new Date().toISOString();
    await this.db.runTransaction(async (transaction) => {
      const familyRef = this.db.collection("families").doc(familyId);
      const memberRef = familyRef.collection("members").doc(uid);
      transaction.set(familyRef, { familyId, createdAt: now, updatedAt: now }, { merge: true });
      transaction.set(memberRef, { userId: uid, role: "parent", createdAt: now, updatedAt: now }, { merge: true });
    });
  }

  /** Authorization: does `uid` belong to the family that owns `childId`?
   *  Fails closed — an unknown child or a missing membership returns false. */
  async ownsChild(uid: string, childId: string): Promise<boolean> {
    if (!uid || !childId) return false;
    const childSnap = await this.db.collection("children").doc(childId).get();
    const familyId = childSnap.exists ? (childSnap.data()?.familyId as string | undefined) : undefined;
    if (!familyId) return false;
    const memberSnap = await this.db.collection("families").doc(familyId).collection("members").doc(uid).get();
    return memberSnap.exists;
  }

  /** B-GA-09 round 5: may `uid` (re)run the erase of `childId`? While the child doc
   *  exists, only its owner (ownsChild). Once it is gone (an earlier erase reached
   *  its last step), a member of the family named in the child's unexpired erase
   *  tombstone, so a retry after a lost response still reaches every sink. Fails
   *  closed: no doc and no tombstone, an expired one, or a non-member → false. */
  async mayEraseChild(uid: string, childId: string): Promise<boolean> {
    if (!uid || !childId) return false;
    const childSnap = await this.db.collection("children").doc(childId).get();
    if (childSnap.exists) return this.ownsChild(uid, childId);
    const tomb = (await this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId).get()).data();
    const familyId = typeof tomb?.familyId === "string" ? tomb.familyId : "";
    if (!familyId || !(toMillis(tomb?.expireAt) > Date.now())) return false;
    const memberSnap = await this.db.collection("families").doc(familyId).collection("members").doc(uid).get();
    return memberSnap.exists;
  }

  /** OWN-1 backfill contract: a new child, or a child doc still stamped with the
   *  legacy 'default-family' id (or none), is parented to the caller's real
   *  family — flipping `ownsChild` to true. Memory ledger events fold by childId
   *  (listEvents), so existing events survive the re-parenting untouched.
   *
   *  A child that already belongs to ANOTHER real family is never moved and
   *  never written: any signed-in account could otherwise claim a child by
   *  posting its id to /onboarding/family-child and pass requireChildOwnership
   *  on its ledger, private book files, export and erase. Returns whether the
   *  child is now parented to `familyId` (false = left with its own family). */
  async ensureChild(familyId: string, childId: string, profileSeed: Record<string, unknown> = {}): Promise<boolean> {
    const now = new Date().toISOString();
    return this.db.runTransaction(async (transaction) => {
      const familyRef = this.db.collection("families").doc(familyId);
      const childRef = this.db.collection("children").doc(childId);
      const childRefInFamily = familyRef.collection("childRefs").doc(childId);

      const existing = await transaction.get(childRef);
      const ownerFamily = existing.exists ? (existing.data()?.familyId as unknown) : undefined;
      if (typeof ownerFamily === "string" && ownerFamily && ownerFamily !== LEGACY_FAMILY_ID && ownerFamily !== familyId) return false;

      transaction.set(familyRef, { familyId, updatedAt: now }, { merge: true });
      transaction.set(childRef, {
        ...profileSeed,
        childId,
        familyId,
        ...(existing.exists ? {} : { createdAt: now }),
        updatedAt: now
      }, { merge: true });
      transaction.set(childRefInFamily, {
        childId,
        familyId,
        updatedAt: now
      }, { merge: true });
      return true;
    });
  }
}
