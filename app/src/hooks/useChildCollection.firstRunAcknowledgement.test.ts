import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import ts from "typescript";
import type { ChildCollection } from "./useChildCollection";
import type { ActionLoopEntry } from "../actionLoop/model";
import type { ChildProfile } from "../types";
import { settleOrQueue, QUEUED_ACK_MS } from "../lib/firestoreWrite";
import { sameLocalHistoryRows } from "../lib/historyWindow";
import { acceptTodayAction } from "../actionLoop/accept";
import { FirstRunController, firstRunCard } from "../lib/onboardingFirstRun";

/** Actual collection callback + acknowledgement helper, with only React and
 * Firestore boundaries replaced. No SDK or model request can leave this test. */
function collectionHarness() {
  const rows = new Map<string, ActionLoopEntry>();
  const write = vi.fn<(path: string, row: ActionLoopEntry) => Promise<void>>().mockResolvedValue();
  const react = {
    useCallback: (fn: unknown) => fn, useEffect: () => {}, useRef: (value: unknown) => ({ current: value }),
    useState: (value: unknown) => [value, () => {}], useSyncExternalStore: () => 0,
  };
  const imports: Record<string, unknown> = {
    react,
    "firebase/firestore": {
      doc: (_db: unknown, ...parts: string[]) => parts.join("/"),
      setDoc: (path: string, row: ActionLoopEntry) => { rows.set(row.id, row); return write(path, row); },
    },
    "../lib/firebase": { db: {}, firebaseEnabled: true }, "../context/AuthContext": { useAuth: () => ({ user: { uid: "owner" } }) },
    "../lib/syncStore": {}, "../lib/firestoreWrite": { settleOrQueue }, "../lib/historyWindow": { sameLocalHistoryRows },
  };
  const code = ts.transpileModule(readFileSync(new URL("./useChildCollection.ts", import.meta.url), "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} as { useChildCollection: (child: string, name: string) => ChildCollection<ActionLoopEntry> } };
  new Function("require", "module", "exports", code)((name: string) => { if (!(name in imports)) throw Error("Unmocked boundary: " + name); return imports[name]; }, module, module.exports);
  return { collection: module.exports.useChildCollection("child-a", "actionLoops"), write, rows };
}
function deferred() {
  let resolve!: () => void, reject!: (error: Error) => void;
  const promise = new Promise<void>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
const NOW = new Date("2026-10-09T12:00:00Z");
const row: ActionLoopEntry = { id: "today.child-a.2026-10-09", recommendation: "Notice today", status: "accepted", source: "onboarding", capacity: "tiny", acceptedAt: NOW.toISOString(), acceptanceKey: "onboarding-v1.child-a.test" };
beforeEach(() => { vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubGlobal("navigator", { onLine: true }); });
afterEach(() => { vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("critical first-run acknowledgement boundary", () => {
  it("ordinary collection upserts retain offline queue semantics", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise); vi.stubGlobal("navigator", { onLine: false });
    await expect(h.collection.upsert(row)).resolves.toBeUndefined(); pending.resolve();
  });
  it("confirmed upsert rejects offline and consumes a late failed write", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise); vi.stubGlobal("navigator", { onLine: false });
    await expect(h.collection.upsert(row, { requireAcknowledgement: true })).rejects.toThrow("online confirmation");
    pending.reject(new Error("late permission-denied")); await Promise.resolve();
  });
  it("confirmed upsert rejects a delayed server rejection before the timeout", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValue(pending.promise);
    const saving = expect(h.collection.upsert(row, { requireAcknowledgement: true })).rejects.toThrow("permission-denied");
    await vi.advanceTimersByTimeAsync(QUEUE_DELAY); pending.reject(new Error("permission-denied")); await saving;
  });
  it("unconfirmed optimistic replay cannot complete setup; same-ID retry waits for actual acknowledgement", async () => {
    const h = collectionHarness(), pending = deferred(); h.write.mockReturnValueOnce(pending.promise);
    const child: ChildProfile = { id: "child-a", name: "Noa", age: 4, birthMonth: "2022-04", languages: ["English"], schoolContext: "", strengths: [], challenges: [], onboardingComplete: false,
      onboardingDraft: { step: 3, choice: "talking", words: "", quote: "bus", hardMomentId: "" } };
    const services = {
      addChild: async () => child,
      updateChild: async (_id: string, patch: Partial<ChildProfile>) => { Object.assign(child, patch); return true; },
      lang: () => "en" as const, now: () => NOW,
      accept: async (childId: string, card: ReturnType<typeof firstRunCard>, acceptanceKey: string) => {
        await acceptTodayAction({ childId, items: [...h.rows.values()], upsert: item => h.collection.upsert(item, { requireAcknowledgement: true }),
          recommendation: card.recommendation, source: card.source, capacity: "tiny", acceptanceKey, confirmExisting: true, now: NOW });
      },
    };
    const c = new FirstRunController(child, services), card = firstRunCard(c.snapshot(), "en", NOW);
    const accepting = c.finish(card); await vi.advanceTimersByTimeAsync(QUEUED_ACK_MS - 1);
    expect(child.onboardingComplete).toBe(false); expect(c.snapshot().busy).toBe(true);
    await vi.advanceTimersByTimeAsync(1); await accepting;
    expect(c.snapshot()).toMatchObject({ complete: false, busy: false, error: true }); expect(child.onboardingComplete).toBe(false);
    expect(child.onboardingDraft?.quote).toBe("bus"); expect(h.rows.size).toBe(1);
    pending.reject(new Error("late permission-denied")); await Promise.resolve();
    // Simulate remount while Firestore still exposes its optimistic row. A
    // matching key is not proof of durability: retry re-confirms that same ID.
    const retry = deferred(); h.write.mockReturnValueOnce(retry.promise);
    const resumed = new FirstRunController(child, services), finishing = resumed.finish(card);
    await vi.advanceTimersByTimeAsync(1); expect(h.write).toHaveBeenCalledTimes(2); expect(child.onboardingComplete).toBe(false);
    expect(h.write.mock.calls[1][0]).toBe(h.write.mock.calls[0][0]); retry.resolve(); await finishing;
    expect(child.onboardingComplete).toBe(true); expect(resumed.snapshot().complete).toBe(true); expect(h.rows.size).toBe(1);
  });
  it("the mounted first-run path opts in for both new and replayed actions", () => {
    const source = readFileSync(new URL("../components/auth/OnboardingFlow.tsx", import.meta.url), "utf8");
    expect(source).toContain("current.actions.upsert(item, { requireAcknowledgement: true })");
    expect(source).toContain("confirmExisting: true");
  });
});
const QUEUE_DELAY = QUEUED_ACK_MS - 1;
