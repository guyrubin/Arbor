/**
 * B-ASKJB-36 — `#/development?view=kept` opens My child with the kept reader
 * open; searching "kept" / "שמרנו" lands there; Back returns; EN + HE.
 *
 * The kept reader (KeptThingsPage) was built for the My child keepsake
 * disclosure, which v3 F-CHILD-1 unmounted: the parent had no way left to
 * reach their own kept words. It is now a MODE of the My child route, picked
 * by Shell like `?view=program` (no route id, no new surface), reachable by
 * hash, by `#/development/kept` (SUB_ROUTES) and by search.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { splitHash, resolveRouteId } from "../../lib/routes";
import { getSearchIndex, searchCatalog } from "../../lib/searchIndex";
import { placeForTab } from "../../lib/companionPlaces";
import { searchnavText } from "../../lib/i18nElevation/searchnav";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  buttons: [] as { children?: unknown; onClick?: () => void; className?: string; "data-testid"?: string }[],
  goToRoute: vi.fn(),
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "child-a", name: "Noa Example", gender: "girl" }, behaviorLogs: [], milestoneHistory: [], setActiveTab: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: () => ({ items: [], loading: false, error: false, confirmed: true, more: false, loadMore: vi.fn(), reload: vi.fn(), isCurrent: () => true }) }));
vi.mock("../../hooks/useHashQuery", () => ({ goToRoute: h.goToRoute }));
vi.mock("./KeptItem", () => ({ default: () => null }));
vi.mock("./KeptMonthPage", () => ({ default: () => null }));
const capture = vi.hoisted(() => (type: unknown, props: unknown) => { if (type === "button" && props && typeof props === "object") h.buttons.push(props as typeof h.buttons[number]); });
vi.mock("react/jsx-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-runtime")>();
  return { ...runtime, jsx: (...a: Parameters<typeof runtime.jsx>) => { capture(a[0], a[1]); return runtime.jsx(...a); }, jsxs: (...a: Parameters<typeof runtime.jsxs>) => { capture(a[0], a[1]); return runtime.jsxs(...a); } };
});
vi.mock("react/jsx-dev-runtime", async original => {
  const runtime = await original<typeof import("react/jsx-dev-runtime")>();
  return { ...runtime, jsxDEV: (...a: Parameters<typeof runtime.jsxDEV>) => { capture(a[0], a[1]); return runtime.jsxDEV(...a); } };
});
import { KeptReaderMode } from "./KeptThingsPage";

const SRC = path.resolve(__dirname, "..", "..");
const code = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
beforeEach(() => { h.buttons = []; h.goToRoute.mockClear(); h.lang = "en"; });

describe("B-ASKJB-36 · #/development?view=kept is My child with the kept reader open", () => {
  it("the hash and the sub-route path both resolve to My child with view=kept", () => {
    for (const hash of ["#/development?view=kept", "#/development/kept"]) {
      const { key, query } = splitHash(hash);
      expect(key, hash).toBe("development");
      expect(query.get("view"), hash).toBe("kept");
      expect(resolveRouteId(hash), hash).toBe("development");
    }
  });

  it("Shell renders the kept mode for ?view=kept (next to ?view=program), never a new route id", () => {
    const shell = code("components/layout/Shell.tsx");
    expect(shell).toContain('query.get("view") === "program" ? <ProgramPage/> : query.get("view") === "kept" ? <KeptReaderMode/> : <DevelopmentTab');
    expect(shell).toContain('import("../kept/KeptThingsPage").then((m) => ({ default: m.KeptReaderMode }))');
    expect(code("lib/routes.ts")).not.toMatch(/"kept"\s*,\s*\n?\s*"/); // no ROUTE_IDS seat
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: one h1 (the reader's title), a 44 px Back to My child that returns`, () => {
    h.lang = lang;
    const html = renderToStaticMarkup(<KeptReaderMode />);
    expect(html).toContain('data-testid="kept-mode"');
    expect(html).toContain(`dir="${lang === "he" ? "rtl" : "ltr"}"`);
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(1);
    expect(html).toContain('<h1 data-testid="kept-reader-title">');
    expect(html).toContain(translate(lang, "kept.title", { name: "Noa" }));
    expect(html).toContain('data-testid="kept-reader"');
    const back = h.buttons.find((b) => b["data-testid"] === "kept-back")!;
    expect(back.className).toMatch(/\bmin-h-11\b/);
    expect(html).toContain(placeForTab("development")[lang]);
    back.onClick!();
    expect(h.goToRoute).toHaveBeenCalledWith("development");
  });

  it("the reader inside My child keeps its h2 (only the mode is a page)", () => {
    const reader = code("components/kept/KeptThingsPage.tsx");
    expect(reader).toContain('{asPage ? <h1 data-testid="kept-reader-title">');
    expect(reader).toContain(': <h2>{t("kept.title", { name: first })}</h2>}');
    expect(reader).toContain("<KeptThingsPage key={childProfile.id} asPage />");
  });
});

describe("B-ASKJB-36 · searching kept / שמרנו lands on the kept mode", () => {
  for (const q of ["kept", "Kept things", "שמרנו", "ששמרנו", "מה ששמרתם"]) it(`"${q}" finds the kept page row`, () => {
    const hits = searchCatalog(q);
    const row = hits.find((e) => e.id === "page:development:kept");
    expect(row, q).toBeDefined();
    expect(row!.kind).toBe("page");
    expect(row!.tab).toBe("development");
    expect(row!.view).toBe("kept");
  });

  it("the row is not a route row (the route list stays exactly the routes) and is labelled in both languages", () => {
    const row = getSearchIndex().find((e) => e.id === "page:development:kept")!;
    expect(row.title.en).toBe(translate("en", "kept.view"));
    expect(row.title.he).toBe(translate("he", "kept.view"));
    expect(row.sub).toEqual({ en: placeForTab("development").en, he: placeForTab("development").he });
    expect(getSearchIndex().filter((e) => e.kind === "route").some((e) => e.id.includes("kept"))).toBe(false);
  });

  it("a page row opens its mode through goToRoute (a history entry, so Back returns)", () => {
    const results = code("components/search/useSearchResults.ts");
    expect(results).toContain("else if (e.view) { setActiveTab(e.tab); goToRoute(e.tab, { view: e.view }); }");
    expect(searchnavText("elev.searchnav.kind.page", false)).toBe("Page");
    expect(searchnavText("elev.searchnav.kind.page", true)).toBe("עמוד");
  });

  it("NEGATIVE CONTROL: before the row, the kept words were unreachable by search", () => {
    const withoutPage = getSearchIndex().filter((e) => e.kind !== "page");
    expect(withoutPage.some((e) => e.tab === "development" && (e as { view?: string }).view === "kept")).toBe(false);
  });
});

describe("B-ASKJB-36 · critic r1: the way in, the pill row and the filter chips", () => {
  const SRC = path.resolve(__dirname, "..", "..");
  const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

  it("My child's kept card links to the Kept reader (a 44 px pill, EN + HE label)", () => {
    const cards = read("components/companion/PortraitCards.tsx");
    expect(cards).toContain('data-testid="portrait-card-kept-open" href={`#${routeHash("development", { view: "kept" })}`}');
    expect(splitHash("#/development?view=kept")).toMatchObject({ key: "development" });
    for (const lang of ["en", "he"] as const) expect(translate(lang, "kept.view")).not.toBe("kept.view");
    expect(read("components/companion/developmentMap.css")).toMatch(/\.portrait-card-tell \{[^}]*min-block-size: var\(--touch-min\)/);
  });

  it("no place pill reads selected in the Kept reader", () => {
    const shell = read("components/layout/Shell.tsx");
    expect(shell).toContain('const on = it.tab === pillLitTab(activeTab) && !(activeTab === "development" && query.get("view") === "kept");');
  });

  it("every filter chip, the one-word All included, is at least 44 px wide and tall", () => {
    const css = read("components/kept/kept.css");
    const rule = css.split("\n").find((l) => l.startsWith(".kept-filters button {")) ?? "";
    expect(rule).toContain("min-block-size: 44px");
    expect(rule).toContain("min-inline-size: 44px");
  });
});
