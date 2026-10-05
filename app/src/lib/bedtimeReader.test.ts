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
    expect(src).toContain("const { childProfile, behaviorLogs, addMoment, openPaywall } = useArbor();");
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

describe("B-PLAY-13 · the prefill tells the truth about today", () => {
  const t = (k: string) => (k === "beh.type.sensory" ? "עומס חושי" : k);
  const now = new Date();
  const at = (minsAgo: number) => new Date(now.getTime() - minsAgo * 60_000).toISOString();

  it("a moment prefills exactly its own words — no 'Moment —' prefix", async () => {
    const { bedtimePrefill } = await import("./bedtimeStories");
    const lines = bedtimePrefill([{ id: "a", timestamp: at(0), behaviorType: "Moment", trigger: "she said butterfly" }], now, t);
    expect(lines).toEqual([{ id: "a", description: "she said butterfly" }]);
  });

  it("at most one incident joins, by its localized label; three lines at most", async () => {
    const { bedtimePrefill } = await import("./bedtimeStories");
    const logs = [
      { id: "i1", timestamp: at(0), behaviorType: "Sensory Overload", trigger: "loud mall" },
      { id: "i2", timestamp: at(0), behaviorType: "Sibling Conflict", trigger: "toy" },
      { id: "m1", timestamp: at(0), behaviorType: "Moment", trigger: "one" },
      { id: "m2", timestamp: at(0), behaviorType: "Moment", trigger: "two" },
      { id: "m3", timestamp: at(0), behaviorType: "Moment", trigger: "three" },
    ];
    const lines = bedtimePrefill(logs, now, t);
    expect(lines.map((l) => l.description)).toEqual(["עומס חושי — loud mall", "one", "two"]);
    expect(lines.some((l) => /Sensory Overload|Sibling/.test(l.description))).toBe(false);
  });

  it("the page reads its prefill from the helper — no UTC day slice, no type join", () => {
    expect(src).toContain("bedtimePrefill(behaviorLogs, new Date(), t)");
    expect(src).not.toMatch(/toISOString\(\)\.slice\(0,\s*10\)/);
    expect(src).not.toMatch(/\[l\.behaviorType, l\.trigger\]/);
  });

  it("chrome follows uiLang; the story request and read-aloud keep aiLang", () => {
    expect(src).toMatch(/const he = uiLang === "he";/);
    expect(src).not.toMatch(/const he = aiLang === "he"/);
    expect(src).toMatch(/language: aiLang,/);
  });
});

/**
 * B-PLAY-14 — Tonight gets a "From today" mode. The bedtime body is ONE
 * component (BedtimeStoryBody) rendered by both #/bedtime-stories and the
 * Stories Tonight cover; the evening doors land on Stories with "From today";
 * goodnight answers can be kept; a failed generation is said inline + Retry.
 */
