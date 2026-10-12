import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

/**
 * v3 F-SHELL-2 (shell-launcher-label) — the Ask bar's visible label is the
 * mock's full line, "Ask Arbor — text, photo or voice", whenever no family
 * question rides on it; the visible text then equals the button's accessible
 * name (label-in-name). With a question, the released FEAT-01 bar is
 * unchanged: the short "Ask Arbor" plus the quiet "On: <question>" line. A
 * draft still reads "Continue your draft".
 */
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", chatInput: "", activeTab: "milestones",
  topic: null as null | { id: string; title: string },
}));
vi.mock("react", async (original) => {
  const react = await original<typeof import("react")>();
  return { ...react, lazy: () => () => null, useEffect: () => undefined };
});
vi.mock("../../lib/kpiEvents", () => ({ trackCompanionPanelOpen: vi.fn() }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  activeTab: state.activeTab, chatInput: state.chatInput, activeFamilyTopic: state.topic,
  childProfile: { id: "child-a", name: "Sam", age: 4 },
  setActiveTab: vi.fn(), setChatInput: vi.fn(), newConversation: vi.fn(), openCaptureSheet: vi.fn(), openHardMomentNow: vi.fn(),
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string) => translate(state.lang, key) }) };
});
import CompanionWorkspace from "./CompanionWorkspace";
import { translate } from "../../lib/i18n";
import { NOW_COPY } from "./nowViewCopy";

const TOPIC = { id: "topic-a", title: "Calmer mornings" };
const render = () => renderToStaticMarkup(<CompanionWorkspace kidLocked={false}><main>Page content</main></CompanionWorkspace>);
/** The visible label: the copy span's own text, before any nested topic line. */
const label = (html: string) => /<span class="companion-launch-copy">([^<]*)/.exec(html)?.[1] ?? null;
const ariaLabel = (html: string) => /<button[^>]*class="companion-launch-main"[^>]*aria-label="([^"]*)"/.exec(html)?.[1] ?? null;

beforeEach(() => { Object.assign(state, { lang: "en", chatInput: "", activeTab: "milestones", topic: null }); });

describe("v3 F-SHELL-2 · the Ask bar's label", () => {
  it.each(["en", "he"] as const)("no question: the full line, and it is the button's accessible name (%s)", lang => {
    state.lang = lang;
    const full = translate(lang, "companion.input.talk-with-arbor-text-photo-or-voice");
    expect(full).toBe(lang === "he" ? "שואלים את ארבור — טקסט, תמונה או קול" : "Ask Arbor — text, photo or voice");
    const html = render();
    expect(label(html)).toBe(full);
    expect(ariaLabel(html)).toBe(full);
    expect(html).not.toContain('id="companion-launch-topic"');
    if (lang === "he") expect(full).not.toMatch(/[A-Za-z]/);
  });

  it.each(["en", "he"] as const)("with a question: FEAT-01 is unchanged, the short Ask plus 'On: <question>' (%s)", lang => {
    state.lang = lang; state.topic = TOPIC;
    const html = render();
    expect(label(html)).toBe(NOW_COPY[lang].talk);
    const on = translate(lang, "companion.launcher.topic").replace("{title}", TOPIC.title);
    const line = html.match(/<span id="companion-launch-topic"[\s\S]*?<\/bdi>[^<]*<\/span>/)?.[0] ?? "";
    expect(line.replace(/<[^>]+>/g, "")).toBe(on);
    // The accessible name still says what the bar does in full.
    expect(ariaLabel(html)).toBe(translate(lang, "companion.input.talk-with-arbor-text-photo-or-voice"));
  });

  it("a draft still reads Continue your draft, question or not", () => {
    state.chatInput = "A question in progress";
    expect(label(render())).toBe(translate("en", "companion.input.continue-your-draft"));
    state.topic = TOPIC;
    expect(label(render())).toBe(translate("en", "companion.input.continue-your-draft"));
  });
});
