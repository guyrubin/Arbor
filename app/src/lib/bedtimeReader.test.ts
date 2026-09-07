import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { SURFACE_CONTRACTS } from "./surfaceContract";
import { TIMELINE_SOURCE_IDS } from "./signalTimeline";
import { en, he } from "./i18nElevation/celebrate";

/**
 * KID-10 — the bedtime reader failed its own job sentence.
 *
 * The contract for `bedtime-stories` says "…read aloud together", yet the
 * reader carried zero read-aloud controls while `#/stories` has had one per
 * beat since HeroScenePlayer shipped; and "Good night" was a bare `reset()`,
 * which is why the contract had to declare `threadWrite: "none"` — the one
 * surface whose whole point is a shared ritual left no trace of it.
 */

const SRC = path.resolve(__dirname, "..");
const READER = path.join(SRC, "components", "tabs", "BedtimeStoriesTab.tsx");
const src = fs.readFileSync(READER, "utf8");

/** The pre-fix page block and done button, verbatim — the negative controls. */
const PRE_FIX_PAGE_END = `              {currentPage}\n            </p>\n          </motion.div>`;
const PRE_FIX_DONE = `onClick={reset}\n              className="inline-flex items-center gap-1.5 text-[13px] font-bold rounded-xl px-4 py-2.5 min-h-[44px] transition"`;

describe("KID-10 · negative control", () => {
  it("the pre-fix page block has no speak control and the pre-fix Good night only resets", () => {
    expect(/SpeakButton/.test(PRE_FIX_PAGE_END)).toBe(false);
    expect(/onClick=\{reset\}/.test(PRE_FIX_DONE)).toBe(true);
    // …and both fixtures are the shapes this file must no longer contain.
    expect(src.includes(PRE_FIX_PAGE_END)).toBe(false);
  });
});

describe("KID-10 · read aloud, per page", () => {
  it("mounts the shared SpeakButton — not a new voice control", () => {
    expect(src).toContain('import { SpeakButton } from "../ui/SpeakButton";');
    const mounts = src.match(/<SpeakButton\b/g) ?? [];
    expect(mounts).toHaveLength(1); // one per rendered page, inside the paged block
  });

  it("the control reads the CURRENT page, in the story's language, at the 44 px floor", () => {
    expect(src).toMatch(/<SpeakButton text=\{currentPage\} lang=\{aiLang\} size="md" className="touch-target" \/>/);
  });

  it("it sits inside the paged AnimatePresence block, so it follows the page", () => {
    const pageBlock = src.slice(src.indexOf('data-testid="bedtime-story-page"'), src.indexOf('{/* Navigation */}'));
    expect(pageBlock).toContain("<SpeakButton");
    expect(pageBlock).toContain('data-testid="bedtime-page-speak"');
  });
});

describe("KID-10 · Good night leaves one line", () => {
  it("the done button calls goodNight, not a bare reset", () => {
    expect(src).toMatch(/onClick=\{goodNight\}/);
    const doneBlock = src.slice(src.indexOf('data-testid="bedtime-story-done"') - 600, src.indexOf('data-testid="bedtime-story-done"'));
    expect(doneBlock).not.toMatch(/onClick=\{reset\}/);
  });

  it("goodNight writes through the existing addMoment seam and still resets", () => {
    expect(src).toContain("const { childProfile, behaviorLogs, addMoment } = useArbor();");
    expect(src).toMatch(/const written = addMoment\(line\);/);
    expect(src).toMatch(/const goodNight = \(\) => \{[\s\S]*?reset\(\);\s*\};/);
  });

  it("the written line carries the story title when there is one, via keys (law 7)", () => {
    expect(src).toContain('t("elev.bedtime.goodnight.moment.titled")');
    expect(src).toContain('t("elev.bedtime.goodnight.moment")');
    for (const key of [
      "elev.bedtime.goodnight.moment",
      "elev.bedtime.goodnight.moment.titled",
      "elev.bedtime.goodnight.saved",
    ]) {
      expect(en[key], `${key} missing in EN`).toBeTruthy();
      expect(he[key], `${key} missing in HE`).toBeTruthy();
      expect(he[key]).toMatch(/[֐-׿]/);
    }
    expect(en["elev.bedtime.goodnight.moment.titled"]).toContain("{title}");
    expect(he["elev.bedtime.goodnight.moment.titled"]).toContain("{title}");
  });

  it("generate-and-discard is unchanged — the story itself is still never persisted", () => {
    // The only write is the parent's own line; no story store, no upsert of
    // pages/title/summary anywhere in this file.
    expect(src).not.toMatch(/upsert\(/);
    expect(src).not.toMatch(/localStorage\.setItem/);
  });
});

describe("KID-10 · the contract now matches the behaviour", () => {
  const bedtime = SURFACE_CONTRACTS.find((c) => c.route === "bedtime-stories");

  it("declares a REAL ingest source, not 'none'", () => {
    expect(bedtime).toBeTruthy();
    expect(bedtime!.threadWrite).toBe("behaviorLogs");
    expect(TIMELINE_SOURCE_IDS).toContain(bedtime!.threadWrite as never);
  });

  it("the job sentence the fix answers is still the declared job", () => {
    expect(bedtime!.job.toLowerCase()).toContain("read aloud together");
  });
});

describe("KID-10 · residue: no cover was added", () => {
  it("WorldScene is NOT mounted here — it spends an image generation per open", () => {
    // WorldScene calls api.generateScene whenever a hero avatar exists, and its
    // prompt is hardcoded to "bright, bold kids' comic-book illustration" —
    // a kid register on a parent bedtime surface (law 2) and a cost per night
    // on a generate-and-discard route. Filed rather than forced.
    expect(src).not.toContain("WorldScene");
  });
});
