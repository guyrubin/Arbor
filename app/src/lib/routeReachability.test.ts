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
 * ONE ROUTE IS DELIBERATELY DOORLESS. `#/strengths` was retired in GP-26: the
 * leaf duplicated Profile chapter 4 and its only entrance was a 16 px link
 * inside that same chapter, so Builder F deleted the door and pointed the hash
 * at Profile through `RETIRED_ROUTES`. This guard then went red — it was
 * asking "does a component navigate here?" of a route whose whole point is
 * that none does. The retired-route contract below makes that explicit: a
 * retired route counts as reachable when its hash RESOLVES to a live route
 * that is itself reachable, and a retirement with no target, a self-redirect,
 * or a target that is not a route fails.
 *
 * Negative controls: `retiredRouteIsReachable` run over four maps that do not
 * satisfy the contract returns false, and rewriting one real `setActiveTab`
 * out of ChildProfile makes the scanner stop seeing that route.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_IDS, HASH_ALIASES, RETIRED_ROUTES, resolveRouteId } from "./routes";
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

/**
 * THE RETIRED-ROUTE CONTRACT.
 *
 * GP-26 retired `#/strengths` (0a4239f2 / c5a22c21): its whole content is
 * Profile chapter 4, and its only door was a 16 px link inside that same
 * chapter. The id keeps its seat in ROUTE_IDS — it is persisted in
 * `arbor.activeTab`, baked into shared deep links, and it drives Shell's
 * registry type and the module-budget floors — so this guard's original
 * question ("does a component navigate here?") is the WRONG question for it,
 * and asking it turned a deliberate retirement into a red gate.
 *
 * A retired route is reachable when its hash RESOLVES to a live route. Not
 * when it is merely listed: a retirement with no redirect target, or one that
 * points at itself or at something that is not a route, is a dead door and
 * must fail. That is what this predicate is for — it takes the map and the
 * live-route set as arguments precisely so it can be run against a map that
 * does NOT satisfy it (the negative control below).
 */
export function retiredRouteIsReachable(
  key: string,
  map: Readonly<Record<string, string>>,
  liveRoutes: ReadonlySet<string>,
): boolean {
  const target = map[key];
  if (!target) return false;        // retired with nowhere to land
  if (target === key) return false; // a self-redirect is not a redirect
  return liveRoutes.has(target);
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

  it("NEGATIVE CONTROL: the scanner really does read call sites", () => {
    // Rewrite one real navigation out of a real component and the scanner
    // stops seeing it — so an empty result above means "nothing navigates
    // here", not "the regexes matched nothing at all".
    const current = read("components/sections/ChildProfile.tsx");
    expect(navigationTargets(current).has("memory")).toBe(true);
    const preFix = current.replace(/setActiveTab\("memory"\)/g, 'setActiveTab("profile")');
    expect(navigationTargets(preFix).has("memory")).toBe(false);
  });

  it("the registry alias detector finds the known retired doors and nothing bogus", () => {
    expect(aliased.has("handoff")).toBe(true);
    expect(aliased.has("strengths")).toBe(false);
  });

  const live = new Set<string>(ROUTE_IDS);
  const retired = new Set(Object.keys(RETIRED_ROUTES));

  for (const route of ROUTE_IDS) {
    if (pills.has(route)) continue;
    it(`#/${route} is navigated to by a component, indexed for search, aliased, or redirected`, () => {
      const ok =
        callSites.has(route) ||
        extra.has(route) ||
        aliased.has(route) ||
        aliasTargets.has(route) ||
        retiredRouteIsReachable(route, RETIRED_ROUTES, live);
      expect(ok, `route "${route}" is declared but nothing navigates to it`).toBe(true);
    });
  }

  it("every retired route redirects to a LIVE route, and that route is itself reachable", () => {
    expect(retired.size, "the retired map is empty — this contract is not being exercised").toBeGreaterThan(0);
    for (const key of retired) {
      const target = RETIRED_ROUTES[key];
      // The id keeps its seat: retiring a route must not delete it, or every
      // stored activeTab and shared deep link carrying it breaks.
      expect(live.has(key), `retired route "${key}" was deleted from ROUTE_IDS`).toBe(true);
      expect(retiredRouteIsReachable(key, RETIRED_ROUTES, live)).toBe(true);
      // The hash actually lands there — the contract is the router's behaviour,
      // not a comment in a map.
      expect(resolveRouteId(`#/${key}`)).toBe(target);
      expect(resolveRouteId(key)).toBe(target);
      // …and the destination is a place a parent can otherwise get to, so the
      // redirect is not one dead door forwarding to another.
      const targetReachable = pills.has(target) || callSites.has(target) || extra.has(target) || aliasTargets.has(target);
      expect(targetReachable, `retired "${key}" lands on "${target}", which nothing else reaches`).toBe(true);
      // A retired route must not also be an alias key — two maps answering for
      // one hash is how the drift this file exists to catch starts.
      expect(Object.keys(HASH_ALIASES)).not.toContain(key);
    }
  });

  it("NEGATIVE CONTROL: a retired route with no live redirect target FAILS", () => {
    // Same predicate, four maps that do not satisfy the contract.
    expect(retiredRouteIsReachable("ghost", {}, live)).toBe(false);                    // retired, no target
    expect(retiredRouteIsReachable("ghost", { ghost: "" }, live)).toBe(false);         // empty target
    expect(retiredRouteIsReachable("ghost", { ghost: "ghost" }, live)).toBe(false);    // points at itself
    expect(retiredRouteIsReachable("ghost", { ghost: "nowhere" }, live)).toBe(false);  // target is not a route
    // …and one that does.
    expect(retiredRouteIsReachable("ghost", { ghost: "profile" }, live)).toBe(true);
  });

  it("#/strengths is retired: no visible door, and the hash lands on the hub that owns the content", () => {
    // Builder F removed the 16 px JumpLink. Re-introducing a Strengths door is
    // the regression this asserts against — the route stays valid for old deep
    // links, and it stays doorless.
    expect(callSites.has("strengths"), "a component navigates to #/strengths again").toBe(false);
    expect(navigationTargets(read("components/sections/ChildProfile.tsx")).has("strengths")).toBe(false);
    expect(resolveRouteId("#/strengths")).toBe("profile");
  });
});
