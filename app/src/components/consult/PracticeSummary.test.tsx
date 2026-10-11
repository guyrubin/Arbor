import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";

const h = vi.hoisted(() => ({
  cursor: 0, slots: [] as any[], effects: [] as (() => void)[], locale: "en" as "en" | "he",
  ownerCurrent: true, sourceCurrent: true, sources: {} as Record<string, any>, child: {} as any,
  milestones: [] as any[], logs: [] as any[], data: {} as any, copy: vi.fn(async (_text: string) => {}),
}));
vi.mock("react", async original => ({
  ...await original<typeof import("react")>(),
  useRef: (value: unknown) => { const i = h.cursor++; return h.slots[i] ??= { current: value }; },
  useState: (initial: unknown) => { const i = h.cursor++; if (!(i in h.slots)) h.slots[i] = typeof initial === "function" ? initial() : initial; return [h.slots[i], (value: any) => { h.slots[i] = typeof value === "function" ? value(h.slots[i]) : value; }]; },
  useMemo: (build: () => unknown, deps: unknown[]) => { const i = h.cursor++; const prev = h.slots[i]; if (!prev || deps.some((v, j) => !Object.is(v, prev.deps[j]))) h.slots[i] = { value: build(), deps }; return h.slots[i].value; },
  useCallback: (callback: unknown) => callback,
  useEffect: (effect: () => void | (() => void), deps: unknown[]) => { const i = h.cursor++; const prev = h.slots[i]; if (!prev || deps.some((v, j) => !Object.is(v, prev.deps[j]))) { prev?.cleanup?.(); const slot = h.slots[i] = { deps, cleanup: undefined as void | (() => void) }; h.effects.push(() => { slot.cleanup = effect(); }); } },
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: h.child, milestones: h.milestones, behaviorLogs: h.logs, consultRecordSources: { milestones: h.sources.milestones, behaviorLogs: h.sources.behaviorLogs } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.locale, t: (key: string, vars?: Record<string, string | number>) => translate(h.locale, key, vars) }) }));
vi.mock("../../practice/usePracticeData", () => ({ usePracticeData: (childId: string, confirmed: boolean) => { expect(childId).toBe(h.child.id); expect(confirmed).toBe(true); return h.data; } }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (_id: string, name: string, opts: { trackConfirmation: boolean }) => { expect(opts.trackConfirmation).toBe(true); return h.sources[name]; } }));
vi.mock("../ui/Icon", () => ({ Icon: () => <span /> }));
import PracticeSummary from "./PracticeSummary";

const guard = { isCurrent: () => h.ownerCurrent };
type Element = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): Element[] {
  if (!React.isValidElement(node)) return [];
  const el = node as Element;
  return [el, ...React.Children.toArray(el.props.children).flatMap(elements)];
}
const find = (node: React.ReactNode, id: string) => elements(node).find(el => el.props["data-testid"] === id)!;
function render() {
  h.cursor = 0;
  const tree = PracticeSummary({ egressGuard: guard });
  h.effects.splice(0).forEach(effect => effect());
  return { tree, html: renderToStaticMarkup(tree), copy: find(tree, "consult-practice-copy"), disclosure: find(tree, "consult-practice-summary") };
}
function open() { render().disclosure.props.onToggle({ currentTarget: { open: true } }); return render(); }
function close() { render().disclosure.props.onToggle({ currentTarget: { open: false } }); }
beforeEach(() => {
  vi.clearAllMocks(); h.cursor = 0; h.slots = []; h.effects = []; h.locale = "en"; h.ownerCurrent = true; h.sourceCurrent = true;
  h.child = { id: "child-a", name: "Noa", age: 3, languages: [], schoolContext: "", strengths: [], challenges: [] };
  h.milestones = []; h.logs = [];
  h.sources = Object.fromEntries(["speech", "mimic", "missions", "adventures", "events", "screenings", "milestones", "behaviorLogs"].map(name => [name, { items: [], loaded: true, confirmed: true, error: false, isCurrent: () => h.sourceCurrent }]));
  h.data = { ...h.sources, today: "2026-10-10", stats: [], week: { sessions: 2, activeDays: 1, domainsTouched: ["language"] }, streak: 4 };
  vi.stubGlobal("navigator", { clipboard: { writeText: h.copy } });
});
afterEach(() => { h.slots.forEach(slot => slot?.cleanup?.()); vi.unstubAllGlobals(); });

