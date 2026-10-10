import { describe, expect, it, vi } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import CoachAnswerCards from "./CoachAnswerCards";
import type { CoachContract } from "../../types";
import { en, he, translate } from "../../lib/i18n";

/**
 * The document variation preserves type, key points, questions, a note to share
 * and explicit pending-memory choices. It follows the first action and script;
 * its professional handoff belongs to the grouped secondary actions. Static
 * tests establish read-only render and complete mounted content, not interaction
 * success or rendered visual acceptance.
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
const escapeHtml = (text: string) => text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

/** Extract the whole static section, including nested sections. */
function section(html: string, testId: string): string {
  const tag = [...html.matchAll(/<section\b[^>]*>/g)].find(match => match[0].includes(`data-testid="${testId}"`));
  if (!tag) return "";
  const pattern = /<(\/?)section\b[^>]*>/g;
  pattern.lastIndex = tag.index!;
  let depth = 0;
  for (let match = pattern.exec(html); match; match = pattern.exec(html)) {
    depth += match[1] ? -1 : 1;
    if (!depth) return html.slice(tag.index, pattern.lastIndex);
  }
  return "";
}

function expectClosedPanel(markup: string): void {
  const button = /<button[^>]*>/.exec(markup)?.[0] ?? "";
  const toggleId = / id="([^"]+)"/.exec(button)?.[1];
  const panelId = / aria-controls="([^"]+)"/.exec(button)?.[1];
  expect(button).toContain('type="button"');
  expect(button).toContain('aria-expanded="false"');
  expect(toggleId).toBeTruthy();
  expect(panelId).toBeTruthy();
  expect(markup).toContain(`<div id="${panelId}" role="region" aria-labelledby="${toggleId}" hidden=""`);
}

describe("the document block", () => {
  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] preserves all document values once in a closed linked panel after the first action and script`, () => {
      const doc = lang === "he" ? { documentType: "פתק מהגן", keyPoints: ["להציע בחירה בין שני ספרים.", "לא לבקש מהילד לחזור על מילים."], questionsForProfessional: ["מה מתרגלים בקבוצה?"], handoffNote: "הגן מציע שני ספרים.", suggestedMemory: ["משתתף בקבוצת שפה ביום שלישי"] } : DOC;
      const script = lang === "he" ? "אפשר לבחור אחד משני הספרים." : "You can choose either book.";
      const html = render(base({ document: doc, parentScript: script }), { lang, onProposeMemory: async () => {} });
      const panel = section(html, "coach-report-document");
      const actions = section(html, "coach-report-actions");
      expectClosedPanel(panel);
      expectClosedPanel(actions);
      expect(html.indexOf('data-testid="coach-report-next"')).toBeLessThan(html.indexOf('data-testid="say-this"'));
      expect(html.indexOf('data-testid="say-this"')).toBeLessThan(html.indexOf('data-testid="coach-report-document"'));
      expect(panel).toContain(translate(lang, "coach.doc.titleTyped", { type: doc.documentType }));
      for (const value of [...doc.keyPoints, ...doc.questionsForProfessional, doc.handoffNote, ...doc.suggestedMemory]) {
        expect(panel, value).toContain(escapeHtml(value));
        expect(html.split(escapeHtml(value)), value).toHaveLength(2);
      }
      expect(actions).toContain('data-testid="coach-doc-handoff"');
      expect(actions).toContain(translate(lang, "coach.doc.toConsult"));
      expect(panel).not.toContain('data-testid="coach-doc-handoff"');
      const other = lang === "he" ? en : he;
      for (const key of ["coach.doc.keyPoints", "coach.doc.askPro", "coach.doc.remember", "coach.doc.save", "coach.doc.pendingNote"]) {
        expect(panel).toContain(escapeHtml(translate(lang, key)));
        expect(panel).not.toContain(escapeHtml(other[key]));
      }
    });

    it(`[${lang}] rendering does not save, approve, seed a plan or hand off a document`, () => {
      const callbacks = { onProposeMemory: vi.fn(async () => {}), onAddToHandoff: vi.fn(), onSaveToPlan: vi.fn() };
      const contract = base({ document: DOC });
      const before = JSON.stringify(contract);
      const html = render(contract, { lang, ...callbacks });
      expect(html).toContain(translate(lang, "coach.doc.save"));
      expect(html).toContain(translate(lang, "coach.doc.pendingNote"));
      expect(html).not.toContain(translate(lang, "coach.doc.saved"));
      expect(html).not.toContain('aria-busy="true"');
      expect(html).not.toContain('role="status"');
      expect(JSON.stringify(contract)).toBe(before);
      for (const callback of Object.values(callbacks)) expect(callback).not.toHaveBeenCalled();
    });

    it(`[${lang}] a screened declined turn has only its words and no supplied document data or action scaffolding`, () => {
      const text = lang === "he" ? "אפשר לעיין רק בתמונות ובמסמכים על הילד והמשפחה." : "I can only look at photos and documents about your child and family.";
      const html = render(base({ fileDeclined: true, document: DOC, todayPlan: [], text }), { lang, onProposeMemory: async () => {} });
      expect(html.split(text)).toHaveLength(2);
      for (const id of ["coach-report-document", "coach-report-next", "coach-report-actions", "coach-doc-handoff", "coach-doc-memory", "coach-professional-note"]) expect(html).not.toContain(`data-testid="${id}"`);
      for (const value of [DOC.documentType, ...DOC.keyPoints, ...DOC.questionsForProfessional, DOC.handoffNote, ...DOC.suggestedMemory]) expect(html).not.toContain(value);
    });

    it(`[${lang}] empty document fields use the generic title without invented content or a document handoff`, () => {
      const html = render(base({ document: { documentType: "", keyPoints: [], questionsForProfessional: [], handoffNote: "", suggestedMemory: [] } }), { lang, onProposeMemory: async () => {} });
      const panel = section(html, "coach-report-document");
      expectClosedPanel(panel);
      expect(panel).toContain(translate(lang, "coach.doc.title"));
      for (const key of ["coach.doc.keyPoints", "coach.doc.askPro", "coach.doc.remember", "coach.doc.pendingNote"]) expect(panel).not.toContain(escapeHtml(translate(lang, key)));
      expect(html).not.toContain('data-testid="coach-doc-handoff"');
      expect(html).not.toContain('data-testid="coach-doc-memory"');
    });
  }

  it("each suggested fact remains a parent's explicit choice with pending-approval wording", () => {
    const html = render(base({ document: DOC }), { onProposeMemory: async () => {} });
    expect(html).toContain('data-testid="coach-doc-memory"');
    expect(html).toContain(DOC.suggestedMemory[0]);
    expect(html).toContain(en["coach.doc.save"]);
    expect(html).toContain(en["coach.doc.pendingNote"]);
  });

  it("without a propose seam facts are not offered and nothing implies they were kept", () => {
    const html = render(base({ document: DOC }));
    expect(html).not.toContain('data-testid="coach-doc-memory"');
    expect(html).not.toContain(DOC.suggestedMemory[0]);
    expect(html).not.toContain(en["coach.doc.save"]);
    expect(html).not.toContain(en["coach.doc.saved"]);
    expect(html).not.toContain(en["coach.doc.pendingNote"]);
    expect(html).toContain(DOC.keyPoints[0]);
    expect(html).toContain('data-testid="coach-doc-handoff"');
  });
});

describe("the professional note", () => {
  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] teacher, professional and document handoffs remain distinct in closed secondary actions`, () => {
      const onAddToHandoff = vi.fn();
      const html = render(base({ document: DOC, handoffNotes: { teacher: "Private teacher prefill", professional: "Private clinician prefill" } }), { lang, onAddToHandoff });
      const actions = section(html, "coach-report-actions");
      expectClosedPanel(actions);
      for (const key of ["coach.cards.teacherNote", "coach.cards.professionalNote", "coach.doc.toConsult"]) expect(actions).toContain(translate(lang, key));
      for (const id of ["coach-professional-note", "coach-doc-handoff"]) expect(actions.split(`data-testid="${id}"`)).toHaveLength(2);
      expect(actions).not.toContain("Private teacher prefill");
      expect(actions).not.toContain("Private clinician prefill");
      expect(onAddToHandoff).not.toHaveBeenCalled();
    });
  }
  it("is absent when empty", () => {
    expect(render(base())).not.toContain('data-testid="coach-professional-note"');
  });
});

