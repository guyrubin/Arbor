import { afterEach, describe, expect, it, vi } from "vitest";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { computeContentHash, isPublishableContent, type ContentLocale } from "./governance";
import { hardMomentCards, publishedHardMomentCards, type HardMomentCard } from "./hardMomentCards";
import { availableHardMomentCards, byCategory, byConcern, matchToRecentBehaviors } from "./selectCards";
import { buildHardMomentSeedPrompt, todayHardMomentOffer } from "./hardMomentSurface";
import { HARD_MOMENT_PILOT, computePilotDigest, hardMomentPublication, type HardMomentContext } from "./pilotRelease";
import { hardMomentPilotText } from "./hardMomentPilotText";
import { getSearchIndex, searchCatalog } from "../lib/searchIndex";
import { translate } from "../lib/i18n";

const ui = vi.hoisted(() => ({
  locale: "en" as "en" | "he",
  childProfile: { name: "Noa", ageMonths: 36 },
  behaviorLogs: [] as { behaviorType: string; timestamp: string }[],
  activeTodayAction: null,
  acceptTodayAction: vi.fn(),
  seedCoach: vi.fn(),
}));
vi.mock("../context/ArborContext", () => ({ useArbor: () => ({ ...ui, requestLearnRead: vi.fn() }) }));
vi.mock("../context/LanguageContext", () => ({ useLanguage: () => ({
  uiLang: ui.locale, aiLang: ui.locale, t: (key: string) => translate(ui.locale, key),
}) }));
vi.mock("../components/ui/Modal", () => ({ Modal: () => null }));
import HardMomentsSection, { HardMomentGuideContent } from "../components/behaviors/HardMomentsSection";
import HardMomentTodayOffer from "../components/overview/HardMomentTodayOffer";

const NOW = new Date("2026-09-04T12:00:00Z");
const context = (locale: ContentLocale = "en", ageMonths: number | null = 36): HardMomentContext => ({ locale, ageMonths, now: NOW });
const find = (id: string) => hardMomentCards.find((card) => card.id === id)!;
const log = { behaviorType: "Hitting", timestamp: NOW.toISOString() };
const IDS = [
  "tantrum", "refusal", "hitting", "sibling-conflict", "separation", "bedtime",
  "leaving-play", "morning-rush", "homework", "screen-ending", "public-meltdown",
  "whining", "not-listening", "fear-new-thing", "losing-game", "sharing",
  "teasing", "clinging", "school-dropoff", "getting-dressed", "toothbrushing",
  "mealtime", "bath", "waiting", "change-of-plan",
];
const schoolAge = new Set(["homework", "screen-ending", "losing-game"]);
afterEach(() => { vi.useRealTimers(); ui.locale = "en"; ui.childProfile.ageMonths = 36; ui.behaviorLogs = []; });

