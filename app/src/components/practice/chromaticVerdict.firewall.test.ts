import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

/**
 * Clinical firewall — no CHROMATIC VERDICT on a parent surface.
 *
 * The standing rule is that parent surfaces never render scores as judgements:
 * no verdict tags, no weakest-domain pointers, and never a colour that means
 * "good" or "bad" about the child.
 *
 * The existing firewall test (DevelopmentCopilot.firewall.test.ts) reads two
 * named files. That is why this shipped: SpeechCoachTab rendered a practice
 * accuracy whose colour flipped at 70% — clay above, yellow below — in both a
 * chip and a progress bar, on the parent-register Practice Studio, for months.
 * Every leak so far has lived off the fixed file list, so this guard scans the
 * whole component tree instead of naming files.
 *
 * What it bans: a ternary whose CONDITION compares a numeric-looking identifier
 * against a threshold and whose BRANCHES are two different colour tokens. That
 * is the exact shape of a graded verdict. A single accent at every value, or a
 * colour chosen by category rather than by score, both pass.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const componentsRoot = path.join(here, "..");

const listTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((entry) => {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) return listTsx(full);
    return /\.tsx$/.test(entry) && !/\.test\.tsx$/.test(entry) ? [full] : [];
  });

/**
 * `<numeric-ish> >=|>|<=|< <number> ? <colour> : <colour>` — the two branches
 * must be DIFFERENT colour tokens, so a ternary that picks the same colour, or
 * picks a width/label, does not trip.
 */
const COLOUR = String.raw`(?:"var\(--arbor-[\w-]+\)"|"#[0-9a-fA-F]{3,8}")`;
const CHROMATIC_VERDICT = new RegExp(
  String.raw`\b(\w*(?:accuracy|score|percent|pct|rate|progress|mastery|level)\w*)\s*(?:>=|<=|>|<)\s*\d+(?:\.\d+)?\s*\?\s*(${COLOUR})\s*:\s*(${COLOUR})`,
  "gi",
);

const offenders = listTsx(componentsRoot).flatMap((file) => {
  const src = readFileSync(file, "utf8");
  return [...src.matchAll(CHROMATIC_VERDICT)]
    .filter((m) => m[2] !== m[3])
    .map((m) => ({ file: path.relative(componentsRoot, file), snippet: m[0] }));
});

