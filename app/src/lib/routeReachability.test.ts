/**
 * IA-09 / GP-26 — reachability counts CALL SITES, not declarations.
 *
 * `#/strengths` was a live route with ZERO entry points: Shell mounted it,
 * TAB_SECTION_FALLBACK homed it, and surfaceContract.test.ts SC-3 called it
 * "reachable" because that guard builds its set from the fallback map — so
 * "reachable" meant "declared". This guard asks the only question that
 * matters: for every route that is NOT a hub pill, does some component
 * actually navigate to it (`setActiveTab("<route>")`, a `tab: "<route>"`
 * link entry, a search-index route, or a hash alias), or is it a retired door
 * whose registry entry is an alias of another route's component?
 *
 * Negative control: the scanner run over the pre-fix ChildProfile source (no
 * strengths link) does not find "strengths".
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_IDS, HASH_ALIASES } from "./routes";
import { SECTIONS, hubTabsForSection } from "./navigation";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(full);
  }
  return out;
}

/** Route ids a source string NAVIGATES to (call sites, not declarations). */
export function navigationTargets(code: string): Set<string> {
  const out = new Set<string>();
  const src = stripComments(code);
  for (const re of [
    /setActiveTab\(\s*["']([a-z][a-z0-9-]*)["']/g,
    /\btab:\s*["']([a-z][a-z0-9-]*)["']\s*(?:as const)?/g,
    /\bonFollow=\{\(\) => setActiveTab\(["']([a-z][a-z0-9-]*)["']\)/g,
  ]) {
    for (const m of src.matchAll(re)) out.add(m[1]);
  }
  return out;
}

/** Routes whose Shell registry component is ALSO registered under another id
 *  (retired doors kept valid for deep links — Law 5). */
function registryAliases(): Set<string> {
  const shell = stripComments(read("components/layout/Shell.tsx"));
  const start = shell.indexOf("tabRegistry");
  const block = shell.slice(start, shell.indexOf("};", start));
  const byComponent = new Map<string, string[]>();
  for (const m of block.matchAll(/^\s*"?([a-z][a-z0-9-]*)"?:\s*([A-Za-z0-9_]+),/gm)) {
    const list = byComponent.get(m[2]) ?? [];
    list.push(m[1]);
    byComponent.set(m[2], list);
  }
  const out = new Set<string>();
  for (const ids of byComponent.values()) if (ids.length > 1) for (const id of ids) out.add(id);
  return out;
}

describe("IA-09 — every non-pill route has a real entry point", () => {
  const pills = new Set<string>(SECTIONS.flatMap((s) => hubTabsForSection(s).map((i) => i.tab)));
  const files = [...walk(path.join(SRC, "components")), ...walk(path.join(SRC, "hooks")), ...walk(path.join(SRC, "context"))]
    .filter((f) => !/[\\/]layout[\\/]Shell\.tsx$/.test(f));
  const callSites = new Set<string>();
  for (const f of files) for (const t of navigationTargets(readFileSync(f, "utf8"))) callSites.add(t);
  const searchIndex = stripComments(read("lib/searchIndex.ts"));
  const extra = new Set<string>([...searchIndex.matchAll(/["']([a-z][a-z0-9-]*)["']/g)].map((m) => m[1]));
  const aliased = registryAliases();
  const aliasTargets = new Set<string>(Object.values(HASH_ALIASES));

  it("the scanner sees a real corpus", () => {
    expect(files.length).toBeGreaterThan(100);
    expect(callSites.size).toBeGreaterThan(20);
  });

  it("NEGATIVE CONTROL: the pre-fix ChildProfile (no strengths link) does not reach 'strengths'", () => {
    const current = read("components/sections/ChildProfile.tsx");
    const preFix = current.replace(/setActiveTab\("strengths"\)/g, 'setActiveTab("profile")');
    expect(navigationTargets(preFix).has("strengths")).toBe(false);
    expect(navigationTargets(current).has("strengths")).toBe(true);
  });

  it("the registry alias detector finds the known retired doors and nothing bogus", () => {
    expect(aliased.has("handoff")).toBe(true);
    expect(aliased.has("strengths")).toBe(false);
  });

  for (const route of ROUTE_IDS) {
    if (pills.has(route)) continue;
    it(`#/${route} is navigated to by a component, indexed for search, aliased, or a retired door`, () => {
      const ok = callSites.has(route) || extra.has(route) || aliased.has(route) || aliasTargets.has(route);
      expect(ok, `route "${route}" is declared but nothing navigates to it`).toBe(true);
    });
  }

  it("#/strengths specifically is reached from the Development Profile's strengths chapter", () => {
    expect(navigationTargets(read("components/sections/ChildProfile.tsx")).has("strengths")).toBe(true);
  });
});
