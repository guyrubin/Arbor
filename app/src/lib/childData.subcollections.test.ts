import { describe, it, expect, vi } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { CHILD_SUBCOLLECTIONS, exportChildData, eraseEverything } from "./childData";
import { STORAGE_PREFIXES } from "./childDataSinks";
import { childBookAssetPrefix, isBookAssetRel } from "./library/bookAssetPaths";
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

function collectChildCollectionSinks(dir: string, acc: Set<string>): void {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name);
    if (entry.isDirectory()) {
      collectChildCollectionSinks(p, acc);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      const text = readFileSync(p, "utf8");
      const re = /useChildCollection\s*(?:<[\s\S]*?>)?\s*\(\s*[\s\S]*?,\s*"([^"]+)"/g;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text)) !== null) acc.add(m[1]);
    }
  }
}

describe("child-data GDPR allow-list completeness", () => {
  it(
    "registers every useChildCollection sink in CHILD_SUBCOLLECTIONS (export + erasure)",
    () => {
      const sinks = new Set<string>();
      collectChildCollectionSinks(SRC_ROOT, sinks);

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

/* B-BOOK-20 — every child-scoped Firestore subcollection or document, and
   every owned Storage prefix, found by reading the writers (app source,
   scripts, and a functions/ package when one exists). A name passed through
   a constant (bookReads) or a single-quoted call (studioCreations) counts.
   Narration and prints are files under the one books prefix, not stores of
   their own. voiceClips and dayBooks are not writers in this tree; the
   negative control is the proof that either one would fail this guard. */
const APP_ROOT = join(SRC_ROOT, "..");
const REPO_ROOT = join(APP_ROOT, "..");
const SKIP_DIR = new Set(["node_modules", "dist", ".data", "studio-v2-preview"]);
/** The allow-list loop itself. A `${name}` segment here is not a new sink. */
const DRIVER_FILES = new Set([
  "src/lib/childData.ts",
  "src/hooks/useChildCollection.ts",
  "src/hooks/useChildHistory.ts",
]);
const SEARCH_ROOTS = [SRC_ROOT, join(APP_ROOT, "scripts"), join(REPO_ROOT, "functions"), join(APP_ROOT, "functions")];

interface SourceFile { file: string; code: string }
interface SinkAudit {
  collections: Map<string, Set<string>>;
  prefixes: Map<string, Set<string>>;
  unresolved: string[];
}

const stripComments = (text: string) => text.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
const normPath = (raw: string) => raw.replace(/\$\{[^}]+\}/g, "{id}").replace(/\{[^}]+\}/g, "{id}");
const REGISTERED_PREFIXES = Object.values(STORAGE_PREFIXES).map(normPath).sort();

function walkProduction(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (SKIP_DIR.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) walkProduction(full, acc);
    else if (/\.(tsx?|mjs|js|py)$/.test(entry.name) && !/\.test\./.test(entry.name) && !entry.name.endsWith(".d.ts")) acc.push(full);
  }
  return acc;
}

function loadProductionFiles(): SourceFile[] {
  const files: SourceFile[] = [];
  for (const root of SEARCH_ROOTS) {
    if (!existsSync(root) || !statSync(root).isDirectory()) continue;
    for (const full of walkProduction(root)) {
      const file = full.slice(REPO_ROOT.length + 1).split("\\").join("/");
      files.push({ file, code: stripComments(readFileSync(full, "utf8")) });
    }
  }
  return files;
}

function auditSinks(files: readonly SourceFile[]): SinkAudit {
  const values = new Map<string, Set<string>>();
  const constRe = /(?:export\s+)?const\s+([A-Z][A-Z0-9_]*)\s*=\s*["']([A-Za-z][A-Za-z0-9_]*)["']/g;
  for (const f of files) for (const m of f.code.matchAll(constRe)) {
    if (!values.has(m[1])) values.set(m[1], new Set());
    values.get(m[1])!.add(m[2]);
  }
  const consts = new Map([...values].filter(([, set]) => set.size === 1).map(([name, set]) => [name, [...set][0]]));
  const collections = new Map<string, Set<string>>();
  const prefixes = new Map<string, Set<string>>();
  const unresolved: string[] = [];
  const add = (map: Map<string, Set<string>>, key: string, file: string) => {
    if (!map.has(key)) map.set(key, new Set());
    map.get(key)!.add(file);
  };
  const resolve = (expr: string, file: string): string | null => {
    const lit = /^["'`]([A-Za-z_][A-Za-z0-9_]*)["'`]$/.exec(expr.trim());
    if (lit) return lit[1];
    const id = /^([A-Za-z_][A-Za-z0-9_]*)$/.exec(expr.trim());
    if (!id) return null;
    const value = consts.get(id[1]);
    if (value) return value;
    unresolved.push(`${file}: ${id[1]}`);
    return null;
  };
  const noteStorage = (raw: string, file: string) => {
    if (raw.includes("encodeURIComponent") || raw.includes("/api/") || raw.startsWith("/") || raw.includes("http")) return;
    const n = normPath(raw);
    const storageLike = /\.[a-z0-9]{2,5}($|[^a-z0-9])/i.test(n) || n.endsWith("/") || n.includes("/photos/");
    if (!storageLike) return;
    let prefix: string | null = null;
    if (n.startsWith("users/{id}/children/{id}/")) prefix = "users/{id}/children/{id}/";
    else if (n.startsWith("children/{id}/")) {
      const seg = n.slice("children/{id}/".length).split("/")[0];
      if (seg && seg !== "{id}") prefix = `children/{id}/${seg}/`;
    }
    if (prefix) add(prefixes, prefix, file);
  };
  const hookRe = /useChild(?:Collection|History)\s*(?:<[\s\S]*?>)?\s*\(\s*[^,()\n]+,\s*([^,)\n]+)/g;
  const pathRe = /`users\/\$\{[^}]+\}\/children\/\$\{[^}]+\}\/(\$\{([A-Za-z_][A-Za-z0-9_]*)\}|([A-Za-z_][A-Za-z0-9_]*))([^`]*)`/g;
  const pyPathRe = /f?"users\/\{[^}]+\}\/children\/\{[^}]+\}\/([A-Za-z_][A-Za-z0-9_]*)/g;
  const colRe = /([A-Za-z_][\w]*)\.collection\(\s*["']([A-Za-z_][A-Za-z0-9_]*)["']\s*\)/g;
  const unionRe = /type\s+([A-Za-z0-9_]+)\s*=\s*((?:"[A-Za-z0-9_]+"\s*(?:\|\s*"[A-Za-z0-9_]+"\s*)+))/g;

  for (const f of files) {
    const appRel = f.file.startsWith("app/") ? f.file.slice(4) : f.file;
    for (const m of f.code.matchAll(hookRe)) {
      const name = resolve(m[1], f.file);
      if (name) add(collections, name, f.file);
    }
    for (const m of f.code.matchAll(pathRe)) {
      const tail = m[4] ?? "";
      if (m[2] === "name") {
        if (DRIVER_FILES.has(appRel)) continue;
        const param = /(?:^|[^.\w])name\s*:\s*([A-Za-z0-9_]+)/.exec(f.code)?.[1];
        const union = [...f.code.matchAll(unionRe)].find((u) => u[1] === param);
        if (!union) { unresolved.push(`${f.file}: dynamic collection name`); continue; }
        for (const lit of union[2].matchAll(/"([A-Za-z0-9_]+)"/g)) add(collections, lit[1], f.file);
        continue;
      }
      const name = m[2] ? consts.get(m[2]) : m[3];
      if (m[2] && !name) unresolved.push(`${f.file}: path ${m[2]}`);
      if (name === "photos" || /\.[a-z0-9]{2,5}/i.test(tail)) noteStorage(`users/\${uid}/children/\${childId}/${name ?? ""}${tail}`, f.file);
      else if (name) add(collections, name, f.file);
    }
    for (const m of f.code.matchAll(pyPathRe)) add(collections, m[1], f.file);
    for (const m of f.code.matchAll(/`([^`]*children\/\$\{[^`]+)`/g)) noteStorage(m[1], f.file);
    for (const m of f.code.matchAll(/f"([^"\n]*children\/\{[^"\n]*)"/g)) noteStorage(m[1], f.file);
    for (const m of f.code.matchAll(/f'([^'\n]*children\/\{[^'\n]*)'/g)) noteStorage(m[1], f.file);
    const userChildFile = /users\/(?:\$\{[^}]+\}|\{[^}]+\})\/children/.test(f.code);
    for (const m of f.code.matchAll(colRe)) {
      const recv = m[1];
      const name = m[2];
      if (recv === "db" || recv === "ro" || recv === "familyRef") continue;
      const assignedServer = new RegExp(`(?:const|let)\\s+${recv}\\s*=[\\s\\S]{0,180}\\.collection\\(\\s*["']children["']`).test(f.code);
      // children/{childId}/memoryEvents is the server ledger, erased by memoryStore, not a users/ subcollection.
      if (assignedServer && (!userChildFile || name === "memoryEvents")) continue;
      add(collections, name, f.file);
    }
  }
  return { collections, prefixes, unresolved };
}

function unregistered(audit: SinkAudit): { collections: string[]; prefixes: string[] } {
  return {
    collections: [...audit.collections.keys()].filter((name) => !CHILD_SUBCOLLECTIONS.includes(name)).sort(),
    prefixes: [...audit.prefixes.keys()].filter((prefix) => !REGISTERED_PREFIXES.includes(prefix)).sort(),
  };
}

describe("B-BOOK-20 — every child store and owned Storage prefix is registered", () => {
  const files = loadProductionFiles();
  const audit = auditSinks(files);

  it("the scan reads app writers, scripts, and a functions package when present", () => {
    expect(SEARCH_ROOTS.map((root) => root.slice(REPO_ROOT.length + 1) || ".")).toEqual([
      "app/src", "app/scripts", "functions", "app/functions",
    ]);
    expect(files.length).toBeGreaterThan(400);
    expect(files.some((f) => f.file === "app/src/server/heroPoseRoute.ts")).toBe(true);
    expect(files.some((f) => f.file === "app/scripts/upload-book-assets.py")).toBe(true);
    expect(files.some((f) => f.file.endsWith("functions/index.ts")) || !existsSync(join(REPO_ROOT, "functions"))).toBe(true);
  }, 30_000);

  it("lists every child-scoped Firestore sink, including constant and union writers", () => {
    expect(audit.unresolved, audit.unresolved.join("; ")).toEqual([]);
    expect(audit.collections.size).toBeGreaterThan(20);
    for (const name of ["heroSheet", "bookAssets", "bookReads", "studioQuestProgress", "bookBookmarks", "keepsakes", "studioCreations"]) {
      expect(audit.collections.has(name), name).toBe(true);
    }
    // bookReads is passed as the constant BOOK_READS, not a string literal.
    expect([...audit.collections.get("bookReads")!].some((f) => f.endsWith("KidBookReaderView.tsx"))).toBe(true);
    // The notice reader names its collections in a string union, then interpolates ${name}.
    expect([...audit.collections.get("keepsakes")!].some((f) => f.endsWith("useNoticeSource.ts"))).toBe(true);
    expect(unregistered(audit).collections, "unregistered child stores").toEqual([]);
  }, 30_000);

  it("lists every owned Storage prefix; narration and prints ride the books prefix", () => {
    expect([...audit.prefixes.keys()].sort()).toEqual(REGISTERED_PREFIXES);
    expect(unregistered(audit).prefixes).toEqual([]);
    expect(childBookAssetPrefix("synthetic-child")).toBe("children/synthetic-child/books/");
    expect(isBookAssetRel("narration/set/en/page.mp3")).toBe(true);
    expect(isBookAssetRel("hero-sheets/sheet/prints/cover.webp")).toBe(true);
    // These names are not writers today. The next test is what would catch them.
    expect(audit.collections.has("voiceClips")).toBe(false);
    expect(audit.prefixes.has("children/{id}/dayBooks/")).toBe(false);
  });

  it("negative control: a new constant-named store and a new Storage prefix fail this audit", () => {
    const planted = auditSinks([{
      file: "functions/voiceClips.ts",
      code: [
        'const VOICE_CLIPS = "voiceClips";',
        "export function write(childId: string) {",
        "  useChildCollection(childId, VOICE_CLIPS);",
        "  bucket.file(`children/${childId}/dayBooks/page.pdf`);",
        "}",
      ].join("\n"),
    }]);
    expect(planted.unresolved).toEqual([]);
    expect(unregistered(planted)).toEqual({
      collections: ["voiceClips"],
      prefixes: ["children/{id}/dayBooks/"],
    });
    expect(CHILD_SUBCOLLECTIONS.includes("voiceClips")).toBe(false);
    expect(REGISTERED_PREFIXES.includes("children/{id}/dayBooks/")).toBe(false);
  });
});
