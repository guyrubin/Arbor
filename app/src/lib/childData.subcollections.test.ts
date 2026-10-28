import { describe, it, expect, vi } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import * as ts from "typescript";
import { CHILD_SUBCOLLECTIONS, exportChildData, eraseEverything } from "./childData";
import type { ChildProfile } from "../types";

// The export/erase calls below hit the server first; offline here, so the
// client half (what this file guards) is what runs.
vi.mock("./api", () => ({
  api: {
    privacyExport: async () => { throw new Error("offline"); },
    privacyErase: async () => { throw new Error("offline"); },
  },
}));

// Guard against the caps-reconcile COPPA/GDPR finding: a per-child
// useChildCollection("name") sink that is NOT registered in
// CHILD_SUBCOLLECTIONS silently escapes both the data export (Art. 15/20) and
// erasure + deletion-receipt (Art. 17). This test fails the build the moment a
// new child sub-collection is added without registering it, so child data can
// never again be written to a sink that deletion/export can't reach.
const SRC_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

// Parse the actual TypeScript call expression rather than matching source text:
// string literals, comments and single-quoted sinks must all be handled safely.
function findChildCollectionSinks(filename: string, code: string): { names: string[]; dynamic: string[] } {
  const source = ts.createSourceFile(filename, code, ts.ScriptTarget.Latest, true,
    filename.endsWith(".tsx") ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const names: string[] = [];
  const dynamic: string[] = [];
  function visit(node: ts.Node): void {
    if (ts.isCallExpression(node) && (
      (ts.isIdentifier(node.expression) && node.expression.text === "useChildCollection") ||
      (ts.isPropertyAccessExpression(node.expression) && node.expression.name.text === "useChildCollection")
    )) {
      const arg = node.arguments[1];
      if (arg && (ts.isStringLiteral(arg) || ts.isNoSubstitutionTemplateLiteral(arg))) {
        names.push(arg.text);
      } else {
        const line = source.getLineAndCharacterOfPosition(node.getStart(source)).line + 1;
        dynamic.push(`${filename}:${line}: ${arg?.getText(source) ?? "<missing collection name>"}`);
      }
    }
    ts.forEachChild(node, visit);
  }
  visit(source);
  return { names, dynamic };
}

function collectChildCollectionSinks(dir: string, acc: Set<string>, dynamic: string[]): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectChildCollectionSinks(p, acc, dynamic);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      const code = readFileSync(p, "utf8");
      if (!code.includes("useChildCollection")) continue;
      const found = findChildCollectionSinks(p, code);
      found.names.forEach((name) => acc.add(name));
      dynamic.push(...found.dynamic);
    }
  }
}

describe("child-data GDPR allow-list completeness", () => {
  it("detects quoted and template-literal sinks without matching comments or plain text", () => {
    const fixtureCode = [
      '// useChildCollection(childId, "commented")',
      'const example = "useChildCollection(childId, unrelated)";',
      "useChildCollection<T>(childId, 'studioCreations');",
      'otherFunction(childId, "unrelated");',
      'useChildCollection(childId, `studioQuestProgress`);',
      'useChildCollection(childId, collectionName);',
    ].join("\n");
    const found = findChildCollectionSinks("fixture.ts", fixtureCode);
    expect(found.names).toEqual(["studioCreations", "studioQuestProgress"]);
    expect(found.dynamic).toEqual(["fixture.ts:6: collectionName"]);
  });

  it(
    "registers every useChildCollection sink in CHILD_SUBCOLLECTIONS (export + erasure)",
    () => {
      const sinks = new Set<string>();
      const dynamic: string[] = [];
      collectChildCollectionSinks(SRC_ROOT, sinks, dynamic);
      expect(dynamic, "All child collection sinks require literal, audited names").toEqual([]);
      expect(sinks.has("studioCreations"), "The single-quoted Studio creation sink must be found").toBe(true);

    // Sanity: the scan actually found sinks (guards against a broken regex
    // silently making this test pass).
    expect(sinks.size).toBeGreaterThan(10);

    const missing = [...sinks].filter((name) => !CHILD_SUBCOLLECTIONS.includes(name)).sort();
    expect(
      missing,
      `child sub-collections missing from CHILD_SUBCOLLECTIONS (they would escape GDPR export + erasure): ${missing.join(", ")}`,
    ).toEqual([]);
    },
    // This test does a synchronous recursive walk + readFileSync of every
    // source file under src/. Under full-suite parallel cold-start (many workers
    // doing heavy cold imports at once) the disk I/O contention can push the
    // walk past vitest's 5s default testTimeout on constrained runners, even
    // though the work itself is ~1s in isolation. Raise the per-test ceiling
    // so the guard doesn't flake under parallel load; the work is bounded and
    // the assertion is unchanged.
    30_000,
  );
});

/* B-GROWTH-10 (Guy G9) — the parent's keepsake notes moved from a device-local
   key into the `keepsakes` subcollection. Registered, they ride the Art. 15/20
   export and the Art. 17 erase like every other per-child sink. */
describe("B-GROWTH-10 — keepsakes export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "ms-1", milestoneId: "ms-1", note: "three steps to me", noticedOn: "2026-09-20", createdAt: "t", updatedAt: "t" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("keepsakes");
  });

  it("the export JSON carries collections.keepsakes", async () => {
    const map = installStorage();
    map.set("arbor.keepsakes.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.keepsakes).toEqual([doc]);
  });

  it("child erase removes it", async () => {
    const map = installStorage();
    map.set("arbor.keepsakes.c1", JSON.stringify([doc]));
    map.set("arbor.keepsakes.c2", JSON.stringify([doc]));
    const receipt = await eraseEverything(undefined, "c1");
    expect(map.has("arbor.keepsakes.c1")).toBe(false);
    expect(map.has("arbor.keepsakes.c2")).toBe(true); // a sibling's notes stay
    expect(receipt.childId).toBe("c1");
  });
});

