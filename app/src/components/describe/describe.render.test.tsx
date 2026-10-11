/**
 * B-SHELL-39 — what a parent sees on the describe surface, the thread and the
 * readback, in EN and HE: the opening question and its three hints, the mic
 * only where dictation exists (with the voice-door data line on first use),
 * every readback row quoting the parent, the Art. 50 line, "Keep these", and
 * no verdict, score or AI reading of the child anywhere. Synthetic child only.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DescribeSession, type DescribeServices } from "../../lib/describeChild";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, aiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "synthetic-kid", name: "Noa", strengths: ["Funny"], challenges: ["Mornings are hard"], interests: [],
  focusAreas: [{ id: "f1", words: "Getting dressed", domainId: "body", since: "2026-10-10", source: "describe", confirmedAt: "x" }] }, milestones: [] }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ updateChild: async () => true }) }));
vi.mock("./TellArborMore", () => ({ default: () => null }));
import { translate } from "../../lib/i18n";
import KeptDescription from "./KeptDescription";
import DescribeChild from "./DescribeChild";
import DescribeReadback from "./DescribeReadback";
import DescribeThread from "./DescribeThread";

const svc = (reply: unknown): DescribeServices => ({
  profile: () => ({ strengths: [], challenges: ["Loud places"], describedItems: [{ id: "w1", kind: "worry", words: "Loud places", since: "2026-10-01", source: "describe", confirmedAt: "x" }] }),
  draft: async () => reply as never,
  commit: async (plan) => ({ plan, memoryIds: [], milestonesBefore: [] }),
  undo: async () => {},
  now: () => new Date("2026-10-10T09:00:00Z"),
});
/** Verdicts, scores and Arbor's own reading of the child the surface must never print. */
const VERDICT = /\b(on track|behind|delayed|at risk|score|percent|%|Arbor thinks|seems to have|signs of)\b/i;

afterEach(() => { vi.unstubAllGlobals(); h.lang = "en"; });

describe.each(["en", "he"] as const)("describe surface (%s)", (lang) => {
  it("asks the opening question with three hints; no dictation ⇒ no mic, typing works", () => {
    h.lang = lang;
    const html = renderToStaticMarkup(<DescribeChild name="Noa" lang={lang} value="" onChange={() => {}} />);
    expect(html).toContain(translate(lang, "elev.describe.opening", { name: "Noa" }));
    for (const k of ["elev.describe.hint2", "elev.describe.hint3"]) expect(html).toContain(translate(lang, k).replace(/'/g, "&#x27;"));
    expect(html).toContain('maxLength="2000"');
    expect(html).not.toContain('data-testid="describe-mic"');
  });
  it("where dictation exists the mic shows, with the voice-door data line on first use", () => {
    h.lang = lang;
    vi.stubGlobal("window", { SpeechRecognition: class {} });
    vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
    const html = renderToStaticMarkup(<DescribeChild name="Noa" lang={lang} value="" onChange={() => {}} quickFills />);
    expect(html).toContain('data-testid="describe-mic"');
    expect(html).toContain('data-testid="describe-mic-data-use"');
    expect((html.match(/data-fill=/g) ?? [])).toHaveLength(8);
  });
  it("the readback quotes the parent on every row, names a replace, carries the Art. 50 line and one Keep these", async () => {
    h.lang = lang;
    const session = new DescribeSession(svc({ items: [
      { id: "i0", kind: "strength", text: "Funny", quote: "she is funny", op: "add" },
      { id: "i1", kind: "worry", text: "Big crowds", quote: "big crowds are hard now", op: "replace", itemId: "w1" },
      { id: "i2", kind: "context", text: "Diagnosed with a speech delay in March", quote: "diagnosed with a speech delay in March", op: "add", parentReported: true },
    ], nextQuestion: null }));
    await session.start("she is funny, big crowds are hard now");
    const html = renderToStaticMarkup(<DescribeReadback name="Noa" session={session} profile={session.services.profile()} />);
    expect(html).toContain(translate(lang, "elev.describe.readback.title", { name: "Noa" }).replace(/'/g, "&#x27;"));
    expect((html.match(/data-testid="describe-item"/g) ?? [])).toHaveLength(3);
    expect(html).toContain(translate(lang, "elev.describe.youSaid", { quote: "she is funny" }));
    expect(html).toContain(translate(lang, "elev.describe.replace", { old: "Loud places", new: "Big crowds" }));
    expect(html).toContain(translate(lang, "elev.describe.yourWords"));
    expect(html).toContain('data-testid="describe-ai-line"');
    expect(html).toContain(translate(lang, "elev.describe.aiLine").replace(/'/g, "&#x27;"));
    expect((html.match(/data-testid="describe-keep-these"/g) ?? [])).toHaveLength(1);
    expect(html.replace(/speech delay/g, "")).not.toMatch(VERDICT);
  });
  it("the thread shows Arbor's question, the parent's answer and one open question with Answer, Skip and Done", async () => {
    h.lang = lang;
    const session = new DescribeSession(svc({ items: [{ id: "i0", kind: "strength", text: "Funny", quote: "she is funny", op: "add" }], nextQuestion: "What makes her laugh?" }));
    await session.start("she is funny");
    const html = renderToStaticMarkup(<DescribeThread name="Noa" lang={lang} session={session} />);
    expect(html).toContain(translate(lang, "elev.describe.opening", { name: "Noa" }));
    expect(html).toContain("she is funny");
    expect(html).toContain("What makes her laugh?");
    expect((html.match(/data-testid="describe-answer-box"/g) ?? [])).toHaveLength(1);
    for (const id of ["describe-answer-send", "describe-question-skip", "describe-done"]) expect(html).toContain(`data-testid="${id}"`);
  });
  it("What you told me lists each kept item with Edit and Remove, and the door; My child folds it", () => {
    h.lang = lang;
    const open = renderToStaticMarkup(<KeptDescription testId="kept" />);
    expect((open.match(/data-testid="describe-kept-item"/g) ?? [])).toHaveLength(3);
    expect((open.match(/data-testid="describe-kept-remove"/g) ?? [])).toHaveLength(3);
    expect(open).toContain('data-testid="describe-door"');
    expect(open).toContain(translate(lang, "elev.describe.door"));
    expect(open).not.toMatch(VERDICT);
    const folded = renderToStaticMarkup(<KeptDescription testId="kept" collapsible />);
    expect(folded).toContain('data-testid="kept-fold"');
    expect(folded).toContain(translate(lang, "elev.describe.kept.show"));
  });
});
