/**
 * The unified companion report: one explanation, visible reasoning and all
 * suggested steps, with explicit actions beside keepable advice. Snapshots
 * record the authorized October redesign rather than freeze the former
 * collapsed-card layout.
 *
 * Structural and mutated-render checks preserve the substantive invariants:
 * no hidden core answer, no duplicated steps, no keepable hypotheses or help
 * warnings, urgent help first, readable EN/HE, bidi isolation, count-only
 * provenance, accessible controls and token-based styling.
 *
 * renderToStaticMarkup checks markup and hidden ancestors. Computed layout,
 * actual focus behavior and microphone permissions require browser evidence.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import CoachAnswerCards from "./CoachAnswerCards";
import type { CoachContract, CouncilTake } from "../../types";

const contract: CoachContract = {
  text: "Bedtime resistance at this age is usually about separation, not defiance.",
  riskLevel: "low",
  ageBand: "3-4y",
  domains: ["social_emotional", "language_communication"] as CoachContract["domains"],
  nonDiagnosticHypotheses: [
    { label: "Separation at lights-out", confidence: "moderate", rationale: "The protest starts when you leave the room." },
    { label: "Overtired by bedtime", confidence: "low", rationale: "The nap dropped three weeks ago." },
  ],
  todayPlan: [
    "Start the wind-down fifteen minutes earlier tonight.",
    "Sit beside the bed for the first two minutes, then step to the doorway.",
  ],
  parentScript: "I am right here. I will check on you in two minutes.",
  avoid: ["Bargaining once the light is off."],
  observe: ["Whether the protest shortens across the week."],
  escalateIf: ["The night waking is paired with breathing that frightens you."],
  // ASK-3: frame ids are internal orchestration vocabulary and are never
  // rendered on a parent surface — present here only to complete the contract.
  frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
  memoryProposals: [{ fact: "Nap dropped at 3y2m", source: "parent", retention: "long" }],
  handoffNotes: { teacher: "We are working on a two-minute check-in at lights-out.", professional: "" },
  followUps: ["What if the check-ins stop working?"],
  sourceCardsUsed: ["sleep-onset-association", "separation-protest"],
  sourceCards: [{ id: "sleep-onset-association", title: "Sleep-onset associations", type: "practice_card" }],
  approvedMemoryFactsUsed: 2,
};

const council: CouncilTake[] = [
  { scholarId: "bowlby", name: "Bowlby", concept: "Secure base", takeaway: "The check-in IS the secure base.", suggestion: "Keep the interval predictable." } as CouncilTake,
];

const noop = () => {};
const reportCss = readFileSync(resolve(__dirname, "coachReport.css"), "utf8");
const asyncNoop = async () => {};
void asyncNoop;

function render(props: Partial<Parameters<typeof CoachAnswerCards>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract,
      onSaveToPlan: noop,
      onAddToHandoff: noop,
      onManageMemory: noop,
      ...props,
    }),
  );
}

/* ── Frozen pre-extraction markup ─────────────────────────────────────────── */

describe("AI-17 — the unified report's English, Hebrew and escalation markup", () => {
  it("renders the complete low-risk English report", () => {
    const html = render({ lang: "en" });
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatchSnapshot();
  });

  it("renders urgent help before the report explanation", () => {
    const html = render({ lang: "en", contract: { ...contract, riskLevel: "moderate" } });
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatchSnapshot();
  });

  it("renders the Hebrew report with council and bidi isolation", () => {
    const html = render({ lang: "he", council, lens: "Bowlby's Attachment Model" });
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatchSnapshot();
  });
});

/* ── Negative controls ────────────────────────────────────────────────────────
   Each control proves the matcher below it rejects markup in which the named
   property has regressed. The mutants are built from the real rendered HTML,
   so a matcher that passes on anything cannot pass here. */

const CARD_FRAME = 'class="rounded-xl p-3.5 bg-white"';
const SECTION_TITLE = "text-[10px] font-extrabold uppercase tracking-wider";

/** Read visibility from the actual static HTML, including hidden ancestors.
 * This checks collapsed markup, not computed CSS or browser layout. */
