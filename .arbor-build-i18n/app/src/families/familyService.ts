import { randomUUID } from "crypto";

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

  async ensureChild(familyId: string, childId: string, profileSeed: Record<string, unknown> = {}) {
    const now = new Date().toISOString();
    await this.db.runTransaction(async (transaction) => {
      const familyRef = this.db.collection("families").doc(familyId);
      const childRef = this.db.collection("children").doc(childId);
      const childRefInFamily = familyRef.collection("childRefs").doc(childId);

      transaction.set(familyRef, { familyId, updatedAt: now }, { merge: true });
      transaction.set(childRef, {
        ...profileSeed,
        childId,
        familyId,
        createdAt: now,
        updatedAt: now
      }, { merge: true });
      transaction.set(childRefInFamily, {
        childId,
        familyId,
        updatedAt: now
      }, { merge: true });
    });
  }
}
