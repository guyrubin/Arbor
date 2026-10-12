import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { Milestone } from "../../types";
import { PORTRAIT_COPY } from "./portraitCopy";

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he", loading: false, error: false, more: false, confirmed: true,
  observations: [] as Observation[], setActiveTab: vi.fn(), loadMore: vi.fn(), seedCoach: vi.fn(),
  milestones: [] as Milestone[],
  // v3 FEAT-08: the loaded record's raw sources, which the words-and-firsts strip reads.
  sources: { behaviorLogs: [] } as Record<string, unknown[]>,
  buttons: [] as { children?: React.ReactNode; onClick?: () => void; "data-testid"?: string; "data-domain"?: string }[],
  // v3 FEAT-03: a tiny stateful SSR harness (as PortraitWatchRow.test) so a tile click survives into the next render.
  keepState: false, cursor: 0, hooks: [] as unknown[],
  sheet: null as null | { domain: DomainId | null; onClose: () => void; onCheck: () => void; onExplore: (d: DomainId) => void; onOpenMoments: (d: DomainId) => void },
}));
vi.mock("react", async original => {
  const actual = await original<typeof import("react")>();
  return { ...actual, useState: (initial: unknown) => {
    if (!state.keepState) return actual.useState(initial);
    const index = state.cursor++;
    if (!(index in state.hooks)) state.hooks[index] = typeof initial === "function" ? initial() : initial;
    return [state.hooks[index], (next: unknown) => { state.hooks[index] = typeof next === "function" ? next(state.hooks[index]) : next; }];
  } };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "child-a", name: "Noa", interests: [], strengths: ["Curiosity"] }, milestones: state.milestones, setActiveTab: state.setActiveTab, seedCoach: state.seedCoach, openCaptureSheet: vi.fn(), requestJournalFocus: vi.fn() }) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({ ...state, sources: state.sources, reload: vi.fn() }) }));
vi.mock("../ui/Modal", () => ({ Modal: () => null }));
// Parity 9 Oct: the watch row and the keepsake disclosure have their own tests.
vi.mock("./PortraitWatchRow", () => ({ default: () => <div data-testid="watch-row" /> }));
vi.mock("./PortraitKeepsakes", () => ({ default: () => <div data-testid="keepsakes-disclosure" /> }));
// B-SHELL-39: the kept-description card has its own tests (components/describe).
vi.mock("../describe/KeptDescription", () => ({ default: () => null }));
// v3 FEAT-03: the domain sheet has its own tests (DomainSheet.test.tsx); here only its wiring.
// The stand-in carries no role: only ui/Modal and ui/Sheet own a dialog (ui/overlays.test.ts).
vi.mock("./DomainSheet", () => ({ default: (props: NonNullable<typeof state.sheet>) => {
  state.sheet = props;
  return props.domain ? <div data-testid="domain-sheet-mock" data-domain={props.domain} /> : null;
} }));
const capture = (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") state.buttons.push(props as typeof state.buttons[number]); };
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...args: Parameters<typeof runtime.jsx>) => { capture(args[0], args[1]); return runtime.jsx(...args); }, jsxs: (...args: Parameters<typeof runtime.jsxs>) => { capture(args[0], args[1]); return runtime.jsxs(...args); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...args: Parameters<typeof runtime.jsxDEV>) => { capture(args[0], args[1]); return runtime.jsxDEV(...args); } };
});
import ChildPortrait from "./ChildPortrait";
import { DOMAIN_IDS, domainName } from "../../lib/domains/registry";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES } from "../../lib/milestoneData";
import { noticedByDomain } from "../../lib/milestones/domainMap";
import { portraitDiscussionPrompt } from "./portraitModel";

beforeEach(() => {
  vi.clearAllMocks(); state.lang = "en"; state.observations = []; state.loading = false; state.more = false; state.error = false; state.confirmed = true; state.buttons = [];
  state.milestones = []; state.keepState = false; state.cursor = 0; state.hooks = []; state.sheet = null; state.sources = { behaviorLogs: [] };
});

