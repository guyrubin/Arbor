/**
 * B-ASKJB-36 / v10.1 — the kept reader (the year book) lives in Moments, kind
 * Kept: `#/timeline?kind=kept&reader=book`. Its old addresses
 * (`#/development?view=kept`, `#/development/kept`) and the search rows'
 * `?view=kept` resolve there in lib/routes (movedMode), so saved links keep
 * working; "kept" / "שמרנו" find it; EN + HE.
 *
 * History: the reader was a MODE of My child (KeptReaderMode, picked by Shell
 * like `?view=program`). v10.1 homes it under Moments; the shell no longer
 * carries a second copy, and inside Moments the Moments header holds the h1.
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { translate } from "../../lib/i18n";
import { splitHash, resolveRouteId, routeHash } from "../../lib/routes";
import { getSearchIndex, searchCatalog } from "../../lib/searchIndex";
import { placeForTab } from "../../lib/companionPlaces";
import { litPillFor } from "../../lib/navigation";
import { searchnavText } from "../../lib/i18nElevation/searchnav";

const h = vi.hoisted(() => ({
  lang: "en" as "en" | "he",
  query: "",
  buttons: [] as { children?: unknown; onClick?: () => void; className?: string; "data-testid"?: string }[],
  goToRoute: vi.fn(),
}));
vi.mock("../../context/ArborContext", () => ({ useArbor: () => ({ childProfile: { id: "child-a", name: "Noa Example", gender: "girl" }, behaviorLogs: [], milestoneHistory: [], setActiveTab: vi.fn() }) }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ uiLang: h.lang, t: (key: string, vars?: Record<string, string | number>) => translate(h.lang, key, vars) }) }));
vi.mock("../../hooks/useChildHistory", () => ({ useChildHistory: () => ({ items: [], loading: false, error: false, confirmed: true, more: false, loadMore: vi.fn(), reload: vi.fn(), isCurrent: () => true }) }));
vi.mock("../../hooks/useHashQuery", () => ({ goToRoute: h.goToRoute, useHashQuery: () => new URLSearchParams(h.query) }));
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
import KeptThingsPage from "./KeptThingsPage";

const SRC = path.resolve(__dirname, "..", "..");
const code = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
beforeEach(() => { h.buttons = []; h.goToRoute.mockClear(); h.lang = "en"; h.query = ""; });

describe("v10.1 · the kept reader is Moments, kind Kept; the old addresses resolve there", () => {
  it("the old hash, the sub-route path and the search rows' ?view=kept open the reader in Moments", () => {
    for (const hash of ["#/development?view=kept", "#/development/kept", "#/timeline?view=kept", "#/timeline?kind=kept&reader=book"]) {
      const { key, query } = splitHash(hash);
      expect(key, hash).toBe("timeline");
      expect(query.get("kind"), hash).toBe("kept");
      expect(query.get("reader"), hash).toBe("book");
      expect(query.get("view"), hash).toBeNull();
      expect(resolveRouteId(hash), hash).toBe("timeline");
    }
  });

  it("a year on an old address is kept, so a saved year book link opens that year", () => {
    const { key, query } = splitHash("#/development?view=kept&year=2026");
    expect(key).toBe("timeline");
    expect(query.get("year")).toBe("2026");
    expect(query.get("reader")).toBe("book");
  });

  it("NEGATIVE CONTROL: other My child views and the other Moments kinds are untouched", () => {
    expect(splitHash("#/development?view=program").key).toBe("development");
    expect(splitHash("#/development").key).toBe("development");
    const hard = splitHash("#/timeline?kind=hard");
    expect(hard.key).toBe("timeline");
    expect(hard.query.get("reader")).toBeNull();
  });

  it("the shell carries no second copy of the reader, and kept has no route id", () => {
    const shell = code("components/layout/Shell.tsx");
    expect(shell).not.toContain("KeptReaderMode");
    expect(shell).not.toContain('query.get("view") === "kept"');
    expect(code("components/kept/KeptThingsPage.tsx")).not.toContain("KeptReaderMode");
    expect(code("lib/routes.ts")).not.toMatch(/"kept"\s*,\s*\n?\s*"/); // no ROUTE_IDS seat
  });

  it("Moments renders the reader and opens a year book at its own address", () => {
    const body = code("components/moments/MomentsBody.tsx");
    expect(body).toContain("<KeptThingsPage key={childProfile.id} onOpenYear={openReader} />");
    expect(body).toContain('goToRoute("timeline", { kind: "kept", reader: "book", year })');
    expect(litPillFor("timeline")).toBe("timeline");
  });

  for (const lang of ["en", "he"] as const) it(`${lang}: inside Moments the reader's title is an h2 (the Moments header holds the h1)`, () => {
    h.lang = lang;
    const html = renderToStaticMarkup(<KeptThingsPage />);
    expect(html).toContain('data-testid="kept-reader"');
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(0);
    expect(html).toContain('<h2 data-testid="kept-reader-title">');
    expect(html).toContain(translate(lang, "kept.title", { name: "Noa" }));
  });

  it("a year book request reads that year, still under one heading level", () => {
    h.query = "year=2026";
    const html = renderToStaticMarkup(<KeptThingsPage />);
    expect(html.match(/<h1\b/g) ?? []).toHaveLength(0);
    expect(html).toContain('<h2 data-testid="kept-year-title">');
    expect(html).toContain(translate("en", "kept.yearEmpty", { year: "2026" }));
  });
});

describe("B-ASKJB-36 · searching kept / שמרנו lands on the reader", () => {
  for (const q of ["kept", "Kept things", "שמרנו", "ששמרנו", "מה ששמרתם"]) it(`"${q}" finds the kept page row`, () => {
    const hits = searchCatalog(q);
    const row = hits.find((e) => e.id === "page:development:kept");
    expect(row, q).toBeDefined();
    expect(row!.kind).toBe("page");
    expect(row!.tab).toBe("timeline");
    expect(row!.view).toBe("kept");
    // The row's address resolves to the reader in Moments.
    const { key, query } = splitHash(`#${routeHash(row!.tab, { view: row!.view })}`);
    expect(key).toBe("timeline");
    expect(query.get("reader")).toBe("book");
  });

  it("the row is not a route row (the route list stays exactly the routes) and is labelled in both languages", () => {
    const row = getSearchIndex().find((e) => e.id === "page:development:kept")!;
    expect(row.title.en).toBe(translate("en", "kept.view"));
    expect(row.title.he).toBe(translate("he", "kept.view"));
    expect(row.sub).toEqual({ en: placeForTab("timeline").en, he: placeForTab("timeline").he });
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
    expect(withoutPage.some((e) => (e as { view?: string }).view === "kept")).toBe(false);
  });
});

describe("B-ASKJB-36 · the way in and the filter chips", () => {
  const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

  it("My child's kept card links to the reader in Moments (a 44 px pill, EN + HE label)", () => {
    const cards = read("components/companion/PortraitCards.tsx");
    expect(cards).toContain('data-testid="portrait-card-kept-open" href={`#${routeHash("timeline", { kind: "kept", reader: "book" })}`}');
    expect(splitHash(`#${routeHash("timeline", { kind: "kept", reader: "book" })}`)).toMatchObject({ key: "timeline" });
    for (const lang of ["en", "he"] as const) expect(translate(lang, "kept.view")).not.toBe("kept.view");
    // v10: the link is the card's `.oa` action, 44 px tall (milestonesV10.css).
    expect(cards).toContain('className="oa" data-testid="portrait-card-kept-open"');
    expect(read("components/companion/milestonesV10.css")).toMatch(/\.ds \.obj \.oa \{[^}]*min-height: 44px/);
  });

  it("a year door without Moments' handler still opens the reader's own address", () => {
    const reader = code("components/kept/KeptThingsPage.tsx");
    expect(reader).toContain('goToRoute("timeline", { kind: "kept", reader: "book", year })');
    expect(reader).not.toContain('goToRoute("development", { view: "kept"');
  });

  it("every filter chip, the one-word All included, is at least 44 px wide and tall", () => {
    const css = read("components/kept/kept.css");
    const rule = css.split("\n").find((l) => l.startsWith(".kept-filters button {")) ?? "";
    expect(rule).toContain("min-block-size: 44px");
    expect(rule).toContain("min-inline-size: 44px");
  });
});
