import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { childScopedKey, clearChildLocalState, isChildScopedKey } from "./childLocalState";
import { watchFocusKey } from "./screeningWatch";

/**
 * GDPR Art. 17, the device half. Deleting ONE child used to sweep the server
 * and leave that child's local rows on the parent's own device — the copy they
 * can actually see. These pin the sweep AND the convention it depends on.
 */

/** Minimal Storage double — the real one is not available in the node env. */
function fakeStorage(seed: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(seed));
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => void map.set(k, v),
    removeItem: (k: string) => void map.delete(k),
    clear: () => map.clear(),
  } as unknown as Storage;
}

describe("child-scoped local state is swept on deletion", () => {
  it("removes only THIS child's rows, from both storages", () => {
    const local = fakeStorage({
      [childScopedKey("screen.watch", "kid-a")]: "1",
      [childScopedKey("screen.watch", "kid-b")]: "1",
      "arbor.uiLang": "he",
      "unrelated.key": "1",
    });
    const session = fakeStorage({ [childScopedKey("screen.draft", "kid-a")]: "{}" });

    const removed = clearChildLocalState("kid-a", { local, session });

    expect(removed).toBe(2);
    expect(local.getItem(childScopedKey("screen.watch", "kid-a"))).toBeNull();
    // The sibling, the app-wide preference and a foreign key all survive.
    expect(local.getItem(childScopedKey("screen.watch", "kid-b"))).toBe("1");
    expect(local.getItem("arbor.uiLang")).toBe("he");
    expect(local.getItem("unrelated.key")).toBe("1");
    expect(session.getItem(childScopedKey("screen.draft", "kid-a"))).toBeNull();
  });

  it("never throws, and removes nothing, on a hostile or absent storage", () => {
    const hostile = { get length() { throw new Error("blocked"); } } as unknown as Storage;
    expect(clearChildLocalState("kid-a", { local: hostile, session: null })).toBe(0);
    expect(clearChildLocalState("", { local: fakeStorage({ "arbor.x.": "1" }) })).toBe(0);
  });

  it("a non-arbor key carrying the id is NOT swept (we own only our namespace)", () => {
    expect(isChildScopedKey("vendor.thing.kid-a", "kid-a")).toBe(false);
    expect(isChildScopedKey("arbor.screen.watch.kid-a", "kid-a")).toBe(true);
    // Negative control: a prefix collision must not match.
    expect(isChildScopedKey("arbor.screen.watch.kid-abc", "kid-a")).toBe(false);
  });

  it("the shipped per-child stores actually follow the sweepable convention", () => {
    // If screeningWatch stops using arbor.<ns>.<childId>, the sweep silently
    // stops covering it — so pin the real key builder, not a copy of it.
    expect(isChildScopedKey(watchFocusKey("kid-a"), "kid-a")).toBe(true);
  });

  it("deleteChild calls the sweep", () => {
    const here = path.dirname(fileURLToPath(import.meta.url));
    const src = readFileSync(path.join(here, "..", "context", "ProfileContext.tsx"), "utf8")
      .replace(/\r\n/g, "\n");
    const body = /const deleteChild = useCallback\([\s\S]*?\n  \);/.exec(src)?.[0] ?? "";
    expect(body).toBeTruthy();
    expect(body).toContain("clearChildLocalState(id)");
    // Negative control: the pre-change body had only the server erase.
    expect("const deleteChild = useCallback(\n await eraseEverything(uid, id);\n  );")
      .not.toContain("clearChildLocalState");
  });
});
