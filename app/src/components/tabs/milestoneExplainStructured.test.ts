/**
 * GP-23 — the two AI answers a parent reads WHILE marking milestones.
 *
 * "Explain" and "Find next steps" were the least structured AI in the app, on
 * the surface where structure matters most: raw markdown through MarkdownBlock,
 * a hard-coded ENGLISH failure string ("### Unavailable\nCould not load
 * guidance right now.") rendered as if it were guidance, no statement of what
 * the answer was written from, no door to the Trust Center, and nothing the
 * parent could keep. Law 4 asks for structure + provenance + one-tap keep, and
 * every seam already existed: ContentActionBar (why + trustLink + the canonical
 * `save` verb) and the `insights` record behind keepBehaviorInsight.
 *
 * SOURCE scan (`environment: "node"`). \r\n is normalised first, every
 * extraction is asserted truthy before it is judged, and each rule carries a
 * negative control built from the pre-change source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translate } from "../../lib/i18n";

const here = path.dirname(fileURLToPath(import.meta.url));
const app = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(app, rel), "utf8").replace(/\r\n/g, "\n");

const SRC = read("components/tabs/MilestonesTab.tsx");

/** The ContentActionBar mounted for one surface tag. */
function actionBar(src: string, surface: string): string {
  const m = src.match(new RegExp(`<ContentActionBar[\\s\\S]{0,900}?surface="${surface}"[\\s\\S]{0,900}?\\n\\s*/>`));
  return m ? m[0] : "";
}

/* ── Pre-change source, verbatim from the audit ────────────────────────────── */
const OLD_EXPLAIN_RENDER = `            <div className="mt-2 p-3 rounded-xl text-[11px] leading-relaxed select-text" style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}>
              <MarkdownBlock text={explanations[item.id]} className="space-y-1.5" />
            </div>`;
const OLD_GAPS_RENDER = `            <MarkdownBlock text={milestoneAnalysisOfGaps} className="space-y-2" />
            <div className="pt-2.5 flex justify-end" style={{ borderTop: "1px solid var(--arbor-rule)" }}>
              <button type="button" onClick={() => seedCoach({ prompt: t("seed.milestoneGaps") })}>
                {t("ms.discussCoach")}
              </button>
            </div>`;
const OLD_ERROR_LINE = '      setExplanations((p) => ({ ...p, [item.id]: "### Unavailable' + String.fromCharCode(92) + 'nCould not load guidance right now." }));';

