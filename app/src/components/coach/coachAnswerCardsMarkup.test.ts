/**
 * Structured answer hierarchy: urgent help, a short lead, the first action and
 * usable words lead. Optional depth and grouped secondary actions start closed;
 * their complete contents stay mounted once. Semantic assertions come before
 * snapshots, with mutated controls guarding visibility, linkage and flex width.
 *
 * Static markup cannot establish computed layout, actual keyboard/focus behavior,
 * scrolling or browser acceptance; those require separate interaction evidence.
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
const coachSource = readFileSync(resolve(__dirname, "../tabs/CoachTab.tsx"), "utf8");

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

/* Semantic assertions precede all three intentionally updated snapshots. */

describe("AI-17 — the unified report's English, Hebrew and escalation markup", () => {
  it("renders the complete low-risk English report", () => {
    const html = render({ lang: "en" });
    expect(html.length).toBeGreaterThan(2000);
    assertInitialHierarchy(html, contract);
    expect(html).toMatchSnapshot();
  });

  it("renders urgent help before the report explanation", () => {
    const html = render({ lang: "en", contract: { ...contract, riskLevel: "moderate" } });
    expect(html.length).toBeGreaterThan(2000);
    assertInitialHierarchy(html, { ...contract, riskLevel: "moderate" });
    expect(html).toMatchSnapshot();
  });

  it("renders the Hebrew report with council and bidi isolation", () => {
    const html = render({ lang: "he", council, lens: "Bowlby's Attachment Model" });
    expect(html.length).toBeGreaterThan(2000);
    assertInitialHierarchy(html, contract);
    expect(visibleText(html, council[0].takeaway)).toBe(false);
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
      stack.push({ tag, hidden: /(?:^|\s)hidden(?:=|\s|$)|display:\s*none/.test(match[2]) });
    }
  }
  return !stack.some(item => item.hidden);
}

const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const attribute = (tag: string, name: string): string | undefined => new RegExp(`(?:^|\\s)${name}="([^"]*)"`).exec(tag)?.[1];

/** Extract a complete static element, including nested elements of its kind. */
function elementWithAttribute(html: string, name: string, value: string): string {
  const tags = [...html.matchAll(/<([a-z][a-z0-9-]*)\b[^>]*>/g)];
  const start = tags.find(tag => attribute(tag[0], name) === value);
  if (!start) return "";
  const matcher = new RegExp(`<(/?)${start[1]}\\b[^>]*>`, "g");
  matcher.lastIndex = start.index!;
  let depth = 0;
  for (let tag = matcher.exec(html); tag; tag = matcher.exec(html)) {
    depth += tag[1] ? -1 : 1;
    if (!depth) return html.slice(start.index, matcher.lastIndex);
  }
  return "";
}
const section = (html: string, id: string) => elementWithAttribute(html, "data-testid", id);

function hasLinkedCollapsedPanel(markup: string): boolean {
  const button = /<button\b[^>]*>/.exec(markup)?.[0] ?? "";
  const buttonId = attribute(button, "id");
  const panelId = attribute(button, "aria-controls");
  if (!buttonId || !panelId || attribute(button, "type") !== "button" || attribute(button, "aria-expanded") !== "false") return false;
  const panel = elementWithAttribute(markup, "id", panelId);
  const panelTag = /^<[^>]*>/.exec(panel)?.[0] ?? "";
  return attribute(panelTag, "role") === "region" && attribute(panelTag, "aria-labelledby") === buttonId && /\shidden(?:=|\s|>)/.test(panelTag);
}

function assertInitialHierarchy(html: string, answer: CoachContract): void {
  expect(html.match(/data-testid="coach-answer-cards"/g)).toHaveLength(1);
  const first = section(html, "coach-report-next");
  expect(visibleText(first, escapeHtml(answer.todayPlan[0]))).toBe(true);
  expect(visibleText(html, escapeHtml(answer.parentScript))).toBe(true);
  for (const id of ["coach-report-opening", "coach-report-next", "say-this", "coach-report-understanding"]) expect(html.indexOf(`data-testid="${id}"`), id).toBeGreaterThan(-1);
  expect(html.indexOf('data-testid="coach-report-opening"')).toBeLessThan(html.indexOf('data-testid="coach-report-next"'));
  expect(html.indexOf('data-testid="coach-report-next"')).toBeLessThan(html.indexOf('data-testid="say-this"'));
  expect(html.indexOf('data-testid="say-this"')).toBeLessThan(html.indexOf('data-testid="coach-report-understanding"'));
  for (const value of [answer.text!, ...answer.todayPlan, answer.parentScript, ...answer.nonDiagnosticHypotheses.flatMap(item => [item.label, item.rationale]), ...answer.observe, ...answer.avoid]) {
    expect(html.split(escapeHtml(value)), value).toHaveLength(2);
  }
  for (const value of [...answer.todayPlan.slice(1), ...answer.nonDiagnosticHypotheses.flatMap(item => [item.label, item.rationale]), ...answer.observe, ...answer.avoid]) {
    expect(visibleText(html, escapeHtml(value)), value).toBe(false);
  }
  for (const id of ["coach-report-understanding", "coach-report-details", "coach-report-actions", "coach-report-sources"]) {
    expect(hasLinkedCollapsedPanel(section(html, id)), id).toBe(true);
  }
  expect(html).not.toContain("Nap dropped at 3y2m");
  expect(html).not.toContain("confidence");
  if (answer.riskLevel === "moderate") {
    expect(html.indexOf('data-testid="coach-report-urgent-help"')).toBeLessThan(html.indexOf('data-testid="coach-report-opening"'));
    expect(visibleText(html, answer.escalateIf[0])).toBe(true);
  } else {
    expect(hasLinkedCollapsedPanel(section(html, "coach-report-help"))).toBe(true);
    expect(visibleText(html, answer.escalateIf[0])).toBe(false);
  }
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

  it("grouped Keep slots retain exact fields and source associations without duplicating advice", () => {
    const kept: { field: string; text: string }[] = [];
    const out = render({ renderKeepAction: (field, text) => {
      kept.push({ field, text });
      return React.createElement("div", { className: "coach-report__keep" }, React.createElement("button", { type: "button", "data-testid": "test-grouped-keep" }, "Keep this advice"));
    } });
    expect(kept).toEqual([
      ...contract.todayPlan.map(text => ({ field: "todayPlan", text })),
      { field: "parentScript", text: contract.parentScript },
      ...contract.observe.map(text => ({ field: "observe", text })),
    ]);
    expect(out.match(/data-testid="test-grouped-keep"/g)).toHaveLength(4);
    const actions = section(out, "coach-report-actions");
    expect(hasLinkedCollapsedPanel(actions)).toBe(true);
    const groups = [...actions.matchAll(/<div class="coach-report__save-row"[^>]*>/g)];
    expect(groups).toHaveLength(kept.length);
    const labels = ["Step 1", "Step 2", "Say this", "Watch for · 1"];
    for (const [index, group] of groups.entries()) {
      expect(attribute(group[0], "role")).toBe("group");
      expect(attribute(group[0], "aria-label")).toBe(labels[index]);
      const sourceId = attribute(group[0], "aria-describedby");
      expect(sourceId).toBeTruthy();
      const source = elementWithAttribute(out, "id", sourceId!);
      expect(source, labels[index]).toContain(escapeHtml(kept[index].text));
      expect(out.split(escapeHtml(kept[index].text))).toHaveLength(2);
      expect(actions).not.toContain(escapeHtml(kept[index].text));
    }
    expect(kept.some(item => item.text === contract.escalateIf[0] || item.text === contract.avoid[0] || item.text === contract.nonDiagnosticHypotheses[0].label)).toBe(false);
    expect(reportCss).toMatch(/\.coach-report__keep button \{[^}]*min-block-size: var\(--touch-min\)/);
    expect(visibleText(out, "Keep this advice")).toBe(false);
    const expandedMarkup = out.replaceAll('hidden=""', "");
    expect(visibleText(expandedMarkup, "Keep this advice")).toBe(true);
  });
});

