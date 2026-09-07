import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";

/**
 * OBJ-TODAY-01 / OBJ-JOURNAL-03 — gradient = the one primary CTA.
 *
 * Product principle 3: one screen, one job, one obvious next action, and
 * `surfaceContract.primaryMove` names it. `--arbor-gradient-primary` /
 * `--gradient-cta` is how that one action is spelled, so any OTHER control
 * wearing it is a second "obvious next action" — which is no obvious next
 * action at all. The 7 Sep object audit measured 3–4 of them on `#/overview`
 * (interests Save, the FirstStepsRail done row, the play card's "We did this",
 * the post-capture strip) while the anchor itself was outline.
 *
 * The vitest env is node-only (scripts/vitest.config.mjs), so this is a SOURCE
 * scan in the house pattern of todayConsolidation.test.ts / clinicalFirewall —
 * it pins the shape that makes the rendered count true. The scanner is a pure
 * function over {path, src} pairs so the pre-fix markup can be fed in as a
 * negative control.
 *
 * SCOPE is the Today / Journal / Weekly surface set this item owns. Files
 * outside it keep their own budget; `KNOWN_GRADIENT_FILES` is the repo-wide
 * ratchet that may only shrink.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(SRC_ROOT, "components");

const GRADIENT = /--arbor-gradient-primary|--gradient-cta|\bgradient-cta\b/;

/** Directories whose every file is scanned against the allow-list. */
const SCOPE_DIRS = ["overview", "onboarding", "trust", "ui", "weekly"];
/** Individually scoped leaves outside those directories. */
const SCOPE_FILES = [
  "tabs/OverviewTab.tsx",
  "tabs/JournalTab.tsx",
  "tabs/WeeklyTab.tsx",
];

/**
 * The only files in scope allowed to spell the primary gradient. Each one is
 * the declared primary move of its surface (or the modal that completes it):
 *   TodayRecommendation  — Today's `do-today-action` accept
 *   PromptCaptureCard    — the hero's mutually-exclusive day-0 sibling
 *   WeekOpenAnchorCard   — the week-open ritual's CTA (same slot)
 *   QuickLogModal        — capture submit
 *   ConfirmCaptureReview — capture confirm
 *   DailyPlanCard        — the DailyPlay hub's own hero
 *   HubHero / Button     — the shared primary recipes
 *   WeeklyTab            — one gradient per weekly state (3b037bfe)
 *   RecapStoryCards      — `accept-recap-recommendation`, weekly's primaryMove
 */
const ALLOWED = new Set([
  "overview/TodayRecommendation.tsx",
  "overview/PromptCaptureCard.tsx",
  "overview/WeekOpenAnchorCard.tsx",
  "overview/QuickLogModal.tsx",
  "overview/ConfirmCaptureReview.tsx",
  "overview/DailyPlanCard.tsx",
  "ui/HubHero.tsx",
  "ui/Button.tsx",
  "weekly/RecapStoryCards.tsx",
  "tabs/WeeklyTab.tsx",
]);

/** Drop comments so prose about the rule cannot trip the scan. */
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

export interface ScanFile {
  /** Path relative to src/components, POSIX separators. */
  rel: string;
  src: string;
}

/** Files in scope that carry the primary gradient without a licence for it. */
function offenders(files: ScanFile[]): string[] {
  return files
    .filter((f) => !ALLOWED.has(f.rel) && GRADIENT.test(stripComments(f.src)))
    .map((f) => f.rel);
}

function walk(dir: string, prefix: string, out: ScanFile[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.isDirectory()) walk(path.join(dir, entry.name), rel, out);
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push({ rel, src: fs.readFileSync(path.join(dir, entry.name), "utf8") });
    }
  }
}

function scopeFiles(): ScanFile[] {
  const out: ScanFile[] = [];
  for (const d of SCOPE_DIRS) walk(path.join(COMPONENTS, d), d, out);
  for (const rel of SCOPE_FILES) {
    out.push({ rel, src: fs.readFileSync(path.join(COMPONENTS, rel), "utf8") });
  }
  return out;
}

const read = (rel: string) => fs.readFileSync(path.join(COMPONENTS, rel), "utf8");

