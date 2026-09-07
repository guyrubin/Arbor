/**
 * playShell.register.test.ts — IA-08 / RUN-12 (law 2: registers are never crossed).
 *
 * Six routes have TWO audiences behind one URL: `#/speech`, `#/mimic`,
 * `#/feelings`, `#/adventures`, `#/comics`, `#/stories`. The child reaches them
 * inside Kid Mode; the parent reaches the same URL from parent chrome. Until
 * this guard both got `PlayShell` — the comic register (`.arbor-play`: gradient
 * wash, play radii, mascot bubble, display title) rendering inside the calm
 * parent shell.
 *
 * The rule this file enforces: **`PlayShell` / `.arbor-play` may only mount
 * inside a Kid-Mode branch.** A parent branch renders the parent register
 * (`PageHeader` + `SectionCard` from `ui/kit.tsx`, tokens only), which is what
 * `ui/playkit.tsx`'s `RegisterShell` does with its `kidMode` prop.
 *
 * Mechanics: a static scan. Kid-only regions (`if (kidMode) { … }`,
 * `{kidMode && ( … )}`, `kidMode ? ( … ) : …`) are cut out first, then the
 * remainder — everything a PARENT can reach — must contain no play shell.
 * Bracket matching mirrors `kidRegisterScan.test.ts`'s `matchBracket` (copied
 * rather than imported: importing a `.test.ts` re-runs that whole suite here).
 *
 * Negative controls (all three must FAIL the rule, proving the scan can see a
 * violation): the pre-fix unconditional `<PlayShell>` return; a play wash
 * mounted in an explicitly PARENT-only branch (`!kidMode &&`); and a bare
 * `className="arbor-play"` with no branch at all.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { SECTIONS, TAB_SECTION_FALLBACK } from "./navigation";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** The six shared drill routes, and the file that renders each. */
const SHARED_ROUTE_FILES: Record<string, string> = {
  speech: "components/practice/SpeechCoachTab.tsx",
  mimic: "components/practice/MimicStudioTab.tsx",
  feelings: "components/practice/FeelingsLabTab.tsx",
  adventures: "components/practice/AdventuresTab.tsx",
  comics: "components/tabs/ComicsTab.tsx",
  stories: "components/tabs/HeroJourneyTab.tsx",
};

/**
 * Files allowed to carry `.arbor-play` OUTSIDE a `kidMode` branch, with the
 * reason each is unreachable from parent chrome. A new entry here is a design
 * decision, not a formality.
 */
const KID_ONLY_SURFACES: Record<string, string> = {
  "components/ui/playkit.tsx":
    "the primitive itself — `PlayShell` declares the class, and `RegisterShell` is the only thing that mounts it (asserted below)",
  "components/kidmode/KidModeOverlay.tsx": "the Kid Mode shell; it IS the kid register",
  "components/practice/HeroArcade.tsx":
    "mounted only by PracticeHubTab, which only KidModeOverlay renders (#/practice is PracticeStudioTab)",
  "components/practice/EarlyReadingTrack.tsx": "a Spell Forge world panel, reached only from the arcade",
};

