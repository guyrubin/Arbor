/**
 * storiesCover.test.ts — §3f rows 3–4: #/stories opens on ONE story.
 *
 * Measured on the parent door: the first story card rendered at 1,151 px. Above
 * it sat a comic hero banner (a "0 stories done" chip and six virtue counters
 * all reading 0 on day 0 — RUN-08's zero wall), a mascot speech bubble written
 * in the child's voice on a PARENT surface (law 2), a Hero Comics tile that
 * duplicates the hub's own pill and a Family Formation tile that duplicates the
 * Learn hub's, then a filter row. An evening surface that makes you scroll past
 * four things before it offers a story has not done its job — and its contract
 * says so: primaryMove "read-tonights-story", moduleBudget 3.
 *
 * The pick itself is NOT new. `chooseTonightsStory()` was built for the kid home
 * (02e04b42) and is reused verbatim, with the same local day key and the same
 * per-child seed, so the kid banner and the parent cover always name the same
 * story on the same day.
 *
 * Source-order and source-shape are proxies for the rendered "cover top < 700 px
 * at 390"; the pixel measurement stays the orchestrator's (no jsdom here).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { contractFor } from "./surfaceContract";
import { chooseTonightsStory } from "../components/kidmode/tonightsStory";
import { HERO_STORIES } from "./heroJourneys";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const HERO = stripComments(read("components/tabs/HeroJourneyTab.tsx"));
const KID_HOME = stripComments(read("components/kidmode/KidDashboard.tsx"));

/** The player view — everything from the beat renderer down. */
function playerView(src: string): string {
  const at = src.indexOf("const playerBody = (immersiveMode: boolean)");
  expect(at, "the player view was not found").toBeGreaterThan(-1);
  return src.slice(at);
}

/** The parent branch of the catalogue view: everything after the kid ternary. */
function parentBranch(src: string): string {
  const at = src.indexOf("    ) : (\n      <div className=\"space-y-6 max-w-[1100px]\">");
  expect(at, "the parent branch of the #/stories catalogue was not found").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("const playerBody = (immersiveMode: boolean)"));
}

/** The kid branch: from the kidMode ternary's true arm to the parent arm. */
function kidBranch(src: string): string {
  const from = src.indexOf("    return kidMode ? (");
  const to = src.indexOf("    ) : (\n      <div className=\"space-y-6 max-w-[1100px]\">");
  expect(from).toBeGreaterThan(-1);
  expect(to).toBeGreaterThan(from);
  return src.slice(from, to);
}