describe("Growth record coverage and restored doors", () => {
  it.each(["en", "he"] as const)("renders truthful loading, partial and complete states in %s", lang => {
    state.lang = lang;
    state.loading = true; let html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain('data-history-state="loading"'); expect(html).toContain(PORTRAIT_COPY[lang].loading);
    state.loading = false; state.more = true; html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain('data-history-state="partial"'); expect(html).toContain(PORTRAIT_COPY[lang].more);
    const older = state.buttons.find(button => React.Children.toArray(button.children).includes(PORTRAIT_COPY[lang].more));
    older?.onClick?.(); expect(state.loadMore).toHaveBeenCalledOnce();
    state.more = false; html = renderToStaticMarkup(<ChildPortrait />); expect(html).toContain('data-history-state="complete"');
    state.error = true; html = renderToStaticMarkup(<ChildPortrait />); expect(html).toContain('data-history-state="error"');
  });
  it("puts the core record lenses before the optional watch controls", () => {
    const html = renderToStaticMarkup(<ChildPortrait />);
    expect(html.indexOf('class="portrait-toolbar"')).toBeGreaterThan(-1);
    expect(html.indexOf('class="portrait-toolbar"')).toBeLessThan(html.indexOf('data-testid="watch-row"'));
    expect(html).toContain('data-primary-move="explore-child-record"');
  });
  it("renders a neutral moment with a neutral glyph and a visible unfiled door", () => {
    state.observations = [{ id: "behaviorLogs:a", childId: "child-a", at: new Date().toISOString(), domains: [], kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false }];
    const html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).toContain(PORTRAIT_COPY.en.unfiled); expect(html).toContain("portrait-unfiled"); expect(html).not.toContain(">undefined<");
  });
  it("gives reports, patterns and plans working visible navigation handlers", () => {
    renderToStaticMarkup(<ChildPortrait />);
    for (const [label, route] of [[PORTRAIT_COPY.en.reports, "reports"], [PORTRAIT_COPY.en.behavior, "behaviors"], [PORTRAIT_COPY.en.plans, "plans"]]) {
      const button = state.buttons.find(button => React.Children.toArray(button.children).includes(label));
      expect(button).toBeDefined(); button?.onClick?.(); expect(state.setActiveTab).toHaveBeenLastCalledWith(route);
    }
  });
});

/* v3 FEAT-03 — the development map at the top of My child, and its domain
   sheet's wiring. Counts only: a blank area says "No record yet"; nothing on
   the map is a fraction, a share or a not-yet number. */
