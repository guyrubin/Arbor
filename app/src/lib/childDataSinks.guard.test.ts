/**
 * B-GA-09 — the child-data GDPR sweep, made to stick.
 *
 * Every place the code can keep data about one child must be accounted for
 * before it ships: a per-child Firestore subcollection is in
 * CHILD_SUBCOLLECTIONS (lib/childData.ts, the ONLY driver of export and
 * erase); every other Firestore collection, Storage module and prefix,
 * IndexedDB database, Cache Storage cache and device key is classified in
 * lib/childDataSinks.ts; and every registered sink has a line in the DPIA
 * register (docs/compliance/child-data-register.md).
 *
 * The scans read the source. Each is checked to be non-vacuous (it found the
 * known real sinks) and carries a negative control.
 *
 * What it caught on the day it was written: `studioCreations`, a kid-mode
 * store written with a single-quoted name — the old guard regex only read
 * double quotes — escaped both export and erase.
 */
import { describe, expect, it, vi } from "vitest";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  ACCOUNT_DEVICE_KEYS,
  CACHE_STORAGE_CACHES,
  CHILD_DEVICE_KEY_PREFIXES,
  INDEXED_DB_DATABASES,
  OTHER_CHILD_SINKS,
  OTHER_FIRESTORE_COLLECTIONS,
  STORAGE_MODULES,
  STORAGE_PREFIXES,
  childSinkIds,
} from "./childDataSinks";
import { isChildScopedKey } from "./childLocalState";
import { childBookAssetPrefix } from "./library/bookAssetPaths";

vi.mock("./api", () => ({ api: {} }));
const { CHILD_SUBCOLLECTIONS } = await import("./childData");

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..");
const APP = path.join(SRC, "..");
const REPO = path.join(APP, "..");

function sourceFiles(dir: string, acc: string[] = []): string[] {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name === "node_modules" || entry.name === "dist") continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) sourceFiles(full, acc);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) && !/testSupport/.test(entry.name)) acc.push(full);
  }
  return acc;
}
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");
/** Comments removed (block, then line comments not part of a URL). */
const code = (text: string) =>
  text.replace(/\r\n/g, "\n").replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

const FILES = sourceFiles(SRC).map((f) => ({ file: rel(f), raw: readFileSync(f, "utf8").replace(/\r\n/g, "\n") }))
  .map((f) => ({ ...f, code: code(f.raw) }));

const allMatches = (re: RegExp, pick: (m: RegExpMatchArray) => string, files = FILES) => {
  const out = new Map<string, Set<string>>();
  for (const f of files) for (const m of f.code.matchAll(re)) {
    const v = pick(m);
    if (!out.has(v)) out.set(v, new Set());
    out.get(v)!.add(f.file);
  }
  return out;
};

describe("the scans read real source", () => {
  it("walked the tree", () => {
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES.some((f) => f.file === "lib/childData.ts")).toBe(true);
    expect(FILES.some((f) => f.file === "routes/api.ts")).toBe(true);
  });
});

/* ── 1 · Firestore ───────────────────────────────────────────────────────── */

