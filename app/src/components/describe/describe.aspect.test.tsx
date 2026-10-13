/**
 * v3 F-CHILD-3 — the About pill opens the ONE guided conversation
 * (TellArborMore), never a fork:
 *  - "Write" is the conversation as it was; "Tell Arbor by voice" is the same
 *    surface with the mic first (dictation still starts only on the tap), and
 *    where the browser cannot dictate it says so and the field works;
 *  - an area's "Tell more" / ?aspect=<id> opens it on that area: the area's
 *    fill is pressed and the opening question names it (EN + HE);
 *  - the quick fills are About's eight areas; a fill picks the area
 *    (aria-pressed, the filled navy chip) and never writes into the field;
 *    without an area picker there are no fills (onboarding keeps its tiles);
 *  - a bottom sheet below lg, the centred dialog above it.
 * Synthetic child only.
 */
import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const h = vi.hoisted(() => ({ lang: "en" as "en" | "he", compact: false, buttons: [] as Array<Record<string, any>> }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: h.lang, aiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: { id: "synthetic-kid", name: "Noa", strengths: [], challenges: [], interests: [] },
  milestones: [], setMilestoneObservation: vi.fn(), restoreMilestone: vi.fn(), retryMemoryReview: vi.fn(),
}) }));
vi.mock("../../context/ProfileContext", () => ({ useProfile: () => ({ updateChild: async () => true }) }));
vi.mock("../../lib/describeChildClient", () => ({
  describeServices: () => ({
    profile: () => ({}),
    draft: async () => ({ items: [], nextQuestion: null }),
    commit: async (plan: unknown) => ({ plan, memoryIds: [], milestonesBefore: [] }),
    undo: async () => {},
    now: () => new Date("2026-10-10T09:00:00Z"),
  }),
  primeQuestionVoice: () => null,
}));
vi.mock("../ui/Modal", () => ({ Modal: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-surface="modal">{children}</div> : null) }));
vi.mock("../ui/Sheet", () => ({
  Sheet: ({ open, children }: { open: boolean; children: React.ReactNode }) => (open ? <div data-surface="sheet">{children}</div> : null),
  useCompactSurface: () => h.compact,
}));
// Capture every rendered <button>'s props so a tap can be replayed (h is hoisted).
vi.mock("react/jsx-runtime", async (original) => {
  const r = await original<typeof import("react/jsx-runtime")>();
  return { ...r,
    jsx: (...args: Parameters<typeof r.jsx>) => { if (args[0] === "button") h.buttons.push(args[1] as Record<string, any>); return r.jsx(...args); },
    jsxs: (...args: Parameters<typeof r.jsxs>) => { if (args[0] === "button") h.buttons.push(args[1] as Record<string, any>); return r.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async (original) => {
  const r = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...r, jsxDEV: (...args: Parameters<typeof r.jsxDEV>) => { if (args[0] === "button") h.buttons.push(args[1] as Record<string, any>); return r.jsxDEV(...args); } };
});

import { translate } from "../../lib/i18n";
import { ASPECT_IDS } from "../../lib/aboutAspects";
import DescribeChild from "./DescribeChild";
import TellArborMore from "./TellArborMore";

const unescape = (html: string) => html.replace(/&#x27;/g, "'").replace(/&quot;/g, '"').replace(/&amp;/g, "&");
const openingOf = (html: string) => {
  const at = html.indexOf('data-testid="describe-opening"');
  return unescape(html.slice(html.indexOf(">", at) + 1, html.indexOf("</p>", at)));
};
const fills = (html: string) => [...html.matchAll(/<button[^>]*data-fill="([a-z]+)"[^>]*>/g)].map((m) => ({ id: m[1], tag: m[0] }));
const speech = () => vi.stubGlobal("window", { SpeechRecognition: class {} });

beforeEach(() => { h.buttons = []; h.compact = false; vi.stubGlobal("localStorage", { getItem: () => "1", setItem: () => {} }); });
afterEach(() => { vi.unstubAllGlobals(); h.lang = "en"; });

describe.each(["en", "he"] as const)("the About door's conversation (%s)", (lang) => {
  beforeEach(() => { h.lang = lang; });

  it("the quick fills are About's eight areas, in order, named as on About", () => {
    const html = renderToStaticMarkup(<DescribeChild name="Noa" lang={lang} value="" onChange={() => {}} aspect="sleep" onAspect={() => {}} />);
    const chips = fills(html);
    expect(chips.map((c) => c.id)).toEqual([...ASPECT_IDS]);
    for (const id of ASPECT_IDS) expect(unescape(html)).toContain(translate(lang, `companion.about.aspect.${id}`));
    for (const chip of chips) expect(chip.tag, chip.id).toContain(`aria-pressed="${chip.id === "sleep"}"`);
    // without an area picker there are no fills at all (no dead insert path)
    expect(fills(renderToStaticMarkup(<DescribeChild name="Noa" lang={lang} value="" onChange={() => {}} />))).toHaveLength(0);
  });

  it("an area's Tell more opens on that area: its fill is pressed and the opening names it", () => {
    const html = renderToStaticMarkup(<TellArborMore onClose={() => {}} aspect="sleep" />);
    expect(html).toContain('data-testid="tell-arbor-more" data-aspect="sleep" data-mode="write"');
    const area = translate(lang, "companion.about.aspect.sleep");
    expect(openingOf(html)).toBe(translate(lang, "elev.describe.openingAspect", { name: "Noa", area: lang === "he" ? area : area.toLocaleLowerCase("en") }));
    for (const chip of fills(html)) expect(chip.tag, chip.id).toContain(`aria-pressed="${chip.id === "sleep"}"`);
  });

  it("Write with no area asks the plain opening; nothing is pressed", () => {
    const html = renderToStaticMarkup(<TellArborMore onClose={() => {}} />);
    expect(html).not.toContain("data-aspect=");
    expect(html).toContain('data-mode="write"');
    expect(openingOf(html)).toBe(translate(lang, "elev.describe.opening", { name: "Noa" }));
    expect(fills(html)).toHaveLength(8);
    expect(fills(html).every((c) => c.tag.includes('aria-pressed="false"'))).toBe(true);
    expect(html).not.toContain('data-testid="describe-voice-lead"');
  });

  it("Tell Arbor by voice: the same surface with the mic first and the voice lead", () => {
    speech();
    const html = renderToStaticMarkup(<TellArborMore onClose={() => {}} mode="voice" />);
    expect(html).toContain('data-mode="voice"');
    expect(html).toContain('data-testid="describe-voice-lead"');
    expect(unescape(html)).toContain(translate(lang, "elev.describe.voiceLead"));
    const mic = html.indexOf('data-testid="describe-mic"');
    expect(mic).toBeGreaterThan(-1);
    expect(mic).toBeLessThan(html.indexOf('data-testid="describe-text"'));
    expect(html).not.toContain('data-testid="describe-voice-unavailable"');
  });

  it("Write keeps the field first and the mic after it", () => {
    speech();
    const html = renderToStaticMarkup(<TellArborMore onClose={() => {}} />);
    expect(html.indexOf('data-testid="describe-text"')).toBeLessThan(html.indexOf('data-testid="describe-mic"'));
  });

  it("voice where the browser cannot dictate: it says so and typing works", () => {
    const html = renderToStaticMarkup(<TellArborMore onClose={() => {}} mode="voice" />);
    expect(html).toContain('data-testid="describe-voice-unavailable"');
    expect(html).toMatch(/role="status" data-testid="describe-voice-unavailable"/);
    expect(unescape(html)).toContain(translate(lang, "elev.describe.voiceUnavailable"));
    expect(html).not.toContain('data-testid="describe-mic"');
    expect(html).not.toContain('data-testid="describe-voice-lead"');
    expect(html).toContain('data-testid="describe-text"');
  });
});

describe("the fill tap and the surface", () => {
  it("on the About door a fill picks the area (onAspect), it does not write into the field", () => {
    const onAspect = vi.fn();
    const onChange = vi.fn();
    renderToStaticMarkup(<DescribeChild name="Noa" lang="en" value="" onChange={onChange} aspect="lang" onAspect={onAspect} />);
    h.buttons.find((b) => b["data-fill"] === "school")!.onClick();
    expect(onAspect).toHaveBeenCalledWith("school");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("the pressed fill is styled: the filled navy chip, the same pressed fill as Together's filter row", () => {
    const css = readFileSync(new URL("./describe.css", import.meta.url), "utf8");
    const rule = css.match(/\.describe-chip\[aria-pressed="true"\]\s*\{([^}]*)\}/);
    expect(rule, "describe.css styles .describe-chip[aria-pressed=\"true\"]").not.toBeNull();
    const body = rule![1];
    expect(body).toMatch(/(^|;|\s)background:\s*var\(--arbor-subtab-active\)/);
    expect(body).toMatch(/(^|;|\s)color:\s*var\(--arbor-subtab-on-ink\)/);
    expect(body).toMatch(/border-color:\s*var\(--arbor-subtab-active\)/);
  });

  it("an opening passed by the container replaces the default question", () => {
    const html = renderToStaticMarkup(<DescribeChild name="Noa" lang="en" value="" onChange={() => {}} opening="Tell me about Noa's sleep." />);
    expect(openingOf(html)).toBe("Tell me about Noa's sleep.");
  });

  it("a bottom sheet below lg, the centred dialog above it — one flow either way", () => {
    h.compact = true;
    const sheet = renderToStaticMarkup(<TellArborMore onClose={() => {}} aspect="lang" />);
    expect(sheet).toMatch(/^<div data-surface="sheet">/);
    expect(sheet).toContain('data-testid="tell-arbor-more"');
    h.compact = false;
    const modal = renderToStaticMarkup(<TellArborMore onClose={() => {}} aspect="lang" />);
    expect(modal).toMatch(/^<div data-surface="modal">/);
    expect(modal).toContain('data-testid="tell-arbor-more"');
  });
});
