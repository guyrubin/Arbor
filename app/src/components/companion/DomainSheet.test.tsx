import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "../../types";

/* v3 FEAT-03 — the domain sheet behind a development-map tile. Catalogue rows
   only (lib/milestoneData ALL_MILESTONES), no child data. A tiny stateful SSR
   harness (as PortraitWatchRow.test) carries the "written" state from one
   render into the next, so the receipt is proven to wait for the write. */

type Answer = "yes" | "not_yet" | "not_sure";
const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  keepState: false, cursor: 0, hooks: [] as unknown[],
  compact: false,
  arbor: {} as Record<string, unknown>,
  segments: [] as { ariaLabel: string; selected?: string | null; onAnswer: (status: "yes" | "not_yet" | "not_sure") => void }[],
  buttons: [] as { onClick?: () => void; "data-testid"?: string }[],
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
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return { useLanguage: () => ({ uiLang: state.lang, t: (key: string, vars?: Record<string, string | number>) => translate(state.lang, key, vars) }) };
});
vi.mock("../../context/ArborContext", () => ({ useArbor: () => state.arbor }));
type SurfaceProps = { open: boolean; title?: string; children?: React.ReactNode };
vi.mock("../ui/Modal", () => ({ Modal: ({ open, title, children }: SurfaceProps) => (open ? <div data-surface="modal" aria-label={title}>{children}</div> : null) }));
vi.mock("../ui/Sheet", () => ({
  Sheet: ({ open, title, children }: SurfaceProps) => (open ? <div data-surface="sheet" aria-label={title}>{children}</div> : null),
  useCompactSurface: () => state.compact,
}));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => {
  if (!props || typeof props !== "object") return;
  if ("onAnswer" in props && "ariaLabel" in props) state.segments.push(props as typeof state.segments[number]);
  if (type === "button") state.buttons.push(props as typeof state.buttons[number]);
});
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import DomainSheet, { DomainSheetBody, type DomainSheetBodyProps } from "./DomainSheet";
import { domainName } from "../../lib/domains/registry";
import { translate } from "../../lib/i18n";
import { ALL_MILESTONES, bandForAgeMonths } from "../../lib/milestoneData";
import { groupMilestonesByShelf, shelfBands } from "../../lib/milestones/shelfMap";
import { shelfLabel } from "../../lib/shelves/registry";

const catalogue = (): Milestone[] => ALL_MILESTONES.map(m => ({ ...m }));
/** The catalogue carries no Sleep skill: the Sleep shelf fills from rows the
 *  parent adds (tag `sleep`, lib/shelves/registry milestoneShelf). Invented. */
const PARENT_SLEEP: Milestone = { id: "ms-sleep-own", custom: true, tags: ["sleep"], domain: "health_sleep_feeding", ageGroup: "Custom", title: "Falls asleep after one story", description: "x", checked: false };
const WORDS = groupMilestonesByShelf(catalogue()).words;
const bandOf = (m: Milestone) => (typeof m.ageMonths === "number" ? bandForAgeMonths(m.ageMonths).months : -1);
const wordBands = [...new Set(WORDS.map(bandOf).filter(b => b >= 0))].sort((a, b) => a - b);
/** A Words band with at least two skills, an earlier band below it and a later band above it. */
const CURRENT = wordBands.find((b, i) => i > 0 && i < wordBands.length - 1 && WORDS.filter(m => bandOf(m) === b).length >= 2)!;
const NOW = WORDS.filter(m => bandOf(m) === CURRENT);
const LATER = WORDS.filter(m => bandOf(m) > CURRENT);
const EARLIER = WORDS.filter(m => bandOf(m) >= 0 && bandOf(m) < CURRENT);

const tick = () => new Promise<void>(resolve => setTimeout(resolve, 0));
/** Text as React writes it into markup (& < > " ' escaped). */
const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#x27;");
const ids = (html: string) => [...html.matchAll(/data-testid="domain-sheet-skill" data-milestone="([^"]+)"/g)].map(m => m[1]);
const body = (over: Partial<DomainSheetBodyProps> = {}) => {
  state.cursor = 0; state.segments = []; state.buttons = [];
  const props: DomainSheetBodyProps = { domain: "talking", milestones: catalogue(), currentBandMonths: CURRENT, onAnswer: vi.fn(), onCheck: vi.fn(), onExplore: vi.fn(), onOpenMoments: vi.fn(), ...over };
  return renderToStaticMarkup(<DomainSheetBody {...props} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.keepState = false; state.cursor = 0; state.hooks = []; state.compact = false; state.arbor = {}; state.segments = []; state.buttons = [];
});

