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
    await this.families.ensureChild(event.familyId, event.childId);
    await this.db
      .collection("children")
      .doc(event.childId)
      .collection("memoryEvents")
      .doc(event.eventId)
      .set(event);
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