describe("arbor-pilot-2026-09-04 — separate, bounded editorial release", () => {
  it("enumerates exactly 25 frozen IDs and grants no clinical stamps", () => {
    expect(Object.keys(HARD_MOMENT_PILOT.entries)).toEqual(IDS);
    expect(hardMomentCards.map((card) => card.id)).toEqual(IDS);
    expect(Object.isFrozen(HARD_MOMENT_PILOT.entries)).toBe(true);
    expect(publishedHardMomentCards).toEqual([]);
    for (const card of hardMomentCards) {
      expect(card.reviewStatus).toBe("draft");
      expect(card.reviewedBy).toBe("");
      expect(card.reviewedAt).toBe("");
      expect(card.contentHash).toBeUndefined();
      expect(isPublishableContent(card, NOW)).toBe(false);
      expect(HARD_MOMENT_PILOT.entries[card.id]).toBe(computePilotDigest(card));
      expect(card.evidenceRefs.every((ref) => ref.startsWith("https://"))).toBe(true);
    }
    expect(hardMomentCards.filter((card) => card.safetyClass === "heightened-care").map((card) => card.id))
      .toEqual(["tantrum", "hitting", "separation", "public-meltdown", "fear-new-thing", "teasing", "school-dropoff", "mealtime", "bath"]);
  });

  for (const locale of ["en", "he"] as const) {
    it.each(IDS)("%s is available and rendered only in its authored age bands — " + locale, (id) => {
      const card = find(id);
      const ctx = context(locale, schoolAge.has(id) ? 84 : 36);
      expect(hardMomentPublication(card, ctx)).toBe("editorial-pilot");
      expect(availableHardMomentCards(ctx)).toContain(card);
      expect(hardMomentPublication(card, { ...ctx, ageMonths: schoolAge.has(id) ? 36 : 84 })).toBeNull();
      const html = renderToStaticMarkup(createElement(HardMomentGuideContent, {
        card, context: ctx, childName: "Noa", t: (key) => translate(locale, key),
      }));
      expect(html).toContain(`lang="${locale}"`);
      expect(html).toContain(`dir="${locale === "he" ? "rtl" : "ltr"}"`);
      const escaped = (text: string) => renderToStaticMarkup(createElement("span", null, text)).slice(6, -7);
      expect(html).toContain(escaped(card.doNow[locale]));
      expect(html).toContain(escaped(card.escalation[locale]));
      expect(html).toContain(hardMomentPilotText(locale).status);
      expect(html).toContain(hardMomentPilotText(locale).explanation);
      expect(html).not.toContain("{{childName}}");
      const seed = buildHardMomentSeedPrompt(card, locale, "Noa", ctx);
      expect(seed).toContain(card.escalation[locale]);
      expect(seed).toContain("has not had individual clinical review");
      expect(seed).not.toContain("Here is the reviewed Arbor guide");
    });
  }

  it("keeps both inclusive band edges, and rejects missing/invalid age or locale", () => {
    expect(availableHardMomentCards(context("en", 24))).toHaveLength(22);
    expect(availableHardMomentCards(context("he", 71))).toHaveLength(22);
    expect(availableHardMomentCards(context("en", 72))).toHaveLength(3);
    expect(availableHardMomentCards(context("he", 155))).toHaveLength(3);
    for (const ageMonths of [null, undefined, NaN, Infinity, -1, 0, 23, 156]) {
      expect(availableHardMomentCards({ ...context(), ageMonths })).toEqual([]);
    }
    expect(availableHardMomentCards({ ...context(), locale: "fr" as ContentLocale })).toEqual([]);
    expect(buildHardMomentSeedPrompt(find("hitting"), "en")).toBe("");
  });

  it("does not release early, with a bad clock, or from a forged/withdrawn release", () => {
    const card = find("hitting");
    for (const now of [new Date("2026-09-03"), new Date(HARD_MOMENT_PILOT.expiresAt), new Date("2027-01-01"), new Date(NaN)]) {
      expect(hardMomentPublication(card, { ...context(), now })).toBeNull();
    }
    for (const release of [
      { ...HARD_MOMENT_PILOT, status: "withdrawn" as const },
      { ...HARD_MOMENT_PILOT, id: "unrecognized" },
      { ...HARD_MOMENT_PILOT, availableFrom: "2026-01-01" },
      { ...HARD_MOMENT_PILOT, expiresAt: "2027-01-01" },
      { ...HARD_MOMENT_PILOT, entries: {} },
      { ...HARD_MOMENT_PILOT, withdrawnIds: ["hitting"] },
    ]) {
      expect(hardMomentPublication(card, { ...context(), release })).toBeNull();
      expect(buildHardMomentSeedPrompt(card, "en", undefined, { ...context(), release })).toBe("");
    }
    const unknown = { ...card, id: "unreleased-card" };
    const release = { ...HARD_MOMENT_PILOT, entries: { ...HARD_MOMENT_PILOT.entries, [unknown.id]: computePilotDigest(unknown) } };
    expect(hardMomentPublication(unknown, { ...context(), release })).toBeNull();
  });

  it("preserves the reviewed policy and gives withdrawal precedence", () => {
    const card = find("hitting");
    const reviewed = { ...card, reviewStatus: "approved" as const, reviewedBy: "Synthetic reviewer fixture", reviewedAt: "2026-09-01", contentHash: computeContentHash(card) };
    expect(isPublishableContent(reviewed, NOW)).toBe(true);
    expect(hardMomentPublication(reviewed, context())).toBe("clinical-review");
    expect(hardMomentPublication({ ...reviewed, reviewedBy: "" }, context())).toBeNull();
    expect(hardMomentPublication({ ...reviewed, reviewDueAt: "2026-09-02" }, context())).toBeNull();
    expect(hardMomentPublication(reviewed, { ...context(), release: { ...HARD_MOMENT_PILOT, withdrawnIds: ["hitting"] } })).toBeNull();
  });
});