describe("GP-23 negative controls — the matchers reject the pre-change source", () => {
  it("the old explain render has no action bar at all", () => {
    expect(OLD_EXPLAIN_RENDER).toBeTruthy();
    expect(actionBar(OLD_EXPLAIN_RENDER, "milestone-explain")).toBe("");
  });
  it("the old gap-analysis render offers only the coach hand-off", () => {
    expect(OLD_GAPS_RENDER).toBeTruthy();
    expect(actionBar(OLD_GAPS_RENDER, "milestone-gaps")).toBe("");
    expect(OLD_GAPS_RENDER).not.toMatch(/verb: "save"/);
  });
  it("the old failure path wrote an English markdown heading into the answer", () => {
    expect(OLD_ERROR_LINE).toBeTruthy();
    expect(OLD_ERROR_LINE).toMatch(/### Unavailable/);
    expect(OLD_ERROR_LINE).not.toMatch(/setExplainFailed/);
  });
});

describe("GP-23 — the inline explainer is structured, sourced and keepable", () => {
  const bar = actionBar(SRC, "milestone-explain");

  it("mounts the shared action cluster", () => {
    expect(bar, "no ContentActionBar for milestone-explain").toBeTruthy();
    expect(SRC).toContain('from "../ui/ContentActionBar"');
  });

  it("states what the answer was written from, with a door to the Trust Center", () => {
    expect(bar).toMatch(/\bwhy=/);
    expect(bar).toMatch(/\btrustLink\b/);
    expect(bar).toMatch(/elev\.waveR\.ms\.explain\.why/);
  });

  it("offers ONE-tap Keep through the canonical save verb, into the insights record", () => {
    expect(bar).toMatch(/verb: "save"/);
    expect(bar).toMatch(/keepBehaviorInsight\(/);
    expect(SRC).toMatch(/keepBehaviorInsight,/); // destructured from the context
  });

  it("renders the structured /api/explain fields, not the chat route", () => {
    expect(SRC).toContain('fetch("/api/explain"');
    expect(SRC).not.toContain('fetch("/api/chat"');
    expect(SRC).toMatch(/data\?\.explanation/);
    expect(SRC).toMatch(/data\?\.tryToday/);
  });
});

describe("GP-23 — a failed answer is an honest, translated STATE", () => {
  it("no hard-coded English failure string survives", () => {
    expect(SRC).not.toMatch(/### Unavailable/);
    expect(SRC).not.toMatch(/Could not load guidance right now/);
  });

  it("the failure is tracked separately from the answer and rendered from i18n", () => {
    expect(SRC).toMatch(/const \[explainFailed, setExplainFailed\]/);
    expect(SRC).toMatch(/setExplainFailed\(\(p\) => \(\{ \.\.\.p, \[item\.id\]: true \}\)\);/);
    expect(SRC).toContain('data-testid="ms-explain-error"');
    expect(SRC).toContain('t("elev.waveR.ms.explain.error.title")');
    expect(SRC).toContain('t("elev.waveR.ms.explain.error.body")');
    expect(SRC).toContain('t("err.retry")');
  });

  it("an empty answer is treated as a failure, never rendered as guidance", () => {
    // AI-17 moved the emptiness rule into the shared, tested helper — the
    // guard is the same guard, applied to the structured answer.
    expect(SRC).toMatch(/if \(isEmptyExplainAnswer\(answer\)\) throw new Error\("empty"\);/);
    expect(SRC).toMatch(/isEmptyExplainAnswer.*from "\.\.\/\.\.\/lib\/explainAnswer"/);
  });
});

describe("GP-23 → B-GROWTH-12 — the gap analysis left with its analyzer", () => {
  it("no milestone-gaps action bar, no gap text derivation", () => {
    expect(actionBar(SRC, "milestone-gaps")).toBeFalsy();
    expect(SRC).not.toContain("gapsText");
  });
});

describe("GP-23 — CLINICAL FIREWALL on the new copy", () => {
  it("neither why-line grades the child", () => {
    const waveR = read("lib/i18nElevation/waveR.ts");
    expect(waveR).toBeTruthy();
    const lines = waveR.match(/"elev\.waveR\.(ms\.explain\.why|ms\.gaps\.why)"[\s\S]{0,240}?",/g) ?? [];
    expect(lines.length).toBeGreaterThanOrEqual(4); // en + he, both keys
    for (const line of lines) {
      expect(line).not.toMatch(/%|\bscore\b|\bpercentile\b|\bon[\s-]?track\b|\bbehind\b|\bdelay(ed)?\b/i);
    }
  });
});

/* B-GROWTH-12 — one "Ask Arbor about this" door replaces two AI doors: the
   "What to nurture next" analyzer (fixed "Vygotsky's Scaffolding" lens) and
   DevScoreCard's "Get ideas" CTA are gone; each milestone row and the Map's
   area pane seed the coach through ONE keyed seed with no fixed lens. */
describe("B-GROWTH-12 — one AI door per milestone", () => {
  const card = read("components/sections/DevScoreCard.tsx");
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");

  it("no fixed Vygotsky lens and no analyzer on #/milestones", () => {
    expect(SRC).not.toContain('lens: "Vygotsky\'s Scaffolding"');
    expect(code).not.toContain("handleGenerateMilestoneScaffold");
    expect(code).not.toContain('t("ms.findSteps")');
    expect(code).not.toContain('t("ms.nurtureNext")');
    expect(code).not.toContain("seed.milestoneGaps");
  });

  it("no 'Get ideas' CTA on the DevScore card", () => {
    expect(card).not.toContain('t("devscore.coach")');
    expect(card).not.toContain("seedCoach");
  });

  it("each milestone row carries exactly one Ask door (after Explain); the Map pane carries one", () => {
    expect((code.match(/data-testid="ms-ask-arbor"/g) ?? []).length).toBe(1);
    expect((code.match(/data-testid="ms-map-ask-arbor"/g) ?? []).length).toBe(1);
    expect(code.indexOf('data-testid="ms-ask-arbor"')).toBeGreaterThan(code.indexOf('t("ms.explain")'));
    // both seed through the one key, source milestone-ask, no lens
    const calls = code.split("seedCoach({").slice(1).map((c) => c.slice(0, c.indexOf("source:") + 40));
    expect(calls.length).toBe(2);
    for (const call of calls) {
      expect(call).toContain('t("seed.milestone.ask"');
      expect(call).toContain('source: "milestone-ask"');
      expect(call).not.toContain("lens");
    }
  });

  it("seed.milestone.ask and ms.askArbor exist in both languages; the HE seed is Hebrew", () => {
    for (const key of ["seed.milestone.ask", "ms.askArbor"]) {
      expect(translate("en", key)).not.toBe(key);
      expect(translate("he", key)).not.toBe(key);
    }
    const he = translate("he", "seed.milestone.ask", { title: "צוחקת בקול", name: "נועה", band: "6 חודשים" });
    expect(he).not.toMatch(/[A-Za-z]/);
    expect(he).toContain("צוחקת בקול");
    expect(translate("en", "seed.milestone.ask", { title: "Laughs", name: "Noa", band: "6 months" })).toContain("Laughs");
  });
});

