import { randomUUID } from "crypto";

/** Pre-OWN-1 memory appends stamped this shared literal; such a child has no real owner yet. */
const LEGACY_FAMILY_ID = "default-family";

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
