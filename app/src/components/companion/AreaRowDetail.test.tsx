import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Milestone } from "../../types";

/* v3 F-CHILD-1 — an area row, opened (inline under the row on a wide screen,
   inside the Sheet on a phone). Catalogue rows only (lib/milestoneData
   ALL_MILESTONES) and invented words; no child data. A tiny stateful SSR
   harness carries the component's state from one render into the next, so
   the receipt is proven to wait for the write (the DomainSheet harness it
   replaces). */

const state = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  keepState: false, cursor: 0, hooks: [] as unknown[],
  segments: [] as { ariaLabel: string; selected?: string | null; onAnswer: (status: "yes" | "not_yet" | "not_sure") => void }[],
  buttons: [] as { onClick?: () => void; "data-testid"?: string; disabled?: boolean }[],
  inputs: [] as { onChange?: (e: { target: { value: string } }) => void; "data-testid"?: string }[],
  forms: [] as { onSubmit?: (e: { preventDefault: () => void }) => void }[],
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
import AreaRowDetail, { type AreaRowDetailProps } from "./AreaRowDetail";
import { translate } from "../../lib/i18n";
import { tGCare } from "../../lib/growthCareText";
import { ALL_MILESTONES, bandForAgeMonths } from "../../lib/milestoneData";
import { groupMilestonesByShelf } from "../../lib/milestones/shelfMap";
import { shelfLabel } from "../../lib/shelves/registry";
import { PARENT_RECORD_COPY } from "./parentRecordCopy";

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
const ids = (html: string) => [...html.matchAll(/data-testid="area-detail-skill" data-milestone="([^"]+)"/g)].map(m => m[1]);
const button = (id: string) => state.buttons.find(b => b["data-testid"] === id);
const render = (over: Partial<AreaRowDetailProps> = {}) => {
  state.cursor = 0; state.segments = []; state.buttons = []; state.inputs = []; state.forms = [];
  const props: AreaRowDetailProps = { domain: "talking", milestones: catalogue(), currentBandMonths: CURRENT, onAnswer: vi.fn(), onCheck: vi.fn(), onExplore: vi.fn(), onOpenMoments: vi.fn(), ...over };
  return renderToStaticMarkup(<AreaRowDetail {...props} />);
};

beforeEach(() => {
  vi.clearAllMocks();
  state.lang = "en"; state.keepState = false; state.cursor = 0; state.hooks = []; state.segments = []; state.buttons = []; state.inputs = []; state.forms = [];
});

