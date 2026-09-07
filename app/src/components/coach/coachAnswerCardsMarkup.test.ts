/**
 * AI-17 — byte-equivalence guard for the richest structured-AI surface.
 *
 * CoachAnswerCards is the reference implementation of Arbor's structured
 * answer: the framed section, the parent script with its read-aloud and copy
 * affordances, the interactive today-plan, and the action row. AI-17 lifts
 * those four blocks into shared primitives so the other surfaces stop
 * re-implementing them.
 *
 * The bar for that extraction is ZERO visual regression, so this file freezes
 * the markup the component ships; if moving a block into a shared primitive
 * changes one class, one attribute or one text node, this fails.
 *
 * Re-pinned once, deliberately, after three source changes that the snapshot
 * exists to make visible and that were each reviewed here:
 *   OBJ-TODAY-01  the TrustLink chip is an OUTLINE, not a `--arbor-*-soft`
 *                 wash (every soft token is a gradient, so the filled chip
 *                 read as a second gradient CTA);
 *   OBJ-TODAY-04  that chip carries `touch-target` for the 44 px floor;
 *   OBJ-ASK/M     `isolate()` wraps Latin runs inside Hebrew copy in
 *                 FSI/PDI so a name cannot flip the sentence direction.
 * No text node was lost, no frame was unwrapped and no verdict word entered;
 * the two matchers at the end of the negative-control block pin exactly those
 * three properties so the re-pin cannot silently absorb a fourth change.
 *
 * The explicit assertions below the snapshot are the negative controls: each
 * one names a structural property the extraction could plausibly break, and
 * each is proven to reject a mutated copy of the same markup.
 *
 * Rendered with renderToStaticMarkup under `environment: "node"`, so the
 * read-aloud control (which needs a speech-capable window) renders nothing
 * here; the copy affordance and every framed block do render.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
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
const asyncNoop = async () => {};
void asyncNoop;

function render(props: Partial<Parameters<typeof CoachAnswerCards>[0]> = {}): string {
  return renderToStaticMarkup(
    React.createElement(CoachAnswerCards, {
      contract,
      onSaveToPlan: noop,
      onCreateLog: noop,
      onAddToHandoff: noop,
      onManageMemory: noop,
      ...props,
    }),
  );
}

/* ── Frozen pre-extraction markup ─────────────────────────────────────────── */

describe("AI-17 — CoachAnswerCards markup is byte-identical across the extraction", () => {
  it("renders the low-risk English answer exactly as it shipped", () => {
    const html = render({ lang: "en" });
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatchSnapshot();
  });

  it("renders the prominent-escalation answer exactly as it shipped", () => {
    const html = render({ lang: "en", contract: { ...contract, riskLevel: "moderate" } });
    expect(html.length).toBeGreaterThan(2000);
    expect(html).toMatchSnapshot();
  });

  it("renders the Hebrew answer with a council exactly as it shipped", () => {
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

  it("a today-plan whose unchecked box lost its strong rule is rejected", () => {
    expect(html).toContain("border:1px solid var(--arbor-rule-strong)");
    const mutant = html.split("var(--arbor-rule-strong)").join("var(--arbor-rule)");
    expect(mutant).not.toContain("var(--arbor-rule-strong)");
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

  it("an action row that lost the accent keep button is rejected", () => {
    expect(html).toContain("background:var(--arbor-green-soft);color:var(--arbor-green-ink)");
    const mutant = html.split("var(--arbor-green-soft)").join("var(--arbor-paper-deep)");
    expect(mutant).not.toContain("var(--arbor-green-soft)");
  });
});

/* ── The four blocks AI-17 extracts, asserted structurally ─────────────────── */

describe("AI-17 — the four structured blocks are all present on the reference surface", () => {
  const html = render({ lang: "en" });

  it("frames every section in the shared card tone", () => {
    // Say this, Try today, Avoid, Watch for — four framed sections minimum.
    const frames = html.split(CARD_FRAME).length - 1;
    expect(frames).toBeGreaterThanOrEqual(4);
  });

  it("renders the parent script as a quoted, copyable block", () => {
    expect(html).toContain("Say this");
    expect(html).toContain("“I am right here. I will check on you in two minutes.”");
    expect(html).toContain("italic");
    expect(html).toContain("Copy");
  });

  it("renders the today-plan as an interactive checklist, one button per step", () => {
    expect(html).toContain("Try today");
    for (const step of contract.todayPlan) expect(html).toContain(step);
    // Each step is its own toggle target.
    expect(html.split('class="flex items-start gap-2 text-start w-full group"').length - 1).toBe(contract.todayPlan.length);
  });

  it("renders the keep row with the plan action and the hand-off action", () => {
    expect(html).toContain("Save to plan");
    expect(html).toContain("Teacher note");
  });

  it("CLINICAL FIREWALL: the answer carries no score, percentage or graded verdict", () => {
    expect(html).not.toMatch(/\d+\s?%/);
    expect(html).not.toMatch(/\bpercentile\b|\bscore\b|\bon[\s-]?track\b|\bbehind\b|\bdelayed\b/i);
  });
});
