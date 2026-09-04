/**
 * AI-17 — the three markdown walls fed by POST /api/explain.
 *
 * The route returns TWO structured fields. All three consuming surfaces used
 * to glue them into a markdown string with a manufactured "### Try today"
 * heading and hand that string to a markdown parser, which turned the heading
 * back into a heading. The structure was thrown away and re-derived, and the
 * step the parent is meant to DO arrived as one more paragraph of prose.
 *
 * Two kinds of rule live here:
 *   1. a RENDER check on the shared block, and
 *   2. a SOURCE scan proving no surface re-introduces the flattener.
 *
 * The source scan strips comments first, so prose ABOUT the rule (including
 * the paragraph above) can never be mistaken for the code it forbids, and
 * every extraction is asserted non-empty before it is judged. Each rule has a
 * negative control built from the verbatim pre-change source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { ExplainAnswerBlock } from "./ExplainAnswer";
import { explainAnswerText, isEmptyExplainAnswer, type ExplainAnswer } from "../../lib/explainAnswer";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = path.join(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC_ROOT, rel), "utf8").replace(/\r\n/g, "\n");

/** Drop comments so prose about the rule cannot trip the scans below. */
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

/** The three surfaces that consume the explain route. */
const SURFACES = [
  "components/tabs/MilestonesTab.tsx",
  "components/tabs/BehaviorsTab.tsx",
  "context/ArborContext.tsx",
] as const;

/** The flattener, verbatim from the pre-change source of all three surfaces. */
const OLD_FLATTENER =
  '    [r.explanation, r.tryToday ? `### ${t("explain.tryToday")}\\n${r.tryToday}` : ""].filter(Boolean).join("\\n\\n");';
const OLD_WALL = "                <MarkdownBlock text={inlineCoRegulationScripts[log.id]} className=\"space-y-1.5\" />";

/**
 * A manufactured heading glued in front of the try-today step. Deliberately
 * narrow: other surfaces legitimately build markdown notices with headings
 * (the paywall message, for one). What AI-17 forbids is re-flattening THIS
 * payload — a heading template that carries the step.
 */
const FLATTEN_RE = /`###[^`]*\$\{[^`]*tryToday/;

describe("AI-17 negative controls — the scans reject the pre-change source", () => {
  it("the extracted fixtures are real and non-empty", () => {
    expect(OLD_FLATTENER).toBeTruthy();
    expect(OLD_WALL).toBeTruthy();
    expect(stripComments(OLD_FLATTENER)).toBe(OLD_FLATTENER);
  });

  it("the flattener matcher catches the old glue code", () => {
    expect(FLATTEN_RE.test(OLD_FLATTENER)).toBe(true);
  });

  it("the matcher is narrow enough to spare an unrelated markdown notice", () => {
    const paywall = 'text: `### ${t("coach.paywall.title")}\\n${t("coach.paywall.body")}`';
    expect(paywall).toMatch(/`###/);
    expect(FLATTEN_RE.test(paywall)).toBe(false);
  });

  it("the text form still has exactly ONE home, so the rule is one place not zero", () => {
    const lib = read("lib/explainAnswer.ts");
    expect(lib.length).toBeGreaterThan(500);
    expect(FLATTEN_RE.test(stripComments(lib))).toBe(true);
  });

  it("the wall matcher catches the old markdown render", () => {
    expect(OLD_WALL).toMatch(/<MarkdownBlock text=\{inlineCoRegulationScripts/);
  });

  it("comment stripping is what makes the scan honest", () => {
    // A comment that merely NAMES the forbidden pattern must not read as code.
    const commented = "// we no longer build `### ${label}\\n${r.tryToday}` strings\nconst ok = 1;";
    expect(FLATTEN_RE.test(commented)).toBe(true);
    expect(FLATTEN_RE.test(stripComments(commented))).toBe(false);
  });
});