describe("v3 FEAT-03 — DomainSheetBody", () => {
  it("the fixture is a real middle band (earlier, current and later Words skills all exist)", () => {
    expect(CURRENT).toBeGreaterThan(0);
    expect(NOW.length).toBeGreaterThanOrEqual(2);
    expect(LATER.length).toBeGreaterThan(0);
    expect(EARLIER.length).toBeGreaterThan(0);
  });

  it.each(["en", "he"] as const)("says why the area matters, offers the current band to answer and the later band to read (%s)", lang => {
    state.lang = lang;
    const html = body();
    expect(html).toContain('data-testid="domain-sheet" data-domain="talking"');
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).toContain(esc(translate(lang, "companion.devMap.why.talking")));
    expect(html).toContain(esc(translate(lang, "ms.currentBand")));
    expect(ids(html)).toEqual(NOW.map(m => m.id));
    expect(html.match(/data-testid="segmented-answers"/g)).toHaveLength(NOW.length);
    expect(html.match(/data-testid="domain-sheet-later-item"/g)).toHaveLength(LATER.length);
    // Earlier bands are not re-asked here (the full shelf stays on #/milestones).
    for (const m of EARLIER) expect(html).not.toContain(`data-milestone="${m.id}"`);
    // One shelf: no shelf heading. No module stamp, no primary move, no share.
    expect(html).not.toContain("<h3>");
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
    expect(html.replace(/<[^>]+>/g, " ")).not.toMatch(/%/);
    expect(html).not.toContain('data-testid="domain-sheet-empty"');
    for (const key of ["companion.devMap.check", "companion.devMap.explore", "companion.devMap.moments"]) expect(html).toContain(esc(translate(lang, key)));
  });

  it("body walks both of its shelves under their own headings once Sleep has a row", () => {
    const html = body({ domain: "body", currentBandMonths: 2, milestones: [...catalogue(), PARENT_SLEEP] });
    const t = (key: string) => translate("en", key);
    expect(html.match(/<h3>/g)).toHaveLength(2);
    expect(html).toContain(`<h3>${esc(shelfLabel("sleep", t))}</h3>`);
    expect(html).toContain(`<h3>${esc(shelfLabel("food", t))}</h3>`);
    // The parent's own Sleep row is answerable (no age band to wait for).
    expect(ids(html)).toContain(PARENT_SLEEP.id);
    expect(html).toContain(esc(translate("en", "companion.devMap.why.body")));
  });

  it("body with no Sleep row reads as one list: no lone shelf heading", () => {
    const html = body({ domain: "body", currentBandMonths: 2 });
    expect(html).not.toContain("<h3>");
    expect(html).toContain('data-shelf="food"');
    expect(html).not.toContain('data-shelf="sleep"');
  });

  it("the pressed answer is a neutral state mark: Seen it and Not yet press the same way", () => {
    const [a, b] = NOW;
    const ms = catalogue().map(m => (m.id === a.id ? { ...m, observationStatus: "yes" as const, checked: true } : m.id === b.id ? { ...m, observationStatus: "not_yet" as const } : m));
    const html = body({ milestones: ms });
    const pressed = [...html.matchAll(/data-answer="([a-z_]+)" aria-pressed="true" class="[^"]*" style="([^"]*)"/g)];
    expect(pressed.map(m => m[1])).toEqual(["yes", "not_yet"]);
    expect(pressed[0][2]).toBe(pressed[1][2]);
    expect(state.segments.slice(0, 2).map(s => s.selected)).toEqual(["yes", "not_yet"]);
  });

  it("an answer writes through the one seam; Saved. shows only after the write resolves", async () => {
    state.keepState = true;
    let resolve!: () => void;
    const onAnswer = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    let html = body({ onAnswer });
    expect(html).not.toContain('data-testid="domain-sheet-saved"');
    state.segments[0].onAnswer("not_sure");
    expect(onAnswer).toHaveBeenCalledWith(NOW[0].id, "not_sure");
    html = body({ onAnswer });
    expect(html).not.toContain('data-testid="domain-sheet-saved"');
    resolve();
    await tick();
    html = body({ onAnswer });
    expect(html.match(/data-testid="domain-sheet-saved"/g)).toHaveLength(1);
    expect(html).toContain(esc(translate("en", "companion.devMap.saved")));
    // The receipt sits under the skill that was answered.
    const first = html.indexOf(`data-milestone="${NOW[0].id}"`);
    const second = html.indexOf(`data-milestone="${NOW[1].id}"`);
    const saved = html.indexOf('data-testid="domain-sheet-saved"');
    expect(saved).toBeGreaterThan(first);
    expect(saved).toBeLessThan(second);
    expect(html).not.toContain('data-testid="domain-sheet-failed"');
  });

  it("a write that fails says so and shows no receipt", async () => {
    state.keepState = true;
    const onAnswer = vi.fn(() => Promise.reject(new Error("offline")));
    body({ onAnswer });
    state.segments[1].onAnswer("yes");
    expect(onAnswer).toHaveBeenCalledWith(NOW[1].id, "yes");
    await tick();
    const html = body({ onAnswer });
    expect(html).toContain('role="alert" data-testid="domain-sheet-failed"');
    expect(html).toContain(esc(translate("en", "companion.devMap.saveFailed")));
    expect(html).not.toContain('data-testid="domain-sheet-saved"');
  });

  it("no write, no receipt: an answer the seam did not take leaves the line quiet", async () => {
    state.keepState = true;
    const onAnswer = vi.fn(() => undefined);
    body({ onAnswer });
    state.segments[0].onAnswer("yes");
    await tick();
    const html = body({ onAnswer });
    expect(html).not.toContain('data-testid="domain-sheet-saved"');
    expect(html).not.toContain('data-testid="domain-sheet-failed"');
  });

  it("the three doors call their callbacks", () => {
    const onCheck = vi.fn(), onExplore = vi.fn(), onOpenMoments = vi.fn();
    body({ onCheck, onExplore, onOpenMoments });
    const door = (id: string) => state.buttons.find(b => b["data-testid"] === id)!;
    door("domain-sheet-check").onClick!();
    door("domain-sheet-explore").onClick!();
    door("domain-sheet-moments").onClick!();
    expect(onCheck).toHaveBeenCalledOnce();
    expect(onExplore).toHaveBeenCalledOnce();
    expect(onOpenMoments).toHaveBeenCalledOnce();
  });

  it.each(["en", "he"] as const)("an area with nothing to mark says so plainly (%s)", lang => {
    state.lang = lang;
    const html = body({ milestones: [] });
    expect(html).toContain(esc(translate(lang, "companion.devMap.empty")));
    expect(html).not.toContain('data-testid="segmented-answers"');
  });
});