/** Index of the bracket closing the one at `openIdx`, skipping strings/templates. */
function matchBracket(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : "";
  if (!close) return -1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/**
 * Cut every KID-ONLY region out of a source string, leaving only what a parent
 * can reach. `!kidMode` forms are deliberately NOT markers — a play shell in an
 * explicitly parent-only branch is the very defect this guard is for.
 */
export function stripKidOnly(src: string): string {
  const MARKERS: RegExp[] = [
    /(?<![!\w])kidMode\s*\)\s*\{/, // if (kidMode) {   — the `(` is consumed by the caller below
    /(?<![!\w])kidMode\s*&&\s*\(/, // {kidMode && (
    /(?<![!\w])kidMode\s*\?\s*\(/, // kidMode ? (
  ];
  let out = src;
  for (let guard = 0; guard < 200; guard++) {
    let hit: { index: number; len: number } | null = null;
    for (const re of MARKERS) {
      const m = re.exec(out);
      if (m && (hit === null || m.index < hit.index)) hit = { index: m.index, len: m[0].length };
    }
    if (!hit) return out;
    const openIdx = hit.index + hit.len - 1; // the `{` or `(` the marker ends on
    const closeIdx = matchBracket(out, openIdx);
    if (closeIdx < 0) return out;
    out = `${out.slice(0, hit.index)}KID_ONLY_BRANCH${out.slice(closeIdx + 1)}`;
  }
  return out;
}

/** Play-shell mounts and `.arbor-play` class literals in a source string. */
export function playShellHits(src: string): string[] {
  const hits: string[] = [];
  for (const m of src.matchAll(/<PlayShell\b|<PlayHeader\b/g)) hits.push(m[0]);
  for (const m of src.matchAll(/className=\{?\s*[`"'][^`"'\n]*\barbor-play\b/g)) hits.push("arbor-play class");
  return hits;
}

/** What a PARENT can reach in this file. */
const parentReachable = (rel: string) => stripKidOnly(stripComments(read(rel)));

describe("IA-08 / RUN-12 — the play register never renders on a parent door", () => {
  it("the scanner reads a real corpus", () => {
    for (const rel of Object.values(SHARED_ROUTE_FILES)) {
      expect(read(rel).length, rel).toBeGreaterThan(2000);
    }
  });

  for (const [route, rel] of Object.entries(SHARED_ROUTE_FILES)) {
    it(`#/${route} — no PlayShell / PlayHeader / .arbor-play outside a kidMode branch (${rel})`, () => {
      const hits = playShellHits(parentReachable(rel));
      expect(hits, `${rel} mounts the play register where a parent can reach it: ${hits.join(", ")}`).toEqual([]);
    });
  }

  it("`RegisterShell` is the ONLY thing that mounts PlayShell, and only under kidMode", () => {
    const playkit = stripComments(read("components/ui/playkit.tsx"));
    // Exactly one mount site in the whole primitive module…
    expect([...playkit.matchAll(/<PlayShell\b/g)]).toHaveLength(1);
    // …and it disappears when the kid branch is cut out. (The `.arbor-play`
    // class literal stays: it is PlayShell's OWN declaration, the primitive
    // this rule routes through — only its MOUNT sites are register-sensitive.)
    expect(stripKidOnly(playkit)).not.toMatch(/<PlayShell\b|<PlayHeader\b/);
    // RegisterShell offers both registers: kit's PageHeader is the parent half.
    expect(playkit).toMatch(/export function RegisterShell/);
    expect(playkit).toMatch(/<PageHeader\b/);
  });

  it("every other file carrying `.arbor-play` is an unreachable-from-parent kid surface", () => {
    for (const rel of Object.keys(KID_ONLY_SURFACES)) {
      expect(read(rel), rel).toContain("arbor-play");
    }
  });

  /* ── Negative controls: the scan must SEE a violation ─────────────────── */

  it("NEGATIVE CONTROL: the pre-fix unconditional wrapper is a hit", () => {
    const preFix = `
      export default function FeelingsLabTab() {
        const kidMode = useSyncExternalStore(subscribeKidMode, isKidModeActive);
        return (
          <PlayShell>
            <PlayHeader title={t("prac.feelings.title")} />
          </PlayShell>
        );
      }`;
    expect(playShellHits(stripKidOnly(stripComments(preFix))).length).toBeGreaterThan(0);
  });

  it("NEGATIVE CONTROL: a play wash inside an explicitly PARENT-only branch is a hit", () => {
    const parentBranch = `
      if (!kidMode) {
        return <PlayShell><PlayHeader title="Hero Comics" /></PlayShell>;
      }`;
    expect(playShellHits(stripKidOnly(parentBranch))).toEqual(["<PlayShell", "<PlayHeader"]);
  });

  it("NEGATIVE CONTROL: a bare `arbor-play` class with no branch is a hit", () => {
    expect(playShellHits(stripKidOnly(`<div className="arbor-play space-y-6">x</div>`))).toEqual([
      "arbor-play class",
    ]);
  });

  it("POSITIVE CONTROL: the same wash inside a kidMode branch passes", () => {
    expect(playShellHits(stripKidOnly(`{kidMode && (<PlayShell><PlayHeader title="x" /></PlayShell>)}`))).toEqual([]);
    expect(playShellHits(stripKidOnly(`kidMode ? (<div className="arbor-play">x</div>) : (<div />)`))).toEqual([]);
    expect(playShellHits(stripKidOnly(`if (kidMode) { return <PlayShell>x</PlayShell>; }`))).toEqual([]);
  });
});

describe("IA-08 / RUN-12 — #/practice loses the drill pill row, keeps every route", () => {
  const practice = SECTIONS.find((s) => s.id === "practice");

  it("practice.tools is empty — entry is launcher-mediated", () => {
    expect(practice).toBeDefined();
    expect(practice!.tools).toEqual([]);
  });

  it("all six drill routes still resolve to a hub (no route is orphaned)", () => {
    for (const route of ["speech", "mimic", "feelings", "journey", "adventures", "comics"]) {
      expect(TAB_SECTION_FALLBACK[route as keyof typeof TAB_SECTION_FALLBACK], route).toBeTruthy();
    }
  });

  it("the launcher cards STAY: PracticeStudioTab still opens each standalone drill route", () => {
    const studio = stripComments(read("components/practice/PracticeStudioTab.tsx"));
    for (const route of ["speech", "feelings", "mimic", "adventures"]) {
      expect(studio, `PracticeStudioTab lost its ${route} tile`).toContain(`tab: "${route}"`);
    }
    expect(studio).toMatch(/setActiveTab\(world\.tab\)/);
  });
});
