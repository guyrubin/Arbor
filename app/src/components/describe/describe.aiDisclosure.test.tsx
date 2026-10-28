/**
 * B-GA-11 (critic r1) — the describe conversation's Art. 50 line renders in the
 * SCREEN's language, as Talk's composer foot does, even when the AI language
 * differs (TellArborMore passes the AI language to the describe surface), and
 * it renders right after the field, before the area shortcuts.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { DescribeSession, type DescribeServices } from "../../lib/describeChild";

const h = vi.hoisted(() => ({ ui: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.ui, aiLang: h.ui === "en" ? "he" : "en", t: (key: string, vars?: Record<string, string | number>) => translate(h.ui, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "synthetic-kid", name: "Noa" }, milestones: [] }) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ updateChild: async () => true }) }));
import { translate } from "../../lib/i18n";
import DescribeChild from "./DescribeChild";
import DescribeThread from "./DescribeThread";

const svc = (reply: unknown): DescribeServices => ({
  profile: () => ({ strengths: [], challenges: [], describedItems: [] }),
  draft: async () => reply as never,
  commit: async (plan) => ({ plan, memoryIds: [], milestonesBefore: [] }),
  undo: async () => {},
  now: () => new Date("2026-10-10T09:00:00Z"),
});
const line = (lang: "en" | "he") => translate(lang, "companion.input.foot").replace(/'/g, "&#x27;");

describe.each([["en", "he"], ["he", "en"]] as const)("UI %s, AI %s", (ui, ai) => {
  it("the describe field carries the line in the UI language, right after the field and before the area shortcuts", () => {
    h.ui = ui;
    const html = renderToStaticMarkup(<DescribeChild name="Noa" lang={ai} value="" onChange={() => {}} onAspect={() => {}} />);
    expect(html).toContain(line(ui));
    expect(html).not.toContain(line(ai));
    const at = html.indexOf("data-ai-disclosure");
    expect(at).toBeGreaterThan(html.indexOf('data-testid="describe-text"'));
    expect(at).toBeLessThan(html.indexOf("describe-fills"));
  });

  it("the thread's answer box carries the same line, in the UI language", async () => {
    h.ui = ui;
    const session = new DescribeSession(svc({ items: [{ id: "i0", kind: "strength", text: "Funny", quote: "she is funny", op: "add" }], nextQuestion: "What makes her laugh?" }));
    await session.start("she is funny");
    const html = renderToStaticMarkup(<DescribeThread name="Noa" lang={ai} session={session} />);
    expect((html.match(/data-ai-disclosure/g) ?? [])).toHaveLength(1);
    expect(html).toContain(line(ui));
    expect(html).not.toContain(line(ai));
    expect(html.indexOf("data-ai-disclosure")).toBeGreaterThan(html.indexOf('data-testid="describe-answer-text"'));
  });
});
