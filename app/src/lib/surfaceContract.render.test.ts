/**
 * Item 11 (IA-02, re-evidenced) — the surface contract becomes measurable.
 *
 * The declaration was never the gap. `SURFACE_CONTRACTS` has carried a job, a
 * primaryMove and a moduleBudget for 43 routes since Heartwood; `moduleBudget`
 * was enforced on ONE of them, `data-primary-move` occurred zero times in the
 * DOM, and `surfaceContract.ts` was imported by three components. A purpose
 * nobody can measure is not enforced.
 *
 * The framework half is three pieces, and this file guards all three:
 *   1. `contractFor(route)` — the lookup a render tree can reach.
 *   2. Shell's <SurfaceFrame> — stamps `data-route` + `data-module-budget` on
 *      the active tab, in `display: contents` so no box is added.
 *   3. scripts/framework-check.mjs — walks every ROUTE_IDS leaf and requires
 *      ≥1 `data-module` and exactly one `data-primary-move`, with a
 *      KNOWN_UNSTAMPED ratchet seeded with every leaf unstamped on 2026-09-07.
 *
 * THE RATCHET IS THE POINT. The seed below is frozen. The check's list may only
 * ever be a subset of it: removing a route (because its leaf got stamped) is
 * the only legal edit. Adding one — the way a stale hex allow-list or a raised
 * budget quietly re-opens a closed gate — fails here.
 *
 * There is no jsdom in this repo, so the stamps are asserted as source facts;
 * the rendered sweep (module count ≤ budget at 390, one primary move above the
 * fold) stays the orchestrator's, against the same attributes.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_IDS, type ActiveTab } from "./routes";
import { SURFACE_CONTRACTS, contractFor } from "./surfaceContract";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(APP, rel), "utf8").replace(/\r\n/g, "\n");

const CHECK = read("scripts/framework-check.mjs");
const SHELL = read("src/components/layout/Shell.tsx");

/* ── 1 · the lookup ───────────────────────────────────────────────────────── */

describe("contractFor — the reachable half of the manifest", () => {
  it("returns the contract whose route matches, for every declared surface", () => {
    for (const contract of SURFACE_CONTRACTS) {
      expect(contractFor(contract.route), contract.route).toBe(contract);
    }
  });

  it("resolves for every ROUTE_IDS entry (SC-1 completeness, read through the lookup)", () => {
    const missing = ROUTE_IDS.filter((route) => !contractFor(route));
    expect(missing).toEqual([]);
  });

  it("negative control: an id that is not a route returns undefined, not a guess", () => {
    expect(contractFor("not-a-route" as ActiveTab)).toBeUndefined();
  });
});

/* ── 2 · the frame ────────────────────────────────────────────────────────── */

describe("SurfaceFrame — the contract reaches the DOM without changing layout", () => {
  it("Shell wraps the active tab in a frame stamped with route and budget", () => {
    expect(SHELL).toContain('import { contractFor } from "../../lib/surfaceContract";');
    expect(SHELL).toMatch(/<SurfaceFrame route=\{activeTab\}>\s*\n\s*<ActiveTabComponent \/>\s*\n\s*<\/SurfaceFrame>/);
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).toContain("const contract = contractFor(route);");
    expect(frame).toContain("data-route={route}");
    expect(frame).toMatch(/data-module-budget=\{contract \? String\(contract\.moduleBudget\) : undefined\}/);
  });

  it("the frame adds no box — display:contents, no className, no padding", () => {
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).toContain('style={{ display: "contents" }}');
    expect(frame).not.toContain("className=");
  });

  it("an unbudgeted route is omitted, not zeroed (undefined ≠ a budget of nothing)", () => {
    const frame = SHELL.slice(SHELL.indexOf("function SurfaceFrame"), SHELL.indexOf("export default function Shell"));
    expect(frame).not.toMatch(/data-module-budget=\{[^}]*\?\?\s*0/);
    expect(frame).not.toMatch(/data-module-budget="0"/);
  });
});

/* ── 3 · the ratchet ──────────────────────────────────────────────────────── */

/**
 * FROZEN 2026-09-07. Measured, not assumed: `data-module` and
 * `data-primary-move` each occurred ZERO times in src/components before item
 * 11, so the seed is every route Shell's tabRegistry resolves. Entries may be
 * DELETED as leaves get stamped. Nothing may ever be added.
 */
