import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { DomainId } from "../../lib/domains/registry";
import type { Observation } from "../../lib/observations";
import type { WatchFocus } from "../../lib/screeningWatch";
import type { MemoryReviewItem, Milestone } from "../../types";

/* v3 F-CHILD-1 — My child, the Milestones pill (#/development): the header,
   the three portrait cards and "Milestones across areas", one scroll. Invented
   names, words and catalogue rows only; no child data. A tiny stateful SSR
   harness carries state from one render into the next (as the area-row test),
   so a tap, a write and a stopped watch are followed through the page.
   v3 F-CHILD-4 (MOB-02): `state.phone` drives the phone stack (the page's
   useChildPhoneLayout seam) and `state.compact` the sheet (below lg). */

type Answer = "yes" | "not_yet" | "not_sure";
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  compact: false,
  phone: false,
  sheetClose: null as null | (() => void),
  query: "",
  profile: {} as Record<string, unknown>,
  milestones: [] as Milestone[],
  observations: [] as Observation[],
  sources: { behaviorLogs: [] } as Record<string, unknown[]>,
  screenings: [] as { id: string; answeredAt: string; recheckDueAt?: string }[],
  pending: [] as MemoryReviewItem[],
  watch: null as WatchFocus | null,
  celebrated: false,
  setActiveTab: vi.fn(), seedCoach: vi.fn(), openCaptureSheet: vi.fn(),
  addCustomMilestone: vi.fn((_title: string, _domain: string): Promise<void> => Promise.resolve()),
  keepUpsert: vi.fn((_doc: unknown): Promise<void> => Promise.resolve()),
  keepRemove: vi.fn((_id: string): Promise<void> => Promise.resolve()),
  sheet: null as null | { milestoneId: string; onSave: (draft: { milestoneId: string; note: string; noticedOn: string }) => Promise<unknown>; onRemove: () => Promise<unknown> },
  setMilestoneObservation: vi.fn((_id: string, _status: Answer): Promise<void> | undefined => Promise.resolve()),
  goToRoute: vi.fn(), celebrate: vi.fn(), markCelebrated: vi.fn(), clearWatchFocus: vi.fn(), writeWatchFocus: vi.fn(),
  keepState: false, cursor: 0, hooks: [] as unknown[],
  buttons: [] as { onClick?: () => void; "data-testid"?: string; "data-domain"?: string }[],
  segments: [] as { ariaLabel: string; onAnswer: (status: Answer) => void }[],
  inputs: [] as { onChange?: (e: { target: { value: string } }) => void; "data-testid"?: string }[],
  forms: [] as { onSubmit?: (e: { preventDefault: () => void }) => void; "data-testid"?: string }[],
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
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({
  childProfile: state.profile, milestones: state.milestones, behaviorLogs: [], playLogs: [],
  setActiveTab: state.setActiveTab, seedCoach: state.seedCoach, openCaptureSheet: state.openCaptureSheet,
  setMilestoneObservation: state.setMilestoneObservation, addCustomMilestone: state.addCustomMilestone,
  pendingMemoryItems: state.pending,
}) }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../hooks/useObservationRecord", () => ({ useObservationRecord: () => ({ observations: state.observations, sources: state.sources, reload: vi.fn() }) }));
vi.mock("../../hooks/useChildCollection", async original => ({
  ...(await original<typeof import("../../hooks/useChildCollection")>()),
  useChildCollection: (_childId: string, name: string) => (name === "keepsakes"
    ? { items: [], upsert: state.keepUpsert, remove: state.keepRemove }
    : { items: name === "screenings" ? state.screenings : [], upsert: vi.fn(), remove: vi.fn() }),
}));
vi.mock("../../hooks/useHashQuery", async original => ({
  ...(await original<typeof import("../../hooks/useHashQuery")>()),
  useHashQuery: () => new URLSearchParams(state.query),
  goToRoute: state.goToRoute,
}));
vi.mock("../../lib/screeningWatch", async original => ({
  ...(await original<typeof import("../../lib/screeningWatch")>()),
  readWatchFocus: () => state.watch,
  resolveWatchFocus: (_childId: string, milestones: Milestone[]) => (state.watch ? milestones.find(m => m.id === state.watch!.milestoneId && !m.checked) ?? null : null),
  clearWatchFocus: (...a: unknown[]) => { state.clearWatchFocus(...a); state.watch = null; },
  writeWatchFocus: (childId: string, focus: WatchFocus) => { state.writeWatchFocus(childId, focus); state.watch = focus; },
}));
vi.mock("../../lib/celebrate", async original => ({ ...(await original<typeof import("../../lib/celebrate")>()), celebrate: state.celebrate }));
vi.mock("../ui/CelebrationMoment", async original => ({
  ...(await original<typeof import("../ui/CelebrationMoment")>()),
  hasCelebrated: () => state.celebrated,
  markCelebrated: state.markCelebrated,
}));
type SurfaceProps = { open: boolean; title?: string; children?: React.ReactNode; onClose?: () => void };
// The stand-in carries no role: only ui/Modal and ui/Sheet own a dialog (ui/overlays.test.ts).
// It keeps the page's onClose: the real Sheet calls it on Escape, the backdrop and its close.
vi.mock("../ui/Sheet", async original => ({
  ...(await original<typeof import("../ui/Sheet")>()),
  Sheet: ({ open, title, children, onClose }: SurfaceProps) => {
    state.sheetClose = onClose ?? null;
    return open ? <div data-surface="sheet" data-title={title}>{children}</div> : null;
  },
  useCompactSurface: () => state.compact,
}));
// v3 F-CHILD-4: the phone stack's width seam (a matchMedia read in the app).
vi.mock("./ChildDoors", async original => ({
  ...(await original<typeof import("./ChildDoors")>()),
  useChildPhoneLayout: () => state.phone,
}));
// The goal picker, the describe conversation and the keepsake sheet have their own tests.
vi.mock("../practice/GoalBuilderModal", () => ({ default: ({ childId }: { childId: string }) => <div data-testid="goal-builder" data-child={childId} /> }));
vi.mock("../describe/TellArborMore", () => ({ default: () => <div data-testid="tell-arbor" /> }));
vi.mock("../milestones/FirstKeepsakeSheet", () => ({ default: (props: NonNullable<typeof state.sheet>) => {
  state.sheet = props;
  return <div data-testid="keepsake-sheet" data-milestone={props.milestoneId} />;
} }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (!props || typeof props !== "object") return;
  if ("onAnswer" in props && "ariaLabel" in props) state.segments.push(props as typeof state.segments[number]);
  if (type === "button") state.buttons.push(props as typeof state.buttons[number]);
  if (type === "input") state.inputs.push(props as typeof state.inputs[number]);
  if (type === "form") state.forms.push(props as typeof state.forms[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import ChildPortrait from "./ChildPortrait";
import { DOMAIN_IDS, domainName } from "../../lib/domains/registry";
import { fmtDay } from "../../lib/formatDate";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES, bandForAgeMonths } from "../../lib/milestoneData";
import { noticedByDomain } from "../../lib/milestones/domainMap";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { portraitDiscussionPrompt } from "./portraitModel";

const catalogue = (): Milestone[] => ALL_MILESTONES.map(m => ({ ...m }));
const WORDS = groupMilestonesByShelf(catalogue()).words;
const bandOf = (m: Milestone) => (typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : -1);
const wordBands = [...new Set(WORDS.map(bandOf).filter(b => b >= 0))].sort((a, b) => a - b);
/** A Words band with at least two skills, an earlier band below it and a later band above it. */
const CURRENT = wordBands.find((b, i) => i > 0 && i < wordBands.length - 1 && WORDS.filter(m => bandOf(m) === b).length >= 2)!;
const NOW = WORDS.filter(m => bandOf(m) === CURRENT);
/** The first of the month `months` back, as a local calendar day (no UTC shift). */
const birthDateMonthsAgo = (months: number) => {
  const now = new Date();
  const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
};
const profile = (over: Record<string, unknown> = {}) => ({ id: "child-a", name: "Noa Example", birthDate: birthDateMonthsAgo(CURRENT + 1), strengths: ["Curiosity"], interests: [], ...over });

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
// Visible words: icon ligatures (<span class="msr">diversity_3</span>) are glyphs, not text.
const words = (html: string) => html.replace(/<span class="msr[^"]*"[^>]*>[^<]*<\/span>/g, " ").replace(/<[^>]+>/g, " ").replace(/&#x27;/g, "'").replace(/&amp;/g, "&");
const render = (props: React.ComponentProps<typeof ChildPortrait> = {}) => {
  state.cursor = 0; state.buttons = []; state.segments = []; state.inputs = []; state.forms = [];
  return renderToStaticMarkup(<ChildPortrait {...props} />);
};
const button = (id: string) => state.buttons.find(b => b["data-testid"] === id);
const row = (domain: DomainId) => state.buttons.find(b => b["data-testid"] === "dev-map-row" && b["data-domain"] === domain);
const expanded = (html: string) => [...html.matchAll(/data-testid="dev-map-row" data-domain="([a-z]+)" aria-expanded="true"/g)].map(m => m[1]);
const tile = (domain: DomainId) => state.buttons.find(b => b["data-testid"] === "dev-map-tile" && b["data-domain"] === domain);
const openTiles = (html: string) => [...html.matchAll(/data-testid="dev-map-tile" data-domain="([a-z]+)" aria-expanded="true" aria-haspopup="dialog"/g)].map(m => m[1]);
const t = (lang: "en" | "he") => (key: string) => translate(lang, key);

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.compact = false; state.phone = false; state.sheetClose = null; state.query = ""; state.profile = profile(); state.milestones = catalogue();
  state.observations = []; state.sources = { behaviorLogs: [] }; state.screenings = []; state.pending = []; state.watch = null; state.celebrated = false; state.sheet = null;
  state.setMilestoneObservation.mockImplementation(() => Promise.resolve());
  state.keepState = false; state.cursor = 0; state.hooks = []; state.buttons = []; state.segments = []; state.inputs = []; state.forms = [];
});

describe("v3 F-CHILD-1 — the Milestones pill, one scroll", () => {
  it.each(["en", "he"] as const)("header, three cards, then the eight areas; two modules and one primary move (%s)", lang => {
    state.lang = lang;
    const html = render();
    expect(html).toContain(`data-testid="child-portrait"`);
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    // The header names the child through an isolated placeholder, never "{name}'s" in code.
    expect(html).toContain(esc(translate(lang, "companion.milestones.kicker")));
    const [before, after] = translate(lang, "companion.milestones.title").split("{name}");
    expect(html).toContain(`<h1>${esc(before)}<bdi dir="auto">Noa</bdi>${esc(after)}</h1>`);
    // Order: header → portrait cards → areas.
    const modules = [...html.matchAll(/data-module="([^"]+)"/g)].map(m => m[1]);
    expect(modules).toEqual(["child-milestones-portrait", "child-milestones-areas"]);
    const h1 = html.indexOf("<h1>"), cards = html.indexOf('data-testid="portrait-cards"'), map = html.indexOf('data-testid="dev-map"');
    expect(h1).toBeGreaterThan(-1);
    expect(cards).toBeGreaterThan(h1);
    expect(map).toBeGreaterThan(cards);
    expect(map).toBeGreaterThan(html.indexOf('data-module="child-milestones-areas"'));
    // The 5-minute check is the page's one primary move.
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="dev-map-check" data-primary-move="start-development-check"/);
    expect([...html.matchAll(/data-testid="dev-map-row" data-domain="([a-z]+)" aria-expanded="false"/g)].map(m => m[1])).toEqual([...DOMAIN_IDS]);
    // The record tools, the moments views and the identity button left this page.
    for (const gone of ["portrait-toolbar", "portrait-domain-view", "watch-row", "words-strip", "keepsakes-disclosure", "data-history-state", "<svg"]) expect(html, gone).not.toContain(gone);
    const text = words(html);
    expect(text).not.toMatch(/companion\.|elev\./);
  });

  it.each(["en", "he"] as const)("CLINICAL FIREWALL: counts and the parent's words only — no share, no denominator, no 'n of m' (%s)", lang => {
    state.lang = lang;
    const by = groupMilestonesByShelf(catalogue());
    const marked = new Set([...by.words.slice(0, 5), ...by.moving.slice(0, 2), ...by.food.slice(0, 1)].map(m => m.id));
    state.milestones = catalogue().map(m => (marked.has(m.id) ? { ...m, checked: true, observationStatus: "yes" as const, observationUpdatedAt: new Date(Date.now() - 86_400_000).toISOString() } : { ...m, observationStatus: "not_yet" as const }));
    state.query = "area=talking";
    const text = words(render());
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bof\s+\d+|\d+\s+of\s+\d+|מתוך\s+\d+/);
  });

  it("reads the same milestone documents the answers write: a Seen-it answer shows as pips on its own area only", () => {
    const first = ALL_MILESTONES[0];
    const marked = { ...first, checked: true, observationStatus: "yes" as const };
    const area = DOMAIN_IDS.find(id => noticedByDomain([marked])[id] === 1)!;
    expect(area).toBeDefined();
    state.milestones = ALL_MILESTONES.map(m => (m.id === first.id ? marked : { ...m }));
    const html = render();
    expect(html.match(/data-testid="count-pips"/g)).toHaveLength(1);
    expect(html).toContain(`data-testid="count-pips" data-domain="${area}"`);
    expect(html.match(/data-testid="dev-map-none"/g)).toHaveLength(7);
  });

  it("a row quotes the newest moment in the parent's own words", () => {
    state.sources = { behaviorLogs: [{ id: "l1", timestamp: "2026-06-10T10:00:00.000Z", behaviorType: "Moment", durationMinutes: 0, trigger: "Sang the whole bath song" }] };
    state.observations = [{ id: "behaviorLogs:l1", childId: "child-a", at: "2026-06-10T10:00:00.000Z", domains: ["talking"], kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false }];
    const html = render();
    const talking = html.slice(html.indexOf('data-domain="talking" aria-expanded'), html.indexOf('data-domain="moving" aria-expanded'));
    expect(talking).toContain('data-testid="dev-map-last"');
    expect(talking).toContain("Sang the whole bath song");
  });
});

