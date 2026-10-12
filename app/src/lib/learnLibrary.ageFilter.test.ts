/**
 * OBJ-LEARN-01 · OBJ-LEARN-02 · LC-05/RUN-11 · LC-26 · LC-33.
 *
 * The Learn Library's own surface contract says the shelf is age-banded. It
 * was not: all 93 cards rendered, 0–1 bands included, in one 23,000 px column
 * for a five-year-old — while Masterclasses, one route away, had shipped the
 * whole mechanism (filterByAge + windowFromYears + a persisted "Show all ages"
 * preference + an "N hidden by age" toggle). This ports that, and covers the
 * four smaller Learn·Care rows that ride with it.
 *
 * v3 F-FORYOU-1 re-pins the surface pins here: #/learn is a reader only (no
 * shelf, search, tabs or Saved filter). Reads reach the parent on For you,
 * the parent (#/masterclasses): today's pick and three short reads, both drawn
 * from the age-fit catalogue, and the courses by area behind the SAME shared
 * age switch. The function-level tests below are unchanged.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { filterByAge, windowFromYears } from "./ageFilter";
import { LEARN_CARDS } from "../learn/learnCards";
import { en, he } from "./i18nElevation/careHonesty";
import { rankLearnCards } from "../learn/learnLibrary";
import { translate as tr } from "./i18n";

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

  // v3 F-FORYOU-1 (re-pin): the age mechanism lives on For you now — the
  // courses and the readiness courses behind the shared switch, and the reads
  // drawn from the age-fit catalogue. #/learn shows one read and filters none.
  it("the surface uses the SHARED mechanism, not a private copy", () => {
    expect(MASTER).toContain('from "../../lib/ageFilter"');
    expect(MASTER).toContain("(m) => windowFromYears(m.ageMinYears, m.ageMaxYears),");
    expect(MASTER).toContain('loadShowAllAges("masterclasses")');
    expect(MASTER).toContain('saveShowAllAges("masterclasses", next)');
    expect(MASTER).toContain("rankLearnCards(ageVisibleLearnCards(LEARN_CARDS, learnSignals.ageYears), learnSignals)");
    expect(LEARN).not.toContain("filterByAge(");
  });

  it("every course stays reachable behind the hidden-count toggle (law 6)", () => {
    expect(MASTER).toContain('data-testid="agefilter-toggle-masterclasses"');
    expect(MASTER).toContain('role="switch"');
    expect(MASTER).toContain("aria-checked={showAllAges}");
    expect(MASTER).toContain('agefilterText("elev.agefilter.hiddenCount", he, { n: hiddenByAge })');
    expect(MASTER).toContain("const hiddenByAge = ageHidden.length + readinessHidden.length;");
    // The toggle renders only when it has something to say.
    expect(MASTER).toContain("(ageHidden.length > 0 || showAllAges)");
  });

  it("the counts a parent sees are counts of what they can see", () => {
    // The chips count the visible courses (the readiness courses included);
    // #/learn shows no count at all.
    expect(MASTER).toContain("const areaCounts = courseAreaCounts([...catalog, ...readiness]);");
    expect(MASTER).toContain("const readiness = showAllAges ? READINESS_COURSES : readinessVisible;");
    expect(LEARN).not.toContain('t("learn.count"');
  });
});

describe("OBJ-LEARN-02 · opening a read is a navigation", () => {
  // v3 F-FORYOU-1 (re-pin): a read opened on For you opens in a sheet that
  // owns one history entry (Back closes it). The #/learn route names its read
  // with replaceState, never by driving the hash ArborContext owns.
  it("a read opened on For you owns one history entry; #/learn names its read in place", () => {
    const sheet = read("components/sections/ForYouReadSheet.tsx");
    expect(sheet).toContain("const close = useSheetHistory(true, onClose);");
    expect(MASTER).toContain("<ForYouReadSheet cardId={readId} onClose={() => setReadId(null)} />");
    expect(LEARN).toContain('window.history.replaceState(window.history.state, "", want)');
    expect(LEARN).not.toMatch(/location\.hash\s*=/);
  });

  it("the route's Back goes to For you, the parent", () => {
    expect(LEARN).toContain('onBack={() => setActiveTab("masterclasses")}');
    expect(LEARN).toContain('{t("companion.door.learn")}');
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
    expect(MASTER).toContain('data-testid="academy-hub-hero"');
    expect(MASTER).toContain('data-testid="academy-pick-why"');
    // v3 F-FORYOU-1 (re-pin): "All courses" is retired; the library is "Courses by area".
    expect(MASTER).toContain('t("elev.learnCare.library.title")');
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
  // v3 F-FORYOU-1 (re-pin): #/learn has no Saved shelf. Saving still works in
  // the reader, a saved read still ranks first on For you and says why, and
  // (r2) every saved read is listed behind For you's Saved chip (law 6 below).
  it("no Saved shelf on #/learn; a saved read ranks first on For you and says so", () => {
    expect(LEARN).not.toContain('setFilter("all")');
    expect(LEARN).toContain("onClick: onToggleSave,");
    expect(MASTER).toContain("savedIds: savedLearnIds,");
    expect(MASTER).toContain('? t("elev.learnCare.pick.why.saved")');
  });

  it("the CTA copy ships in both locales (law 7)", () => {
    expect(en["elev.learnCare.saved.browse"]).toContain("{name}");
    expect(he["elev.learnCare.saved.browse"]).toContain("{name}");
    expect(he["elev.learnCare.saved.browse"]).toMatch(/[֐-׿]/);
  });
});

/* v3 F-FORYOU-1 r2 (reviewer r1) — law 6 restored for saved reads. The
   pre-v3 pin ("every saved card reachable") held the Saved filter on #/learn;
   #/learn is a reader now, so the pin follows the reads to For you: every way
   in to "my saved reads" lands on ONE uncapped list, and search opens the read
   it names. */