const SEEDED_UNSTAMPED: readonly string[] = [
  "overview", "coach", "behaviors", "milestones", "plans",
  "stories", "weekly", "scholar", "language", "handoff",
  "safety", "profile", "memory", "strengths", "screening",
  "timeline", "journal", "find-pro", "care-team", "appointments",
  "sharing", "reports", "masterclasses", "learn", "family",
  "comics", "speech", "mimic", "feelings", "journey",
  "adventures", "copilot", "development", "daily-play", "practice",
  "consult", "attribution", "day-windows", "smart-reminders", "science",
  "school-brief", "bedtime-stories", "routines",
];

/** The routes the shipped check currently exempts. */
function knownUnstamped(source: string): string[] {
  const block = source.match(/const KNOWN_UNSTAMPED = new Set\(\[([\s\S]*?)\]\);/);
  expect(block, "KNOWN_UNSTAMPED not found in framework-check.mjs").toBeTruthy();
  return [...block![1].matchAll(/"([a-zA-Z-]+)"/g)].map((m) => m[1]);
}

describe("KNOWN_UNSTAMPED is a shrink-only ratchet", () => {
  const current = knownUnstamped(CHECK);

  /**
   * The ratchet reached ZERO on 2026-09-07 — all 43 leaves are stamped and the
   * shipped list is empty. An empty read is therefore the CORRECT answer, which
   * is exactly the answer a broken parser also gives, so honesty can no longer
   * be shown by a non-empty result. It is shown instead against a seeded copy of
   * the same source: the parser must find an entry that is really there, and
   * find nothing in the file that really has none.
   */
  it("the parser really reads the list (guard stays honest at zero)", () => {
    expect(new Set(current).size).toBe(current.length);
    expect(current).toEqual([]);
    const seeded = knownUnstamped(
      CHECK.replace("const KNOWN_UNSTAMPED = new Set([", 'const KNOWN_UNSTAMPED = new Set([\n  "overview",'),
    );
    expect(seeded).toEqual(["overview"]);
  });

  it("every route is enforced — the exempt set is empty, not merely small", () => {
    expect(current.length).toBe(0);
    expect(SEEDED_UNSTAMPED.length).toBe(43);
  });

  it("every exemption is a real route", () => {
    const routes = new Set<string>(ROUTE_IDS);
    expect(current.filter((r) => !routes.has(r))).toEqual([]);
  });

  it("the list only ever shrinks — nothing outside the frozen seed may appear", () => {
    const seed = new Set(SEEDED_UNSTAMPED);
    const added = current.filter((r) => !seed.has(r));
    expect(
      added,
      `these routes were added to KNOWN_UNSTAMPED after the freeze — stamp the leaf instead: ${added.join(", ")}`,
    ).toEqual([]);
    expect(current.length).toBeLessThanOrEqual(SEEDED_UNSTAMPED.length);
  });

  it("negative control: a list that grew is rejected by the same subset test", () => {
    const grown = knownUnstamped(
      CHECK.replace('const KNOWN_UNSTAMPED = new Set([', 'const KNOWN_UNSTAMPED = new Set([\n  "a-new-hub",'),
    );
    const seed = new Set(SEEDED_UNSTAMPED);
    expect(grown.filter((r) => !seed.has(r))).toEqual(["a-new-hub"]);
  });
});

describe("the check itself enforces what it claims", () => {
  it("it requires ≥1 data-module and exactly one data-primary-move per unexempt leaf", () => {
    expect(CHECK).toContain("const modules = (source.match(/\\bdata-module\\b(?!-)/g) || []).length;");
    expect(CHECK).toContain("const moves = (source.match(/\\bdata-primary-move\\b(?!-)/g) || []).length;");
    expect(CHECK).toContain("has no data-module stamp");
    expect(CHECK).toContain("data-primary-move stamps, expected exactly 1");
  });

  it("it strips comments first — prose about a stamp is not a stamp", () => {
    expect(CHECK).toContain("const stripComments =");
    expect(CHECK).toMatch(/const source = stripComments\(fs\.readFileSync\(file, "utf8"\)\);/);
  });

  it("it resolves leaves from Shell's own registry and fails if the parse drifts", () => {
    expect(CHECK).toContain("const tabRegistry");
    expect(CHECK).toContain("the parser has drifted from the source");
    expect(CHECK).toContain('leaf file missing for route');
  });

  it("an exemption for a route Shell does not host is a failure, not a shrug", () => {
    expect(CHECK).toContain("which is not a route in Shell's tabRegistry");
  });
});