describe("OBJ-TODAY-01 — the primary gradient is an allow-list", () => {
  it("no file on Today / Journal / Weekly wears the primary gradient without a licence", () => {
    expect(offenders(scopeFiles())).toEqual([]);
  });

  it("negative control: the pre-fix markup of each demoted control fails the scan", () => {
    const prefix: ScanFile[] = [
      {
        rel: "overview/LifecycleMomentCard.tsx",
        src: `<button data-testid="lifecycle-loves-save" style={{ background: "var(--arbor-gradient-primary)" }}>save</button>`,
      },
      {
        rel: "overview/DailyPlayCard.tsx",
        src: `<button style={{ background: "var(--arbor-gradient-primary)", color: "#fff" }}>We did this</button>`,
      },
      {
        rel: "overview/PostCaptureCoachStrip.tsx",
        src: `<button style={{ background: "var(--arbor-gradient-primary)" }}>coach</button>`,
      },
      {
        rel: "ui/SpineRibbon.tsx",
        src: `const style = { background: "var(--gradient-cta)" };`,
      },
    ];
    expect(offenders(prefix)).toEqual([
      "overview/LifecycleMomentCard.tsx",
      "overview/DailyPlayCard.tsx",
      "overview/PostCaptureCoachStrip.tsx",
      "ui/SpineRibbon.tsx",
    ]);
    // …and a licensed file with the same markup passes, so the scan is the
    // allow-list and not a blanket ban.
    expect(offenders([{ rel: "ui/HubHero.tsx", src: prefix[0].src }])).toEqual([]);
  });

  it("the licensed Today heroes still carry exactly one gradient each", () => {
    // Mutually exclusive at runtime (todayConsolidation.test.ts pins the
    // ternary chain), so the pair is still ONE gradient on the rendered page.
    const hero = stripComments(read("overview/TodayRecommendation.tsx"));
    const prompt = stripComments(read("overview/PromptCaptureCard.tsx"));
    expect((hero.match(/--arbor-gradient-primary/g) ?? []).length).toBe(1);
    expect((prompt.match(/--arbor-gradient-primary/g) ?? []).length).toBe(1);
  });
});

describe("OBJ-TODAY-01 — secondary controls are outline, not a tone wash", () => {
  /* Every `--arbor-*-soft` token is itself a `linear-gradient(...)`
     (index.css:45-60), which is why the audit measured the trust chips and the
     FirstStepsRail done row as gradient CTAs. Secondary = outline: a flat
     token background plus `--arbor-rule`, with the tone kept in the ink. */
  it("the trust chips are paper + rule, never a `.soft` fill", () => {
    for (const rel of ["trust/TrustLink.tsx", "ui/EvidenceChip.tsx"]) {
      const src = stripComments(read(rel));
      expect(src).not.toMatch(/background:\s*p\.soft/);
      expect(src).toMatch(/background:\s*"var\(--arbor-paper-elevated\)"/);
      expect(src).toMatch(/border:\s*"1px solid var\(--arbor-rule\)"/);
      // the tone survives — the chip is still lav / sky, just not filled
      expect(src).toMatch(/color:\s*p\.ink/);
    }
  });

  it("a finished FirstStepsRail step is a check row, not a filled button", () => {
    const src = stripComments(read("onboarding/FirstStepsRail.tsx"));
    expect(src).not.toMatch(/background:\s*isDone\s*\?\s*p\.soft/);
    expect(src).toMatch(/background:\s*isDone\s*\?\s*"var\(--arbor-paper-deep\)"/);
  });

  it("SpineRibbon defaults to the quiet lav register, never mint/clay", () => {
    const src = stripComments(read("ui/SpineRibbon.tsx"));
    expect(src).toMatch(/tone\s*=\s*"lav"/);
    expect(src).not.toMatch(/tone\s*=\s*"mint"/);
  });
});

describe("OBJ-TODAY-01 — repo-wide ratchet", () => {
  /* Outside the Today/Journal/Weekly scope the gradient is still spread across
     surfaces this item does not own. Pin the file count so it can only shrink;
     a new file reaching for the primary gradient has to justify itself here. */
  const KNOWN_GRADIENT_FILES = 27;

  it("no new surface reaches for the primary gradient", () => {
    const all: ScanFile[] = [];
    walk(COMPONENTS, "", all);
    const hits = all.filter((f) => GRADIENT.test(stripComments(f.src))).map((f) => f.rel);
    expect(hits.length).toBeLessThanOrEqual(KNOWN_GRADIENT_FILES);
  });
});
