import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

export class FirestoreMemoryStore implements MemoryStore {
  private readonly db;

  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({
        credential: applicationDefault(),
        projectId: config.firebaseProjectId
      });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
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
    const child = await this.db.collection("children").doc(event.childId).get();
    if (!child.exists) {
      throw new Error(`Cannot append Arbor memory event because children/${event.childId} does not exist.`);
    }
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
    const now = new Date().toISOString();
    const batch = this.db.batch();
    const familyRef = this.db.collection("families").doc(input.familyId);
    const memberRef = familyRef.collection("members").doc(input.userId);
    const childRef = this.db.collection("children").doc(input.childId);

    batch.set(familyRef, {
      familyId: input.familyId,
      createdAt: now,
      updatedAt: now
    }, { merge: true });
    batch.set(memberRef, {
      userId: input.userId,
      role: "parent",
      createdAt: now,
      updatedAt: now
    }, { merge: true });
    batch.set(childRef, {
      ...(input.childProfile || {}),
      childId: input.childId,
      familyId: input.familyId,
      createdAt: now,
      updatedAt: now
    }, { merge: true });

    await batch.commit();
  }
}