describe("B-PLAY-14 · the shared bedtime body", () => {
  const read = (...p: string[]) => fs.readFileSync(path.join(SRC, ...p), "utf8");
  const fromToday = read("components", "stories", "TonightFromToday.tsx");
  const stories = read("components", "tabs", "HeroJourneyTab.tsx");
  const lifecycle = read("components", "overview", "LifecycleMomentCard.tsx");
  const cue = read("components", "coach", "RhythmCue.tsx");

  it("#/bedtime-stories renders the shared body; the Stories cover embeds the same one", () => {
    expect(src).toMatch(/export default function BedtimeStoriesTab\(\) \{\s*return <BedtimeStoryBody \/>;\s*\}/);
    expect(src).toContain("export function BedtimeStoryBody({ embedded = false }");
    expect(fromToday).toContain('import { BedtimeStoryBody } from "../tabs/BedtimeStoriesTab";');
    expect(fromToday).toContain("<BedtimeStoryBody embedded />");
    // embedded drops the page header and the route stamps — the stories budget is unchanged
    expect(src).toContain('data-module={embedded ? undefined : "bedtime-day-events"}');
    expect(src).toContain('data-primary-move={embedded ? undefined : "generate-bedtime-story"}');
    const storiesContract = SURFACE_CONTRACTS.find((c) => c.route === "stories");
    expect(storiesContract?.moduleBudget).toBe(3);
    expect(storiesContract?.primaryMove).toBe("read-tonights-story");
  });

  it("the Tonight cover carries the two-option switch and opens on the requested mode", () => {
    const cover = stories.slice(stories.indexOf('<section data-module="stories-tonight">'), stories.indexOf("RUN-08 — the counts"));
    expect(cover).toContain('data-testid="stories-tonight-mode"');
    expect(cover).toContain('aria-pressed={tonightMode === m}');
    expect(cover).toContain('t("elev.stories.tonight.mode.today")');
    expect(cover).toContain('t("elev.stories.tonight.mode.hero")');
    expect(cover).toContain("<TonightFromToday />");
    // the hero cover (and its primary move) is still the default
    expect(cover).toContain('data-primary-move="read-tonights-story"');
    expect(stories).toContain('useState<TonightMode>(() => consumeTonightMode() ?? "hero")');
  });

  it("the evening doors re-point to Stories with 'From today' (the route itself stays live)", () => {
    expect(lifecycle).not.toMatch(/go\("bedtime-stories"\)|setActiveTab\("bedtime-stories"\)/);
    expect((lifecycle.match(/requestTonightMode\("today"\)/g) ?? []).length).toBe(2);
    expect(cue).toContain("if (visible.tonightMode) requestTonightMode(visible.tonightMode);");
    expect(SURFACE_CONTRACTS.some((c) => c.route === "bedtime-stories")).toBe(true);
  });

  it("the mode request is one-shot", async () => {
    const { requestTonightMode, consumeTonightMode } = await import("./tonightMode");
    expect(consumeTonightMode()).toBeNull();
    requestTonightMode("today");
    expect(consumeTonightMode()).toBe("today");
    expect(consumeTonightMode()).toBeNull();
  });

  it("'Keep what {name} said' writes ONE parent moment per answer through addMoment", () => {
    const keep = src.slice(src.indexOf("const keepAnswer"), src.indexOf("const keepAnswer") + 500);
    expect(keep).toContain("if (!answer || kept[i]) return;");
    expect(keep).toMatch(/addMoment\(t\("elev\.bedtime\.keep\.line", \{ question, name, answer \}\)\)/);
    expect(src).toContain('t("elev.bedtime.keep.label", { name })');
    expect(src).toContain('data-testid="bedtime-answer-keep"');
    // the input and the Keep button meet the 44 px floor
    expect((src.match(/min-h-11/g) ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it("a failed generation is said inline with Retry (useAsyncAction), not a lone toast", () => {
    expect(src).toMatch(/useAsyncAction\(\s*"bedtime_generate"/);
    expect(src).toContain('data-testid="bedtime-generate-error"');
    expect(src).toContain('data-testid="bedtime-generate-retry"');
    expect(src).not.toContain('"Could not generate the story"');
    // the escalation 409 still opens the calm wall, never the error line
    expect(src).toMatch(/setEscalated\(true\);\s*return null;/);
  });

  it("every new string exists in EN and HE", () => {
    for (const key of [
      "elev.bedtime.keep.label", "elev.bedtime.keep.cta", "elev.bedtime.keep.done", "elev.bedtime.keep.line",
      "elev.bedtime.generate.failed", "elev.stories.tonight.mode.label", "elev.stories.tonight.mode.today", "elev.stories.tonight.mode.hero",
    ]) {
      expect(en[key], `${key} EN`).toBeTruthy();
      expect(he[key], `${key} HE`).toMatch(/[֐-׿]/);
    }
    for (const lang of [en, he]) {
      expect(lang["elev.bedtime.keep.label"]).toContain("{name}");
      expect(lang["elev.bedtime.keep.line"]).toMatch(/\{question\}[\s\S]*\{answer\}/);
    }
  });
});
