/**
 * ENG-L0 — the day-0 chain (first moment → first keepsake → tonight's story).
 *
 * Behaviour tests on the pure resolver and the device record, each paired with
 * a NEGATIVE CONTROL that fails when the defect it guards comes back:
 *
 *   · a chain that cannot be resumed  → the marks must survive a fresh read;
 *   · a chain that nags               → dismissed/complete must go invisible;
 *   · a step asserted, not observed   → `moment` must never come from a mark;
 *   · a key the child sweep misses    → the real isChildScopedKey must match.
 */
import { describe, expect, it } from "vitest";
import {
  FIRST_MOMENT_STEPS,
  dismissFirstMomentChain,
  firstMomentChainKey,
  markFirstMomentStep,
  readFirstMomentChain,
  resolveFirstMomentChain,
} from "./firstMomentChain";
import { childScopedKey, clearChildLocalState, isChildScopedKey } from "./childLocalState";

/** Minimal in-memory Storage stand-in (the suite runs in `environment: "node"`). */
function fakeStorage(): Storage {
  const map = new Map<string, string>();
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (k: string) => map.get(k) ?? null,
    key: (i: number) => [...map.keys()][i] ?? null,
    removeItem: (k: string) => void map.delete(k),
    setItem: (k: string, v: string) => void map.set(k, v),
  } as Storage;
}

const KID = "kid-d0";

describe("resolveFirstMomentChain — where the parent is in the day-0 loop", () => {
  it("has nothing to walk before the first capture", () => {
    const chain = resolveFirstMomentChain({ momentCount: 0, marks: {} });
    expect(chain.done).toEqual({ moment: false, keepsake: false, story: false });
    expect(chain.doneCount).toBe(0);
    expect(chain.next).toBe("moment");
  });

  it("counts the first capture from the moments that exist, never from a mark", () => {
    const chain = resolveFirstMomentChain({ momentCount: 1, marks: {} });
    expect(chain.done.moment).toBe(true);
    expect(chain.doneCount).toBe(1);
    expect(chain.next).toBe("keepsake");
    expect(chain.visible).toBe(true);
  });

  it("NEGATIVE CONTROL — a mark can never assert a capture that did not happen", () => {
    // The shape a future author produces by storing `moment: true` alongside
    // the other two. If this ever passes, the app is telling a parent they
    // captured something they did not.
    const chain = resolveFirstMomentChain({
      momentCount: 0,
      marks: { keepsake: true, story: true } as never,
    });
    expect(chain.done.moment).toBe(false);
    // …and the two dependent steps collapse with it: a keepsake or a story of
    // a moment that no longer exists is not a step the parent still has.
    expect(chain.done.keepsake).toBe(false);
    expect(chain.done.story).toBe(false);
    expect(chain.doneCount).toBe(0);
  });

  it("walks in order and finishes at three", () => {
    const one = resolveFirstMomentChain({ momentCount: 2, marks: { keepsake: true } });
    expect(one.next).toBe("story");
    expect(one.doneCount).toBe(2);
    expect(one.complete).toBe(false);

    const all = resolveFirstMomentChain({ momentCount: 2, marks: { keepsake: true, story: true } });
    expect(all.next).toBeNull();
    expect(all.complete).toBe(true);
    expect(all.doneCount).toBe(FIRST_MOMENT_STEPS.length);
  });

  it("stops offering itself once finished — a completed checklist is not a nudge", () => {
    expect(resolveFirstMomentChain({ momentCount: 1, marks: { keepsake: true, story: true } }).visible).toBe(false);
  });

  it("stops offering itself once waved away, with steps still open", () => {
    const chain = resolveFirstMomentChain({ momentCount: 1, marks: { dismissed: true } });
    expect(chain.complete).toBe(false);
    expect(chain.visible).toBe(false);
  });

  it("NEGATIVE CONTROL — an un-dismissed, unfinished chain IS still offered", () => {
    // Proves the two rules above are not vacuously hiding the card.
    expect(resolveFirstMomentChain({ momentCount: 1, marks: {} }).visible).toBe(true);
  });

  it("exposes a count of the PARENT's steps and no ratio to draw a ring from", () => {
    const chain = resolveFirstMomentChain({ momentCount: 1, marks: { keepsake: true } });
    expect(chain.doneCount).toBe(2);
    expect(chain.total).toBe(3);
    // Clinical firewall: nothing here is a score, a percentage, or a fact
    // about the child. If a `percent`/`score`/`ratio` field ever appears, this
    // is where it gets caught.
    expect(Object.keys(chain).sort()).toEqual(
      ["complete", "done", "doneCount", "next", "total", "visible"].sort(),
    );
  });
});

