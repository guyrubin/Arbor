/**
 * OBJ-LEARN-01 · OBJ-LEARN-02 · LC-05/RUN-11 · LC-26 · LC-33.
 *
 * The Learn Library's own surface contract says the shelf is age-banded. It
 * was not: all 93 cards rendered, 0–1 bands included, in one 23,000 px column
 * for a five-year-old — while Masterclasses, one route away, had shipped the
 * whole mechanism (filterByAge + windowFromYears + a persisted "Show all ages"
 * preference + an "N hidden by age" toggle). This ports that, and covers the
 * four smaller Learn·Care rows that ride with it.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterByAge, windowFromYears } from "./ageFilter";
import { LEARN_CARDS } from "../learn/learnCards";
import { en, he } from "./i18nElevation/careHonesty";
import { rankLearnCards } from "../learn/learnLibrary";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, "..", rel), "utf8");
const LEARN = read("components/sections/LearnLibrary.tsx");
const MASTER = read("components/sections/Masterclasses.tsx");

/** A five-year-old: the run's own seeded child. */
const FIVE_YEARS_MONTHS = 60;

describe("OBJ-LEARN-01 · negative control — the unfiltered shelf is the defect", () => {
  it("the whole catalogue includes bands a five-year-old has outgrown", () => {
    expect(LEARN_CARDS.length).toBeGreaterThan(60);
    const outgrown = LEARN_CARDS.filter((c) => c.ageMax < 4);
    expect(outgrown.length, "no infant-band cards in the catalogue at all").toBeGreaterThan(0);
  });
});

describe("OBJ-LEARN-01 · the age window is on by default", () => {
  const { visible, hidden } = filterByAge(
    LEARN_CARDS,
    (c) => windowFromYears(c.ageMin, c.ageMax),
    FIVE_YEARS_MONTHS,
  );

  it("hides cards written for another age, and keeps the rest", () => {
    expect(hidden.length).toBeGreaterThan(0);
    expect(visible.length).toBeGreaterThan(0);
    expect(visible.length + hidden.length).toBe(LEARN_CARDS.length);
  });

  it("the default view is materially shorter than the whole shelf", () => {
    expect(visible.length).toBeLessThan(LEARN_CARDS.length);
  });

  it("nothing a five-year-old is squarely inside is hidden", () => {
    for (const c of hidden) {
      const inBand = c.ageMin <= 5 && c.ageMax >= 5;
      expect(inBand, `${c.id} (${c.ageMin}-${c.ageMax}) hidden for a 5yo`).toBe(false);
    }
  });

  it("the surface uses the SHARED mechanism, not a private copy", () => {
    expect(LEARN).toContain('from "../../lib/ageFilter"');
    expect(LEARN).toContain("windowFromYears(c.ageMin, c.ageMax)");
    expect(LEARN).toContain('loadShowAllAges("learn")');
    expect(LEARN).toContain('saveShowAllAges("learn", next)');
  });

  it("every card stays reachable behind the hidden-count toggle (law 6)", () => {
    expect(LEARN).toContain('data-testid="agefilter-toggle-learn"');
    expect(LEARN).toContain('role="switch"');
    expect(LEARN).toContain("aria-checked={showAllAges}");
    expect(LEARN).toContain('agefilterText("elev.agefilter.hiddenCount", he, { n: ageHidden.length })');
    // The toggle renders only when it has something to say — the same
    // condition Masterclasses uses.
    expect(LEARN).toContain("(ageHidden.length > 0 || showAllAges)");
    expect(MASTER).toContain("(ageHidden.length > 0 || showAllAges)");
  });

  it("the visible count reported to the parent is the count they can see", () => {
    expect(LEARN).toContain('t("learn.count", { n: inScope.length })');
    expect(LEARN).not.toContain('t("learn.count", { n: LEARN_CARDS.length })');
  });
});

describe("OBJ-LEARN-02 · opening a read is a navigation", () => {
  it("the reader pushes one history entry carrying the card id", () => {
    expect(LEARN).toContain("arborLearnCard: id");
    expect(LEARN).toContain('window.addEventListener("popstate", onPop)');
    // It must NOT drive the hash: ArborContext owns `#/<tab>` and rewrites it.
    expect(LEARN).not.toMatch(/location\.hash\s*=/);
  });

  it("closing from inside the reader retires that entry", () => {
    expect(LEARN).toContain("const closeCard = () => {");
    expect(LEARN).toContain("window.history.back()");
    expect(LEARN).toContain("onBack={closeCard}");
    expect(LEARN).not.toContain("onBack={() => setOpenId(null)}");
  });

  it("focus moves to the reader's own heading", () => {
    expect(LEARN).toContain('data-testid="learn-reader-heading"');
    expect(LEARN).toContain("tabIndex={-1}");
    expect(LEARN).toContain("useEffect(() => { headingRef.current?.focus(); }, [card.id]);");
  });

  it("the sharing wizard focuses its first control", () => {
    const sharing = read("components/sections/TrustedSharing.tsx");
    expect(sharing).toContain("useEffect(() => { if (adding) recipientRef.current?.focus(); }, [adding]);");
    expect(sharing).toContain("<input ref={recipientRef}");
  });
});

