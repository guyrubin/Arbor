import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import { FamilyService } from "../families/familyService.js";
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

  /** GDPR erasure: hard-delete the child's memory event subcollection and child doc. */
  async eraseChild(childId: string) {
    const childRef = this.db.collection("children").doc(childId);
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
    await childRef.delete();
    return removed;
  }
}