describe("v3 FEAT-03 — DomainSheet (the surface)", () => {
  /** The first of the month `months` back, as a local calendar day (no UTC shift). */
  const birthDateMonthsAgo = (months: number) => {
    const now = new Date();
    const d = new Date(now.getFullYear(), now.getMonth() - months, 1);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-01`;
  };
  const arbor = () => ({
    childProfile: { id: "child-a", name: "Noa", birthDate: birthDateMonthsAgo(CURRENT + 1) },
    milestones: catalogue(),
    setMilestoneObservation: vi.fn(() => Promise.resolve()),
  });

  it("renders nothing while closed", () => {
    state.arbor = arbor();
    expect(renderToStaticMarkup(<DomainSheet domain={null} onClose={vi.fn()} onCheck={vi.fn()} onExplore={vi.fn()} onOpenMoments={vi.fn()} />)).toBe("");
  });

  it.each(["en", "he"] as const)("opens on the area, titled with its name, on the child's own current band, and writes through setMilestoneObservation (%s)", lang => {
    state.lang = lang;
    state.keepState = true; // the answer's receipt state lands in the harness, not in a finished server render
    state.arbor = arbor();
    const onExplore = vi.fn(), onOpenMoments = vi.fn();
    const html = renderToStaticMarkup(<DomainSheet domain="talking" onClose={vi.fn()} onCheck={vi.fn()} onExplore={onExplore} onOpenMoments={onOpenMoments} />);
    expect(html).toContain('data-surface="modal"');
    expect(html).toContain(`aria-label="${esc(domainName("talking", k => translate(lang, k)))}"`);
    expect(ids(html)).toEqual(NOW.map(m => m.id));
    state.segments[0].onAnswer("yes");
    expect((state.arbor.setMilestoneObservation as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(NOW[0].id, "yes");
    state.buttons.find(b => b["data-testid"] === "domain-sheet-explore")!.onClick!();
    state.buttons.find(b => b["data-testid"] === "domain-sheet-moments")!.onClick!();
    expect(onExplore).toHaveBeenCalledWith("talking");
    expect(onOpenMoments).toHaveBeenCalledWith("talking");
  });

  it("is a bottom sheet on a compact screen", () => {
    state.compact = true;
    state.arbor = arbor();
    const html = renderToStaticMarkup(<DomainSheet domain="moving" onClose={vi.fn()} onCheck={vi.fn()} onExplore={vi.fn()} onOpenMoments={vi.fn()} />);
    expect(html).toContain('data-surface="sheet"');
    expect(html).toContain('data-testid="domain-sheet" data-domain="moving"');
  });
});