describe("the chain is resumable — the marks survive leaving mid-way", () => {
  it("round-trips a step through storage", () => {
    const store = fakeStorage();
    expect(readFirstMomentChain(KID, store)).toEqual({});
    markFirstMomentStep(KID, "keepsake", store);
    // A FRESH read, as the next app open would do it.
    expect(readFirstMomentChain(KID, store)).toEqual({ keepsake: true });
    expect(resolveFirstMomentChain({ momentCount: 1, marks: readFirstMomentChain(KID, store) }).next).toBe("story");
  });

  it("keeps the two children apart", () => {
    const store = fakeStorage();
    markFirstMomentStep(KID, "story", store);
    expect(readFirstMomentChain("kid-other", store)).toEqual({});
  });

  it("remembers a dismissal", () => {
    const store = fakeStorage();
    dismissFirstMomentChain(KID, store);
    expect(readFirstMomentChain(KID, store)).toEqual({ dismissed: true });
  });

  it("NEGATIVE CONTROL — a corrupt or foreign record reads as empty, never as done", () => {
    const store = fakeStorage();
    store.setItem(firstMomentChainKey(KID), "{not json");
    expect(readFirstMomentChain(KID, store)).toEqual({});
    store.setItem(firstMomentChainKey(KID), JSON.stringify(["keepsake"]));
    expect(readFirstMomentChain(KID, store)).toEqual({});
    // Truthy-but-not-true values do not count as a completed step.
    store.setItem(firstMomentChainKey(KID), JSON.stringify({ keepsake: "yes", story: 1 }));
    expect(readFirstMomentChain(KID, store)).toEqual({});
  });

  it("never throws when storage is blocked (a private window must not break day 0)", () => {
    const blocked = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    } as unknown as Storage;
    expect(() => markFirstMomentStep(KID, "keepsake", blocked)).not.toThrow();
    expect(() => dismissFirstMomentChain(KID, blocked)).not.toThrow();
    expect(readFirstMomentChain(KID, blocked)).toEqual({});
    // With no storage at all (node: no localStorage global) the default path
    // is equally silent, and the chain simply offers from the top.
    expect(() => markFirstMomentStep(KID, "story", null)).not.toThrow();
    expect(readFirstMomentChain(KID, null)).toEqual({});
  });
});

describe("the record is swept when the child is deleted", () => {
  it("is minted through the shared convention", () => {
    expect(firstMomentChainKey(KID)).toBe(childScopedKey("d0chain", KID));
    expect(firstMomentChainKey(KID)).toBe(`arbor.d0chain.${KID}`);
  });

  it("the REAL sweep matcher recognises it", () => {
    expect(isChildScopedKey(firstMomentChainKey(KID), KID)).toBe(true);
  });

  it("clearChildLocalState actually removes it", () => {
    const store = fakeStorage();
    markFirstMomentStep(KID, "keepsake", store);
    store.setItem("arbor.somethingElse", "keep me");
    expect(clearChildLocalState(KID, { local: store, session: null })).toBe(1);
    expect(store.getItem(firstMomentChainKey(KID))).toBeNull();
    expect(store.getItem("arbor.somethingElse")).toBe("keep me");
  });

  it("NEGATIVE CONTROL — a sibling's record is NOT swept, and the old glued shape would have leaked", () => {
    const store = fakeStorage();
    markFirstMomentStep(`${KID}-2`, "keepsake", store);
    expect(clearChildLocalState(KID, { local: store, session: null })).toBe(0);
    expect(store.getItem(firstMomentChainKey(`${KID}-2`))).not.toBeNull();
    // The exact shape that has escaped this sweep four times: the id glued to
    // a suffix instead of sitting in its own dot-delimited segment.
    expect(isChildScopedKey(`arbor.d0chain-${KID}-marks`, KID)).toBe(false);
  });
});