describe("mutation controls across every release consumer", () => {
  const mutations: [string, (card: HardMomentCard) => void][] = [
    ...(["title", "doNow", "sayThis", "avoid", "observe", "escalation"] as const).flatMap((field) =>
      (["en", "he"] as const).map((locale): [string, (card: HardMomentCard) => void] =>
        [field + "." + locale, (card) => { card[field][locale] += " changed"; }])),
    ["ageBands", (card) => { card.ageBands = ["0-18"]; }],
    ["malformed ageBands", (card) => { card.ageBands = ["2-5", "unknown"]; }],
    ["safetyClass", (card) => { card.safetyClass = "general-parenting"; }],
    ["locales", (card) => { card.locales = ["en"]; }],
    ["evidenceRefs", (card) => { card.evidenceRefs = []; }],
    ["domains", (card) => { card.domains = ["changed"]; }],
    ["concerns", (card) => { card.concerns.push("routines"); }],
    ["moment", (card) => { card.moment = "changed"; }],
    ["category", (card) => { card.category = "limits"; }],
    ["version", (card) => { card.version = "1.1.1"; }],
    ["retired", (card) => { card.reviewStatus = "retired"; }],
    ["pretend review", (card) => { card.reviewStatus = "approved"; }],
    ["blank Hebrew", (card) => { card.doNow.he = " "; }],
  ];

  it.each(mutations)("%s change closes lists, detail, Today and coaching", (_name, mutate) => {
    const card = structuredClone(find("hitting"));
    mutate(card);
    for (const locale of ["en", "he"] as const) {
      const ctx = context(locale);
      expect(hardMomentPublication(card, ctx)).toBeNull();
      expect(availableHardMomentCards(ctx, [card])).toEqual([]);
      expect(byCategory(card.category, [card], NOW, 36, locale)).toEqual([]);
      expect(byConcern("aggression", [card], NOW, 36, locale)).toEqual([]);
      expect(matchToRecentBehaviors(["Hitting"], [card], NOW, 36, locale)).toEqual([]);
      expect(todayHardMomentOffer([log], [card], NOW, 36, locale)).toBeNull();
      expect(buildHardMomentSeedPrompt(card, locale, undefined, ctx)).toBe("");
      expect(renderToStaticMarkup(createElement(HardMomentGuideContent, { card, context: ctx, t: (key) => key }))).toBe("");
    }
  });

  it("withdrawal reaches all selector wrappers and seed even after earlier success", () => {
    const card = find("hitting");
    expect(todayHardMomentOffer([log], [card], NOW, 36, "he")?.card).toBe(card);
    const release = { ...HARD_MOMENT_PILOT, withdrawnIds: ["hitting"] };
    expect(byCategory(card.category, [card], NOW, 36, "he", release)).toEqual([]);
    expect(byConcern("aggression", [card], NOW, 36, "he", release)).toEqual([]);
    expect(matchToRecentBehaviors(["מכות"], [card], NOW, 36, "he", release)).toEqual([]);
    expect(todayHardMomentOffer([log], [card], NOW, 36, "he", release)).toBeNull();
    expect(buildHardMomentSeedPrompt(card, "he", undefined, { ...context("he"), release })).toBe("");
  });

  it("Search never retains a stale pilot result in its static memo", () => {
    expect(getSearchIndex().filter((entry) => entry.kind === "hard-moment")).toEqual([]);
    expect(getSearchIndex(context()).filter((entry) => entry.kind === "hard-moment")).toHaveLength(22);
    expect(getSearchIndex(context("he", 84)).filter((entry) => entry.kind === "hard-moment")).toHaveLength(3);
    expect(searchCatalog("מכות", 100, context("he")).map((entry) => entry.id)).toContain("hard-moment:hitting");
    const card = find("hitting"), original = card.doNow.he;
    try {
      card.doNow.he += " changed";
      expect(getSearchIndex(context("he")).map((entry) => entry.id)).not.toContain("hard-moment:hitting");
    } finally { card.doNow.he = original; }
    const release = { ...HARD_MOMENT_PILOT, withdrawnIds: ["hitting"] };
    expect(searchCatalog("hitting", 100, { ...context(), release }).map((entry) => entry.id)).not.toContain("hard-moment:hitting");
    expect(getSearchIndex(context("he", 84)).map((entry) => entry.id)).not.toContain("hard-moment:hitting");
  });
});

describe("real parent surface markup", () => {
  for (const locale of ["en", "he"] as const) {
    it("renders localized catalog and Today offer with 44px controls — " + locale, () => {
      vi.useFakeTimers(); vi.setSystemTime(NOW);
      ui.locale = locale; ui.behaviorLogs = [log];
      const section = renderToStaticMarkup(createElement(HardMomentsSection));
      expect(section).toContain(find("hitting").title[locale]);
      expect(section).not.toContain(find("homework").title[locale]);
      expect(section).toContain('min-h-11');
      expect(section).toContain('min-w-0');
      const today = renderToStaticMarkup(createElement(HardMomentTodayOffer));
      expect(today).toContain(find("hitting").title[locale]);
      expect(today).toContain(hardMomentPilotText(locale).status);
      expect(today).toContain(hardMomentPilotText(locale).explanation);
      expect(today).toContain('min-h-11');
      expect(today).not.toContain("gradient-primary");
      ui.childProfile.ageMonths = 12;
      expect(renderToStaticMarkup(createElement(HardMomentsSection))).toBe("");
      expect(renderToStaticMarkup(createElement(HardMomentTodayOffer))).toBe("");
    });
  }
});