describe("EN + HE parity for document and hierarchy copy", () => {
  const keys = ["coach.cards.professionalNote", "coach.doc.title", "coach.doc.titleTyped", "coach.doc.keyPoints", "coach.doc.askPro", "coach.doc.toConsult", "coach.doc.remember", "coach.doc.save", "coach.doc.saving", "coach.doc.error", "coach.doc.saved", "coach.doc.retry", "coach.doc.pendingNote", "coach.report.context", "coach.report.details", "coach.report.actions", "coach.report.keepAdvice", "coach.report.step", "coach.report.observation"];
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

// These two neighboring controls prepare the same audience from DIFFERENT
// source fields. Distinct IDs alone do not make their visible labels clear.
describe("source-specific professional-note labels", () => {
  const labels = {
    en: { answer: "Answer note for the professional", document: "Document note for the professional" },
    he: { answer: "פתק מהתשובה לאיש המקצוע", document: "פתק מהמסמך לאיש המקצוע" },
  };
  const buttonText = (html: string, id: string) => {
    const body = new RegExp(`<button[^>]*data-testid="${id}"[^>]*>([\\s\\S]*?)</button>`).exec(html)?.[1] ?? "";
    return body.replace(/<span\b[^>]*aria-hidden="true"[^>]*>[\s\S]*?<\/span>/g, "").replace(/<[^>]*>/g, "").trim();
  };
  const sourceLabelsMatch = (html: string, lang: "en" | "he") => buttonText(html, "coach-professional-note") === labels[lang].answer && buttonText(html, "coach-doc-handoff") === labels[lang].document;
  for (const lang of ["en", "he"] as const) {
    it(`[${lang}] identifies answer and document sources without claiming an upload or send`, () => {
      const html = render(base({ document: DOC, handoffNotes: { teacher: "Teacher context", professional: "Answer context" } }), { lang });
      expect(sourceLabelsMatch(html, lang)).toBe(true);
      expect(buttonText(html, "coach-professional-note")).not.toBe(buttonText(html, "coach-doc-handoff"));
      expect([labels[lang].answer, labels[lang].document].join(" ")).not.toMatch(/uploaded|sent|הועלה|נשלח/i);
      const old = lang === "en" ? ["Note for the professional", "Add to a note for the professional"] : ["פתק לאיש המקצוע", "להוסיף לפתק לאיש המקצוע"];
      // Negative controls: the screenshot's former ambiguous pair and two
      // identical labels must fail even when both control IDs still exist.
      expect(sourceLabelsMatch(html.replace(labels[lang].answer, old[0]).replace(labels[lang].document, old[1]), lang)).toBe(false);
      expect(sourceLabelsMatch(html.replace(labels[lang].document, labels[lang].answer), lang)).toBe(false);
    });
  }
});
