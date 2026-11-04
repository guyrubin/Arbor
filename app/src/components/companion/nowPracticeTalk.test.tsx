/**
 * B-VOICE-02 — the practice lead on Now: "Talk it through" starts the spoken
 * conversation on that tap, and its first spoken line is the practice's own
 * words (the "say" line, else what to do), in the page language with the
 * Hebrew forms resolved for the child. Adapting it in writing stays beside it.
 */
import React from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PRACTICES } from "../../content/practices";
import { translate, type UiLang } from "../../lib/i18n";
import { practiceText } from "../loop/PracticeCard";

const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", gender: "girl" as string | null, start: vi.fn(() => true) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "c1", name: "Noa", gender: state.gender } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: state.lang, t: (k: string, v?: Record<string, string | number>) => translate(state.lang as UiLang, k, v) }) }));
vi.mock("../loop/PracticeCard", async (original) => ({ ...(await original<typeof import("../loop/PracticeCard")>()), default: () => null }));
vi.mock("../../lib/companionConversation", async (original) => ({ ...(await original<typeof import("../../lib/companionConversation")>()), startConversationVoice: state.start }));

import { NowPracticeLead, practiceWords } from "./NowLoopBlocks";

const withSay = PRACTICES.find((p) => p.say?.en && p.say?.he)!;
const withoutSay = PRACTICES.find((p) => !p.say && p.do?.en);
const loopFor = (practice: (typeof PRACTICES)[number]) => ({
  pick: { practice, milestone: null, shelf: practice.shelf, via: "chooser", adaptation: null },
  adaptationKey: "k", doseAnswer: null, answerPractice: vi.fn(), undoPractice: vi.fn(), quotes: [], whyReason: null, whyDate: null,
  plan: { practiceMode: "day" }, setAdaptation: vi.fn(),
}) as never;

function findElement(node: unknown, match: (props: Record<string, any>) => boolean): React.ReactElement<any> | null {
  if (Array.isArray(node)) { for (const child of node) { const hit = findElement(child, match); if (hit) return hit; } return null; }
  if (!React.isValidElement(node)) return null;
  const props = node.props as Record<string, any>;
  if (match(props)) return node as React.ReactElement<any>;
  return findElement(props.children, match);
}

beforeEach(() => { state.start.mockClear(); state.lang = "en"; state.gender = "girl"; });

describe("B-VOICE-02 · the practice lead's Talk it through", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: one tap starts voice; the practice's say line is the first spoken line`, () => {
      state.lang = lang;
      const onAdapt = vi.fn();
      const tree = NowPracticeLead({ loop: loopFor(withSay), name: "Noa", onAdapt, adaptLabel: "Adapt" });
      const talk = findElement(tree, (p) => p["data-testid"] === "now-practice-talk");
      expect(talk).not.toBeNull();
      const html = renderToStaticMarkup(<>{tree}</>);
      expect(html).toContain(translate(lang, "companion.input.talk"));
      talk!.props.onClick();
      const words = practiceText(withSay, "say", lang, "girl");
      expect(words.length).toBeGreaterThan(0);
      expect(state.start).toHaveBeenCalledExactlyOnceWith({ source: "practice", opening: words });
      expect(onAdapt).not.toHaveBeenCalled();
      // The written adapt door stays beside it, unchanged.
      findElement(tree, (p) => String(p.className).includes("now-loop-adapt"))!.props.onClick();
      expect(onAdapt).toHaveBeenCalledOnce();
    });
  }

  it("a practice without a say line speaks what to do instead", () => {
    if (!withoutSay) return; // every practice carries a say line today
    expect(practiceWords(withoutSay, "en", null)).toBe(practiceText(withoutSay, "do", "en", null));
  });

  it("Hebrew words resolve the child's gender forms (no slash forms are spoken)", () => {
    const slash = PRACTICES.find((p) => p.say?.he?.includes("/"));
    if (!slash) return;
    expect(practiceWords(slash, "he", "girl")).not.toBe(slash.say!.he);
  });
});
