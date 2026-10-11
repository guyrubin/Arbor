import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { savedMilestoneHistory } from "../../lib/record/savedMilestoneHistory";
import type { BandSnapshot } from "../../types";

const h = vi.hoisted(() => ({ view: "kept", child: "a", locale: "en" as "en" | "he", items: [] as BandSnapshot[], loaded: true, error: false, confirmed: true }));
vi.mock("react", async original => ({ ...await original<typeof import("react")>(), useState: () => [h.view, (view: string) => { h.view = view; }] }));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: h.child } }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.locale, t: (key: string, vars?: Record<string, string | number>) => translate(h.locale, key, vars) }) }));
vi.mock("../../hooks/useChildCollection", () => ({ useChildCollection: (child: string, name: string, options: unknown) => {
  expect(child).toBe(h.child); expect(name).toBe("bandSnapshots"); expect(options).toEqual({ orderByField: "date", orderDir: "desc", max: 60, trackConfirmation: true });
  return { items: h.items, loaded: h.loaded, error: h.error, confirmed: h.confirmed };
} }));
vi.mock("../kept/KeptThingsPage", () => ({ default: () => null }));
vi.mock("../growth/ArborTreeCard", () => ({ default: () => null }));
vi.mock("../sections/DevScoreCard", () => ({ default: () => null }));
vi.mock("../ui/Icon", () => ({ default: () => <span /> }));
import PortraitKeepsakes from "./PortraitKeepsakes";

const snapshot = (id: string, date: string, reached?: number): BandSnapshot => ({ id, date, bands: [{ domain: "language", reached, total: 100, signal: 92, band: "strong" }] } as BandSnapshot);
type El = React.ReactElement<Record<string, any>>;
function elements(node: React.ReactNode): El[] { if (!React.isValidElement(node)) return []; const el = node as El; return [el, ...React.Children.toArray(el.props.children).flatMap(elements)]; }
function openHistory() {
  const tree = PortraitKeepsakes();
  const button = elements(tree).find(el => el.type === "button" && React.Children.toArray(el.props.children).includes(translate(h.locale, "elev.growthTruth.copilot.history.title")))!;
  expect(button).toBeTruthy(); button.props.onClick();
  return renderToStaticMarkup(PortraitKeepsakes());
}
beforeEach(() => { h.view = "kept"; h.child = "a"; h.locale = "en"; h.loaded = true; h.error = false; h.confirmed = true; h.items = [snapshot("2026-W40", "2026-10-02", 37), snapshot("2026-W39", "2026-09-25")]; });

describe("B-GROWTH-22 · retained saved history is reachable through the supported Record disclosure", () => {
  for (const lang of ["en", "he"] as const) it(`${lang}: the actual keepsakes history tab renders saved counts and explicit unknowns`, () => {
    h.locale = lang;
    const html = openHistory();
    expect(html).toContain('data-testid="portrait-keepsakes"');
    expect(html).toContain('data-testid="saved-milestone-history"');
    expect(html).toContain(translate(lang, "elev.reports.lead.milestones.other", { n: 37 }));
    expect(html).toContain(translate(lang, "elev.growthTruth.copilot.history.noSavedCounts"));
    expect(html).toContain(translate(lang, "elev.growthTruth.copilot.history.savedNote"));
    expect(html.replace(/<[^>]*>/g, " ")).not.toMatch(/92|strong|100|%/);
    expect(html).not.toContain('role="progressbar"');
    expect(html).not.toContain("data-primary-move");
  });
  for (const loss of ["loaded", "confirmed", "error"] as const) it(`${loss} source loss cannot present a saved count as current data`, () => {
    if (loss === "error") h.error = true; else h[loss] = false;
    const html = openHistory(); expect(html).not.toContain("2026-W40"); expect(html).toContain('role="status"');
  });
  it("the live development leaf mounts this existing disclosure", () => {
    const portrait = readFileSync(new URL("./ChildPortrait.tsx", import.meta.url), "utf8");
    const shell = readFileSync(new URL("../layout/Shell.tsx", import.meta.url), "utf8");
    expect(portrait).toContain("<PortraitKeepsakes");
    expect(shell).toContain('import("../companion/ChildPortrait")');
    expect(shell).toContain("development: DevelopmentTab");
  });
});

describe("saved history projection never invents or grades a dated count", () => {
  it("preserves the exact saved numerator, never clamps it to a current age window", () => {
    expect(savedMilestoneHistory([snapshot("week", "2026-10-02", 37)])[0].counts).toEqual([{ domain: "language", reached: 37 }]);
  });
  for (const value of [undefined, NaN, Infinity, -1, 1.5]) it(`missing/invalid saved numerator ${String(value)} stays unknown`, () => {
    expect(savedMilestoneHistory([snapshot("week", "2026-10-02", value)])[0].counts[0].reached).toBeNull();
  });
  it("zero is an actual saved count, and the newest three snapshots stay dated", () => {
    const result = savedMilestoneHistory([snapshot("old", "2026-01-01", 0), snapshot("new", "2026-10-02", 0), snapshot("mid", "2026-09-02", 1), snapshot("older", "2026-08-02", 2)]);
    expect(result.map(s => s.id)).toEqual(["new", "mid", "older"]); expect(result[0].counts[0].reached).toBe(0);
  });
  it("never accesses stored grade, signal, or denominator fields", () => {
    const value = snapshot("week", "2026-10-02", 37);
    for (const field of ["signal", "band", "total"]) Object.defineProperty(value.bands[0], field, { get: () => { throw new Error(`forbidden ${field}`); } });
    expect(savedMilestoneHistory([value])[0].counts[0].reached).toBe(37);
  });
});
