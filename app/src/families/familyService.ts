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

  /** B-DATA-15: a NEW child id is issued here, never chosen by a client. The
   *  id is random (not guessable, no shared timestamp namespace) and its
   *  children/{id} doc is created in the same transaction, already parented
   *  to the caller's family — so no other account can collide with it or
   *  claim it before the parent's own profile write lands. */
  async issueChild(familyId: string): Promise<string> {
    const now = new Date().toISOString();
    for (let attempt = 0; attempt < 3; attempt++) {
      const childId = `child-${randomUUID()}`;
      const created = await this.db.runTransaction(async (transaction) => {
        const childRef = this.db.collection("children").doc(childId);
        if ((await transaction.get(childRef)).exists) return false;
        const familyRef = this.db.collection("families").doc(familyId);
        transaction.set(familyRef, { familyId, updatedAt: now }, { merge: true });
        transaction.set(childRef, { childId, familyId, createdAt: now, updatedAt: now, issuedAt: now });
        transaction.set(familyRef.collection("childRefs").doc(childId), { childId, familyId, updatedAt: now }, { merge: true });
        return true;
      });
      if (created) return childId;
    }
    throw new Error("Could not issue a child id");
  }

  /** B-DATA-15 (defense in depth behind requireChildOwnership): may an event
   *  stamped `familyId` be written to `childId`'s memory ledger? Yes when the
   *  child is (now) parented to that family; when the stamp is the legacy
   *  'default-family' of a pre-OWN-1 fact (no request mints it — it is only
   *  carried by that fact's own later transitions); or when the stamping
   *  family shares a member with the owning family (one parent, two family
   *  docs from concurrent first-login provisioning). Any other family —
   *  a caller who is not a member of the owning family — is refused. */
  async admitsLedgerAppend(familyId: string, childId: string): Promise<boolean> {
    if (await this.ensureChild(familyId, childId)) return true;
    if (familyId === LEGACY_FAMILY_ID) return true;
    const owner = (await this.db.collection("children").doc(childId).get()).data()?.familyId;
    if (typeof owner !== "string" || !owner) return false;
    const members = await this.db.collection("families").doc(familyId).collection("members").get();
    for (const member of members.docs) {
      if ((await this.db.collection("families").doc(owner).collection("members").doc(member.id).get()).exists) return true;
    }
    return false;
  }
}