describe("LC-05 / RUN-11 · the parent-learning hub carries no kid-register doors", () => {
  it("the Story-journeys and Comic-library tiles are gone", () => {
    expect(MASTER).not.toContain('setActiveTab("journey")');
    expect(MASTER).not.toContain('setActiveTab("comics")');
    expect(MASTER).not.toContain("Choose an Academy experience");
  });

  it("the hero, the pick card and the courses gallery all remain (law 6)", () => {
    expect(MASTER).toContain('testId="academy-hub-hero"');
    expect(MASTER).toContain('data-testid="academy-pick-why"');
    expect(MASTER).toContain('t("academy.courses.title")');
  });
});

describe("LC-26 · the reader body sits on the type token", () => {
  it("no raw 14 px body paragraphs remain in the reader", () => {
    expect(LEARN).not.toContain('className="text-[14px] leading-relaxed"');
    expect(LEARN).not.toContain('className="text-[14.5px] leading-relaxed max-w-[72ch]"');
    expect((LEARN.match(/className="t-base leading-relaxed/g) ?? []).length).toBe(3);
  });
});

describe("LC-33 · the saved shelf's empty state offers a way forward", () => {
  it("it hands the parent a CTA back into the library", () => {
    expect(LEARN).toContain('t("elev.learnCare.saved.browse", { name: firstName })');
    expect(LEARN).toContain('onClick: () => { setFilter("all"); setQuery(""); }');
    expect(LEARN).not.toContain('filter === "saved" ? undefined :');
  });

  it("the CTA copy ships in both locales (law 7)", () => {
    expect(en["elev.learnCare.saved.browse"]).toContain("{name}");
    expect(he["elev.learnCare.saved.browse"]).toContain("{name}");
    expect(he["elev.learnCare.saved.browse"]).toMatch(/[֐-׿]/);
  });
});

describe("R12 · the default shelf is short, and every control says what it does", () => {
  /** Exactly what LearnLibrary computes for the run's seeded five-year-old. */
  const SHELF_PAGE = 30;
  const { visible: ageVisible, hidden: ageHidden } = filterByAge(
    LEARN_CARDS,
    (c) => windowFromYears(c.ageMin, c.ageMax),
    FIVE_YEARS_MONTHS,
  );
  const ranked = rankLearnCards(ageVisible, { ageYears: 5 });
  const featured = ranked.slice(0, 2);
  const gridAll = ranked.filter((c) => !featured.some((f) => f.id === c.id));
  const firstPage = gridAll.slice(0, SHELF_PAGE - featured.length);

  it("NEGATIVE CONTROL: the age filter alone cannot make this shelf short", () => {
    // The rejection read as "the filter is off". It is not — it is applied and
    // it removes 14 cards. 79 of the 93 name a five-year-old in their own band
    // (0-12, 1-10, 2-8 ...), so the uncapped shelf is still far past 30.
    expect(ageHidden.length).toBeGreaterThan(0);
    expect(ageVisible.length).toBeGreaterThan(SHELF_PAGE);
    expect(gridAll.length + featured.length).toBe(ageVisible.length);
  });

  it("the shelf a five-year-old lands on is 30 reads or fewer", () => {
    expect(featured.length + firstPage.length).toBeLessThanOrEqual(SHELF_PAGE);
  });

  it("the page is the best-ranked page, not a slice of the catalogue file", () => {
    // Ranking is applied BEFORE the cut, so the first page is what ranking chose.
    expect(firstPage[0]).toBe(gridAll[0]);
    expect(firstPage.every((c) => ageVisible.includes(c))).toBe(true);
  });

  it("the surface caps the browse shelf, and only the browse shelf (law 6)", () => {
    expect(LEARN).toContain("const SHELF_PAGE = 30;");
    expect(LEARN).toContain("browsing && !showAllShelf && gridAll.length > SHELF_PAGE - featured.length");
    expect(LEARN).toContain("gridCards = shelfCapped ? gridAll.slice(0, SHELF_PAGE - featured.length) : gridAll");
    // Filtered/searched views are never capped.
    expect(LEARN).toContain("const gridAll = browsing ? visible.filter");
  });

  it("every capped card stays one tap away behind a control of its own", () => {
    expect(LEARN).toContain('data-testid="learn-shelf-more"');
    expect(LEARN).toContain("aria-expanded={showAllShelf}");
    expect(LEARN).toContain('t("elev.learnCare.shelf.more", { n: shelfRest })');
    expect(LEARN).toContain('t("elev.learnCare.shelf.fewer")');
  });

  it("the length control never borrows the age control's sentence", () => {
    // "N more for other ages" is the AGE toggle's line and stays only there:
    // 79 in-band cards are not hidden by age, and must not be labelled so.
    expect(en["elev.learnCare.shelf.more"]).not.toMatch(/age/i);
    expect(en["elev.learnCare.shelf.more"]).toContain("{n}");
    expect(he["elev.learnCare.shelf.more"]).toContain("{n}");
    expect(he["elev.learnCare.shelf.more"]).toMatch(/[֐-׿]/);
    expect(he["elev.learnCare.shelf.fewer"]).toMatch(/[֐-׿]/);
  });

  it("the age switch can actually be reached at 390 (the row wraps)", () => {
    // It was `flex items-baseline justify-between` with a non-wrapping span,
    // so the switch rendered off the right edge of a 390 px viewport.
    expect(LEARN).not.toContain('<div className="flex items-baseline justify-between mb-2.5">');
    expect(LEARN).toContain('<div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1.5 mb-2.5">');
    expect(LEARN).toContain('<span className="inline-flex flex-wrap items-center gap-2">');
  });
});