describe("clinical firewall — no score-thresholded colour on any component", () => {
  it("negative control: the regex catches the exact shapes that shipped", () => {
    const chip = `style={{ color: on ? "#fff" : st.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow-ink)" }}`;
    const bar = `background: s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-yellow)"`;
    expect([...chip.matchAll(CHROMATIC_VERDICT)].length).toBe(1);
    expect([...bar.matchAll(CHROMATIC_VERDICT)].length).toBe(1);
  });

  it("negative control: a single accent at every value is allowed", () => {
    const fixed = `background: "var(--arbor-clay)"`;
    const sameBothWays = `s.recentAccuracy >= 70 ? "var(--arbor-clay)" : "var(--arbor-clay)"`;
    expect([...fixed.matchAll(CHROMATIC_VERDICT)].length).toBe(0);
    expect(
      [...sameBothWays.matchAll(CHROMATIC_VERDICT)].filter((m) => m[2] !== m[3]).length,
    ).toBe(0);
  });

  it("the scan actually reaches the practice tree", () => {
    const files = listTsx(componentsRoot).map((f) => path.relative(componentsRoot, f).replace(/\\/g, "/"));
    expect(files).toContain("practice/SpeechCoachTab.tsx");
    expect(files.length).toBeGreaterThan(50);
  });

  it("no component grades a child with colour", () => {
    expect(
      offenders,
      `chromatic verdict(s):\n${offenders.map((o) => `  ${o.file}: ${o.snippet}`).join("\n")}`,
    ).toEqual([]);
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   KID-03 / KID-04 / GP-20 — the parent DRILL routes print no percentage.

   The chromatic guard above bans a colour that grades a child. It said nothing
   about the number itself, which is why three parent surfaces still printed one
   the moment a family had data (all three are invisible against the empty seed,
   which is how the Wave T pass missed them):
     #/speech   "P 83%" on the sound chip, "recent 83%" + a width:83% fill bar,
                and an up/down trend glyph coloured pink on "down";
     #/feelings "100% Recognition" in a stat bubble;
     #/language "100% … in Hebrew, 0% in English" plus a role=progressbar whose
                aria-valuenow re-published the same share to a screen reader.

   Law 1 allows counts on a parent surface and nothing else. This guard pins the
   four drill files at zero for: a percentage interpolated from a performance
   identifier, a trend glyph, and the progressbar role (which is how a removed
   percentage comes back as an accessible-name percentage).
   ═════════════════════════════════════════════════════════════════════════ */

const DRILL_FILES = [
  "practice/SpeechCoachTab.tsx",
  "practice/FeelingsLabTab.tsx",
  "../components/tabs/LanguageLabVocabView.tsx",
  "../components/tabs/LanguageLabTab.tsx",
  // B-GROWTH-30 — the record by area (spine §9: the guard covers it before it renders)
  "growth/RecordByDomain.tsx",
] as const;

/** `{…accuracy…}%` / `{…pct…}%` / `{…percent…}%` — a rendered performance share. */
const PERF_PERCENT = /\{[^}]*(accuracy|pct|percent)[^}]*\}%/gi;
/** An up/down trend glyph: a delta verdict wearing an icon. */
const TREND_GLYPH = /trending_(up|down)/g;
/** The progressbar role — aria-valuenow is a percentage by definition. */
const PROGRESSBAR_ROLE = /role=["'{\s]*["']?progressbar/g;

const readDrill = (rel: string): string =>
  readFileSync(path.join(componentsRoot, rel), "utf8");

describe("clinical firewall — parent drill routes report counts, never percentages", () => {
  it("negative control: the regexes catch the exact strings that shipped", () => {
    // SpeechCoachTab.tsx:378 before the fix, and its progress row + trend icon.
    const chip = '<span className="text-[11px] font-bold" style={{ color: on ? "#fff" : "var(--arbor-clay)" }}>{st.recentAccuracy}%</span>';
    const bar = 'style={{ width: `${s.recentAccuracy}%`, background: "var(--arbor-clay)" }}';
    const feelings = 'value={emotionAccuracy === null ? "–" : `${emotionAccuracy}%`}';
    const language = 'style={{ width: `${pct}%`, background: langColor(idx) }}';
    for (const shipped of [chip, bar, feelings, language]) {
      expect([...shipped.matchAll(PERF_PERCENT)].length, shipped).toBeGreaterThan(0);
    }
    const icon = 'const trendIconName = s.trend === "up" ? "trending_up" : s.trend === "down" ? "trending_down" : "remove";';
    expect([...icon.matchAll(TREND_GLYPH)].length).toBe(2);
    expect([...'role="progressbar"'.matchAll(PROGRESSBAR_ROLE)].length).toBe(1);
  });

  it("negative control: a count, a dose bar and a category colour all pass", () => {
    const count = "<span>{st.attempts}</span>";
    // The parent's OWN session dose (trials today / target) is not a child grade.
    const dose = "style={{ width: `${Math.min(100, Math.round((dose.trialsToday / dose.perSessionTarget) * 100))}%` }}";
    for (const ok of [count, dose]) {
      expect([...ok.matchAll(PERF_PERCENT)].length, ok).toBe(0);
      expect([...ok.matchAll(TREND_GLYPH)].length, ok).toBe(0);
    }
  });

  it("the drill files are all readable (sanity — a renamed file must fail loudly)", () => {
    for (const rel of DRILL_FILES) expect(readDrill(rel).length).toBeGreaterThan(500);
  });

  it("no drill file renders a performance percentage, trend glyph or progressbar", () => {
    const violations: string[] = [];
    for (const rel of DRILL_FILES) {
      const src = readDrill(rel)
        // Comments explain the removed shape; they render nothing.
        .replace(/\/\*[\s\S]*?\*\//g, "")
        .replace(/\/\/.*$/gm, "");
      for (const [re, id] of [
        [PERF_PERCENT, "performance %"],
        [TREND_GLYPH, "trend glyph"],
        [PROGRESSBAR_ROLE, "progressbar role"],
      ] as const) {
        for (const m of src.matchAll(re)) violations.push(`${rel} — ${id}: ${m[0]}`);
      }
    }
    expect(
      violations,
      `parent drill route grades the child:\n${violations.join("\n")}`,
    ).toEqual([]);
  });
});

/* B-GROWTH-09 — the Milestones "Gentle watch points" box sat on a yellow wash
   with a yellow-ink eye icon: a chromatic verdict on the child's open items.
   It now takes the Screening monitoring card's paper + muted treatment, and
   its copy names the parent's own answers, never "typically seen by now". */
describe("clinical firewall — ms-watch-points carries no verdict colour or norm claim", () => {
  const ms = readFileSync(path.join(componentsRoot, "tabs", "MilestonesTab.tsx"), "utf8");
  const start = ms.indexOf('data-testid="ms-watch-points"');
  const block = ms.slice(start, ms.indexOf("</div>", ms.indexOf("{t(\"ms.watch.close\")}", start)));

  // P5-LOOP c2 r1: the panel is gone from the map altogether (stronger than a
  // neutral wash); no yellow/peach token re-enters the milestones route.
  it("the block is gone (no watch wash of any colour can return with it)", () => {
    expect(start).toBe(-1);
    expect(block).toBe("");
    expect(ms).not.toContain('t("ms.watch.close")');
  });

  it("no ms.watch.* string claims a norm (EN \"typically seen by now\" / HE \"בדרך כלל עד גיל זה\")", async () => {
    const { en, he } = await import("../../lib/i18n");
    const bad = [
      ...Object.entries(en).filter(([k, v]) => k.startsWith("ms.watch.") && /typically seen by now/i.test(v)),
      ...Object.entries(he).filter(([k, v]) => k.startsWith("ms.watch.") && /בדרך כלל עד גיל זה/.test(v)),
    ];
    expect(bad).toEqual([]);
  });

  it("NEGATIVE CONTROL — the pre-fix wash trips the token scan", () => {
    const pre = '<div data-testid="ms-watch-points" style={{ background: "var(--arbor-yellow-soft)" }}>';
    expect(/--arbor-(yellow|peach)-/.test(pre)).toBe(true);
  });
});

/* B-PLAY-07 — Speech becomes a co-play guide. Records the override of FU#30/31
   ("the guard passes the dose bar deliberately"): on #/speech the parent is the
   listener, so the 0/50 dose bar and the accuracy-steered sound picker go. */
describe("B-PLAY-07 · the Speech parent page is a co-play guide, not a meter", () => {
  const speech = readDrill("practice/SpeechCoachTab.tsx")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/\/\/.*$/gm, "");
  const parent = speech.slice(speech.indexOf("if (!kidMode) {"), speech.indexOf("data-module=\"speech-more\""));

  it("the parent branch was found", () => {
    expect(parent.length).toBeGreaterThan(2000);
    expect(parent).toContain('data-primary-move="complete-speech-round"');
  });

  it("no dose-fill arithmetic and no width-percentage style on the parent branch", () => {
    expect(parent).not.toContain("perSessionTarget) * 100");
    expect(parent).not.toMatch(/width:\s*`[^`]*%`/);
  });

  it("recentAccuracy is never read — the next sound is the least-practised by attempt count", () => {
    expect(speech).not.toMatch(/recentAccuracy/);
    expect(speech).toMatch(/const tries = new Map\(data\.stats\.map\(\(s\) => \[s\.sound, s\.attempts\]\)\);/);
    expect(speech).toMatch(/\(tries\.get\(s\.id\) \?\? 0\) < \(tries\.get\(best\.id\) \?\? 0\)/);
  });

  it("the say-it-together card and scoring row follow the header; the guide line, then the picker", () => {
    const primary = parent.indexOf('data-primary-move="complete-speech-round"');
    const together = parent.indexOf('data-testid="speech-together"');
    const picker = parent.indexOf('t("prac.speech.studio.title")');
    expect(primary).toBeGreaterThan(-1);
    expect(together).toBeGreaterThan(primary);
    expect(picker).toBeGreaterThan(together);
  });

  it("the ASHA evidence chip stays with 'About 5 minutes together is plenty' (EN + HE); no mint/yellow reps verdict", async () => {
    const { translate } = await import("../../lib/i18n");
    expect(parent).toContain('t("prac.speech.together.line")');
    expect(parent).toContain('t("prac.speech.evidence.chip")');
    expect(parent).not.toMatch(/dose\.sessionMetToday \? "mint" : "yellow"/);
    expect(parent).not.toContain('t("prac.speech.dose.weekCount"');
    expect(translate("en", "prac.speech.together.line")).toBe("About 5 minutes together is plenty");
    for (const key of ["prac.speech.together.line", "prac.speech.evidence.chip"]) {
      expect(/[\u0590-\u05FF]/.test(translate("he", key)), key).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the pre-change bar and picker trip the bans", () => {
    const bar = "style={{ width: `${Math.min(100, Math.round((dose.trialsToday / dose.perSessionTarget) * 100))}%` }}";
    expect(bar).toContain("perSessionTarget) * 100");
    expect(bar).toMatch(/width:\s*`[^`]*%`/);
    expect("candidates.find((s) => (practiced.get(s.id)?.recentAccuracy ?? 0) < 80)").toMatch(/recentAccuracy/);
  });
});