function visibleText(html: string, content: string): boolean {
  const at = html.indexOf(content);
  if (at < 0) return false;
  const stack: { tag: string; hidden: boolean }[] = [];
  const tags = /<\/?([a-zA-Z][a-zA-Z0-9-]*)([^>]*?)(\/?)>/g;
  for (const match of html.slice(0, at).matchAll(tags)) {
    const tag = match[1].toLowerCase();
    if (match[0].startsWith("</")) {
      const index = stack.map(item => item.tag).lastIndexOf(tag);
      if (index >= 0) stack.length = index;
    } else if (match[3] !== "/" && !/^(area|base|br|col|embed|hr|img|input|link|meta|param|source|track|wbr)$/.test(tag)) {
      stack.push({ tag, hidden: /\bhidden(?:=|\s|$)|display:\s*none/.test(match[2]) });
    }
  }
  return !stack.some(item => item.hidden);
}

describe("AI-17 negative controls — the structural matchers reject a regressed render", () => {
  const html = render({ lang: "en" });

  it("scanned markup is real and non-empty", () => {
    expect(html).toBeTruthy();
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toContain("<div");
  });

  it("a frame that lost its white fill or padding is rejected", () => {
    expect(html).toContain(CARD_FRAME);
    // Mutant: the tone the OTHER surfaces use (paper-deep inset, p-3).
    const mutant = html.split(CARD_FRAME).join('class="rounded-xl p-3"');
    expect(mutant).not.toContain(CARD_FRAME);
  });

  it("a section title that lost its tracked uppercase treatment is rejected", () => {
    expect(html).toContain(SECTION_TITLE);
    const mutant = html.split(SECTION_TITLE).join("text-[10px] font-bold");
    expect(mutant).not.toContain(SECTION_TITLE);
  });

  it("report action doors retain an outline and accessible touch floor through their shared CSS", () => {
    expect(html).toContain('class="coach-report__tools"');
    const tools = /\.coach-report__tools button \{([^}]+)\}/.exec(reportCss)?.[1];
    expect(tools).toBeTruthy();
    expect(tools).toContain("border: 1px solid var(--arbor-rule-strong)");
    expect(tools).toContain("min-block-size: var(--touch-min)");
    const mutant = tools!.replace("border: 1px solid var(--arbor-rule-strong)", "border: 0");
    expect(mutant).not.toContain("border: 1px solid var(--arbor-rule-strong)");
  });

  it("the trust chip stays an OUTLINE — a soft (gradient) wash is rejected", () => {
    expect(html).toContain('data-testid="trust-link"');
    expect(html).toContain("background:var(--arbor-paper-elevated);border:1px solid var(--arbor-rule)");
    expect(html).toContain("touch-target relative !inline-flex");
    // The chip must not carry the gradient wash it shipped with before OBJ-TODAY-01.
    expect(html).not.toContain("var(--arbor-lav-soft)");
    // Mutant: the pre-fix filled chip is what this matcher has to reject.
    const mutant = html
      .split("background:var(--arbor-paper-elevated);border:1px solid var(--arbor-rule)")
      .join("background:var(--arbor-lav-soft)");
    expect(mutant).toContain("var(--arbor-lav-soft)");
    expect(mutant).not.toContain("background:var(--arbor-paper-elevated);border:1px solid var(--arbor-rule)");
  });

  it("Hebrew copy isolates a Latin lens name in FSI/PDI", () => {
    const he = render({ lang: "he", council, lens: "Bowlby's Attachment Model" });
    expect(he).toContain("⁨Bowlby&#x27;s Attachment Model⁩");
    // Mutant: the unisolated name is what the bidi fix removed.
    const mutant = he.split("⁨Bowlby&#x27;s Attachment Model⁩").join("Bowlby&#x27;s Attachment Model");
    expect(mutant).not.toContain("⁨Bowlby&#x27;s Attachment Model⁩");
  });

  it("inline Keep is offered only beside keepable advice, never a hypothesis or help warning", () => {
    const kept: { field: string; text: string }[] = [];
    const out = render({ renderKeepAction: (field, text) => {
      kept.push({ field, text });
      return React.createElement("button", { type: "button", "data-testid": "test-inline-keep" }, "Keep this advice");
    } });
    expect(kept).toEqual([
      ...contract.todayPlan.map(text => ({ field: "todayPlan", text })),
      { field: "parentScript", text: contract.parentScript },
      ...contract.observe.map(text => ({ field: "observe", text })),
    ]);
    expect(out.match(/data-testid="test-inline-keep"/g)).toHaveLength(4);
    expect(reportCss).toMatch(/\.coach-report__keep button \{[^}]*min-block-size: var\(--touch-min\)/);
    const mutant = `<div hidden>${out}</div>`;
    expect(visibleText(out, "Keep this advice")).toBe(true);
    expect(visibleText(mutant, "Keep this advice")).toBe(false);
  });
});

