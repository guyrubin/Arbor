import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { ChildErasedError, ERASED_CHILDREN_COLLECTION, ERASE_TOMBSTONE_DAYS, FamilyService } from "../families/familyService.js";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

export class FirestoreMemoryStore implements MemoryStore {
  private readonly db;
  private readonly families;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({
        credential: applicationDefault(),
        projectId: config.firebaseProjectId
      });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
    this.families = new FamilyService(this.db);
  }

  async listEvents(childId?: string) {
    let query = this.db.collectionGroup("memoryEvents").orderBy("createdAt", "asc");
    if (childId) {
      query = query.where("childId", "==", childId) as FirebaseFirestore.Query;
    }
    const snapshot = await query.get();
    return snapshot.docs.map((doc) => doc.data() as MemoryLedgerEvent);
  }

  async appendEvent(event: MemoryLedgerEvent) {
    // B-GA-09 round 8: no late write (a request that passed the owner check
    // before the erase) reaches an erased child's ledger or re-creates its doc,
    // through any path, the legacy-family one included.
    if (await this.families.isErased(event.childId)) throw new ChildErasedError();
    // B-DATA-15: a family that does not own the child never writes to its
    // ledger (ensureChild alone left the child untouched but still appended).
    if (!(await this.families.admitsLedgerAppend(event.familyId, event.childId))) {
      throw new Error("This family is not authorized to write this child's memory.");
    }
    await this.db
      .collection("children")
      .doc(event.childId)
      .collection("memoryEvents")
      .doc(event.eventId)
      .set(event);
  }

  /** OWN-1: uid → familyId (created on first touch). Requires the
   *  collection-group index on members.userId (firestore.indexes.json). */
  ensureFamilyForUser(uid: string): Promise<{ familyId: string }> {
    return this.families.ensureFamilyForUser(uid);
  }

  async ensureFamilyChild(input: {
    familyId: string;
    childId: string;
    userId: string;
    childProfile?: Record<string, unknown>;
  }) {
    await this.families.ensureFamilyMembership(input.familyId, input.userId);
    await this.families.ensureChild(input.familyId, input.childId, input.childProfile);
  }

  /** B-DATA-15: a new child id, issued and parented server-side. */
  async issueChildId(input: { familyId: string; userId: string }): Promise<string> {
    await this.families.ensureFamilyMembership(input.familyId, input.userId);
    return this.families.issueChild(input.familyId);
  }

  /** Authorization: is `uid` a member of the family that owns `childId`? */
  ownsChild(uid: string, childId: string): Promise<boolean> {
    return this.families.ownsChild(uid, childId);
  }

  /** B-GA-09: the owner, or a member of the family that erased this child (FamilyService.mayEraseChild). */
  mayEraseChild(uid: string, childId: string): Promise<boolean> {
    return this.families.mayEraseChild(uid, childId);
  }

  /** The family that owns (or owned) the child: the child doc, else its erase record. */
  private async erasingFamily(childId: string): Promise<string | undefined> {
    const childFamily = (await this.db.collection("children").doc(childId).get()).data()?.familyId;
    if (typeof childFamily === "string" && childFamily) return childFamily;
    const recorded = (await this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId).get()).data()?.familyId;
    return typeof recorded === "string" && recorded ? recorded : undefined;
  }

  /** B-GA-09: the per-child erase's FIRST step. `erasedChildren/{childId}` (the
   *  child and family ids, expiring in 30 days; firestore.indexes.json TTL) lets
   *  the same family retry once the child doc is gone (mayEraseChild), and lets
   *  account deletion find a child whose erase stopped half way. */
  async recordErase(childId: string): Promise<void> {
    const familyId = await this.erasingFamily(childId);
    // Round 8: a placeholder-family child gets a record too (it stops a late
    // write re-creating the child); its record lets nobody in (mayEraseChild)
    // and account deletion never sweeps that family (round 7).
    if (!familyId) return;
    const now = Date.now();
    await this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId).set({
      childId, familyId, erasedAt: new Date(now).toISOString(), expireAt: new Date(now + ERASE_TOMBSTONE_DAYS * 86_400_000),
    });
  }

  /** Round 7: the erase is finished for good (account deletion): the record goes. */
  async dropEraseRecord(childId: string): Promise<void> {
    await this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId).delete();
  }

  /** GDPR erasure: hard-delete the child's memory event subcollection and child doc.
   *  B-GA-09 round 5: the child doc is the ownership anchor (FamilyService.ownsChild
   *  reads its familyId), so it goes LAST: a step that fails before it leaves the
   *  owner able to retry. */
  async eraseChild(childId: string) {
    const childRef = this.db.collection("children").doc(childId);
    const familyId = await this.erasingFamily(childId);
    if (familyId) {
      // B-GA-09: the family's pointer to this child (ids only) goes with it.
      await this.db.collection("families").doc(familyId).collection("childRefs").doc(childId).delete();
    }
    const events = await childRef.collection("memoryEvents").get();
    let removed = 0;
    // Firestore batches cap at 500 writes.
    const docs = [...events.docs];
    while (docs.length > 0) {
      const batch = this.db.batch();
      for (const doc of docs.splice(0, 450)) {
        batch.delete(doc.ref);
        removed += 1;
      }
      await batch.commit();
    }
    await childRef.delete(); // the ownership anchor, last
    return removed;
  }
}
