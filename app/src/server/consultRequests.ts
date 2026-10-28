/**
 * MON-3 v1: the professional intro/booking transaction (email-based first cut).
 *
 * "Request consultation" used to only navigate to Appointments. Now it creates
 * a durable, structured consult request the parent can follow up on. v1 is
 * deliberately email-based: the server records the request and returns a
 * ready-to-send mailto draft; a staffed directory/booking flow can replace the
 * transport later without changing this contract.
 */
import { randomUUID } from "crypto";
import { getApps, initializeApp, applicationDefault } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";
import type { ArborConfig } from "../config/env.js";

export type ConsultRequest = {
  id: string;
  ownerUid: string;
  ownerEmail: string | null;
  childId: string | null;
  professionalId: string;
  professionalName: string;
  specialty: string | null;
  preferredMode: "video" | "in_person" | "either";
  note: string;
  status: "requested" | "contacted" | "booked" | "closed";
  createdAt: string;
};

export interface ConsultStore {
  create(request: ConsultRequest): Promise<ConsultRequest>;
  listByOwner(ownerUid: string): Promise<ConsultRequest[]>;
  /** B-GA-09: the requests this owner made about one child (the note is the
   *  parent's words about the child): exported with the child (Art. 15/20)… */
  listByChild(ownerUid: string, childId: string): Promise<ConsultRequest[]>;
  /** …and erased with the child (Art. 17), whoever filed them: a co-parent's
   *  request about the child goes too (critic r1). Returns how many. */
  eraseByChild(childId: string): Promise<number>;
}

export class LocalConsultStore implements ConsultStore {
  private requests = new Map<string, ConsultRequest>();
  async create(request: ConsultRequest) { this.requests.set(request.id, request); return request; }
  async listByOwner(ownerUid: string) {
    return [...this.requests.values()]
      .filter((r) => r.ownerUid === ownerUid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  async listByChild(ownerUid: string, childId: string) {
    return (await this.listByOwner(ownerUid)).filter((r) => r.childId === childId);
  }
  async eraseByChild(childId: string) {
    const doomed = [...this.requests.values()].filter((r) => r.childId === childId);
    for (const r of doomed) this.requests.delete(r.id);
    return doomed.length;
  }
}

export class FirestoreConsultStore implements ConsultStore {
  private readonly db;
  constructor(config: ArborConfig) {
    if (!getApps().length) {
      initializeApp({ credential: applicationDefault(), projectId: config.firebaseProjectId });
    }
    this.db = getFirestore(config.firestoreDatabaseId);
  }
  private col() { return this.db.collection("consultRequests"); }
  async create(request: ConsultRequest) {
    await this.col().doc(request.id).set(request);
    return request;
  }
  async listByOwner(ownerUid: string) {
    const snap = await this.col().where("ownerUid", "==", ownerUid).get();
    return snap.docs
      .map((d) => d.data() as ConsultRequest)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  // Filtered in memory after the owner query (the one existing index), so no
  // composite index is needed: a family has a handful of requests.
  async listByChild(ownerUid: string, childId: string) {
    return (await this.listByOwner(ownerUid)).filter((r) => r.childId === childId);
  }
  async eraseByChild(childId: string) {
    const snap = await this.col().where("childId", "==", childId).get();
    for (const d of snap.docs) await d.ref.delete();
    return snap.docs.length;
  }
}

export const createConsultStore = (config: ArborConfig): ConsultStore =>
  config.memoryAdapter === "firestore" ? new FirestoreConsultStore(config) : new LocalConsultStore();

export const buildConsultRequest = (input: {
  ownerUid: string;
  ownerEmail: string | null;
  childId?: string | null;
  professionalId: string;
  professionalName: string;
  specialty?: string | null;
  preferredMode?: string;
  note?: string;
}): ConsultRequest => ({
  id: randomUUID(),
  ownerUid: input.ownerUid,
  ownerEmail: input.ownerEmail,
  childId: input.childId ?? null,
  professionalId: input.professionalId,
  professionalName: input.professionalName,
  specialty: input.specialty ?? null,
  preferredMode: input.preferredMode === "video" || input.preferredMode === "in_person" ? input.preferredMode : "either",
  note: (input.note || "").slice(0, 2000),
  status: "requested",
  createdAt: new Date().toISOString(),
});
