import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { ERASED_CHILDREN_COLLECTION, ERASE_TOMBSTONE_DAYS, FamilyService } from "../families/familyService.js";
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
    await this.families.ensureChild(event.familyId, event.childId);
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

  /** Authorization: is `uid` a member of the family that owns `childId`? */
  ownsChild(uid: string, childId: string): Promise<boolean> {
    return this.families.ownsChild(uid, childId);
  }

  /** B-GA-09: the owner, or a member of the family that erased this child (FamilyService.mayEraseChild). */
  mayEraseChild(uid: string, childId: string): Promise<boolean> {
    return this.families.mayEraseChild(uid, childId);
  }

  /** GDPR erasure: hard-delete the child's memory event subcollection and child doc.
   *  B-GA-09 round 5: the child doc is the ownership anchor (FamilyService.ownsChild
   *  reads its familyId), so it goes LAST: a step that fails before it leaves the
   *  owner able to retry. With `tombstone`, `erasedChildren/{childId}` (the child and
   *  family ids, expiring in 30 days) is written FIRST, so a retry after the anchor
   *  went (a lost response) still passes mayEraseChild. */
  async eraseChild(childId: string, opts: { tombstone?: boolean } = {}) {
    const childRef = this.db.collection("children").doc(childId);
    const tombRef = this.db.collection(ERASED_CHILDREN_COLLECTION).doc(childId);
    const childFamily = (await childRef.get()).data()?.familyId;
    const familyId = typeof childFamily === "string" && childFamily ? childFamily : (await tombRef.get()).data()?.familyId;
    if (typeof familyId === "string" && familyId) {
      if (opts.tombstone) {
        const now = Date.now();
        await tombRef.set({ childId, familyId, erasedAt: new Date(now).toISOString(), expireAt: new Date(now + ERASE_TOMBSTONE_DAYS * 86_400_000) });
      }
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