/* B-PROG-01 — the program enrolments (`programs`) are per-child data: they
   ride the Art. 15/20 export and the Art. 17 erase with the child. */
describe("B-PROG-01 — program enrolments export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "talk-together.2026-10-06", programId: "talk-together", startedAt: "2026-10-06", enrolledAt: "t", currentWeek: 1, status: "active", baseline: { childProxy: null, capturedAt: null }, updatedAt: "t" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("programs");
  });

  it("the export JSON carries collections.programs", async () => {
    const map = installStorage();
    map.set("arbor.programs.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.programs).toEqual([doc]);
  });

  it("child erase removes it; a sibling's enrolment stays", async () => {
    const map = installStorage();
    map.set("arbor.programs.c1", JSON.stringify([doc]));
    map.set("arbor.programs.c2", JSON.stringify([doc]));
    await eraseEverything(undefined, "c1");
    expect(map.has("arbor.programs.c1")).toBe(false);
    expect(map.has("arbor.programs.c2")).toBe(true);
  });
});

/* B-PROG-07 — the family's goals (`familyGoals`) are per-child data: export + erase. */
describe("B-PROG-07 — family goals export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "goal-2026-10-06-1", text: "Bedtime without shouting", setAt: "t", scale: { "-2": "a", "-1": "b", "0": "c", "1": "d", "2": "e" }, scores: [], updatedAt: "t" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("familyGoals");
  });

  it("the export JSON carries collections.familyGoals", async () => {
    const map = installStorage();
    map.set("arbor.familyGoals.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.familyGoals).toEqual([doc]);
  });

  it("child erase removes it; a sibling's goals stay", async () => {
    const map = installStorage();
    map.set("arbor.familyGoals.c1", JSON.stringify([doc]));
    map.set("arbor.familyGoals.c2", JSON.stringify([doc]));
    await eraseEverything(undefined, "c1");
    expect(map.has("arbor.familyGoals.c1")).toBe(false);
    expect(map.has("arbor.familyGoals.c2")).toBe(true);
  });
});

/* B-PROG-10 — the guided tier's coach sessions (`coachSessions`) are per-child data: export + erase. */
describe("B-PROG-10 — coach sessions export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "talk-together.2026-09-09.kickoff", enrolmentId: "talk-together.2026-09-09", programId: "talk-together", slot: "kickoff", bookedFor: "2026-09-10", agreed: "Wait at bath time", createdAt: "t", updatedAt: "t" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("coachSessions");
  });

  it("the export JSON carries collections.coachSessions", async () => {
    const map = installStorage();
    map.set("arbor.coachSessions.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.coachSessions).toEqual([doc]);
  });

  it("child erase removes it; a sibling's sessions stay", async () => {
    const map = installStorage();
    map.set("arbor.coachSessions.c1", JSON.stringify([doc]));
    map.set("arbor.coachSessions.c2", JSON.stringify([doc]));
    await eraseEverything(undefined, "c1");
    expect(map.has("arbor.coachSessions.c1")).toBe(false);
    expect(map.has("arbor.coachSessions.c2")).toBe(true);
  });
});

/* B-BOOK-75 (Everyday Plans) — a child's composed PLAN books (`books`: the
   parent's choices, never the text) are per-child data: export + erase. */
describe("B-BOOK-75 — plan books export and erase with the child", () => {
  const installStorage = () => {
    const map = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      get length() { return map.size; },
      clear: () => map.clear(),
      key: (i: number) => [...map.keys()][i] ?? null,
      getItem: (k: string) => map.get(k) ?? null,
      setItem: (k: string, v: string) => { map.set(k, String(v)); },
      removeItem: (k: string) => { map.delete(k); },
    } as Storage);
    vi.stubGlobal("sessionStorage", { get length() { return 0; }, key: () => null, getItem: () => null, setItem: () => {}, removeItem: () => {}, clear: () => {} } as Storage);
    return map;
  };
  const doc = { id: "plan-poo-sit.c1", bookId: "plan-poo-sit.c1", kind: "plan", pattern: "plan-poo-sit", lang: "en", stepMenuIds: ["sit-after-meal", "the-box", "just-try"], minutes: 5, time: "evening", boxItemIds: ["book"], durationDays: 21, approvedAt: "t", approvedBy: "p", createdAt: "t", updatedAt: "t", status: "active" };

  it("is registered", () => {
    expect(CHILD_SUBCOLLECTIONS).toContain("books");
  });

  it("the export JSON carries collections.books", async () => {
    const map = installStorage();
    map.set("arbor.books.c1", JSON.stringify([doc]));
    const out = await exportChildData(undefined, { id: "c1", name: "Noa" } as ChildProfile);
    expect(out.collections.books).toEqual([doc]);
    expect(out.exportReceipt.collections.books).toBe("included");
  });

  it("child erase removes it; a sibling's plan stays", async () => {
    const map = installStorage();
    map.set("arbor.books.c1", JSON.stringify([doc]));
    map.set("arbor.books.c2", JSON.stringify([doc]));
    const receipt = await eraseEverything(undefined, "c1");
    expect(map.has("arbor.books.c1")).toBe(false);
    expect(map.has("arbor.books.c2")).toBe(true);
    expect(receipt.childId).toBe("c1");
  });
});