describe("v3 F-CHILD-1 — AreaRowDetail", () => {
  it("the fixture is a real middle band (earlier, current and later Words skills all exist)", () => {
    expect(CURRENT).toBeGreaterThan(0);
    expect(NOW.length).toBeGreaterThanOrEqual(2);
    expect(LATER.length).toBeGreaterThan(0);
    expect(EARLIER.length).toBeGreaterThan(0);
  });

  it.each(["en", "he"] as const)("says why the area matters, offers the current band to answer in a grid and the later band to read (%s)", lang => {
    state.lang = lang;
    const html = render({ id: "row-talking" });
    expect(html).toContain('<div class="area-detail" id="row-talking" data-testid="area-detail" data-domain="talking"');
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html).toContain(esc(translate(lang, "companion.devMap.why.talking")));
    expect(html).toContain(esc(translate(lang, "ms.currentBand")));
    expect(html).toContain('<ul class="area-detail-skills">');
    expect(ids(html)).toEqual(NOW.map(m => m.id));
    expect(html.match(/data-testid="segmented-answers"/g)).toHaveLength(NOW.length);
    expect(html.match(/data-testid="area-detail-later-item"/g)).toHaveLength(LATER.length);
    // Earlier bands are not re-asked here.
    for (const m of EARLIER) expect(html).not.toContain(`data-milestone="${m.id}"`);
    // One shelf: no shelf heading. No module stamp, no primary move, no share.
    expect(html).not.toContain("<h3>");
    expect(html).not.toContain("data-module");
    expect(html).not.toContain("data-primary-move");
    const text = html.replace(/<[^>]+>/g, " ");
    expect(text).not.toMatch(/%/);
    expect(text).not.toMatch(/\d+\s*\/\s*\d+/);
    expect(html).not.toContain('data-testid="area-detail-empty"');
    expect(html).not.toContain('data-testid="area-detail-add"');
    for (const key of ["companion.milestones.check", "companion.devMap.explore", "companion.devMap.moments"]) expect(html).toContain(esc(translate(lang, key)));
  });

  it("body walks both of its shelves under their own headings once Sleep has a row", () => {
    const html = render({ domain: "body", currentBandMonths: 2, milestones: [...catalogue(), PARENT_SLEEP] });
    const t = (key: string) => translate("en", key);
    expect(html.match(/<h3>/g)).toHaveLength(2);
    expect(html).toContain(`<h3>${esc(shelfLabel("sleep", t))}</h3>`);
    expect(html).toContain(`<h3>${esc(shelfLabel("food", t))}</h3>`);
    // The parent's own Sleep row is answerable (no age band to wait for).
    expect(ids(html)).toContain(PARENT_SLEEP.id);
    expect(html).toContain(esc(translate("en", "elev.loop.shelf.own")));
    expect(html).toContain(esc(translate("en", "companion.devMap.why.body")));
  });

  it("body with no Sleep row reads as one list: no lone shelf heading", () => {
    const html = render({ domain: "body", currentBandMonths: 2 });
    expect(html).not.toContain("<h3>");
    expect(html).toContain('data-shelf="food"');
    expect(html).not.toContain('data-shelf="sleep"');
  });

  it("the pressed answer is a neutral state mark: Seen it and Not yet press the same way", () => {
    const [a, b] = NOW;
    const ms = catalogue().map(m => (m.id === a.id ? { ...m, observationStatus: "yes" as const, checked: true } : m.id === b.id ? { ...m, observationStatus: "not_yet" as const } : m));
    const html = render({ milestones: ms });
    const pressed = [...html.matchAll(/data-answer="([a-z_]+)" aria-pressed="true" class="[^"]*" style="([^"]*)"/g)];
    expect(pressed.map(m => m[1])).toEqual(["yes", "not_yet"]);
    expect(pressed[0][2]).toBe(pressed[1][2]);
    expect(state.segments.slice(0, 2).map(s => s.selected)).toEqual(["yes", "not_yet"]);
  });

  it("an answer writes through the one seam; Saved. shows only after the write resolves", async () => {
    state.keepState = true;
    let resolve!: () => void;
    const onAnswer = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    let html = render({ onAnswer });
    expect(html).not.toContain('data-testid="area-detail-saved"');
    state.segments[0].onAnswer("not_sure");
    expect(onAnswer).toHaveBeenCalledWith(NOW[0].id, "not_sure");
    html = render({ onAnswer });
    expect(html).not.toContain('data-testid="area-detail-saved"');
    resolve();
    await tick();
    html = render({ onAnswer });
    expect(html.match(/data-testid="area-detail-saved"/g)).toHaveLength(1);
    expect(html).toContain(esc(translate("en", "companion.devMap.saved")));
    // The receipt sits under the skill that was answered.
    const first = html.indexOf(`data-milestone="${NOW[0].id}"`);
    const second = html.indexOf(`data-milestone="${NOW[1].id}"`);
    const saved = html.indexOf('data-testid="area-detail-saved"');
    expect(saved).toBeGreaterThan(first);
    expect(saved).toBeLessThan(second);
    expect(html).not.toContain('data-testid="area-detail-failed"');
    // Not sure is no first: nothing to keep.
    expect(html).not.toContain('data-testid="area-detail-keep"');
  });

  it("a fresh Seen it, once stored, offers a note and a date for the first", async () => {
    state.keepState = true;
    const onKeep = vi.fn();
    let resolve!: () => void;
    const onAnswer = vi.fn(() => new Promise<void>(r => { resolve = r; }));
    render({ onAnswer, onKeep });
    state.segments[1].onAnswer("yes");
    let html = render({ onAnswer, onKeep });
    expect(html).not.toContain('data-testid="area-detail-keep"');
    resolve();
    await tick();
    html = render({ onAnswer, onKeep });
    expect(html.match(/data-testid="area-detail-keep"/g)).toHaveLength(1);
    expect(html).toContain(esc(translate("en", "elev.waveR.keepsake.add")));
    const keep = html.indexOf('data-testid="area-detail-keep"');
    expect(keep).toBeGreaterThan(html.indexOf(`data-milestone="${NOW[1].id}"`));
    button("area-detail-keep")!.onClick!();
    expect(onKeep).toHaveBeenCalledWith(NOW[1].id);
  });

  it("a Seen it on a skill already seen is no new first", async () => {
    state.keepState = true;
    const ms = catalogue().map(m => (m.id === NOW[0].id ? { ...m, observationStatus: "yes" as const, checked: true } : m));
    const onAnswer = vi.fn(() => Promise.resolve());
    render({ milestones: ms, onAnswer, onKeep: vi.fn() });
    state.segments[0].onAnswer("yes");
    await tick();
    const html = render({ milestones: ms, onAnswer, onKeep: vi.fn() });
    expect(html).toContain('data-testid="area-detail-saved"');
    expect(html).not.toContain('data-testid="area-detail-keep"');
  });

  it("a write that fails says so and shows no receipt", async () => {
    state.keepState = true;
    const onAnswer = vi.fn(() => Promise.reject(new Error("offline")));
    render({ onAnswer, onKeep: vi.fn() });
    state.segments[1].onAnswer("yes");
    expect(onAnswer).toHaveBeenCalledWith(NOW[1].id, "yes");
    await tick();
    const html = render({ onAnswer, onKeep: vi.fn() });
    expect(html).toContain('role="alert" data-testid="area-detail-failed"');
    expect(html).toContain(esc(translate("en", "companion.devMap.saveFailed")));
    expect(html).not.toContain('data-testid="area-detail-saved"');
    expect(html).not.toContain('data-testid="area-detail-keep"');
  });

  it("no write, no receipt: an answer the seam did not take leaves the line quiet", async () => {
    state.keepState = true;
    const onAnswer = vi.fn(() => undefined);
    render({ onAnswer });
    state.segments[0].onAnswer("yes");
    await tick();
    const html = render({ onAnswer });
    expect(html).not.toContain('data-testid="area-detail-saved"');
    expect(html).not.toContain('data-testid="area-detail-failed"');
  });

  it("the three doors call their callbacks", () => {
    const onCheck = vi.fn(), onExplore = vi.fn(), onOpenMoments = vi.fn();
    render({ onCheck, onExplore, onOpenMoments });
    button("area-detail-check")!.onClick!();
    button("area-detail-explore")!.onClick!();
    button("area-detail-moments")!.onClick!();
    expect(onCheck).toHaveBeenCalledOnce();
    expect(onExplore).toHaveBeenCalledOnce();
    expect(onOpenMoments).toHaveBeenCalledOnce();
  });

  it.each(["en", "he"] as const)("an area with nothing to mark says so plainly (%s)", lang => {
    state.lang = lang;
    const html = render({ milestones: [] });
    expect(html).toContain(esc(translate(lang, "companion.devMap.empty")));
    expect(html).not.toContain('data-testid="segmented-answers"');
  });
});