describe("v3 F-CHILD-1 — the portrait cards", () => {
  it.each(["en", "he"] as const)("a strength in the parent's words, a kept moment with its day, and what we're working on (%s)", lang => {
    state.lang = lang;
    state.sources = { behaviorLogs: [{ id: "l1", timestamp: "2026-06-10T10:00:00.000Z", behaviorType: "Moment", durationMinutes: 0, trigger: "Sang the whole bath song" }] };
    const html = render();
    const strength = html.slice(html.indexOf('data-testid="portrait-card-strength"'), html.indexOf('data-testid="portrait-card-kept"'));
    expect(strength).toContain(esc(translate(lang, "companion.milestones.card.strength")));
    expect(strength).toContain("Curiosity");
    // A line with no record of its own is shown undated, never given an invented day.
    expect(strength).toContain(esc(translate(lang, "companion.milestones.srcWordsUndated")));
    const kept = html.slice(html.indexOf('data-testid="portrait-card-kept"'), html.indexOf('data-testid="portrait-goals-edit"'));
    expect(kept).toContain(esc(translate(lang, "companion.milestones.card.kept")));
    expect(kept).toContain("Sang the whole bath song");
    expect(kept).toContain(esc(translate(lang, "companion.milestones.srcParent", { date: fmtDay("2026-06-10T10:00:00.000Z", lang) })));
    const goal = html.slice(html.indexOf('data-testid="portrait-goals-edit"'), html.indexOf('data-testid="dev-map"'));
    expect(goal).toContain(esc(translate(lang, "elev.goal.profile.title")));
    expect(goal).toContain(esc(translate(lang, "elev.goal.profile.empty")));
    // The mock's card icon; the source line shows only once a goal is chosen.
    expect(goal).toMatch(/<span class="msr[^"]*"[^>]*>bookmark<\/span>/);
    expect(goal).not.toContain('data-testid="portrait-goal-src"');
    // The first two cards are wide-screen only (CSS); the goal card stays on a phone.
    expect(html.match(/class="portrait-card portrait-card-wide"/g)).toHaveLength(2);
    expect(html).toContain('class="portrait-card portrait-card-goal"');
  });

  it.each(["en", "he"] as const)("an empty card says Not told yet and offers Tell Arbor (%s)", lang => {
    state.lang = lang;
    state.keepState = true;
    state.profile = profile({ strengths: [] });
    let html = render();
    expect(html.match(new RegExp(esc(translate(lang, "companion.milestones.notTold")), "g"))).toHaveLength(2);
    expect(html.match(new RegExp(esc(translate(lang, "companion.milestones.tell")), "g"))).toHaveLength(2);
    expect(html).not.toContain('data-testid="tell-arbor"');
    button("portrait-card-strength-tell")!.onClick!();
    html = render();
    expect(html).toContain('data-testid="tell-arbor"');
    button("portrait-card-kept-tell")!.onClick!();
    expect(state.openCaptureSheet).toHaveBeenCalledOnce();
  });

  it("the goal card opens the goal picker the page owns, for this child", () => {
    state.keepState = true;
    let html = render();
    expect(html).not.toContain('data-testid="goal-builder"');
    button("portrait-goals-edit")!.onClick!();
    html = render();
    expect(html).toContain('data-testid="goal-builder" data-child="child-a"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });
});

describe("v3 F-CHILD-1 — one open row", () => {
  it.each(["en", "he"] as const)("?area= opens its row inline on a wide screen, and nothing else (%s)", lang => {
    state.lang = lang;
    state.query = "area=talking";
    const html = render();
    expect(expanded(html)).toEqual(["talking"]);
    const controls = html.match(/data-domain="talking" aria-expanded="true" aria-controls="([^"]+)"/)?.[1];
    expect(controls).toBeTruthy();
    expect(html).toContain(`<div class="area-detail" id="${controls}" data-testid="area-detail" data-domain="talking"`);
    expect(html.match(/data-testid="area-detail"/g)).toHaveLength(1);
    expect(html).not.toContain('data-surface="sheet"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });

  it("the old ?shelf= link opens the area that shelf sits on", () => {
    state.query = "shelf=food";
    expect(expanded(render())).toEqual(["body"]);
  });

  // v3 F-CHILD-4 (MOB-02) RE-PIN: below lg the areas are tiles, not rows — a
  // tile is what opens the bottom sheet (critic ruling 25: the same
  // AreaRowDetail body, inline on a wide screen, in a sheet on a phone).
  it("below lg the open area is a tile that rides a bottom sheet titled with the area", () => {
    state.compact = true;
    state.query = "area=moving";
    const html = render();
    expect(html).not.toContain('data-testid="dev-map-row"');
    expect(openTiles(html)).toEqual(["moving"]);
    expect(html).not.toContain("aria-controls");
    expect(html).not.toContain('class="dev-map-detail"');
    expect(html).toContain(`data-surface="sheet" data-title="${esc(domainName("moving", t("en")))}"`);
    expect(html).toContain('data-testid="area-detail" data-domain="moving"');
    expect(html.match(/data-testid="area-detail"/g)).toHaveLength(1);
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
  });

  it("the sheet opens on the area's newest moment in the parent's words; the tile only names its day", () => {
    state.compact = true;
    state.query = "area=moving";
    state.sources = { behaviorLogs: [{ id: "l2", timestamp: "2026-06-12T10:00:00.000Z", behaviorType: "Moment", durationMinutes: 0, trigger: "Climbed the big slide alone" }] };
    state.observations = [{ id: "behaviorLogs:l2", childId: "child-a", at: "2026-06-12T10:00:00.000Z", domains: ["moving"], kind: "moment", origin: "behaviorLogs", source: "parent_typed", value: { type: "moment", behaviorType: "Moment" }, ageAtObservationMonths: null, pretermCorrected: false }];
    // The areas module (the kept-moment card above it may quote the same words).
    const html = render();
    const areas = html.slice(html.indexOf('data-module="child-milestones-areas"'));
    const sheetAt = areas.indexOf('data-surface="sheet"');
    expect(sheetAt).toBeGreaterThan(-1);
    expect(areas.match(/Climbed the big slide alone/g)).toHaveLength(1);
    expect(areas.indexOf("Climbed the big slide alone")).toBeGreaterThan(sheetAt);
    expect(areas.indexOf('data-testid="area-detail-last"')).toBeGreaterThan(sheetAt);
    const movingTile = areas.slice(areas.indexOf('data-testid="dev-map-tile" data-domain="moving"'), areas.indexOf('data-testid="dev-map-tile" data-domain="hands"'));
    expect(movingTile).toContain('data-testid="dev-map-tile-last"');
    expect(movingTile).toMatch(/<time datetime="2026-06-12T10:00:00\.000Z">/i);
  });

  it("a wide screen keeps the rows and their inline body, with no sheet line", () => {
    state.query = "area=moving";
    const html = render();
    expect(html).not.toContain("dev-map-tiles");
    expect(html).not.toContain('data-testid="area-detail-last"');
    expect(expanded(html)).toEqual(["moving"]);
  });

  it("a tile tap opens its sheet, a second tap closes it, the sheet's close closes it, and another tile takes over", () => {
    state.keepState = true;
    state.compact = true;
    let html = render();
    expect(html).not.toContain('data-surface="sheet"');
    tile("hands")!.onClick!();
    html = render();
    expect(openTiles(html)).toEqual(["hands"]);
    expect(html).toContain(`data-surface="sheet" data-title="${esc(domainName("hands", t("en")))}"`);
    tile("hands")!.onClick!();
    html = render();
    expect(openTiles(html)).toEqual([]);
    expect(html).not.toContain('data-surface="sheet"');
    tile("feelings")!.onClick!();
    html = render();
    expect(openTiles(html)).toEqual(["feelings"]);
    // Escape, the backdrop and the 44 px close all call the page's onClose (ui/Sheet).
    state.sheetClose!();
    html = render();
    expect(openTiles(html)).toEqual([]);
    expect(html).not.toContain('data-testid="area-detail"');
  });

  it("a tap opens a row, a second tap closes it, and another row takes over; never two open", () => {
    state.keepState = true;
    state.query = "area=talking";
    let html = render();
    expect(expanded(html)).toEqual(["talking"]);
    row("feelings")!.onClick!();
    html = render();
    expect(expanded(html)).toEqual(["feelings"]);
    expect(html.match(/data-testid="area-detail"/g)).toHaveLength(1);
    row("feelings")!.onClick!();
    html = render();
    expect(expanded(html)).toEqual([]);
    expect(html).not.toContain('data-testid="area-detail"');
    row("hands")!.onClick!();
    expect(expanded(render())).toEqual(["hands"]);
  });

  it("the card's check and the row's check both open the 5-minute check", () => {
    state.query = "area=hands";
    render();
    button("dev-map-check")!.onClick!();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("screening");
    state.setActiveTab.mockClear();
    button("area-detail-check")!.onClick!();
    expect(state.setActiveTab).toHaveBeenLastCalledWith("screening");
  });

  it("Explore this with Arbor asks about the area through Talk's door; without one the portrait seeds the coach", () => {
    const onDiscuss = vi.fn();
    state.query = "area=moving";
    render({ onDiscuss });
    button("area-detail-explore")!.onClick!();
    expect(onDiscuss).toHaveBeenCalledOnce();
    expect(onDiscuss).toHaveBeenCalledWith(portraitDiscussionPrompt(["moving"], d => domainName(d, t("en")), false), "child-a");
    state.query = "area=feelings";
    render();
    button("area-detail-explore")!.onClick!();
    expect(state.seedCoach).toHaveBeenCalledWith({ prompt: portraitDiscussionPrompt(["feelings"], d => domainName(d, t("en")), false), source: "child-portrait" });
  });

  it("Open the moments goes to the Moments pill, in the areas view, on this area", () => {
    state.query = "area=playing";
    render();
    button("area-detail-moments")!.onClick!();
    expect(state.goToRoute).toHaveBeenCalledWith("timeline", { view: "areas", area: "playing" });
  });

  it.each([["talking", "language_communication"], ["body", "health_sleep_feeding"]] as const)("Add your own on %s writes a custom row on the stored domain that files it back there", (area, stored) => {
    state.keepState = true;
    state.query = `area=${area}`;
    render();
    state.inputs.find(i => i["data-testid"] === "area-detail-add-input")!.onChange!({ target: { value: "Says hello to the cat" } });
    render();
    state.forms.find(f => f["data-testid"] === "area-detail-add")!.onSubmit!({ preventDefault: vi.fn() });
    expect(state.addCustomMilestone).toHaveBeenCalledOnce();
    expect(state.addCustomMilestone).toHaveBeenCalledWith("Says hello to the cat", stored);
  });
});

describe("v3 F-CHILD-1 — answers, firsts and the chosen watch", () => {
  it("a fresh Seen it writes through the one seam, celebrates once after it is stored, then offers the keepsake", async () => {
    state.keepState = true;
    state.query = "area=talking";
    const html0 = render();
    const id = html0.match(/data-testid="area-detail-skill" data-milestone="([^"]+)"/)![1];
    state.segments[0].onAnswer("yes");
    expect(state.setMilestoneObservation).toHaveBeenCalledWith(id, "yes");
    expect(state.celebrate).not.toHaveBeenCalled();
    await tick();
    expect(state.celebrate).toHaveBeenCalledOnce();
    expect(state.celebrate).toHaveBeenCalledWith({ kind: "milestone" });
    expect(state.markCelebrated).toHaveBeenCalledWith("child-a", id);
    let html = render();
    expect(html).toContain('data-testid="area-detail-saved"');
    expect(html).not.toContain('data-testid="keepsake-sheet"');
    button("area-detail-keep")!.onClick!();
    html = render();
    expect(html).toContain(`data-testid="keepsake-sheet" data-milestone="${id}"`);
  });

  it("the keepsake sheet's save and remove hand back the write itself, so its receipt waits for it", async () => {
    state.keepState = true;
    state.query = "area=talking";
    const id = render().match(/data-testid="area-detail-skill" data-milestone="([^"]+)"/)![1];
    state.segments[0].onAnswer("yes");
    await tick();
    render();
    button("area-detail-keep")!.onClick!();
    render();
    expect(state.sheet?.milestoneId).toBe(id);
    const stored = Promise.resolve();
    state.keepUpsert.mockReturnValueOnce(stored);
    expect(state.sheet!.onSave({ milestoneId: id, note: "  Said it twice  ", noticedOn: "2026-06-10" })).toBe(stored);
    expect(state.keepUpsert).toHaveBeenCalledWith(expect.objectContaining({ id, milestoneId: id, note: "Said it twice", noticedOn: "2026-06-10" }));
    const gone = Promise.resolve();
    state.keepRemove.mockReturnValueOnce(gone);
    expect(state.sheet!.onRemove()).toBe(gone);
    expect(state.keepRemove).toHaveBeenCalledWith(id);
  });

  it("a skill already celebrated is not celebrated again; a failed write celebrates nothing", async () => {
    state.query = "area=talking";
    state.celebrated = true;
    render();
    state.segments[0].onAnswer("yes");
    await tick();
    expect(state.celebrate).not.toHaveBeenCalled();
    state.celebrated = false;
    state.setMilestoneObservation.mockImplementation(() => Promise.reject(new Error("offline")));
    render();
    state.segments[0].onAnswer("yes");
    await tick();
    expect(state.celebrate).not.toHaveBeenCalled();
  });

  it("with no watch, the Development Check's re-check date sits under the areas heading", () => {
    state.screenings = [{ id: "s1", answeredAt: "2026-06-01T10:00:00.000Z", recheckDueAt: "2026-09-01T10:00:00.000Z" }];
    const html = render();
    expect(html).toContain('data-testid="dev-map-recheck"');
    expect(html).toContain(esc(translate("en", "elev.growth.recheck.date", { date: fmtDay("2026-09-01T10:00:00.000Z", "en") })));
  });

  it("the chosen watch leads its own area with the re-check date; Stop watching offers Undo, and Undo restores it", () => {
    state.keepState = true;
    const skill = NOW[0];
    state.watch = { milestoneId: skill.id, screenItemId: "", chosenAt: "2026-06-01T10:00:00.000Z" };
    state.screenings = [{ id: "s1", answeredAt: "2026-06-01T10:00:00.000Z", recheckDueAt: "2026-09-01T10:00:00.000Z" }];
    state.query = "area=talking";
    let html = render();
    expect(html).toContain('data-testid="area-detail-watch"');
    expect(html).toContain('data-testid="area-detail-recheck"');
    // The date shows once: in the watched skill, not again under the heading.
    expect(html).not.toContain('data-testid="dev-map-recheck"');
    expect(html.indexOf(`data-milestone="${skill.id}"`)).toBeGreaterThan(html.indexOf('data-testid="area-detail-watch"'));
    button("area-detail-unwatch")!.onClick!();
    expect(state.clearWatchFocus).toHaveBeenCalledWith("child-a");
    html = render();
    expect(html).not.toContain('data-testid="area-detail-watch"');
    expect(html).toContain('data-testid="area-detail-watch-undo"');
    button("area-detail-watch-undo")!.onClick!();
    expect(state.writeWatchFocus).toHaveBeenCalledWith("child-a", { milestoneId: skill.id, screenItemId: "", chosenAt: "2026-06-01T10:00:00.000Z" });
    html = render();
    expect(html).toContain('data-testid="area-detail-watch"');
    expect(html).not.toContain('data-testid="area-detail-watch-undo"');
  });

  it("a watch on another area leaves this row alone", () => {
    const moving = groupMilestonesByShelf(catalogue()).moving.find(m => !m.checked)!;
    state.watch = { milestoneId: moving.id, screenItemId: "", chosenAt: "2026-06-01T10:00:00.000Z" };
    state.query = "area=talking";
    expect(render()).not.toContain('data-testid="area-detail-watch"');
  });
});

describe("v3 F-CHILD-4 (MOB-02) — the Milestones pill on a phone, one stack", () => {
  const phone = () => { state.phone = true; state.compact = true; };

  it.each(["en", "he"] as const)("the areas first, then the goal card, then the doors; the h1 is for screen readers; two modules, one primary move (%s)", lang => {
    state.lang = lang;
    phone();
    const html = render();
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect([...html.matchAll(/data-module="([^"]+)"/g)].map(m => m[1])).toEqual(["child-milestones-areas", "child-milestones-portrait"]);
    const [before, after] = translate(lang, "companion.milestones.title").split("{name}");
    expect(html).toContain(`<h1 class="sr-only">${esc(before)}<bdi dir="auto">Noa</bdi>${esc(after)}</h1>`);
    expect(html.match(/<h1[\s>]/g)).toHaveLength(1);
    expect(html).not.toContain('class="portrait-intro"');
    const h1 = html.indexOf("<h1"), map = html.indexOf('data-testid="dev-map"'), goal = html.indexOf('data-testid="portrait-goals-edit"'), doors = html.indexOf('data-testid="child-doors"');
    expect(h1).toBeGreaterThan(-1);
    expect(map).toBeGreaterThan(h1);
    expect(goal).toBeGreaterThan(map);
    expect(doors).toBeGreaterThan(goal);
    expect(html.match(/data-testid="dev-map-tile"/g)).toHaveLength(8);
    expect(html).not.toContain('data-testid="dev-map-row"');
    expect(html.match(/data-primary-move=/g)).toHaveLength(1);
    expect(html).toMatch(/data-testid="dev-map-check" data-primary-move="start-development-check"/);
    // The doors are navigation: no module, no stamp.
    const nav = html.slice(doors, html.indexOf("</nav>", doors));
    expect(nav).not.toContain("data-module");
    expect(nav).not.toContain("data-primary-move");
    expect(words(html)).not.toMatch(/companion\.|elev\./);
  });

  it.each(["en", "he"] as const)("the doors: journal, memory and Care, each the place's own name; the check's door is the page's primary move, not a second door (%s)", lang => {
    state.lang = lang;
    phone();
    const html = render();
    expect([...html.matchAll(/data-testid="child-door-([a-z]+)"/g)].map(m => m[1])).toEqual(["journal", "memory", "consult"]);
    expect(html).not.toContain('data-testid="child-door-screening"');
    // Icon and name only, as the mock's phone grid; Care keeps the place's one name.
    for (const [tab, key] of [["journal", "companion.portrait.journal"], ["memory", "companion.portrait.memory"], ["consult", "companion.door.care"]] as const) {
      const at = html.indexOf(`data-testid="child-door-${tab}"`);
      const door = html.slice(html.indexOf(">", at) + 1, html.indexOf("</button>", at));
      expect(words(door).replace(/\s+/g, " ").trim(), key).toBe(translate(lang, key));
    }
    for (const tab of ["journal", "memory", "consult"]) {
      button(`child-door-${tab}`)!.onClick!();
      expect(state.setActiveTab).toHaveBeenLastCalledWith(tab);
    }
  });

  it.each(["en", "he"] as const)("CLINICAL FIREWALL at phone width: a tile is glyph, name and pips — no share, no denominator, no level word (%s)", lang => {
    state.lang = lang;
    phone();
    const by = groupMilestonesByShelf(catalogue());
    const marked = new Set([...by.words.slice(0, 5), ...by.moving.slice(0, 2), ...by.food.slice(0, 1)].map(m => m.id));
    state.milestones = catalogue().map(m => (marked.has(m.id) ? { ...m, checked: true, observationStatus: "yes" as const, observationUpdatedAt: new Date(Date.now() - 86_400_000).toISOString() } : { ...m, observationStatus: "not_yet" as const }));
    state.query = "area=talking";
    const html = render();
    const text = words(html);
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(text).not.toMatch(/\bof\s+\d+|\d+\s+of\s+\d+|מתוך\s+\d+/);
    const start = html.indexOf('data-testid="dev-map-tiles"');
    const tiles = words(html.slice(start, html.indexOf("</ul>", start)));
    expect(tiles).not.toMatch(/\b(low|medium|high|behind|ahead|on track|not yet)\b/i);
    expect(html.match(/data-testid="count-pips"/g)).toHaveLength(3);
  });

  it.each(["en", "he"] as const)("the memory door says in words when a proposal waits: this pill shows none, so any waiting one is behind the door, as About's door speaks of one its areas do not show (%s)", lang => {
    state.lang = lang;
    phone();
    const doorOf = (html: string) => {
      const at = html.indexOf('data-testid="child-door-memory"');
      return html.slice(html.indexOf(">", at) + 1, html.indexOf("</button>", at));
    };
    expect(doorOf(render())).not.toContain("child-door-waiting");
    // Invented proposals: one About would place in its sleep area, one that names no area.
    for (const fact of ["Wakes up twice since the move", "fact 1"]) {
      state.pending = [{ memoryId: "p1", childId: "child-a", status: "pending", fact, source: "chat", retention: "standard", createdAt: "2026-10-06T10:00:00.000Z", latestEventId: "event-p1" }];
      const html = render();
      expect(html.match(/data-testid="child-door-waiting"/g)).toHaveLength(1);
      const door = words(doorOf(html)).replace(/\s+/g, " ").trim();
      expect(door).toBe(`${translate(lang, "companion.portrait.memory")} ${translate(lang, "companion.about.memoryWaiting")}`);
      expect(door).not.toMatch(/\d/);
      // Still one primary move and the same two modules: the sentence is no module.
      expect(html.match(/data-primary-move=/g)).toHaveLength(1);
      expect([...html.matchAll(/data-module="([^"]+)"/g)].map(m => m[1])).toEqual(["child-milestones-areas", "child-milestones-portrait"]);
    }
  });

  it("a tablet (below lg, above a phone) keeps the header and the cards, with tiles and no doors", () => {
    state.compact = true;
    const html = render();
    expect([...html.matchAll(/data-module="([^"]+)"/g)].map(m => m[1])).toEqual(["child-milestones-portrait", "child-milestones-areas"]);
    expect(html).toContain('class="portrait-intro"');
    expect(html).not.toContain('<h1 class="sr-only"');
    expect(html.match(/data-testid="dev-map-tile"/g)).toHaveLength(8);
    expect(html).not.toContain('data-testid="child-doors"');
  });

  it("a wide screen has no tiles, no doors and a visible h1", () => {
    const html = render();
    expect(html).not.toContain("dev-map-tiles");
    expect(html).not.toContain('data-testid="child-doors"');
    expect(html).not.toContain('<h1 class="sr-only"');
    expect(html).toContain("<h1>");
  });
});