describe("v3 FEAT-03 — the development map on My child", () => {
  const render = (props: React.ComponentProps<typeof ChildPortrait> = {}) => { state.cursor = 0; state.buttons = []; return renderToStaticMarkup(<ChildPortrait {...props} />); };
  const tile = (domain: DomainId) => state.buttons.find(b => b["data-testid"] === "dev-map-tile" && b["data-domain"] === domain);
  const mapSlice = (html: string) => html.slice(html.lastIndexOf("<section", html.indexOf('data-testid="dev-map"')), html.indexOf('class="portrait-toolbar"'));
  // Visible words: icon ligatures (<span class="msr">diversity_3</span>) are glyphs, not text.
  const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ");
  const SHEET = /<div data-testid="domain-sheet-mock" data-domain="([a-z]+)"/;
  const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");

  it.each(["en", "he"] as const)("mounts eight area tiles inside the overview, before the record lenses, with no verdict (%s)", lang => {
    state.lang = lang;
    const html = render();
    const overview = html.indexOf('data-module="child-portrait-overview"');
    const map = html.indexOf('data-testid="dev-map"');
    expect(overview).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(overview);
    expect(map).toBeLessThan(html.indexOf('class="portrait-toolbar"'));
    expect(map).toBeLessThan(html.indexOf('data-module="child-portrait-evidence"'));
    const slice = mapSlice(html);
    expect(slice.match(/data-testid="dev-map-tile"/g)).toHaveLength(8);
    expect(slice.match(/data-testid="dev-map-none"/g)).toHaveLength(8);
    expect([...slice.matchAll(/data-testid="dev-map-tile" data-domain="([a-z]+)"/g)].map(m => m[1])).toEqual([...DOMAIN_IDS]);
    // The map is part of the overview module: no module stamp and no primary move of its own.
    expect(slice).not.toContain("data-module");
    expect(slice).not.toContain("data-primary-move");
    expect(html.match(/data-primary-move="/g)).toHaveLength(1);
    const text = words(slice);
    expect(text).toContain(esc(translate(lang, "companion.devMap.none")));
    expect(text).toContain(esc(translate(lang, "companion.devMap.note")));
    expect(text).toContain(esc(translate(lang, "companion.devMap.check")));
    expect(text).not.toMatch(/%|\/|companion\./);
    // An empty record puts no number on any tile (the "5" lives only in the check's label).
    const grid = slice.slice(slice.indexOf('class="dev-map-grid"'), slice.indexOf("</ul>"));
    expect(words(grid)).not.toMatch(/\d/);
    expect(html).not.toMatch(SHEET);
  });

  it("reads the same milestone documents #/milestones writes: a Seen-it answer shows as pips on its own area only", () => {
    const first = ALL_MILESTONES[0];
    const marked = { ...first, checked: true, observationStatus: "yes" as const };
    const area = DOMAIN_IDS.find(id => noticedByDomain([marked])[id] === 1)!;
    expect(area).toBeDefined();
    state.milestones = ALL_MILESTONES.map(m => (m.id === first.id ? marked : { ...m }));
    const slice = mapSlice(render());
    expect(slice.match(/data-testid="count-pips"/g)).toHaveLength(1);
    expect(slice).toContain(`data-testid="count-pips" data-domain="${area}"`);
    expect(slice.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
    expect(words(slice)).not.toMatch(/%|\//);
  });

  it("a tile opens that area's domain sheet and closing it returns the map; the primary move stays one", () => {
    state.keepState = true;
    let html = render();
    expect(state.sheet?.domain).toBeNull();
    expect(html).not.toMatch(SHEET);
    tile("talking")!.onClick!();
    html = render();
    expect(html.match(SHEET)?.[1]).toBe("talking");
    expect(html.match(/data-primary-move="/g)).toHaveLength(1);
    expect(html.match(/data-testid="dev-map-tile"/g)).toHaveLength(8);
    state.sheet!.onClose();
    html = render();
    expect(html).not.toMatch(SHEET);
  });

  it("the map's check and the sheet's check both open the 5-minute development check", () => {
    state.keepState = true;
    render();
    state.buttons.find(b => b["data-testid"] === "dev-map-check")!.onClick!();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("screening");
    state.setActiveTab.mockClear();
    tile("hands")!.onClick!();
    render();
    state.sheet!.onCheck();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("screening");
    expect(render()).not.toMatch(SHEET);
  });

  it("Explore this with Arbor asks about the area through the portrait's own door, then closes the sheet", () => {
    state.keepState = true;
    const onDiscuss = vi.fn();
    render({ onDiscuss });
    tile("moving")!.onClick!();
    render({ onDiscuss });
    state.sheet!.onExplore("moving");
    expect(onDiscuss).toHaveBeenCalledOnce();
    expect(onDiscuss).toHaveBeenCalledWith(portraitDiscussionPrompt(["moving"], d => domainName(d, k => translate("en", k)), false), "child-a");
    expect(render({ onDiscuss })).not.toMatch(SHEET);
    // Without a host door the portrait seeds the coach itself.
    tile("feelings")!.onClick!();
    render();
    state.sheet!.onExplore("feelings");
    expect(state.seedCoach).toHaveBeenCalledWith({ prompt: portraitDiscussionPrompt(["feelings"], d => domainName(d, k => translate("en", k)), false), source: "child-portrait" });
  });

  it("Open the moments switches to the area lens and closes the sheet", () => {
    state.keepState = true;
    let html = render();
    expect(html).not.toContain("portrait-domain-view");
    tile("playing")!.onClick!();
    render();
    state.sheet!.onOpenMoments("playing");
    html = render();
    expect(html).toContain("portrait-domain-view");
    expect(html).not.toMatch(SHEET);
    expect(html.match(/data-primary-move="/g)).toHaveLength(1);
  });

  it("Open the moments lists the area over the whole record, the set the area lens shows once the period reads the entire record", () => {
    state.keepState = true;
    const daysAgo = (n: number) => new Date(Date.now() - n * 86_400_000).toISOString();
    const entry = (id: string, domains: DomainId[], at: string): Observation => ({ id, childId: "child-a", at, domains, kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false });
    // Invented entries: one Playing moment older than the default three-month period, one recent, one in another area.
    state.observations = [entry("behaviorLogs:play-old", ["playing"], daysAgo(200)), entry("behaviorLogs:play-new", ["playing"], daysAgo(5)), entry("behaviorLogs:talk", ["talking"], daysAgo(5))];
    let html = render();
    expect(html).toContain('<option value="3" selected="">');
    // The tile quotes the newest Playing moment of the whole loaded record.
    expect(mapSlice(html)).toContain('data-testid="dev-map-last"');
    tile("playing")!.onClick!();
    render();
    state.sheet!.onOpenMoments("playing");
    html = render();
    expect(html).toContain('<option value="0" selected="">');
    const selection = state.hooks.find((h): h is { title: string; ids: string[]; domain?: DomainId } => !!h && typeof h === "object" && "ids" in h && "title" in h);
    expect(selection?.domain).toBe("playing");
    expect(selection?.title).toBe(domainName("playing", k => translate("en", k)));
    expect([...(selection?.ids ?? [])].sort()).toEqual(["behaviorLogs:play-new", "behaviorLogs:play-old"]);
  });
});

/* v3 FEAT-08 — the words-and-firsts strip on My child reads the record the
   portrait already loaded. Invented words and an invented custom first only. */
describe("v3 FEAT-08 — the words-and-firsts strip on My child", () => {
  const KEPT = {
    behaviorLogs: [],
    langObs: [
      { id: "w-he", timestamp: "2026-10-05T12:00:00Z", phrase: "ירח", language: "Hebrew" },
      { id: "w-en", timestamp: "2026-09-20T12:00:00Z", phrase: "The moon is following us", language: "English" },
    ],
    milestones: [{ id: "ms-own", custom: true, checked: true, observationStatus: "yes", observedAt: "2026-10-02", title: "Three steps to the sofa", domain: "sensory_motor_patterns", ageGroup: "Custom", description: "x" }],
  };

  it.each(["en", "he"] as const)("shows kept words and the confirmed first inside the overview, between the watch row and the disclosure (%s)", lang => {
    state.lang = lang;
    state.sources = KEPT;
    const html = renderToStaticMarkup(<ChildPortrait />);
    const strip = html.indexOf('data-testid="words-strip"');
    expect(strip).toBeGreaterThan(html.indexOf('data-module="child-portrait-overview"'));
    expect(strip).toBeGreaterThan(html.indexOf('data-testid="watch-row"'));
    expect(strip).toBeLessThan(html.indexOf('data-testid="keepsakes-disclosure"'));
    expect(strip).toBeLessThan(html.indexOf('data-module="child-portrait-evidence"'));
    expect(html).toContain('<bdi dir="auto" lang="he">ירח</bdi>');
    expect(html).toContain('<bdi dir="auto" lang="en">The moon is following us</bdi>');
    expect(html).toContain(`<span class="words-strip-first">${translate(lang, "companion.portrait.words.first")}</span> <bdi dir="auto" lang="und">Three steps to the sofa</bdi>`);
    expect(html.match(/data-testid="words-strip-month"/g)).toHaveLength(2);
    // The overview stays one module with one primary move; the strip adds neither.
    expect(html.match(/data-module="/g)).toHaveLength(3);
    expect(html.match(/data-primary-move="/g)).toHaveLength(1);
  });

  it("Add or see all words opens the words place", () => {
    state.sources = KEPT;
    renderToStaticMarkup(<ChildPortrait />);
    state.buttons.find(b => b["data-testid"] === "words-strip-all")!.onClick!();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("language");
  });

  it("with nothing kept the strip is absent and the disclosure is still there", () => {
    const html = renderToStaticMarkup(<ChildPortrait />);
    expect(html).not.toContain("words-strip");
    expect(html).toContain('data-testid="keepsakes-disclosure"');
  });
});