describe("v3 F-CHILD-1 — the watched skill leads its area", () => {
  it.each(["en", "he"] as const)("leads with the chosen skill, its re-check date and a way to stop (%s)", lang => {
    state.lang = lang;
    const onStop = vi.fn();
    const html = render({ watch: { milestoneId: NOW[1].id, recheckDueAt: "2026-09-01T10:00:00.000Z", onStop } });
    const watch = html.indexOf('data-testid="area-detail-watch"');
    expect(watch).toBeGreaterThan(-1);
    // The chosen skill is asked once, first, and not again in its band.
    expect(ids(html)).toEqual([NOW[1].id, ...NOW.filter(m => m.id !== NOW[1].id).map(m => m.id)]);
    expect(html).toContain(esc(PARENT_RECORD_COPY[lang].chosenFocus));
    const recheck = html.match(/<p class="area-detail-recheck" data-testid="area-detail-recheck">([^<]*)<\/p>/);
    expect(recheck).not.toBeNull();
    expect(recheck![1]).not.toBe("elev.growth.recheck.date");
    expect(html).toContain(esc(tGCare(lang, "elev.gcare.growth.watch.clear")));
    button("area-detail-unwatch")!.onClick!();
    expect(onStop).toHaveBeenCalledOnce();
  });

  it("a watch with no saved re-check date shows no date line", () => {
    const html = render({ watch: { milestoneId: NOW[0].id, recheckDueAt: null, onStop: vi.fn() } });
    expect(html).toContain('data-testid="area-detail-watch"');
    expect(html).not.toContain('data-testid="area-detail-recheck"');
  });

  it("a watch on a skill of another area stays out of this one", () => {
    const moving = groupMilestonesByShelf(catalogue()).moving[0];
    const html = render({ watch: { milestoneId: moving.id, recheckDueAt: "2026-09-01T10:00:00.000Z", onStop: vi.fn() } });
    expect(html).not.toContain('data-testid="area-detail-watch"');
    expect(html).not.toContain(`data-milestone="${moving.id}"`);
  });

  it("a watch just stopped offers Undo", () => {
    const onUndoWatch = vi.fn();
    const html = render({ onUndoWatch });
    expect(html).toContain(esc(PARENT_RECORD_COPY.en.watchCleared));
    expect(html).toMatch(/<div class="area-detail-undo" role="status">/);
    button("area-detail-watch-undo")!.onClick!();
    expect(onUndoWatch).toHaveBeenCalledOnce();
  });
});

