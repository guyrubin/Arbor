import { describe, it, expect } from "vitest";
import { readFileSync } from "fs";
import path from "path";
import {
  DEFAULT_MEMORY_RETENTION,
  enforceMemoryRetention,
  foldMemoryEvents,
  getApprovedMemoryContextDetail,
  isMemoryExpired,
  retentionToMs
} from "./memoryService.js";
import type { MemoryLedgerEvent, MemoryStore } from "./types.js";

const DAY = 86_400_000;
const DEFAULT_MS = 90 * DAY; // "3 months" — the propose flow's stated default

const daysAgo = (n: number) => new Date(Date.now() - n * DAY).toISOString();

const approvedEvent = (overrides: Partial<MemoryLedgerEvent>): MemoryLedgerEvent => ({
  eventId: `e-${Math.random()}`,
  memoryId: `m-${Math.random()}`,
  familyId: "f1",
  childId: "c1",
  eventType: "approved",
  status: "approved",
  fact: "fact",
  source: "chat",
  retention: "3 months",
  createdAt: daysAgo(1),
  actor: "parent",
  ...overrides
});

const createStore = (seed: MemoryLedgerEvent[] = []): MemoryStore & { events: MemoryLedgerEvent[] } => ({
  events: [...seed],
  async listEvents(childId?: string) {
    return childId ? this.events.filter((event) => event.childId === childId) : this.events;
  },
  async appendEvent(event) {
    this.events.push(event);
  },
  async eraseChild(childId: string) {
    const before = this.events.length;
    this.events = this.events.filter((event) => event.childId !== childId);
    return before - this.events.length;
  }
});

describe("memory time-boxing (SAFE-3 / G10 / SPC2)", () => {
  it("parses retention strings to TTLs", () => {
    expect(retentionToMs("30 days")).toBe(30 * DAY);
    expect(retentionToMs("2 weeks")).toBe(14 * DAY);
    expect(retentionToMs("6 months")).toBe(180 * DAY);
    expect(retentionToMs("1 year")).toBe(365 * DAY);
    expect(retentionToMs("session")).toBe(DAY);
    expect(retentionToMs("permanent")).toBe(Infinity); // explicit permanence honoured
    expect(retentionToMs("long-term")).toBe(Infinity);
  });

  it("SPC2 re-anchor: missing/unparseable retention falls back to the app default, never Infinity", () => {
    // Previously missing/unparseable → Infinity (never expires). That let child
    // data outlive any retention promise; now only EXPLICIT permanence is permanent.
    expect(DEFAULT_MEMORY_RETENTION).toBe("3 months");
    expect(retentionToMs(undefined)).toBe(DEFAULT_MS);
    expect(retentionToMs("")).toBe(DEFAULT_MS);
    expect(retentionToMs("until the parent revokes")).toBe(DEFAULT_MS); // unparseable → default
  });

  it("expires approved memory past its retention", () => {
    expect(isMemoryExpired({ retention: "30 days", createdAt: daysAgo(40) })).toBe(true);
    expect(isMemoryExpired({ retention: "30 days", createdAt: daysAgo(5) })).toBe(false);
    expect(isMemoryExpired({ retention: "permanent", createdAt: daysAgo(4000) })).toBe(false);
    // missing retention: default window applies
    expect(isMemoryExpired({ retention: undefined, createdAt: daysAgo(100) })).toBe(true);
    expect(isMemoryExpired({ retention: undefined, createdAt: daysAgo(5) })).toBe(false);
  });

  it("enforceMemoryRetention keeps fresh facts, drops expired ones, and tombstones via the ledger (never deletes)", async () => {
    const fresh = approvedEvent({ memoryId: "m-fresh", fact: "fresh fact", retention: "30 days", createdAt: daysAgo(5) });
    const stale = approvedEvent({ memoryId: "m-stale", fact: "stale fact", retention: "30 days", createdAt: daysAgo(40) });
    const noRetention = approvedEvent({ memoryId: "m-default", fact: "default-window fact", retention: "", createdAt: daysAgo(100) });
    const store = createStore([fresh, stale, noRetention]);

    const live = await enforceMemoryRetention(store, foldMemoryEvents(store.events, "c1"));

    expect(live.map((i) => i.memoryId)).toEqual(["m-fresh"]);
    // Tombstoned through the transition machinery: append-only "expired" events, actor system.
    const tombstones = store.events.filter((e) => e.eventType === "expired");
    expect(tombstones.map((e) => e.memoryId).sort()).toEqual(["m-default", "m-stale"]);
    expect(tombstones.every((e) => e.status === "expired" && e.actor === "system")).toBe(true);
    // Nothing was deleted from the ledger — original events remain.
    expect(store.events.filter((e) => e.eventId === stale.eventId)).toHaveLength(1);
    // After tombstoning, the fold itself excludes them (parent list + all readers).
    expect(foldMemoryEvents(store.events, "c1").map((i) => i.memoryId)).toEqual(["m-fresh"]);
  });

  it("GUARD: the coach context path applies the retention filter and never injects expired facts", async () => {
    const fresh = approvedEvent({ memoryId: "m-fresh", fact: "Uses a picture card before shoes", retention: "6 months", createdAt: daysAgo(5) });
    const stale = approvedEvent({ memoryId: "m-stale", fact: "Bedtime regression last spring", retention: "30 days", createdAt: daysAgo(60) });
    const store = createStore([fresh, stale]);

    const { context, factsUsed } = await getApprovedMemoryContextDetail(store, "c1");

    expect(context).toContain("Uses a picture card before shoes");
    expect(context).not.toContain("Bedtime regression last spring");
    expect(factsUsed).toBe(1);
    // Reading coach context is an enforcement point: the expired fact is tombstoned.
    expect(store.events.some((e) => e.memoryId === "m-stale" && e.eventType === "expired")).toBe(true);
  });

  it("GUARD (source pin): coach context + parent-visible list + shared packet all route through retention enforcement", () => {
    const svc = readFileSync(path.join(__dirname, "memoryService.ts"), "utf8");
    const coachPath = svc.slice(svc.indexOf("getApprovedMemoryContextDetail"), svc.indexOf("export const getApprovedMemoryContext ="));
    expect(coachPath).toContain("enforceMemoryRetention");

    const api = readFileSync(path.join(__dirname, "..", "routes", "api.ts"), "utf8");
    const listRoute = api.slice(api.indexOf('router.get("/memory/:childId"'), api.indexOf('router.post("/memory/:childId/propose"'));
    expect(listRoute).toContain("enforceMemoryRetention");

    const packet = readFileSync(path.join(__dirname, "..", "server", "sharedPacket.ts"), "utf8");
    expect(packet).toContain("isMemoryExpired");
  });
});
