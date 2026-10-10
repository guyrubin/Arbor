import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PRACTICES } from "../../content/practices";
import { NOW_COPY } from "../companion/nowViewCopy";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as Record<string, any>[],
}));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("react/jsx-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  const capture = (type: unknown, props: unknown) => { if (type === "button") state.buttons.push(props as Record<string, any>); };
  return {
    ...runtime,
    jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); },
    jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); },
  };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => {
    if (args[0] === "button") state.buttons.push(args[1] as Record<string, any>);
    return runtime.jsxDEV(...args);
  } };
});
import PracticeCard, { practiceText } from "./PracticeCard";
const practice = PRACTICES.find(p => p.id === "pr-cdc-36m-9")!;

beforeEach(() => { state.buttons = []; state.lang = "en"; });

describe("Now's opt-in action-first practice", () => {
  it.each(["en", "he"] as const)("puts the complete action and outcomes before optional words and history (%s)", lang => {
    state.lang = lang;
    const onAnswer = vi.fn();
    const html = renderToStaticMarkup(<PracticeCard practice={practice} milestone={null} shelf="hands" childName="Noa" gender="girl"
      onAnswer={onAnswer} quotes={[{ text: "A complete parent observation", date: "8 Oct" }]} whyText="The reason for this particular idea."
      stampMove="choose-next-step" actionFirstDetailsLabel={NOW_COPY[lang].practiceDetails} />);
    const at = (id: string) => html.indexOf(`data-testid="${id}"`);
    const order = ["practice-title", "practice-do", "practice-answers", "practice-details", "practice-quotes", "practice-say", "practice-meta", "practice-why"].map(at);
    expect(order.every(index => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).not.toMatch(/<details[^>]*\bopen(?:=|>)/);
    expect(html).toContain("A complete parent observation");
    expect(html).toContain("The reason for this particular idea.");
    expect(html).toContain(practiceText(practice, "materials", lang, "girl"));
    expect(html).not.toContain("arbor-type-say");
    expect(html).not.toContain("var(--font-editorial)");
    expect(html).not.toContain(" italic");
    expect(html).not.toContain("truncate");
    state.buttons.find(b => b["data-answer"] === "did")!.onClick();
    state.buttons.find(b => b["data-answer"] === "not_today")!.onClick();
    expect(onAnswer.mock.calls).toEqual([["did"], ["not_today"]]);
  });

  it.each(["did", "not_today"] as const)("keeps the %s receipt and Undo outside the collapsed details", answered => {
    const onUndo = vi.fn();
    const html = renderToStaticMarkup(<PracticeCard practice={practice} milestone={null} shelf="hands" childName="Noa"
      onAnswer={vi.fn()} answered={answered} onUndo={onUndo} actionFirstDetailsLabel={NOW_COPY.en.practiceDetails} />);
    expect(html.indexOf('data-testid="practice-receipt"')).toBeLessThan(html.indexOf('data-testid="practice-details"'));
    expect(html.indexOf('data-testid="practice-undo"')).toBeLessThan(html.indexOf('data-testid="practice-details"'));
    expect(html).not.toContain('data-testid="practice-answers"');
    if (answered === "did") expect(html).toContain('#/journal?shelf=hands');
    state.buttons.find(b => b["data-testid"] === "practice-undo")!.onClick();
    expect(onUndo).toHaveBeenCalledOnce();
  });

  it("leaves the shared default presentation unchanged", () => {
    const html = renderToStaticMarkup(<PracticeCard practice={practice} milestone={null} shelf="hands" onAnswer={vi.fn()} />);
    expect(html).not.toContain('data-presentation="action-first"');
    expect(html).not.toContain("<details");
    expect(html.indexOf('data-testid="practice-say"')).toBeLessThan(html.indexOf('data-testid="practice-answers"'));
    expect(html.indexOf('data-testid="practice-why"')).toBeGreaterThan(html.indexOf('data-testid="practice-answers"'));
  });
});
