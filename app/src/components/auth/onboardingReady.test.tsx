/** B-SHELL-36 supersedes the four-step summary / B-SHELL-08 model answer. */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { initialFirstRunState, firstRunCard, FirstRunController } from "../../lib/onboardingFirstRun";
import { DOMAIN_IDS } from "../../lib/domains/registry";
import { translate } from "../../lib/i18n";
import { HARD_MOMENT_PILOT } from "../../content/pilotRelease";
const state = vi.hoisted(() => ({ lang: "en" as "en" | "he", buttons: [] as Record<string, any>[], inputs: [] as Record<string, any>[] }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ profiles: [], isCurrentSession: () => true, addChild: vi.fn(), updateChild: vi.fn(), setActiveChild: vi.fn() }) }));
vi.mock("../../context/AuthContext", () => ({ useAuth: () => ({ user: { uid: "owner" } }) }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => { throw new Error("Pre-shell must not require ArborProvider"); } }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: () => ({ items: [], loaded: true, error: false, upsert: vi.fn() }) }));
vi.mock("../../lib/analytics", () => ({ track: vi.fn() }));
vi.mock("../../lib/kpiEvents", () => ({ trackOnboardingCompleted: vi.fn() }));
vi.mock("../billing/LegalLinks", () => ({ LegalLinks: () => <span>Privacy · Terms · Support</span> }));
vi.mock("../ui/SpeakButton", () => ({ SpeakButton: () => null }));
vi.mock("../behaviors/HardMomentsSection", () => ({ HardMomentGuideContent: ({ card }: { card: { escalation: { en: string; he: string } } }) => <p>{card.escalation[state.lang]}</p> }));
const capture = vi.hoisted(() => (type: unknown, props: any) => {
  if (type === "button") state.buttons.push(props);
  if (type === "input" || type === "textarea" || type === "select") state.inputs.push(props);
});
vi.mock("react/jsx-runtime", async original => {
  const real = await original<typeof import("react/jsx-runtime")>();
  return { ...real, jsx: (...args: Parameters<typeof real.jsx>) => { capture(args[0], args[1]); return real.jsx(...args); }, jsxs: (...args: Parameters<typeof real.jsxs>) => { capture(args[0], args[1]); return real.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const real = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...real, jsxDEV: (...args: Parameters<typeof real.jsxDEV>) => { capture(args[0], args[1]); return real.jsxDEV(...args); } };
});
import OnboardingFlow, { StepChild, StepDomains, StepReady, ONBOARDING_CHOICES } from "./OnboardingFlow";
const NOW = new Date("2026-10-09T12:00:00Z");
const base = () => ({ ...initialFirstRunState(), name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true });
const nothing = () => {};
const flow = readFileSync(new URL("./OnboardingFlow.tsx", import.meta.url), "utf8");
beforeEach(() => { state.lang = "en"; state.buttons = []; state.inputs = []; vi.useFakeTimers(); vi.setSystemTime(NOW); vi.stubGlobal("fetch", vi.fn(() => { throw new Error("First run must stay local"); })); });
afterEach(() => { expect(globalThis.fetch).not.toHaveBeenCalled(); vi.unstubAllGlobals(); vi.useRealTimers(); });

describe("three-step authored first run", () => {
  it("a fresh signed-in root starts About, three progress dots, no welcome/tool tour", () => {
    const html = renderToStaticMarkup(<OnboardingFlow />);
    expect(html).toContain('data-testid="onboarding-about"'); expect(html).toContain('aria-valuemax="3"');
    expect(html).not.toContain("onboarding-promise-card"); expect(html).not.toMatch(/First steps|1 of 4|Create.*comic|demo/i);
    expect(state.inputs.find(input => input.type === "month")?.value).toBe("");
  });
  it.each(["en", "he"] as const)("Continue is disabled until a birth month is supplied (%s)", lang => {
    state.lang = lang; const s = { ...base(), birthMonth: "" };
    const html = renderToStaticMarkup(<StepChild state={s} onEdit={nothing} onNext={nothing} />);
    expect(html).toContain('type="month"'); expect(html).not.toContain('type="range"'); expect(html).not.toContain('type="number"');
    expect(state.buttons.find(button => button.className === "first-run-primary")?.disabled).toBe(true);
    state.buttons = []; renderToStaticMarkup(<StepChild state={base()} onEdit={nothing} onNext={nothing} />);
    expect(state.buttons.find(button => button.className === "first-run-primary")?.disabled).toBe(false);
  });
  it("actual month, languages and consent controls call the supplied editor", () => {
    const edit = vi.fn(); renderToStaticMarkup(<StepChild state={{ ...base(), languages: [] }} onEdit={edit} onNext={nothing} />);
    state.inputs.find(input => input.type === "month")!.onChange({ target: { value: "2023-08" } });
    state.buttons.find(button => button.children === "Hebrew")!.onClick();
    state.inputs.find(input => input.type === "checkbox")!.onChange({ target: { checked: true } });
    expect(edit.mock.calls).toEqual([[{ birthMonth: "2023-08" }], [{ languages: ["Hebrew"] }], [{ consent: true }]]);
  });
  it.each(["en", "he"] as const)("the worry screen has exactly ten registry-backed single-select tiles (%s)", lang => {
    state.lang = lang; const edit = vi.fn(); const html = renderToStaticMarkup(<StepDomains state={base()} onWorry={edit} onNext={nothing} />);
    expect(ONBOARDING_CHOICES).toEqual([...DOMAIN_IDS, "hard-moment", "nothing"]);
    expect((html.match(/data-choice=/g) ?? [])).toHaveLength(10); expect(html).not.toContain("elev.domains.");
    expect((html.match(/aria-pressed="true"/g) ?? [])).toHaveLength(1);
    state.buttons.find(button => button["data-choice"] === "talking")!.onClick();
    expect(edit).toHaveBeenCalledWith({ choice: "talking", hardMomentId: "", quote: "" });
    state.inputs.find(input => input.rows === 2)!.onChange({ target: { value: "My words" } }); expect(edit).toHaveBeenLastCalledWith({ words: "My words" });
  });
  it.each(["en", "he"] as const)("an area card has one primary accept, with no replay or model answer (%s)", lang => {
    state.lang = lang; const s = base(); s.worry.choice = "thinking"; const submit = vi.fn();
    const html = renderToStaticMarkup(<StepReady state={s} card={firstRunCard(s, lang, NOW)} onWorry={nothing} onSubmit={submit} ready />);
    expect((html.match(/<button\b/g) ?? [])).toHaveLength(1); expect(html).toContain(translate(lang, "ob.first.try").replace(/'/g, "&#x27;"));
    state.buttons[0].onClick(); expect(submit).toHaveBeenCalledOnce();
    expect(html).not.toMatch(/demo|AI-powered|1 of 4/i);
  });
  it("hard-moment preview keeps pilot disclosure and escalation verbatim; expiry becomes Feelings", () => {
    const s = base(); s.worry = { ...s.worry, choice: "hard-moment", hardMomentId: "tantrum" };
    const card = firstRunCard(s, "en", NOW); const html = renderToStaticMarkup(<StepReady state={s} card={card} onWorry={nothing} onSubmit={nothing} ready />);
    expect(html).toContain("not had individual clinical review"); expect(html).toContain('data-testid="onboarding-escalation"');
    expect(html).toContain(card.guide!.escalation.en.replace(/'/g, "&#x27;"));
    const expired = firstRunCard(s, "en", new Date(HARD_MOMENT_PILOT.expiresAt));
    const fallback = renderToStaticMarkup(<StepReady state={s} card={expired} onWorry={nothing} onSubmit={nothing} ready />);
    expect(fallback).toContain("Feelings &amp; behaviour"); expect(fallback).not.toContain("Pilot guide");
  });
  it("urgent language shows immediate human support before advancing, with no delayed 'try today' CTA", () => {
    const s = base(); s.worry.words = "he wants to hurt himself";
    expect(renderToStaticMarkup(<StepDomains state={s} onWorry={nothing} onNext={nothing} />)).toContain('href="tel:101"');
    state.buttons = []; const html = renderToStaticMarkup(<StepReady state={s} card={firstRunCard(s, "en", NOW)} onWorry={nothing} onSubmit={nothing} ready />);
    expect(html).not.toContain("I'll try it today"); expect(html).toContain("emergency services");
  });
  it("a cold/erroring action collection keeps acceptance disabled", () => {
    const s = base(); renderToStaticMarkup(<StepReady state={s} card={firstRunCard(s, "en", NOW)} onWorry={nothing} onSubmit={nothing} ready={false} />);
    expect(state.buttons[0].disabled).toBe(true);
  });
  it.each(["en", "he"] as const)("a dangerous Talking quote replaces ordinary say-back and helper copy (%s)", lang => {
    state.lang = lang; const s = base(); s.worry.choice = "talking"; s.worry.quote = "I want to hurt myself";
    const html = renderToStaticMarkup(<StepReady state={s} card={firstRunCard(s, lang, NOW)} onWorry={nothing} onSubmit={nothing} ready />);
    expect(html).toContain('data-testid="onboarding-urgent-support"'); expect(html).toContain('href="tel:101"');
    expect(html).not.toContain(translate(lang, "ob.first.whyQuote"));
    expect(state.buttons[0].children).toBe(translate(lang, "ob.step.continue"));
  });
  it("source guard: no first-run API, coach seed, comic generation or journey mutation", () => {
    expect(flow).not.toMatch(/import.*(?:lib\/api|firstComic|onboardingJourney)|prewarmFirstComic\(|markWowPending\(|setCoachSeed\(/);
    expect(readFileSync(new URL("../../lib/onboardingFirstRun.ts", import.meta.url), "utf8")).not.toMatch(/fetch\(|api\.|\/chat/);
    const wow = readFileSync(new URL("../onboarding/WowOnboarding.tsx", import.meta.url), "utf8");
    expect(wow).toContain("export function WowOnboarding() { return null; }");
    const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8"); expect(shell).toContain("<WowOnboarding />");
    const now = readFileSync(new URL("../companion/NowView.tsx", import.meta.url), "utf8"); expect(now).not.toContain("FirstStepsRail");
    const modules = readFileSync(new URL("../overview/todayModules.ts", import.meta.url), "utf8"); expect(modules).not.toMatch(/rail\??\s*:/);
  });
  it("controller callbacks behind the actual fields retain edits while going backward", async () => {
    const c = new FirstRunController(null, { addChild: async input => ({ ...input, id: "new" }), updateChild: async () => true, accept: async () => {}, lang: () => "en", now: () => NOW });
    c.edit({ name: "Noa", birthMonth: "2022-04", languages: ["English"], consent: true });
    renderToStaticMarkup(<StepChild state={c.snapshot()} onEdit={patch => c.edit(patch)} onNext={() => c.next()} />);
    await state.buttons.find(button => button.className === "first-run-primary")!.onClick();
    state.buttons = []; renderToStaticMarkup(<StepDomains state={c.snapshot()} onWorry={patch => c.worry(patch)} onNext={() => c.next()} />);
    state.buttons.find(button => button["data-choice"] === "body")!.onClick(); await state.buttons.find(button => button.className === "first-run-primary")!.onClick();
    expect(c.snapshot().step).toBe(3); c.back(); expect(c.snapshot().worry.choice).toBe("body"); c.back(); expect(c.snapshot().birthMonth).toBe("2022-04");
  });
});
