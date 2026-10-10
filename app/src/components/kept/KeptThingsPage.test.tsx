import React from "react";
import { readFileSync } from "node:fs";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import type { MonthPage } from "../../lib/keepsakeMonth";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he", childId: "child-a", filter: "all", loading: false, error: false, confirmed: true, more: false,
  empty: false, current: true, changed: false, loadMore: vi.fn(), reload: vi.fn(), setActiveTab: vi.fn(), scopes: [] as string[],
  pages: [] as { page: MonthPage; disabled: boolean; beforeExport: () => boolean }[], itemDisabled: [] as boolean[],
  buttons: [] as { children?: unknown; onClick?: () => void; disabled?: boolean }[],
}));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: (initial: unknown) => initial === "all" ? [h.filter, (next: string) => { h.filter = next; }] : [h.changed, (next: boolean) => { h.changed = next; }] }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.childId, name: "Noa Example", gender: "girl" }, behaviorLogs: [], milestones: [], setActiveTab: h.setActiveTab }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: (childId: string, name: string) => {
  h.scopes.push(`${childId}:${name}`);
  const items = h.empty || childId !== "child-a" ? [] : name === "langObs" ? [{ id: "word", timestamp: "2026-10-05T12:00:00Z", phrase: "Moon follows us", language: "English" }]
    : name === "milestones" ? [{ id: "first", checked: true, observationStatus: "yes", observationUpdatedAt: "2026-10-06T12:00:00Z", title: "Three steps to me", domain: "sensory_motor_patterns", custom: true }] : [];
  return { items, loading: h.loading, error: h.error, confirmed: h.confirmed, more: h.more, loadMore: h.loadMore, reload: h.reload, isCurrent: () => h.current };
} }));
vi.mock("./KeptItem", () => ({ default: ({ item, disabled }: { item: { text: string }; disabled: boolean }) => { h.itemDisabled.push(disabled); return <article>{item.text}</article>; } }));
vi.mock("./KeptMonthPage", () => ({ default: (props: { page: MonthPage; disabled: boolean; beforeExport: () => boolean }) => { h.pages.push(props); return <div data-testid="month-page" />; } }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import KeptThingsPage from "./KeptThingsPage";

const render = () => { h.buttons = []; h.pages = []; h.itemDisabled = []; h.scopes = []; return renderToStaticMarkup(<KeptThingsPage />); };
const button = (key: string) => h.buttons.find(row => row.children === translate(h.lang, key));
beforeEach(() => { vi.clearAllMocks(); h.lang = "en"; h.childId = "child-a"; h.filter = "all"; h.loading = false; h.error = false; h.confirmed = true; h.more = false; h.empty = false; h.current = true; h.changed = false; });

describe("current My child kept disclosure", () => {
  it("wraps every filter instead of clipping keyboard focus in a horizontal scroller", () => {
    const css = readFileSync(new URL("./kept.css", import.meta.url), "utf8");
    const filters = css.match(/\.kept-filters\s*\{([^}]+)\}/)?.[1] ?? "";
    expect(filters).toMatch(/flex-wrap:\s*wrap/);
    expect(filters).not.toMatch(/overflow(?:-x)?:\s*(?:auto|scroll|hidden|clip)/);
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: filters without count chips and prints the whole month even from a filtered view`, () => {
    h.lang = lang;
    const html = render();
    expect(html).toContain(translate(lang, "kept.title", { name: "Noa" }));
    expect(html).toContain("Moon follows us"); expect(html).toContain("Three steps to me");
    expect(h.pages[0].disabled).toBe(false);
    button("kept.filter.said")!.onClick!();
    const filtered = render();
    expect(filtered).toContain("Moon follows us"); expect(filtered).not.toContain("Three steps to me");
    expect(h.pages[0].page.items.map(row => row.kind)).toEqual(["said", "first"]);
    expect(filtered).not.toMatch(/\d+ (?:kept|words|firsts)|progressbar|%/);
    button("kept.allWords")!.onClick!();
    expect(h.setActiveTab).toHaveBeenCalledWith("language");
  });

  it("loads older existing records only on an explicit tap and prevents partial month export", () => {
    h.more = true; render();
    expect(h.pages[0].disabled).toBe(true);
    expect(h.itemDisabled).toEqual([false, false]);
    expect(h.loadMore).not.toHaveBeenCalled();
    button("kept.loadMore")!.onClick!();
    expect(h.loadMore).toHaveBeenCalledTimes(4);
  });

  it("revalidates source snapshots at export time and reloads rather than sending stale words", () => {
    render(); const guard = h.pages[0].beforeExport;
    expect(guard()).toBe(true); expect(h.reload).not.toHaveBeenCalled();
    h.current = false;
    expect(guard()).toBe(false); expect(h.reload).toHaveBeenCalledTimes(4);
    expect(render()).toContain(translate("en", "kept.changed"));
  });

  for (const state of ["loading", "error", "unconfirmed"] as const) it(`${state}: cannot export a month or an individual item`, () => {
    if (state === "loading") h.loading = true;
    if (state === "error") h.error = true;
    if (state === "unconfirmed") h.confirmed = false;
    const html = render();
    expect(h.pages[0].disabled).toBe(true);
    expect(h.itemDisabled).toEqual([true, true]);
    expect(html).not.toContain(translate("en", "kept.empty", { name: "Noa" }));
    if (state === "error") { button("kept.retry")!.onClick!(); expect(h.reload).toHaveBeenCalledTimes(4); }
  });

  it("does not call a partially paged empty selection an empty record", () => {
    h.empty = true; h.more = true;
    const html = render();
    expect(html).toContain(translate("en", "kept.monthPending"));
    expect(html).not.toContain(translate("en", "kept.empty", { name: "Noa" }));
  });

  it("shows the single-sentence empty state only for a confirmed complete record", () => {
    h.empty = true;
    expect(render()).toContain(translate("en", "kept.empty", { name: "Noa" }));
    expect(h.pages).toEqual([]);
  });

  it("scopes all source reads to the current child and cannot retain another child's rows", () => {
    render();
    expect(h.scopes).toEqual(["child-a:behaviorLogs", "child-a:milestones", "child-a:keepsakes", "child-a:langObs"]);
    h.childId = "child-b";
    expect(render()).not.toContain("Moon follows us");
    expect(h.scopes.every(scope => scope.startsWith("child-b:"))).toBe(true);
    expect(h.pages).toEqual([]);
  });
});