describe("use-time applicability and real Today action callbacks", () => {
  it("rejects wrong-age, missing-locale and expired contexts throughout", () => {
    const card = find("hitting");
    for (const ctx of [
      context("en", 84),
      { ...context(), locale: undefined as unknown as ContentLocale },
      { ...context(), now: new Date(HARD_MOMENT_PILOT.expiresAt) },
    ]) {
      expect(availableHardMomentCards(ctx, [card])).toEqual([]);
      // Omitted locale defaults only on the compatibility wrappers; the policy,
      // Search and coach handoff require an explicit supported locale.
      expect(buildHardMomentSeedPrompt(card, ctx.locale, undefined, ctx)).toBe("");
      expect(getSearchIndex(ctx).map((entry) => entry.id)).not.toContain("hard-moment:hitting");
      expect(renderToStaticMarkup(createElement(HardMomentGuideContent, { card, context: ctx, t: (key) => key }))).toBe("");
    }
    const expired = new Date(HARD_MOMENT_PILOT.expiresAt);
    const currentLog = { ...log, timestamp: expired.toISOString() };
    expect(byCategory(card.category, [card], expired, 36, "en")).toEqual([]);
    expect(byConcern("aggression", [card], expired, 36, "he")).toEqual([]);
    expect(matchToRecentBehaviors(["Hitting"], [card], expired, 36, "en")).toEqual([]);
    expect(todayHardMomentOffer([currentLog], [card], expired, 36, "he")).toBeNull();
  });

  it("a caller cannot repair a changed card by supplying its own digest", () => {
    const card = structuredClone(find("hitting"));
    card.ageBands = ["0-18"];
    const release = { ...HARD_MOMENT_PILOT, entries: { ...HARD_MOMENT_PILOT.entries, hitting: computePilotDigest(card) } };
    expect(hardMomentPublication(card, { ...context(), release })).toBeNull();
  });

  it("Today rechecks retirement, copy, age and expiry before accepting its rendered action", () => {
    vi.useFakeTimers(); vi.setSystemTime(NOW);
    ui.behaviorLogs = [log]; ui.acceptTodayAction.mockClear();
    // The real component has no React state hooks; context hooks are mocked above.
    // Walk its returned React elements to invoke the actual button callback.
    type Element = { type: unknown; props: { children?: unknown; onClick?: () => void } };
    const button = (node: unknown): Element | undefined => {
      if (!node || typeof node !== "object") return;
      if (Array.isArray(node)) return node.map(button).find(Boolean);
      const element = node as Element;
      return element.type === "button" ? element : button(element.props?.children);
    };
    const onClick = button(HardMomentTodayOffer())?.props.onClick;
    expect(onClick).toBeTypeOf("function");
    onClick!();
    expect(ui.acceptTodayAction).toHaveBeenLastCalledWith(find("hitting").doNow.en, "standard");
    ui.acceptTodayAction.mockClear();
    const card = find("hitting"), original = structuredClone(card);
    try {
      card.reviewStatus = "retired"; onClick!();
      Object.assign(card, structuredClone(original));
      card.doNow.en += " changed"; onClick!();
      Object.assign(card, structuredClone(original));
      ui.childProfile.ageMonths = 84; onClick!();
      ui.childProfile.ageMonths = 36;
      vi.setSystemTime(new Date(HARD_MOMENT_PILOT.expiresAt)); onClick!();
      expect(ui.acceptTodayAction).not.toHaveBeenCalled();
    } finally { Object.assign(card, original); }
  });

  it("urgency is first in both locales, before the hitting-specific medical advice", () => {
    const card = find("hitting");
    expect(card.escalation.en).toMatch(/^If anyone is in immediate danger, seek local emergency help\./);
    expect(card.escalation.he).toMatch(/^אם מישהו בסכנה מיידית, פנו לעזרת חירום מקומית\./);
    expect(card.escalation.en).toContain("For injuries, seek medical advice promptly.");
    expect(card.sayThis.en).not.toContain("You're safe");
    expect(find("separation").sayThis.en).not.toContain("After snack");
  });
});