describe("law 6 · every saved read stays reachable", () => {
  const MEMORY = read("components/sections/ChildMemory.tsx").replace(/\r\n/g, "\n");
  const SEARCH = read("components/search/useSearchResults.ts").replace(/\r\n/g, "\n");
  const M = MASTER.replace(/\r\n/g, "\n");
  const L = LEARN.replace(/\r\n/g, "\n");

  it("ChildMemory's 'All saved reads' asks for the saved reads, and #/learn hands them to For you's Saved chip", () => {
    expect(MEMORY).toContain('onClick={() => requestLearnRead({ category: "saved", source: "child-memory" })}');
    expect(L).toContain('const savedAsked = useRef(pendingLearnRequest?.category === "saved");');
    expect(L).toContain('queueLibraryScroll(savedAsked.current ? "saved" : "library");');
    expect(M).toContain('const [savedShelf, setSavedShelf] = useState<boolean>(() => peekLibraryScroll() === "saved");');
  });

  it("the Saved chip lists every saved read, uncapped, each one tap from its read", () => {
    expect(M).toContain('data-testid="academy-saved-chip"');
    expect(M).toContain("const savedReads = savedLearnIds.map((id) => learnCardById(id)).filter((c): c is LearnCard => c !== undefined);");
    expect(M).toContain("{showSaved && savedReads.map((c) => (");
    expect(M).toContain('onClick={() => openRead(c.id, "learn-hub-saved")}');
    expect(M).not.toMatch(/savedReads\.slice\(|savedLearnIds\.slice\(/);
    // The chip shows whenever anything is saved, even with one area only.
    expect(M).toContain("{(areaCounts.length > 1 || savedReads.length > 0) && (");
    expect(M).toContain("{savedReads.length > 0 && (");
  });

  it("a search result for a read opens THAT read (never just the library)", () => {
    expect(SEARCH).toMatch(/if \(e\.kind === "learn" && e\.cardId\) \{\s*seams\.requestLearnRead\(\{ cardId: e\.cardId, source: "search" \}\);\s*return;/);
    expect(SEARCH).toContain("go: () => catalogGo(e, { setActiveTab, setSelectedLens, requestLearnRead }),");
  });

  it("the copy says where it goes, in both locales (law 7)", () => {
    expect(tr("en", "learn.trailAll")).toBe("All saved reads");
    expect(tr("he", "learn.trailAll")).toMatch(/[\u05d0-\u05ea]/);
    expect(tr("he", "learn.trailAll")).not.toMatch(/[A-Za-z]/);
    // NEGATIVE CONTROL: the r1 copy promised the library, not the saved reads.
    expect(tr("en", "learn.trailAll")).not.toBe("Open the library");
    expect(tr("en", "learn.trailSub")).not.toContain("Learn Library");
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
  // `focusDomain: null` is the no-focus form learnLibrary itself uses
  // (todaysPick, learnLibrary.ts:277); omitting the key left the file failing
  // `tsc` while vitest ran it happily, so the branch was red on a test whose
  // assertions all passed. Null and absent score identically — learnCardScore
  // reads focusDomain for truthiness only — so the shelf under test is
  // unchanged: this is the age-only ranking it was always meant to be.
  const ranked = rankLearnCards(ageVisible, { ageYears: 5, focusDomain: null });
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

  // v3 F-FORYOU-1 (re-pin): there is no browse shelf to cap any more. The
  // reads a parent lands on are today's pick and three short reads, both from
  // the same ranking over the age-fit catalogue.
  it("no browse shelf: the reads on For you are the pick and three short reads", () => {
    expect(LEARN).not.toContain("SHELF_PAGE");
    expect(LEARN).not.toContain('data-testid="learn-shelf-more"');
    // v3 F-FORYOU-1 r2 (re-pin): the week's concept may take the last slot.
    expect(MASTER).toContain("const shortReadRow = pickShortReads(readShelf, activeFamilyTopic?.title, weeklyConcept);");
    expect(MASTER).toContain(".filter((c) => c.id !== todaysRead?.card.id);");
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

  // v3 F-FORYOU-1 (re-pin): the switch is a quiet text button on its own
  // row under the chips, and that row wraps.
  it("the age switch can actually be reached at 390 (its own row, which wraps)", () => {
    expect(MASTER).not.toContain('<div className="flex items-baseline justify-between mb-2.5">');
    expect(MASTER).toContain('<div className="flex min-w-0 flex-wrap items-center gap-x-3 px-1">');
  });
});

describe("R20 · the age switch is on its own row below sm, not a wrap that might", () => {
  /* Round 2c re-measured the switch at x=1119 — a desktop coordinate, so the
     reading could not settle whether 390 was fixed. `flex-wrap` only wraps
     when the line actually overflows, which depends on the rendered width of
     "All reads", the "N reads · M read" count and the "N more for other ages"
     line — all translated strings. The source now states the outcome instead
     of leaving it to measurement: below sm the meta group is a full-width row. */
  // v3 F-FORYOU-1 (re-pin): the switch moved to For you's library, under the
  // chips, in a row of its own; the hidden-count line rides in that row.
  const ROW = MASTER.slice(MASTER.indexOf("{ageSwitchShown && ("), MASTER.indexOf('data-testid="agefilter-toggle-masterclasses"'));

  it("the switch takes a row of its own under the chips", () => {
    expect(ROW).toContain('<div className="flex min-w-0 flex-wrap items-center gap-x-3 px-1">');
    expect(ROW).toContain('agefilterText("elev.agefilter.hiddenCount", he, { n: hiddenByAge })');
    expect(MASTER.indexOf('data-testid="academy-by-area"')).toBeLessThan(MASTER.indexOf("{ageSwitchShown && ("));
  });

  it("the switch clears the 44 px floor and keeps its label", () => {
    const at = MASTER.indexOf('data-testid="agefilter-toggle-masterclasses"');
    const shell = MASTER.slice(at, at + 400);
    expect(shell).toMatch(/min-h-11|touch-target|min-h-\[4[4-9]px\]/);
    expect(MASTER).toContain('agefilterText("elev.agefilter.showAll", he)');
  });

  it("NEGATIVE CONTROL: both pre-fix shapes fail the rule this pins", () => {
    // R12's shape: wrap allowed, but the group could still share the line and
    // overflow it. Round 2b's shape: no wrap at all.
    const r12 = '<span className="inline-flex flex-wrap items-center gap-2">';
    const r2b = '<div className="flex items-baseline justify-between mb-2.5">';
    expect(r12).not.toContain("w-full");
    expect(r2b).not.toContain("flex-wrap");
    expect(LEARN).not.toContain(r12);
    expect(LEARN).not.toContain(r2b);
    expect(MASTER).not.toContain(r12);
    expect(MASTER).not.toContain(r2b);
  });
});