/* The core hierarchy and complete mounted optional content. */

describe("AI-17 — structured hierarchy preserves the complete answer", () => {
  const html = render({ lang: "en" });

  it("the container-query report receives real flex width from its AI bubble", () => {
    // Inline-size containment removes the report's intrinsic width. An
    // auto-sized flex bubble can therefore collapse to nearly zero width.
    // Execute the shipped class expressions for both roles, and prove the
    // pre-fix missing-growth/min-width shapes fail this source-level guard.
    const bubble = /<div dir="auto" className=\{(`[^`]+`)\}/.exec(coachSource)?.[1];
    const row = /data-companion-message=\{msg\.sender\}[^>]*?className=\{(`[^`]+`)\}/.exec(coachSource)?.[1];
    expect(bubble).toBeTruthy(); expect(row).toBeTruthy();
    const classes = (expression: string, sender: string): string => new Function("msg", `return ${expression};`)({ sender });
    const safeBubble = (value: string) => /\bmin-w-0\b/.test(value) && /\bflex-1\b/.test(value);
    const ai = classes(bubble!, "ai");
    expect(reportCss).toContain("container-type: inline-size");
    expect(classes(row!, "ai")).toMatch(/\bw-full\b/);
    expect(safeBubble(ai)).toBe(true);
    expect(safeBubble(ai.replace("flex-1", ""))).toBe(false);
    expect(safeBubble(ai.replace("min-w-0", ""))).toBe(false);
    expect(classes(bubble!, "user")).not.toMatch(/\bflex-1\b/);
  });

  it("keeps the short lead, first action and script visible, with optional reasoning and detail mounted once", () => {
    assertInitialHierarchy(html, contract);
    expect(html).toContain('<article class="coach-report"');
    expect(visibleText(html, contract.text!)).toBe(true);
    // Negative controls prove both the core-visibility and optional-depth checks.
    expect(visibleText(`<div hidden>${html}</div>`, contract.todayPlan[0])).toBe(false);
    expect(visibleText(html.replaceAll('hidden=""', ""), contract.nonDiagnosticHypotheses[0].rationale)).toBe(true);
  });

  it("renders the parent script as a quoted, copyable block", () => {
    expect(html).toContain("Say this");
    expect(html).toContain("“I am right here. I will check on you in two minutes.”");
    expect(html).toContain("font-family:var(--font-sans);font-style:normal");
    expect(html).toContain("Copy");
  });

  it("keeps every suggested step once and in order, with only the first step initially exposed", () => {
    expect(html).toContain("Try today");
    const details = section(html, "coach-report-details");
    expect(hasLinkedCollapsedPanel(details)).toBe(true);
    for (const [index, step] of contract.todayPlan.entries()) {
      expect(html.split(step)).toHaveLength(2);
      expect(visibleText(html, step)).toBe(index === 0);
      if (index > 0) expect(details).toContain(step);
    }
    expect(details).not.toContain(contract.todayPlan[0]);
    expect(details).toContain('<ol class="coach-report__steps" start="2">');
    // No ephemeral tick box: the step enters the loop through "I'll try it".
    expect(html).not.toContain('class="flex items-start gap-2 text-start w-full group"');
  });

  it("groups the one plan door and explicit teacher-note action in closed secondary actions", () => {
    const actions = section(html, "coach-report-actions");
    expect(hasLinkedCollapsedPanel(actions)).toBe(true);
    expect(html.split('data-testid="coach-plan-door"').length - 1).toBe(1);
    expect(actions).toContain("Turn into a plan");
    expect(actions).toContain("Teacher note");
    expect(html).not.toContain("Save to plan");
    expect(html).not.toContain("Save as plan");
    expect(visibleText(html, "Turn into a plan")).toBe(false);
    expect(visibleText(html, "Teacher note")).toBe(false);
  });

  it("reads lead → first action → script → optional depth, while urgent help always comes first", () => {
    for (const c of [contract, { ...contract, riskLevel: "moderate" }]) {
      const out = render({ lang: "en", contract: c });
      assertInitialHierarchy(out, c);
      const ordered = ["coach-report-opening", "coach-report-next", "say-this", "coach-report-understanding", "coach-report-details", "coach-report-observe", "coach-plan-door", "coach-report-sources", "coach-answer-footer"];
      const positions = ordered.map(id => out.indexOf(`data-testid="${id}"`));
      expect(positions.every(position => position >= 0)).toBe(true);
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    }
  });

  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] a long lead and uncapped steps/observations remain complete and in order without burying the first action`, () => {
      const longText = lang === "he" ? "אפשר להקשיב ולהציע צעד קטן שמתאים למשפחה. ".repeat(16).trim() : "A hard day can need patient listening and one small next step. ".repeat(12).trim();
      const steps = Array.from({ length: 9 }, (_, i) => lang === "he" ? `צעד מקורי מספר ${i + 1}: שתי אפשרויות.` : `Original step ${i + 1}: offer two choices.`);
      const observations = Array.from({ length: 6 }, (_, i) => lang === "he" ? `התבוננות מקורית מספר ${i + 1}.` : `Original observation ${i + 1}.`);
      const answer = { ...contract, text: longText, todayPlan: steps, observe: observations };
      const out = render({ lang, contract: answer });
      const context = section(out, "coach-report-opening");
      const details = section(out, "coach-report-details");
      expect(hasLinkedCollapsedPanel(context)).toBe(true);
      expect(context).toContain(lang === "he" ? "רקע נוסף" : "More context");
      expect(out.indexOf('data-testid="say-this"')).toBeLessThan(out.indexOf('data-testid="coach-report-opening"'));
      expect(out.split(longText)).toHaveLength(2);
      expect(visibleText(out, longText)).toBe(false);
      expect(visibleText(out, steps[0])).toBe(true);
      expect(visibleText(out, contract.parentScript)).toBe(true);
      for (const [index, step] of steps.entries()) {
        expect(out.split(step), step).toHaveLength(2);
        expect(visibleText(out, step)).toBe(index === 0);
        if (index > 0) expect(details).toContain(step);
        if (index > 1) expect(details.indexOf(steps[index - 1])).toBeLessThan(details.indexOf(step));
      }
      for (const observation of observations) {
        expect(out.split(observation), observation).toHaveLength(2);
        expect(details).toContain(observation);
        expect(visibleText(out, observation)).toBe(false);
      }
      expect(answer.todayPlan).toHaveLength(9);
      expect(answer.observe).toHaveLength(6);
    });

    it(`[${lang}] council/source detail stays attached and collapsed with readable titles and legacy fallback`, () => {
      const out = render({ lang, council, onGoDeeper: noop });
      expect(hasLinkedCollapsedPanel(section(out, "coach-report-council"))).toBe(true);
      expect(hasLinkedCollapsedPanel(section(out, "coach-report-sources"))).toBe(true);
      for (const value of [council[0].name, council[0].concept, council[0].takeaway, council[0].suggestion, "Sleep-onset associations", "practice card", "separation protest"]) {
        expect(out.split(value), value).toHaveLength(2);
        expect(visibleText(out, value), value).toBe(false);
      }
      expect(out).not.toContain('data-testid="coach-go-deeper"');
      expect(out).toContain('data-testid="trust-link"');
      expect(out).toContain(lang === "he" ? "מבוסס על 2 עובדות שאישרתם" : "Grounded in 2 facts you approved");
      expect(out).not.toContain(contract.memoryProposals[0].fact);
    });
  }

  it("every disclosure is a native button linked both ways to a uniquely named mounted panel", () => {
    const out = render({ council, contract: { ...contract, text: "Long context retained without truncation. ".repeat(20), document: { documentType: "school note", keyPoints: ["One point"], questionsForProfessional: ["One question?"], handoffNote: "One note", suggestedMemory: [] } } });
    const ids = ["coach-report-opening", "coach-report-understanding", "coach-report-details", "coach-report-document", "coach-report-help", "coach-report-actions", "coach-report-council", "coach-report-sources"];
    for (const id of ids) {
      const markup = section(out, id);
      expect(hasLinkedCollapsedPanel(markup), id).toBe(true);
      // Negative controls reject a dangling control, a wrong label and an exposed panel.
      expect(hasLinkedCollapsedPanel(markup.replace(/aria-controls="[^"]*"/, 'aria-controls="missing"')), id).toBe(false);
      expect(hasLinkedCollapsedPanel(markup.replace(/aria-labelledby="[^"]*"/, 'aria-labelledby="missing"')), id).toBe(false);
      expect(hasLinkedCollapsedPanel(markup.replace('hidden=""', "")), id).toBe(false);
    }
    const domIds = [...out.matchAll(/(?:\s)id="([^"]*)"/g)].map(match => match[1]);
    expect(new Set(domIds).size).toBe(domIds.length);
  });

  it("multiple historical answers have independent panel and advice IDs", () => {
    const out = renderToStaticMarkup(React.createElement("div", null, ...[contract, { ...contract, text: "Another answer." }].map((answer, index) => React.createElement(CoachAnswerCards, { key: index, contract: answer, lang: "en", onSaveToPlan: noop, onAddToHandoff: noop }))));
    const ids = [...out.matchAll(/(?:\s)id="([^"]*)"/g)].map(match => match[1]);
    expect(ids.length).toBeGreaterThan(10);
    expect(new Set(ids).size).toBe(ids.length);
    for (const control of out.matchAll(/aria-controls="([^"]*)"/g)) expect(elementWithAttribute(out, "id", control[1])).toContain('role="region"');
  });

  it("CLINICAL FIREWALL: the answer carries no score, percentage or graded verdict", () => {
    expect(html).not.toMatch(/\d+\s?%/);
    expect(html).not.toMatch(/\bpercentile\b|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelayed\b/i);
  });
});

/** A slot callback can explicitly decline a candidate (for example the
 * host's four-proposal bound). Its missing control must not leave a label. */
describe("absent Keep actions do not leave empty groups", () => {
  it("emits only four offered rows from a longer answer, with exact original source associations", () => {
    const answer = { ...contract, todayPlan: Array.from({ length: 6 }, (_, i) => `Exact longer-answer step ${i + 1}.`) };
    const calls: { field: string; text: string }[] = [];
    const out = render({ contract: answer, renderKeepAction: (field, text) => {
      calls.push({ field, text });
      if (calls.length > 4) return null;
      return React.createElement("div", { className: "coach-report__keep" }, React.createElement("button", { type: "button" }, "Keep this advice"));
    } });
    expect(calls).toEqual([
      ...answer.todayPlan.map(text => ({ field: "todayPlan", text })),
      { field: "parentScript", text: answer.parentScript },
      ...answer.observe.map(text => ({ field: "observe", text })),
    ]);
    const groups = [...out.matchAll(/<div class="coach-report__save-row"[^>]*>/g)];
    expect(groups).toHaveLength(4);
    for (const [index, group] of groups.entries()) {
      expect(attribute(group[0], "aria-label")).toBe(`Step ${index + 1}`);
      const source = elementWithAttribute(out, "id", attribute(group[0], "aria-describedby")!);
      expect(source).toContain(answer.todayPlan[index]);
    }
    const actions = section(out, "coach-report-actions");
    expect(actions).not.toContain('aria-label="Step 5"');
    expect(actions).not.toContain('aria-label="Step 6"');
    expect(actions).not.toContain('aria-label="Say this"');
    expect(actions).not.toContain('aria-label="Watch for · 1"');
    for (const value of [...answer.todayPlan, answer.parentScript, ...answer.observe]) {
      expect(out.split(escapeHtml(value))).toHaveLength(2);
      expect(actions).not.toContain(escapeHtml(value));
    }
  });

  it("all-null slots omit their rows, list and header while preserving real Plan/handoff actions", () => {
    const out = render({ renderKeepAction: () => null });
    expect(out).not.toContain("coach-report__save-row");
    expect(out).not.toContain("coach-report__save-list");
    expect(out).not.toContain("coach-report__save-advice");
    expect(out).not.toContain("Keep or edit advice");
    expect(section(out, "coach-report-actions")).toContain("Turn into a plan");
    expect(section(out, "coach-report-actions")).toContain("Teacher note");
  });

  it("all-null slots without other tools leave no empty actions disclosure", () => {
    const out = render({ contract: { ...contract, todayPlan: [], parentScript: "", nonDiagnosticHypotheses: [], handoffNotes: { teacher: "", professional: "" } }, renderKeepAction: () => null });
    expect(out).not.toContain('data-testid="coach-report-actions"');
    expect(out).toContain(escapeHtml(contract.observe[0]));
  });
});