describe("§3f row 3 — the parent door leads with tonight's cover", () => {
  const parent = parentBranch(HERO);

  it("the scanner reads a real corpus", () => {
    expect(HERO.length).toBeGreaterThan(20000);
    expect(parent.length).toBeGreaterThan(2000);
  });

  it("reuses the kid home's tonightsStory helper — same day key, same seed (B-PLAY-16: + the same family inputs)", () => {
    expect(HERO).toContain('import { pickTonightsStory, TONIGHT_AIM_REASON_KEY } from "../kidmode/tonightsStory";');
    expect(HERO).toMatch(/pickTonightsStory\(dayKey\(new Date\(\)\), childProfile\.id, \{/);
    // The kid home seeds it the same way, so both surfaces name one story.
    expect(KID_HOME).toMatch(/chooseTonightsStory\(data\.today, childProfile\.id, \{/);
  });

  it("stamps ONE dominant cover as the first module, carrying the declared move", () => {
    const contract = contractFor("stories")!;
    expect(contract.primaryMove).toBe("read-tonights-story");
    const tonight = parent.indexOf('data-module="stories-tonight"');
    const catalogue = parent.indexOf('data-module="stories-catalogue"');
    const library = parent.indexOf('data-module="stories-library"');
    expect(tonight).toBeGreaterThan(-1);
    expect(tonight).toBeLessThan(catalogue);
    expect(catalogue).toBeLessThan(library);
    expect(parent).toContain('data-primary-move="read-tonights-story"');
    // The move is inside the cover module, not somewhere below the shelf.
    expect(parent.indexOf('data-primary-move="read-tonights-story"')).toBeLessThan(catalogue);
  });

  it("stays inside the declared module budget, with exactly one primary move", () => {
    const modules = (HERO.match(/\bdata-module=/g) || []).length;
    const demoted = (HERO.match(/\bdata-module-demoted\b/g) || []).length;
    const moves = (HERO.match(/\bdata-primary-move=/g) || []).length;
    expect(modules - demoted).toBeLessThanOrEqual(contractFor("stories")!.moduleBudget);
    expect(modules - demoted).toBeLessThanOrEqual(3);
    expect(moves).toBe(1);
  });

  it("the cover is the FIRST thing under the page header — nothing above it", () => {
    const header = parent.indexOf("<PageHeader");
    const tonight = parent.indexOf('data-module="stories-tonight"');
    const between = parent.slice(header, parent.indexOf('<section data-module="stories-tonight"'));
    expect(header).toBeGreaterThan(-1);
    expect(between).not.toContain("<section");
    expect(between).not.toContain("ArborMascot");
  });

  it("the mascot bubble and the duplicate doors are gone from the parent branch", () => {
    expect(parent).not.toContain("ArborMascot");
    expect(parent).not.toContain('kidNav("comics")');
    expect(parent).not.toContain('kidNav("family")');
    // …and the whole file no longer carries the in-hub tile pair at all.
    expect(HERO).not.toContain('kidNav("comics")');
  });

  it("RUN-08 — no zero wall: the counts line renders only when there is something to count", () => {
    expect(parent).toMatch(/\{runs\.length > 0 && \(\s*<p[^>]*>\s*\{t\("elev\.stories\.counts\.stories", \{ n: runs\.length \}\)\}/);
  });

  it("KID-29 residue — the kid banner keeps the crest and the name, not the tally", () => {
    const kid = kidBranch(HERO);
    expect(kid).toContain("<HeroCrest");
    expect(kid).not.toContain("stories done");
    expect(kid).not.toContain("סיפורים הושלמו");
    expect(kid).not.toContain("METRIC_IDS.map");
    expect(kid).not.toContain("METRIC_EMOJI[m]");
  });

  it("NEGATIVE CONTROL: the pre-fix banner (unguarded zero chip + six counters) is what the rules reject", () => {
    const preFix = `
      <span>{he ? \`\${runs.length} סיפורים הושלמו\` : \`\${runs.length} stories done\`}</span>
      {METRIC_IDS.map((m) => (<span key={m}><b>{totalMetrics[m]}</b></span>))}`;
    expect(preFix).toContain("stories done");
    expect(preFix).toContain("METRIC_IDS.map");
    expect(preFix).not.toMatch(/runs\.length > 0/);
  });
});

describe("§3f row 4 — the reader's own controls clear the touch floor", () => {
  it("'All journeys' and 'Immersive' are 44 px and keyed", () => {
    const player = playerView(HERO);
    const back = player.indexOf('t("elev.stories.reader.back")');
    const imm = player.indexOf('t("elev.stories.reader.immersive")');
    expect(back).toBeGreaterThan(-1);
    expect(imm).toBeGreaterThan(-1);
    // Both buttons carry the explicit floor (they measured 20 px and 16 px).
    // Split rather than regex-match the open tag: an arrow function's `=>`
    // in an attribute makes "the first > ends the tag" wrong, and the
    // lookbehind that fixes that is easy to get subtly wrong. The first 400
    // characters after each `<button` cover its whole attribute list.
    const buttons = player.split("<button").slice(1).map((chunk) => chunk.slice(0, 400));
    const backBtn = buttons.find((b) => b.includes("exitJourney"));
    const immBtn = buttons.find((b) => b.includes("immersiveTriggerRef"));
    expect(backBtn, "the exit button was not found").toBeTruthy();
    expect(immBtn, "the immersive button was not found").toBeTruthy();
    expect(backBtn!).toContain("min-h-[44px]");
    expect(immBtn!).toContain("min-h-[44px]");
  });

  it("NEGATIVE CONTROL: the pre-fix buttons carried no minimum height", () => {
    const preFix = '<button onClick={exitJourney} className="flex items-center gap-1.5 text-sm font-bold">';
    expect(preFix).not.toContain("min-h-[44px]");
  });

  it("the exit chevron mirrors under RTL (CR-13 class of defect)", () => {
    const player = playerView(HERO);
    expect(player).toMatch(/name="arrow_back"[\s\S]{0,120}scaleX\(-1\)/);
  });
});

describe("chooseTonightsStory — one story per local day, stable and rotating", () => {
  it("is deterministic for a given day and child", () => {
    const a = chooseTonightsStory("2026-09-07", "child-1");
    expect(chooseTonightsStory("2026-09-07", "child-1")).toBe(a);
    expect(HERO_STORIES.some((s) => s.id === a)).toBe(true);
  });

  it("rotates across days and differs between children", () => {
    const days = ["2026-09-05", "2026-09-06", "2026-09-07", "2026-09-08", "2026-09-09"];
    const picks = new Set(days.map((d) => chooseTonightsStory(d, "child-1")));
    expect(picks.size).toBeGreaterThan(1);
    const sameDayTwoKids = new Set(["child-1", "child-2", "child-3"].map((c) => chooseTonightsStory("2026-09-07", c)));
    expect(sameDayTwoKids.size).toBeGreaterThan(1);
  });
});

describe("B-PLAY-11 — Tonight cover: no virtue tallies, insight first, catalogue behind 'More stories'", () => {
  const parent = parentBranch(HERO);

  it("no METRIC_LABELS / virtue tally renders on the parent branch (law 1); the shared-reading count stays", () => {
    expect(parent).not.toContain("METRIC_LABELS");
    expect(parent).not.toContain("METRIC_EMOJI");
    expect(parent).not.toContain("totalMetrics");
    expect(parent).toContain('t("elev.stories.counts.stories", { n: runs.length })');
  });

  it("the grown-up insight sits under the cover title and before Play, in uiLang", () => {
    const cover = parent.slice(parent.indexOf('data-module="stories-tonight"'), parent.indexOf("</section>", parent.indexOf('data-module="stories-tonight"')));
    const insight = cover.indexOf('data-testid="stories-tonight-insight"');
    expect(insight).toBeGreaterThan(cover.indexOf("tonightStory.titleHe"));
    expect(insight).toBeLessThan(cover.indexOf('t("elev.stories.tonight.cta")'));
    expect(cover).toContain('uiLang === "he" ? tonightStory.parentInsight.he : tonightStory.parentInsight.en');
    // The reader's insight block reads uiLang too (it is chrome, not story text).
    expect(HERO).toContain('uiLang === "he" ? activeStory.parentInsight.he : activeStory.parentInsight.en');
    expect(HERO).not.toContain('aiLang === "he" ? activeStory.parentInsight.he');
  });

  it("pack filter + catalogue sit in ONE collapsed disclosure, demoted (R25)", () => {
    const details = parent.indexOf('<details data-module-disclosure="stories-more"');
    const close = parent.indexOf("</details>", details);
    expect(details).toBeGreaterThan(parent.indexOf('data-module="stories-tonight"'));
    const inside = parent.slice(details, close);
    expect(inside).toContain('<section data-module="stories-catalogue" data-module-demoted');
    expect(inside).toContain('role="tablist"');
    expect(inside).toContain('t("elev.stories.more")');
    expect((parent.match(/data-module-disclosure=/g) || []).length).toBe(1);
    // The hero-first gate is never collapsed away.
    expect(parent.indexOf('data-testid="hero-first-gate"')).toBeLessThan(details);
  });

  it("no comic register token or .comic-panel on the parent branch (kit tokens only)", () => {
    // The parent door only — the player view below it (coverPage onward) is the book itself.
    const door = parent.slice(0, parent.indexOf("const coverPage = (immersiveMode: boolean)"));
    expect(door.length).toBeGreaterThan(2000);
    expect(door).not.toMatch(/var\(--comic-/);
    expect(door).not.toContain("comic-panel");
  });

  it("negative control: the pre-fix tally line is what the rule rejects", () => {
    const preFix = '{METRIC_LABELS[m]} {totalMetrics[m]}';
    expect(preFix).toContain("METRIC_LABELS");
    expect(parent).not.toContain(preFix);
  });
});