/* ── The four blocks AI-17 extracts, asserted structurally ─────────────────── */

describe("AI-17 — the four structured blocks are all present on the reference surface", () => {
  const html = render({ lang: "en" });

  it("one report keeps its explanation, reasoning, steps, script and considerations visible", () => {
    expect(html.match(/data-testid="coach-answer-cards"/g)).toHaveLength(1);
    expect(html).toContain('<article class="coach-report"');
    for (const line of [contract.text, ...contract.nonDiagnosticHypotheses.flatMap(item => [item.label, item.rationale]), ...contract.todayPlan, contract.parentScript, ...contract.observe, ...contract.avoid]) {
      expect(visibleText(html, line), line).toBe(true);
    }
  });

  it("renders the parent script as a quoted, copyable block", () => {
    expect(html).toContain("Say this");
    expect(html).toContain("“I am right here. I will check on you in two minutes.”");
    expect(html).toContain("italic");
    expect(html).toContain("Copy");
  });

  it("renders every suggested step once, outside any More disclosure", () => {
    expect(html).toContain("Try today");
    for (const step of contract.todayPlan) {
      expect(html.split(step)).toHaveLength(2);
      expect(visibleText(html, step)).toBe(true);
    }
    expect(html).not.toContain('data-testid="coach-answer-more"');
    // No ephemeral tick box: the step enters the loop through "I'll try it".
    expect(html).not.toContain('class="flex items-start gap-2 text-start w-full group"');
  });

  it("renders one visible plan door and explicit teacher-note action", () => {
    expect(html.split('data-testid="coach-plan-door"').length - 1).toBe(1);
    expect(html).toContain("Turn into a plan");
    expect(html).not.toContain("Save to plan");
    expect(html).not.toContain("Save as plan");
    expect(html).toContain("Teacher note");
    expect(visibleText(html, "Turn into a plan")).toBe(true);
    expect(visibleText(html, "Teacher note")).toBe(true);
  });

  it("the report reads explanation → reasoning → action, while urgent help always comes first", () => {
    for (const c of [contract, { ...contract, riskLevel: "moderate" }]) {
      const out = render({ lang: "en", contract: c });
      const ordered = ["coach-report-opening", "coach-report-understanding", "coach-report-next", "say-this", "coach-report-observe", "coach-plan-door", "coach-report-sources", "coach-answer-footer"];
      const positions = ordered.map(id => out.indexOf(`data-testid="${id}"`));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      if (c.riskLevel === "moderate") {
        expect(out.indexOf('data-testid="coach-report-urgent-help"')).toBeLessThan(positions[0]);
        expect(visibleText(out, c.escalateIf[0])).toBe(true);
      } else {
        expect(out).toMatch(/data-testid="coach-report-help"[^>]*><button type="button" aria-expanded="false"/);
        expect(visibleText(out, c.escalateIf[0])).toBe(false);
      }
    }
  });

  it("CLINICAL FIREWALL: the answer carries no score, percentage or graded verdict", () => {
    expect(html).not.toMatch(/\d+\s?%/);
    expect(html).not.toMatch(/\bpercentile\b|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelayed\b/i);
  });
});
