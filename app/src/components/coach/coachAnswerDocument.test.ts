import { describe, expect, it } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoachAnswerCards from "./CoachAnswerCards";
import type { CoachContract } from "../../types";
import { en, he } from "../../lib/i18n";

/**
 * Parity 9 Oct — the conversation regains what the retired Vision modal gave a
 * document (type, key points, questions for the professional, a note to share,
 * facts the parent may keep), the professional handoff, and a calm text-only
 * decline for a file the FILE SAFETY GATE refuses.
 */
const base = (over: Partial<CoachContract> = {}): CoachContract => ({
  text: "Here is what the note says.", riskLevel: "Low", ageBand: "", domains: [], nonDiagnosticHypotheses: [],
  todayPlan: ["Offer two books."], parentScript: "", avoid: [], observe: [], escalateIf: [],
  frameRouting: { aim: "", twoAxes: "", story: "", shadow: "", marriage: "", shepherd: "" },
  memoryProposals: [], handoffNotes: { teacher: "", professional: "" }, ...over,
});
const render = (contract: CoachContract, extra: Record<string, unknown> = {}) => renderToStaticMarkup(React.createElement(CoachAnswerCards, {
  contract, onSaveToPlan: () => {}, onAddToHandoff: () => {}, lang: "en", ...extra,
}));
const DOC = { documentType: "daycare note", keyPoints: ["Offer a choice of two books.", "Do not ask the child to repeat words."], questionsForProfessional: ["What does the group practise?"], handoffNote: "The daycare suggests two books.", suggestedMemory: ["Attends a Tuesday speech group"] };

describe("the document block", () => {
  it("renders type, key points, questions and the consult door", () => {
    const html = render(base({ document: DOC }), { onProposeMemory: async () => {} });
    expect(html).toContain('data-testid="coach-report-document"');
    expect(html).toContain("From the daycare note");
    expect(html).toContain("Do not ask the child to repeat words.");
    expect(html).toContain("What does the group practise?");
    expect(html).toContain('data-testid="coach-doc-handoff"');
  });

  it("each suggested fact is the PARENT's choice: a save button and the pending-approval note", () => {
    const html = render(base({ document: DOC }), { onProposeMemory: async () => {} });
    expect(html).toContain('data-testid="coach-doc-memory"');
    expect(html).toContain("Attends a Tuesday speech group");
    expect(html).toContain(en["coach.doc.save"]);
    expect(html).toContain(en["coach.doc.pendingNote"]);
  });

  it("without a propose seam the facts are not offered (nothing implies they were kept)", () => {
    expect(render(base({ document: DOC }))).not.toContain('data-testid="coach-doc-memory"');
  });

  it("a declined turn shows its words only — never a document, plan or handoff", () => {
    const html = render(base({ fileDeclined: true, document: DOC, todayPlan: [], text: "I can only look at photos and documents about your child and family." }));
    expect(html).toContain("I can only look at photos and documents about your child and family.");
    expect(html).not.toContain('data-testid="coach-report-document"');
    expect(html).not.toContain('data-testid="coach-report-next"');
  });
});

describe("the professional note", () => {
  it("is offered when the answer carries one, beside the teacher note", () => {
    const html = render(base({ handoffNotes: { teacher: "For the teacher", professional: "For the clinician" } }));
    expect(html).toContain('data-testid="coach-professional-note"');
    expect(html).toContain(en["coach.cards.professionalNote"]);
  });
  it("is absent when empty", () => {
    expect(render(base())).not.toContain('data-testid="coach-professional-note"');
  });
});

describe("EN + HE parity for the new copy", () => {
  const keys = ["coach.cards.professionalNote", "coach.doc.title", "coach.doc.titleTyped", "coach.doc.keyPoints", "coach.doc.askPro", "coach.doc.toConsult", "coach.doc.remember", "coach.doc.save", "coach.doc.saved", "coach.doc.retry", "coach.doc.pendingNote"];
  it("every key exists in both dictionaries, distinct, with the same placeholders", () => {
    for (const key of keys) {
      expect(en[key], `en ${key}`).toBeTruthy();
      expect(he[key], `he ${key}`).toBeTruthy();
      expect(he[key]).not.toBe(en[key]);
      const holes = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      expect(holes(he[key])).toEqual(holes(en[key]));
    }
  });
});
