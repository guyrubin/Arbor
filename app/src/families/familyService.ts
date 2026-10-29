import { randomUUID } from "crypto";

/** Pre-OWN-1 memory appends stamped this shared literal; such a child has no real owner yet. */
export const LEGACY_FAMILY_ID = "default-family";

/** B-GA-09 round 5: `erasedChildren/{childId}` = { childId, familyId, erasedAt, expireAt }, written by
 *  the per-child erase before it deletes anything (FirestoreMemoryStore.eraseChild). Ids only, no child
 *  data; Firestore's TTL policy on `expireAt` removes it (docs/compliance/child-data-register.md). */
export const ERASED_CHILDREN_COLLECTION = "erasedChildren";
export const ERASE_TOMBSTONE_DAYS = 30;

/** B-GA-09 round 8: a write to a child whose erase is under way or done. The
 *  routes answer it as 410 Gone; nothing is written and nothing re-created. */
export class ChildErasedError extends Error {
  readonly status = 410;
  constructor() {
    super("This child's data was erased.");
    this.name = "ChildErasedError";
  }
}

/** Does this erase record still stand (unexpired)? */
const recordStands = (record: Record<string, unknown> | undefined): boolean =>
  !!record && toMillis(record.expireAt) > Date.now();

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

  /** B-GA-09 round 8: is this child's erase under way or done (an unexpired erase record)? */
  async isErased(childId: string): Promise<boolean> {
    return recordStands((await this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId).get()).data());
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
    // Round 7: the shared placeholder family is nobody's (its members are unrelated accounts).
    if (!familyId || familyId === LEGACY_FAMILY_ID || !(toMillis(tomb?.expireAt) > Date.now())) return false;
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

      // B-GA-09 round 8: an erase under way or done (an unexpired erase record)
      // is final: a request that passed the owner check before the erase must
      // not bring children/{id} back for its family afterwards.
      const erased = await transaction.get(this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId));
      if (erased.exists && recordStands(erased.data())) return false;

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