// Any quote style. The original guard read only "…", so a 'single-quoted'
// sink (studioCreations) slipped past it.
const SINK_CALL = /useChildCollection\s*(?:<[\s\S]*?>)?\s*\(\s*[^,()]+,\s*(["'`])([A-Za-z0-9_]+)\1/g;
const OLD_SINK_CALL = /useChildCollection\s*(?:<[\s\S]*?>)?\s*\(\s*[\s\S]*?,\s*"([^"]+)"/g;

describe("Firestore · every per-child subcollection is in CHILD_SUBCOLLECTIONS", () => {
  const sinks = allMatches(SINK_CALL, (m) => m[2]);
  const history = allMatches(/useChildHistory\s*(?:<[\s\S]*?>)?\s*\(\s*[^,()]+,\s*(["'`])([A-Za-z0-9_]+)\1/g, (m) => m[2]);
  const paths = allMatches(/`users\/\$\{[^}]+\}\/children\/\$\{[^}]+\}\/([A-Za-z_]+)/g, (m) => m[1]);

  it("useChildCollection sinks, in every quote style", () => {
    expect(sinks.size).toBeGreaterThan(20);
    expect(sinks.has("studioCreations")).toBe(true); // the single-quoted one
    const missing = [...sinks.keys()].filter((n) => !CHILD_SUBCOLLECTIONS.includes(n));
    expect(missing, `unregistered child sinks: ${missing.map((n) => `${n} (${[...sinks.get(n)!].join(", ")})`).join("; ")}`).toEqual([]);
  });

  it("negative control: the old double-quote-only scan could not see studioCreations", () => {
    const old = allMatches(OLD_SINK_CALL, (m) => m[1]);
    expect(old.has("studioCreations")).toBe(false);
    expect(old.has("behaviorLogs")).toBe(true);
  });

  it("useChildHistory reads only registered subcollections", () => {
    expect(history.size).toBeGreaterThan(3);
    expect([...history.keys()].filter((n) => !CHILD_SUBCOLLECTIONS.includes(n))).toEqual([]);
  });

  it("every literal users/{uid}/children/{childId}/<name> path is a registered subcollection or a registered Storage prefix", () => {
    expect(paths.has("insights")).toBe(true);
    const photoPrefix = STORAGE_PREFIXES["storage:photos"];
    const bad = [...paths].filter(([seg, files]) => {
      if (CHILD_SUBCOLLECTIONS.includes(seg)) return false;
      // A Storage object under the photos prefix, written by a registered Storage module.
      return !([...files].every((f) => f in STORAGE_MODULES) && `users/{uid}/children/{childId}/${seg}/`.startsWith(photoPrefix));
    });
    expect(bad.map(([seg, files]) => `${seg} (${[...files].join(", ")})`)).toEqual([]);
  });

  // Critic r1 P2: a write through a path variable (`${path}/programs/${id}`,
  // ConsultTab) never matched the literal users/…/children/… scan.
  const VIA_PATH_VAR = /\b(?:doc|collection|getDocs|onSnapshot)\(\s*[A-Za-z_]+\s*,\s*`\$\{[A-Za-z_.]+\}\/([A-Za-z_]+)/g;
  const viaPath = allMatches(VIA_PATH_VAR, (m) => m[1]);

  it("writes through a path variable (`${path}/<name>/…`) land only in registered subcollections", () => {
    expect(viaPath.has("programs")).toBe(true); // ConsultTab's batch
    const bad = [...viaPath].filter(([seg]) => !CHILD_SUBCOLLECTIONS.includes(seg) && !(seg in OTHER_FIRESTORE_COLLECTIONS));
    expect(bad.map(([seg, files]) => `${seg} (${[...files].join(", ")})`)).toEqual([]);
  });

  it("negative control: an unregistered collection written through a path variable is caught", () => {
    const src = "batch.set(doc(db, `${path}/voiceNotes/${note.id}`), note);";
    const found = [...src.matchAll(VIA_PATH_VAR)].map((m) => m[1]);
    expect(found).toEqual(["voiceNotes"]);
    expect(CHILD_SUBCOLLECTIONS.includes("voiceNotes")).toBe(false);
  });

  it("CHILD_SUBCOLLECTIONS has no duplicate", () => {
    expect(new Set(CHILD_SUBCOLLECTIONS).size).toBe(CHILD_SUBCOLLECTIONS.length);
  });
});

describe("Firestore · every other collection is classified", () => {
  const literal = allMatches(/\.?collection(?:Group)?\(\s*["']([A-Za-z_]+)["']\s*\)/g, (m) => m[1]);
  const constants = allMatches(/const\s+[A-Z_]*COLLECTION\s*=\s*["']([A-Za-z_]+)["']/g, (m) => m[1]);
  const userPaths = allMatches(/`users\/\$\{[^}]+\}\/([A-Za-z_]+)`/g, (m) => m[1]);
  const names = new Set([...literal.keys(), ...constants.keys(), ...userPaths.keys()]);

  it("found the real ones", () => {
    for (const n of ["memoryEvents", "consents", "shares", "entitlements", "heroSheet", "children", "events"]) expect(names.has(n), n).toBe(true);
  });

  it("each is a registered subcollection, a registered sink, or named as holding no per-child data", () => {
    const unclassified = [...names].filter((n) => !CHILD_SUBCOLLECTIONS.includes(n) && !(n in OTHER_FIRESTORE_COLLECTIONS));
    expect(unclassified, "classify each in OTHER_FIRESTORE_COLLECTIONS (lib/childDataSinks.ts)").toEqual([]);
  });

  it("each classification is a real sink id or an account/aggregate reason, and none is stale", () => {
    const ids = new Set(OTHER_CHILD_SINKS.map((s) => s.id));
    for (const [name, cls] of Object.entries(OTHER_FIRESTORE_COLLECTIONS)) {
      expect(ids.has(cls as never) || /^(account|aggregate): \S/.test(cls), `${name}: ${cls}`).toBe(true);
      const firestoreRules = readFileSync(path.join(REPO, "firestore.rules"), "utf8");
      expect(names.has(name) || firestoreRules.includes(`/${name}/`), `${name} is registered but no longer used`).toBe(true);
    }
  });
});

/* ── 2 · Storage ─────────────────────────────────────────────────────────── */

const STORAGE_TOUCH = /firebase\/storage"|firebase-admin\/storage"|\.getFiles\(|\.deleteFiles\(|bucket\.file\(/;

describe("Storage · every module and prefix is registered", () => {
  const touching = FILES.filter((f) => STORAGE_TOUCH.test(f.code)).map((f) => f.file).sort();

  it("the modules that touch Storage are exactly the registered ones", () => {
    expect(touching).toContain("lib/storage.ts");
    expect(touching).toContain("server/bookAssets.ts");
    expect(touching).toEqual(Object.keys(STORAGE_MODULES).sort());
  });

  it("every child path a Storage module builds starts with a registered prefix", () => {
    const prefixes = Object.values(STORAGE_PREFIXES).map((p) => p.replace(/\{[^}]+\}/g, "{}"));
    const offenders: string[] = [];
    let seen = 0;
    for (const f of FILES.filter((x) => x.file in STORAGE_MODULES)) {
      for (const m of f.code.matchAll(/`([^`]*children\/\$\{[^`]*)`/g)) {
        const t = m[1];
        if (t.startsWith("/") || t.includes("/api/") || t.startsWith("storage prefixes")) continue; // URLs and log text, not objects
        seen++;
        const norm = t.replace(/\$\{[^}]+\}/g, "{}");
        if (!prefixes.some((p) => norm.startsWith(p) || p.startsWith(norm))) offenders.push(`${f.file}: ${t}`);
      }
    }
    expect(seen).toBeGreaterThanOrEqual(3);
    expect(offenders).toEqual([]);
  });

  it("negative control: an unregistered child prefix is flagged", () => {
    const prefixes = Object.values(STORAGE_PREFIXES).map((p) => p.replace(/\{[^}]+\}/g, "{}"));
    const norm = "children/{}/voice-clips/{}.webm";
    expect(prefixes.some((p) => norm.startsWith(p) || p.startsWith(norm))).toBe(false);
  });

  it("the child's erase deletes both prefixes and counts each", () => {
    expect(childBookAssetPrefix("kid-1")).toBe("children/kid-1/books/");
    // Round 7: the one per-child erase (server/childErase), run by /privacy/erase and account deletion.
    const erase = readFileSync(path.join(SRC, "server/childErase.ts"), "utf8");
    expect(erase).toContain("deleteFiles({ prefix: `users/${uid}/children/${childId}/` })");
    expect(erase).toContain("eraseChildBookAssets(");
    expect(erase).toContain("storage = { photos: photoFiles.length, books: bookFiles };");
    // Round 4: no per-prefix count is claimed when the Storage erase was skipped.
    expect(erase).toMatch(/let storage: \{ photos: number; books: number \} \| undefined;/);
    const api = readFileSync(path.join(SRC, "routes/api.ts"), "utf8");
    const route = api.slice(api.indexOf('router.post("/privacy/erase"'), api.indexOf('router.post("/account/delete"'));
    expect(route).toContain("await eraseChildServerData(childEraseStores, uid, childId);");
    expect(readFileSync(path.join(SRC, "server/accountDeletion.ts"), "utf8")).toContain("deleted += await stores.eraseChild(uid, childId);");
  });
});

/* ── 3 · The parent's device ─────────────────────────────────────────────── */

describe("Device · IndexedDB databases", () => {
  const dbNames = new Map<string, string>();
  for (const f of FILES) {
    for (const m of f.code.matchAll(/indexedDB\.open\(\s*([^,)]+)/g)) {
      const arg = m[1].trim();
      const lit = /^["'`]([^"'`]+)["'`]$/.exec(arg)?.[1]
        ?? new RegExp(`const\\s+${arg}\\s*=\\s*["']([^"']+)["']`).exec(f.code)?.[1];
      dbNames.set(lit ?? `<unresolved ${arg} in ${f.file}>`, f.file);
    }
  }

  it("every database the app opens is registered, and every registered one still exists", () => {
    expect(dbNames.size).toBeGreaterThanOrEqual(3);
    expect([...dbNames.keys()].sort()).toEqual(Object.keys(INDEXED_DB_DATABASES).sort());
  });

  it("the child's erase purges each one (the walk test proves the behaviour)", () => {
    const purgeOf: Record<string, string> = {
      "device:comicPages": "purgeComicPages(childId)",
      "device:heroRenders": "purgeHeroRenders(childId)",
      "device:bookAssets": "purgeBookAssets(childId)",
    };
    const childData = readFileSync(path.join(SRC, "lib/childData.ts"), "utf8");
    for (const sink of Object.values(INDEXED_DB_DATABASES)) {
      expect(OTHER_CHILD_SINKS.some((s) => s.id === sink), sink).toBe(true);
      expect(childData, sink).toContain(purgeOf[sink]);
    }
  });

  it("the Firestore SDK's offline cache is a registered sink while it is on", () => {
    const firebase = readFileSync(path.join(SRC, "lib/firebase.ts"), "utf8");
    expect(firebase).toContain("persistentLocalCache(");
    expect(OTHER_CHILD_SINKS.some((s) => s.id === "device:firestoreCache")).toBe(true);
  });
});

describe("Device · Cache Storage holds no child data", () => {
  const publicDir = path.join(APP, "public");
  const workers = readdirSync(publicDir).filter((n) => n.endsWith(".js")).map((n) => ({ name: n, code: code(readFileSync(path.join(publicDir, n), "utf8")) }));

  it("the app itself never writes Cache Storage", () => {
    expect(FILES.filter((f) => /\bcaches\.(open|put|add)\b/.test(f.code)).map((f) => f.file)).toEqual([]);
  });

  it("every cache a worker opens is registered, by name prefix", () => {
    const opened: string[] = [];
    for (const w of workers) {
      for (const m of w.code.matchAll(/caches\.open\(\s*([A-Za-z_]+)\s*\)/g)) {
        const def = new RegExp(`const\\s+${m[1]}\\s*=\\s*["'\`]([^"'\`$]+)`).exec(w.code)?.[1];
        opened.push(def ?? `<unresolved ${m[1]} in ${w.name}>`);
      }
    }
    expect(opened.length).toBeGreaterThan(0);
    for (const name of opened) expect(Object.keys(CACHE_STORAGE_CACHES).some((p) => name.startsWith(p)), name).toBe(true);
  });

  it("the shell worker never caches /api and only public art enters the art cache", () => {
    const sw = workers.find((w) => w.name === "sw.js")!.code;
    expect(sw).toContain('url.pathname.startsWith("/api")) return;');
    expect(sw).toContain("/^\\/visuals\\/[\\w\\/.-]+\\.webp$/");
  });

  it("the private book files are never kept in the browser's HTTP cache", () => {
    const proxy = readFileSync(path.join(SRC, "server/bookAssets.ts"), "utf8");
    expect(proxy).toContain('res.setHeader("Cache-Control", "private, no-store");');
    expect(proxy).not.toMatch(/max-age=\d+/);
  });
});

describe("Device · localStorage / sessionStorage keys", () => {
  const looksLikeChild = (expr: string) => /child|kid/i.test(expr);
  // A key only ever passed to removeItem (a one-time migration) stores nothing.
  const literals = new Map<string, Set<string>>();
  for (const f of FILES) for (const m of f.code.matchAll(/(["'`])(arbor\.[A-Za-z0-9_.${}-]*)\1/g)) {
    if (/removeItem\(\s*$/.test(f.code.slice(Math.max(0, m.index! - 24), m.index))) continue;
    if (!literals.has(m[2])) literals.set(m[2], new Set());
    literals.get(m[2])!.add(f.file);
  }
  const classify = (lit: string): "child-scoped" | "registered" | "unregistered" => {
    const parts = [...lit.matchAll(/\$\{([^}]*)\}/g)].map((p) => p[1]);
    if (parts.some(looksLikeChild)) return "child-scoped";
    if (lit in ACCOUNT_DEVICE_KEYS || CHILD_DEVICE_KEY_PREFIXES.includes(lit)) return "registered";
    return "unregistered";
  };

  it("found the real keys", () => {
    expect(literals.size).toBeGreaterThan(60);
    expect(literals.has("arbor.uiLang")).toBe(true);
    expect(literals.has("arbor.screen.draft")).toBe(true);
  });

  it("every arbor.* key either carries the child id or is registered as holding no per-child data", () => {
    const unregistered = [...literals].filter(([lit]) => classify(lit) === "unregistered").map(([lit, files]) => `${lit} (${[...files].join(", ")})`);
    expect(unregistered, "a key about one child must carry its id as a dot segment; any other key is registered in ACCOUNT_DEVICE_KEYS (lib/childDataSinks.ts)").toEqual([]);
  });

  it("negative control: a new key with no child id and no registration is flagged", () => {
    expect(classify("arbor.newSurface.lastDraft")).toBe("unregistered");
    expect(classify("arbor.newSurface.${childId}")).toBe("child-scoped");
  });

  it("each child key prefix produces keys the child's erase sweeps", () => {
    const KID = "kid-sweep-sentinel";
    for (const prefix of CHILD_DEVICE_KEY_PREFIXES) {
      const concrete = prefix.replace(/\$\{name\}/, "behaviorLogs").replace(/\$\{id\}/, KID);
      const key = concrete.includes(KID) ? concrete : `${concrete}.${KID}`;
      expect(isChildScopedKey(key, KID), key).toBe(true);
      expect(isChildScopedKey(`${key}.variant`, KID), key).toBe(true);
    }
  });

  it("no registration is stale", () => {
    const stale = [...Object.keys(ACCOUNT_DEVICE_KEYS), ...CHILD_DEVICE_KEY_PREFIXES].filter((k) => !literals.has(k));
    expect(stale).toEqual([]);
  });
});

/* ── 4 · The DPIA register ───────────────────────────────────────────────── */

describe("DPIA register · one line per registered sink", () => {
  const registerPath = path.join(REPO, "docs/compliance/child-data-register.md");
  const ids = childSinkIds(CHILD_SUBCOLLECTIONS);

  it("exists", () => {
    expect(existsSync(registerPath)).toBe(true);
  });

  it("every sink has its row, and no row names a sink that is not registered", () => {
    const doc = readFileSync(registerPath, "utf8");
    const rows = [...doc.matchAll(/^\|\s*`([^`]+)`\s*\|/gm)].map((m) => m[1]);
    expect(ids.filter((id) => !rows.includes(id)), "missing DPIA lines").toEqual([]);
    expect(rows.filter((id) => !ids.includes(id)), "DPIA lines for unknown sinks").toEqual([]);
    expect(new Set(rows).size).toBe(rows.length);
  });

  it("sink ids are unique", () => {
    expect(new Set(ids).size).toBe(ids.length);
  });
});