describe("AI-17 — no surface re-flattens the explain route into markdown", () => {
  for (const rel of SURFACES) {
    it(`${rel} keeps the two fields as fields`, () => {
      const raw = read(rel);
      expect(raw.length, `${rel} is empty or unreadable`).toBeGreaterThan(1000);
      const code = stripComments(raw);
      expect(code.length).toBeGreaterThan(500);
      expect(code, `${rel} rebuilds a markdown heading`).not.toMatch(FLATTEN_RE);
    });
  }

  it("the co-regulation script is no longer a markdown wall", () => {
    const code = stripComments(read("components/tabs/BehaviorsTab.tsx"));
    expect(code).not.toMatch(/<MarkdownBlock text=\{inlineCoRegulationScripts/);
    expect(code).toMatch(/<ExplainAnswerBlock answer=\{inlineCoRegulationScripts\[log\.id\]\}/);
  });

  it("both milestone answers are no longer markdown walls", () => {
    const code = stripComments(read("components/tabs/MilestonesTab.tsx"));
    expect(code).not.toMatch(/<MarkdownBlock text=\{explanations\[item\.id\]\}/);
    expect(code).not.toMatch(/<MarkdownBlock text=\{milestoneAnalysisOfGaps\}/);
    expect(code).toMatch(/<ExplainAnswerBlock answer=\{explanations\[item\.id\]\}/);
    expect(code).toMatch(/<ExplainAnswerBlock answer=\{milestoneAnalysisOfGaps\}/);
  });

  it("the deterministic escalation copy STILL routes through the markdown renderer", () => {
    // Not a wall: it is safety copy whose bare helpline numbers only become
    // tap targets because MarkdownBlock links them. Converting it would break
    // a call button for a parent in crisis.
    const code = stripComments(read("components/tabs/BehaviorsTab.tsx"));
    expect(code).toMatch(/<MarkdownBlock text=\{escalationMarkdown\}/);
  });
});

/* ── The shared text form ─────────────────────────────────────────────────── */

const answer: ExplainAnswer = {
  explanation: "Bedtime resistance at this age is usually about separation.",
  tryToday: "Sit beside the bed for the first two minutes.",
};

describe("AI-17 — the text form a parent keeps is unchanged", () => {
  it("reproduces the markdown these surfaces used to store, byte for byte", () => {
    expect(explainAnswerText(answer, "Try today")).toBe(
      "Bedtime resistance at this age is usually about separation.\n\n### Try today\nSit beside the bed for the first two minutes.",
    );
  });

  it("omits the heading entirely when there is no step", () => {
    expect(explainAnswerText({ explanation: "Just prose.", tryToday: "" }, "Try today")).toBe("Just prose.");
  });

  it("negative control: a dropped field changes the kept text", () => {
    expect(explainAnswerText(answer, "Try today")).not.toBe(explainAnswerText({ ...answer, tryToday: "" }, "Try today"));
  });

  it("an answer with nothing in it is a failure, never guidance", () => {
    expect(isEmptyExplainAnswer({ explanation: "   ", tryToday: "" })).toBe(true);
    expect(isEmptyExplainAnswer(null)).toBe(true);
    expect(isEmptyExplainAnswer(answer)).toBe(false);
    expect(isEmptyExplainAnswer({ explanation: "", tryToday: "one step" })).toBe(false);
  });
});

/* ── The shared render ────────────────────────────────────────────────────── */

const render = (a: ExplainAnswer) =>
  renderToStaticMarkup(React.createElement(ExplainAnswerBlock, { answer: a, tryTodayLabel: "Try today" }));

describe("AI-17 — the explain answer renders as structure, not a wall", () => {
  const html = render(answer);

  it("renders the step in the same framed block the coach answer uses", () => {
    expect(html).toContain('<div class="rounded-xl p-3.5 bg-white"');
    expect(html).toContain("Try today");
    expect(html).toContain(answer.tryToday);
  });

  it("makes the step tickable, exactly as the coach today-plan is", () => {
    expect(html).toContain('class="flex items-start gap-2 text-start w-full group"');
  });

  it("leaves the explanation as prose, because it IS prose", () => {
    expect(html).toContain(answer.explanation);
    // No manufactured heading is rendered around the prose half.
    expect(html.split("Try today").length - 1).toBe(1);
  });

  it("renders a prose-only answer with no empty step block", () => {
    const proseOnly = render({ explanation: "Just prose.", tryToday: "" });
    expect(proseOnly).toContain("Just prose.");
    expect(proseOnly).not.toContain("Try today");
    expect(proseOnly).not.toContain("rounded-xl p-3.5");
  });

  it("negative control: the framed step is what distinguishes the two renders", () => {
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(300);
    expect(render({ explanation: answer.explanation, tryToday: "" })).not.toBe(html);
  });

  it("CLINICAL FIREWALL: nothing here grades the child", () => {
    expect(html).not.toMatch(/\d+\s?%/);
    expect(html).not.toMatch(/\bpercentile\b|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelayed\b/i);
  });
});
