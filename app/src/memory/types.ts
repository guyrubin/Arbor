import type { CoachResponse } from "../contracts/coach.js";

export type MemoryStatus = "pending" | "approved" | "rejected" | "deleted" | "expired";

export type MemoryLedgerEvent = {
  eventId: string;
  memoryId: string;
  familyId: string;
  childId: string;
  eventType: "proposed" | "approved" | "rejected" | "deleted" | "edited" | "expired";
  status: MemoryStatus;
  fact: string;
  source: string;
  retention: string;
  createdAt: string;
  actor: "system" | "parent";
  prompt?: string;
  frameRouting?: CoachResponse["frameRouting"];
};

export type MemoryReviewItem = Omit<MemoryLedgerEvent, "eventId" | "eventType" | "actor"> & {
  latestEventId: string;
};

export type MemoryStore = {
  listEvents(childId?: string): Promise<MemoryLedgerEvent[]>;
  appendEvent(event: MemoryLedgerEvent): Promise<void>;
  ensureFamilyChild?(input: {
    familyId: string;
    childId: string;
    userId: string;
    childProfile?: Record<string, unknown>;
  }): Promise<void>;
};