describe("v3 F-CHILD-1 — Add your own", () => {
  const typeLine = (value: string) => state.inputs.find(i => i["data-testid"] === "area-detail-add-input")!.onChange!({ target: { value } });
  const deferred = () => {
    let resolve!: () => void;
    let reject!: (e: Error) => void;
    const promise = new Promise<void>((res, rej) => { resolve = res; reject = rej; });
    return { promise, resolve, reject };
  };

  // RE-PIN (v3 F-CHILD-1 review): the line cleared synchronously on submit;
  // it now clears only after the write resolved.
  it.each(["en", "he"] as const)("writes the parent's words on this area and clears the line once stored (%s)", async lang => {
    state.lang = lang;
    state.keepState = true;
    const onAddOwn = vi.fn((_title: string) => Promise.resolve());
    let html = render({ onAddOwn });
    expect(html).toContain('data-testid="area-detail-add"');
    expect(html).toContain(`placeholder="${esc(translate(lang, "companion.milestones.addOwnHint"))}"`);
    expect(html).toContain(`aria-label="${esc(translate(lang, "companion.milestones.addOwn"))}"`);
    expect(html).toMatch(/data-testid="area-detail-add-save" disabled=""/);
    typeLine("  Says hello to the cat  ");
    html = render({ onAddOwn });
    expect(html).not.toMatch(/data-testid="area-detail-add-save" disabled=""/);
    const preventDefault = vi.fn();
    state.forms[0].onSubmit!({ preventDefault });
    expect(preventDefault).toHaveBeenCalledOnce();
    expect(onAddOwn).toHaveBeenCalledWith("Says hello to the cat");
    await tick();
    html = render({ onAddOwn });
    expect(html).toContain('value=""');
    expect(html).toMatch(/data-testid="area-detail-add-save" disabled=""/);
    expect(html).not.toContain('data-testid="area-detail-add-failed"');
  });

  it("the words stay while the write is in flight, and a second submit waits for it", async () => {
    state.keepState = true;
    const write = deferred();
    const onAddOwn = vi.fn((_title: string) => write.promise);
    render({ onAddOwn });
    typeLine("Waves bye");
    render({ onAddOwn });
    state.forms[0].onSubmit!({ preventDefault: vi.fn() });
    let html = render({ onAddOwn });
    expect(html).toContain('value="Waves bye"');
    expect(html).toMatch(/data-testid="area-detail-add-save" disabled="" aria-busy="true"/);
    state.forms[0].onSubmit!({ preventDefault: vi.fn() });
    expect(onAddOwn).toHaveBeenCalledOnce();
    write.resolve();
    await tick();
    html = render({ onAddOwn });
    expect(html).toContain('value=""');
    expect(html).not.toContain('aria-busy="true"');
  });

  it.each(["en", "he"] as const)("a failed write keeps the words and says it was not saved (%s)", async lang => {
    state.lang = lang;
    state.keepState = true;
    const onAddOwn = vi.fn((_title: string): Promise<void> => Promise.reject(new Error("offline")));
    render({ onAddOwn });
    typeLine("Waves bye");
    render({ onAddOwn });
    state.forms[0].onSubmit!({ preventDefault: vi.fn() });
    await tick();
    let html = render({ onAddOwn });
    expect(html).toContain('value="Waves bye"');
    expect(html).toContain('data-testid="area-detail-add-failed"');
    expect(html).toContain(esc(translate(lang, "companion.devMap.saveFailed")));
    expect(html).not.toMatch(/data-testid="area-detail-add-save" disabled=""/);
    // Editing the line clears the failure; a retry that lands clears the line.
    typeLine("Waves bye-bye");
    html = render({ onAddOwn });
    expect(html).not.toContain('data-testid="area-detail-add-failed"');
    onAddOwn.mockImplementation(() => Promise.resolve());
    state.forms[0].onSubmit!({ preventDefault: vi.fn() });
    expect(onAddOwn).toHaveBeenLastCalledWith("Waves bye-bye");
    await tick();
    html = render({ onAddOwn });
    expect(html).toContain('value=""');
  });

  it("an empty line writes nothing", () => {
    state.keepState = true;
    const onAddOwn = vi.fn((_title: string) => Promise.resolve());
    render({ onAddOwn });
    typeLine("   ");
    render({ onAddOwn });
    state.forms[0].onSubmit!({ preventDefault: vi.fn() });
    expect(onAddOwn).not.toHaveBeenCalled();
  });
});