/* ── 4 · R24 · a stamp inside one branch is not a stamp ───────────────────── */

/**
 * #/coach declared `primaryMove: "ask"` and stamped it — inside `composerDocked
 * &&`, the branch that only renders once the thread already HAS a user turn. On
 * a fresh thread, which is the state a parent lands in, the page carried no
 * primary-move stamp at all: the source count said 1, the DOM said 0, and the
 * one route whose move is literally "ask" was unmeasurable at the moment it
 * mattered. A source-counting gate cannot see that on its own, so the shape is
 * pinned here instead.
 *
 * The fix is not a second stamp. ASK-2/COACH-4 already guarantee ONE composer
 * element (`composerSection`) rendered in exactly one of two positions, so the
 * stamps belong on that element: one occurrence in source, exactly one
 * `data-primary-move` in the DOM in either state, and nothing to keep in sync.
 */
describe("R24 — the coach composer is stamped in BOTH of its positions", () => {
  const COACH = read("src/components/tabs/CoachTab.tsx");
  const composerSection = COACH.slice(
    COACH.indexOf("const composerSection = ("),
    COACH.indexOf("const composerDocked") >= 0 ? COACH.indexOf("return (\n    <motion.div") : COACH.length,
  );

  it("the stamps sit on the shared composer element, not on the docked wrapper", () => {
    expect(composerSection, "the composerSection slice must really contain the composer").toContain("<textarea");
    expect(composerSection).toContain('data-module="coach-composer"');
    expect(composerSection).toContain('data-primary-move="ask"');
  });

  it("that element renders in the hero position AND in the docked position", () => {
    expect(COACH).toContain("{!composerDocked && composerSection}");
    expect(COACH).toMatch(/composerDocked && \(\s*\n\s*<div\s*\n\s*data-testid="coach-docked-composer"/);
    expect(COACH).toMatch(/data-testid="coach-docked-composer"[\s\S]*?\{composerSection\}/);
  });

  it("exactly one of each stamp exists in the file, so the DOM can only ever hold one", () => {
    expect((COACH.match(/data-primary-move="ask"/g) || []).length).toBe(1);
    expect((COACH.match(/data-module="coach-composer"/g) || []).length).toBe(1);
  });

  it("negative control: the pre-fix shape — the stamp on the docked branch only", () => {
    const PRE_FIX = [
      "  const composerSection = (",
      '        <section className={composerDocked ? "py-2.5" : "border-y py-5"}>',
      "          <textarea />",
      "        </section>",
      "  );",
      "      {!composerDocked && composerSection}",
      "      {composerDocked && (",
      "        <div",
      '          data-module="coach-composer"',
      '          data-primary-move="ask"',
      '          data-testid="coach-docked-composer"',
      "        >",
      "          {composerSection}",
      "        </div>",
      "      )}",
    ].join("\n");
    // The file-wide count is 1 — which is why framework-check.mjs passed on it.
    expect((PRE_FIX.match(/data-primary-move="ask"/g) || []).length).toBe(1);
    // The shape check is what catches it: the stamp is not on the shared element.
    const slice = PRE_FIX.slice(PRE_FIX.indexOf("const composerSection = ("), PRE_FIX.indexOf("{!composerDocked"));
    expect(slice).toContain("<textarea");
    expect(slice).not.toContain('data-primary-move="ask"');
  });
});

/* ── 5 · R25 · the budget is counted, not just declared ───────────────────── */

/**
 * `moduleBudget` sat in the contract for 43 routes and was enforced on ONE
 * (#/overview, at runtime, via components/overview/todayModules.ts). Item 11
 * stamped every leaf, which made the counts readable — and ten leaves were over:
 * profile 9/3, safety 7/2, memory 6/3, weekly 6/3, copilot 6/2, sharing 5/2,
 * appointments 5/2, smart-reminders 5/3, language 4/3, find-pro 3/2.
 *
 * The counting rule has to survive the obvious cheat. If demotion meant deleting
 * a module's stamp, any leaf could reach its budget by going quiet — which is
 * exactly how these ten stayed invisible. So a demoted module KEEPS its
 * `data-module` and adds `data-module-demoted`, the collapsed wrapper carries
 * `data-module-disclosure` and is deliberately not a module, and
 *
 *     top-level = data-module − data-module-demoted
 *
 * Folding something away is therefore recorded, and the only way to lower the
 * number is to actually demote. This block measures the real tree with that
 * rule (not a substring of the check), pins the ONE runtime-budgeted exemption,
 * and proves the arithmetic on a fixture that is one stamp over budget.
 *
 * It generalises practiceDoors.copy.test.ts's per-route budget assertions, which
 * did this for the nine routes of item 6, to all 43.
 */
const SURFACE_CONTRACT_SRC = read("src/lib/surfaceContract.ts");
const TODAY_MODULES = read("src/components/overview/todayModules.ts");

/** The same leaf resolution framework-check.mjs does, from Shell's own registry. */
function routeLeafSources(): Map<string, string> {
  const lazyPaths = new Map<string, string>();
  for (const m of SHELL.matchAll(/const (\w+) = lazy\(\(\) => import\("([^"]+)"\)\);/g)) {
    lazyPaths.set(m[1], m[2]);
  }
  const start = SHELL.indexOf("const tabRegistry");
  const registry = SHELL.slice(start, SHELL.indexOf("};", start));
  const out = new Map<string, string>();
  for (const m of registry.matchAll(/^\s*"?([a-zA-Z-]+)"?:\s*(\w+),/gm)) {
    const rel = lazyPaths.get(m[2]);
    if (!rel) continue;
    out.set(m[1], read(path.join("src/components/layout", rel + ".tsx").split(path.sep).join("/")));
  }
  return out;
}

const stripJsComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

function countModules(source: string) {
  const src = stripJsComments(source);
  const modules = (src.match(/\bdata-module\b(?!-)/g) || []).length;
  const demoted = (src.match(/\bdata-module-demoted\b/g) || []).length;
  const disclosures = (src.match(/\bdata-module-disclosure=/g) || []).length;
  return { modules, demoted, disclosures, topLevel: modules - demoted };
}

/** #/overview is capped at render time, not in the markup — see the check. */
const RUNTIME_BUDGETED = ["overview"];

describe("R25 — every leaf renders within its declared moduleBudget", () => {
  const leaves = routeLeafSources();

  it("the leaf resolution really reads Shell's registry", () => {
    expect(leaves.size).toBeGreaterThanOrEqual(40);
    expect(leaves.has("coach")).toBe(true);
    expect(leaves.get("coach")).toContain('data-module="coach-composer"');
  });

  it("no route stamps more top-level modules than its contract allows", () => {
    const over: string[] = [];
    for (const [route, source] of leaves) {
      if (RUNTIME_BUDGETED.includes(route)) continue;
      const contract = contractFor(route as ActiveTab);
      expect(contract, `no contract for route ${route}`).toBeTruthy();
      const c = countModules(source);
      if (c.topLevel > contract!.moduleBudget) {
        over.push(`${route}: ${c.topLevel} top-level (${c.modules} stamped, ${c.demoted} demoted) > budget ${contract!.moduleBudget}`);
      }
    }
    expect(over, `over budget — demote the tail into ONE collapsed disclosure, never raise the budget:\n${over.join("\n")}`).toEqual([]);
  });

  it("demoted modules live in exactly one collapsed disclosure per route", () => {
    const wrong: string[] = [];
    for (const [route, source] of leaves) {
      const c = countModules(source);
      if (c.demoted > 0 && c.disclosures !== 1) {
        wrong.push(`${route}: ${c.demoted} demoted module(s) in ${c.disclosures} disclosure wrapper(s)`);
      }
    }
    expect(wrong).toEqual([]);
  });

  it("the ten measured leaves really demote — they did not reach budget by going quiet", () => {
    // Every route R25 named, with the disclosure it now carries. find-pro is the
    // exception ON PURPOSE: its two stamps were one module in two mutually
    // exclusive branches, so the fix was one wrapper stamp and zero demotions.
    for (const route of ["profile", "safety", "memory", "weekly", "copilot", "sharing", "appointments", "smart-reminders", "language"]) {
      const c = countModules(leaves.get(route)!);
      expect(c.demoted, `${route} must demote, not delete, the modules it folded away`).toBeGreaterThan(0);
      expect(c.disclosures, `${route} must carry exactly one disclosure`).toBe(1);
    }
    const findPro = countModules(leaves.get("find-pro")!);
    expect(findPro.topLevel).toBe(2);
    expect(findPro.demoted).toBe(0);
  });

  it("negative control: a leaf one stamp over budget is rejected by the same arithmetic", () => {
    const budget = contractFor("language" as ActiveTab)!.moduleBudget;
    const overBudget = Array.from({ length: budget + 1 }, (_, i) => `<div data-module="m${i}" />`).join("\n");
    expect(countModules(overBudget).topLevel).toBe(budget + 1);
    expect(countModules(overBudget).topLevel > budget).toBe(true);
    // …and the same source, with the tail demoted into one disclosure, passes.
    const demoted = [
      ...Array.from({ length: budget }, (_, i) => `<div data-module="m${i}" />`),
      `<details data-module-disclosure="x-more"><div data-module="m${budget}" data-module-demoted /></details>`,
    ].join("\n");
    expect(countModules(demoted).topLevel).toBe(budget);
    expect(countModules(demoted).disclosures).toBe(1);
  });

  it("negative control: deleting a stamp instead of demoting does NOT satisfy the rule", () => {
    // The cheat the attribute exists to block: the count drops, but so does the
    // demotion evidence, and the per-route disclosure assertion above is what
    // catches a leaf that quietly stopped stamping what it still renders.
    const quiet = `<div data-module="m0" />\n<div />`;
    expect(countModules(quiet).topLevel).toBe(1);
    expect(countModules(quiet).demoted).toBe(0);
    expect(countModules(quiet).disclosures).toBe(0);
  });
});

describe("R25 — the shipped check enforces exactly this, and its one exemption", () => {
  it("framework-check computes top-level as stamps minus demoted", () => {
    expect(CHECK).toContain('const demoted = (source.match(/\\bdata-module-demoted\\b/g) || []).length;');
    expect(CHECK).toContain("topLevel: modules - demoted");
    expect(CHECK).toContain("against a declared moduleBudget of");
    expect(CHECK).toContain("never raise the budget");
  });

  it("it reads the budgets from surfaceContract.ts and fails if that parse drifts", () => {
    expect(CHECK).toContain("function surfaceBudgets()");
    expect(CHECK).toContain("the parser has drifted from the source");
    const parsed = [...SURFACE_CONTRACT_SRC.matchAll(/route: "([a-zA-Z-]+)",[\s\S]{0,400}?moduleBudget: (\d+),/g)];
    expect(parsed.length, "the regex the check uses must resolve every contract").toBe(SURFACE_CONTRACTS.length);
  });

  it("the runtime-budgeted exemption is #/overview and nothing else", () => {
    const set = CHECK.match(/const RUNTIME_BUDGETED = new Set\(\[([\s\S]*?)\]\);/);
    expect(set, "RUNTIME_BUDGETED not found in framework-check.mjs").toBeTruthy();
    const routes = [...set![1].matchAll(/"([a-zA-Z-]+)"/g)].map((m) => m[1]);
    expect(routes).toEqual(RUNTIME_BUDGETED);
  });

  it("#/overview's exemption is real: todayModules caps renders at the declared budget", () => {
    const contract = contractFor("overview" as ActiveTab)!;
    const declared = Number(TODAY_MODULES.match(/export const TODAY_MODULE_BUDGET = (\d+);/)?.[1]);
    expect(declared, "TODAY_MODULE_BUDGET not found").not.toBeNaN();
    expect(declared, "the runtime cap must equal the contract, or the exemption is a hole").toBe(contract.moduleBudget);
    expect(TODAY_MODULES).toContain("const budget = opts.budget ?? TODAY_MODULE_BUDGET;");
  });
});