describe("B-GROWTH-22 · real migrated Consult disclosure", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: closed secondary disclosure, bilingual chrome, English safe preview and explicit copy`, async () => {
    h.locale = lang;
    const closed = render();
    expect(closed.disclosure.props.open).toBeUndefined();
    expect(closed.html).not.toContain("data-primary-move");
    expect(closed.html).toContain(translate(lang, "elev.growthTruth.copilot.share.title"));
    expect(closed.html).toContain(translate(lang, "elev.growthTruth.copilot.share.lang"));
    const current = open();
    expect(current.html).toContain('dir="ltr"');
    expect(current.html).toContain("ARBOR PRACTICE SUMMARY");
    expect(current.html).not.toContain("Streak:");
    expect(current.copy.props.disabled).toBe(false);
    await current.copy.props.onClick();
    expect(h.copy).toHaveBeenCalledExactlyOnceWith(expect.stringContaining("Streak: 4 days."));
    expect(render().html).toContain(translate(lang, "elev.growthTruth.copilot.share.copied"));
  });

  it("closing and reopening retires the prior open callback", async () => {
    const old = open().copy.props.onClick;
    close(); await old(); expect(h.copy).not.toHaveBeenCalled();
    const current = open().copy.props.onClick;
    await old(); expect(h.copy).not.toHaveBeenCalled();
    await current(); expect(h.copy).toHaveBeenCalledOnce();
  });

  for (const kind of ["owner", "source", "child", "record", "unmount"] as const) it(`retires a captured copy callback after ${kind} changes`, async () => {
    const old = open().copy.props.onClick;
    if (kind === "owner") h.ownerCurrent = false;
    if (kind === "source") h.sourceCurrent = false;
    if (kind === "child") { h.child = { ...h.child, id: "child-b", name: "Tal" }; render(); }
    if (kind === "record") { h.data.week = { ...h.data.week, sessions: 5 }; render(); }
    if (kind === "unmount") h.slots.forEach(slot => slot?.cleanup?.());
    await old(); expect(h.copy).not.toHaveBeenCalled();
  });

  for (const state of ["loading", "error", "cache"] as const) it(`${state} source hides the incomplete summary and disables copy`, async () => {
    const old = open().copy.props.onClick;
    h.sources.speech.isCurrent = () => false;
    h.sourceCurrent = false;
    if (state === "loading") h.sources.speech.loaded = false;
    if (state === "error") h.sources.speech.error = true;
    if (state === "cache") h.sources.speech.confirmed = false;
    const current = render();
    expect(current.html).not.toContain("ARBOR PRACTICE SUMMARY");
    expect(current.copy.props.disabled).toBe(true);
    await old(); await current.copy.props.onClick(); expect(h.copy).not.toHaveBeenCalled();
  });

  it("a forbidden token reaches neither rendered preview nor clipboard", async () => {
    h.child.name = "riskLevel";
    const current = open();
    expect(current.copy.props.disabled).toBe(true);
    expect(current.html).not.toContain("riskLevel");
    expect(find(current.tree, "consult-practice-preview").props.children).toBe(translate("en", "elev.growthTruth.copilot.share.blocked"));
    await current.copy.props.onClick(); expect(h.copy).not.toHaveBeenCalled();
  });

  it("Consult mounts one summary after its existing packet inside the target guard", () => {
    const source = readFileSync(new URL("../tabs/ConsultTab.tsx", import.meta.url), "utf8");
    expect(source.match(/<PracticeSummary\b/g)).toHaveLength(1);
    expect(source.indexOf("<PracticeSummary")).toBeGreaterThan(source.indexOf("<AskSpecialist"));
    expect(source).toContain("isOwnerCurrent() && (!egressGuard || egressGuard.isCurrent())");
    expect(source).toContain('<PracticeSummary egressGuard={summaryGuard} />');
  });
});
