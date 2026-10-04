/**
 * TJB-21 — the Behaviors hub's primary move sat at y898.
 *
 * Two rules, guarded here because neither can be read off a screenshot:
 *
 *  1. SECTION ORDER — hero → capture → echo → guide shelf → log list, with the
 *     static `beh.next.*` banner (213 px of copy that rendered regardless of
 *     data) gone. Proved by the order of the marker strings in the source; the
 *     negative control is the pre-fix arrangement, pasted below, which the same
 *     checker rejects.
 *  2. THE RESTING SHELF — at most three matched guides, and a door that reaches
 *     the whole catalogue. `restingGuides` is pure, so the count is a rule; the
 *     door and the full-catalogue branch are read from the source.
 *
 * Node env: there is no jsdom in this repo, so the render-time acceptance
 * (capture input `top < 700` at 390 px) belongs to the orchestrator.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RESTING_GUIDES, restingGuides } from "./HardMomentsSection";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");

/** Markers in the order the parent meets them on #/behaviors. */
const MARKERS = [
  { name: "hero", re: /<HubHero/ },
  { name: "capture", re: /aria-label=\{t\("beh\.captureTitle"\)\}/ },
  { name: "echo", re: /behaviors-pattern-echo/ },
  { name: "guides", re: /<HardMomentsSection/ },
  { name: "logs", re: /t\("beh\.activeLogs"\)/ },
];

/** null when the order holds; else the first pair that is out of order. */
function outOfOrder(source: string): string | null {
  let prev = -1;
  let prevName = "";
  for (const m of MARKERS) {
    const at = source.search(m.re);
    if (at < 0) return `${m.name} missing`;
    if (at < prev) return `${m.name} before ${prevName}`;
    prev = at;
    prevName = m.name;
  }
  return null;
}

describe("TJB-21 — Behaviors section order", () => {
  const source = read("components/tabs/BehaviorsTab.tsx");

  it("renders hero → capture → echo → guides → logs", () => {
    expect(outOfOrder(source)).toBeNull();
  });

  it("the static YOUR NEXT STEP banner is gone", () => {
    // The banner's three copy keys, and the heading it labelled.
    expect(source).not.toMatch(/t\("beh\.next\.(eyebrow|title|body|plan)"\)/);
    expect(source).not.toContain('aria-labelledby="behavior-next-step"');
  });

  it("NEGATIVE CONTROL: the pre-fix order (banner between hero and capture) fails", () => {
    // The shape the file had at 7208d0db, reduced to its markers.
    const prefix = [
      "<HubHero",
      'aria-labelledby="behavior-next-step"',
      't("beh.next.title")',
      'aria-label={t("beh.captureTitle")}',
      "behaviors-pattern-echo",
      't("beh.activeLogs")',
      "<HardMomentsSection />",
    ].join("\n");
    expect(outOfOrder(prefix)).toBe("logs before guides");
    expect(prefix).toMatch(/t\("beh\.next\.title"\)/);
  });
});

describe("TJB-21 — the guide shelf rests at three, and the door keeps every guide", () => {
  const source = read("components/behaviors/HardMomentsSection.tsx");
  const cards = ["a", "b", "c", "d", "e"];

  it("shows at most three guides at rest", () => {
    expect(RESTING_GUIDES).toBe(3);
    expect(restingGuides(cards, [])).toHaveLength(3);
    expect(restingGuides(cards, ["e", "d", "c", "b"])).toHaveLength(3);
  });

  it("prefers the guides matched to the parent's own logs", () => {
    expect(restingGuides(cards, ["e", "d"])).toEqual(["e", "d"]);
  });

  it("never rests on an empty shelf when nothing is matched yet (day 0)", () => {
    expect(restingGuides(cards, [])).toEqual(["a", "b", "c"]);
    expect(restingGuides([], [])).toEqual([]);
  });

  it("the door exists, is two-way, and the open branch renders the full list", () => {
    expect(source).toContain('data-testid="hard-moments-door"');
    expect(source).toMatch(/aria-expanded=\{expanded\}/);
    // `all` is every available card under the active category filter; the
    // resting branch is `featured`. Both branches feed the same grid, so no
    // guide can be reachable in one and unreachable in the other.
    expect(source).toMatch(/const visible = expanded \? all : featured;/);
    expect(source).toMatch(/setExpanded\(\(v\) => !v\)/);
  });

  it("the category filter only mounts with the open catalogue", () => {
    expect(source).toMatch(/\{expanded && \(\s*<div className="flex flex-wrap items-center gap-2" role="group"/);
  });

  it("NEGATIVE CONTROL: the pre-fix grid (whole catalogue, no door) fails both source rules", () => {
    const prefix = 'const visible = activeCategory === "all" ? cards : cards.filter((card) => card.category === activeCategory);';
    expect(prefix).not.toMatch(/const visible = expanded \? all : featured;/);
    expect(prefix).not.toContain('data-testid="hard-moments-door"');
  });
});

/**
 * B-ASKJB-31 — "Hard moment now": ONE sheet over the pilot guides with doors
 * from Ask, Behaviors and Today. Opening or reading a card makes no request;
 * every door hides after the pilot expires (injected clock); the card is never
 * seeded into the prompt (clinical veto).
 */
describe("B-ASKJB-31 — the Hard moment now sheet and its doors", async () => {
  const { hardMomentSheetCards, hardMomentSheetOrder } = await import("./HardMomentNowSheet");
  const { HARD_MOMENT_PILOT } = await import("../../content/pilotRelease");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const SHEET = strip(read("components/behaviors/HardMomentNowSheet.tsx"));
  const SHELF = strip(read("components/behaviors/HardMomentsSection.tsx"));
  const COACH = strip(read("components/tabs/CoachTab.tsx"));
  const TODAY = strip(read("components/tabs/OverviewTab.tsx"));
  const SHELL = strip(read("components/layout/Shell.tsx"));
  const CTX = strip(read("context/ArborContext.tsx"));
  const inPilot = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) - 7 * 86_400_000);
  const afterPilot = new Date(Date.parse(HARD_MOMENT_PILOT.expiresAt) + 1000);
  const refusals = [0, 1, 2].map((i) => ({ behaviorType: "Transition Refusal", timestamp: new Date(inPilot.getTime() - i * 86_400_000).toISOString() }));

  it("a child with 3 'Transition Refusal' logs sees the matched card first; nothing is dropped", () => {
    const { ordered, matchedIds } = hardMomentSheetCards({ now: inPilot, ageMonths: 48, locale: "en" }, refusals);
    expect(matchedIds.length).toBeGreaterThan(0);
    expect(ordered[0].id).toBe(matchedIds[0]);
    const none = hardMomentSheetCards({ now: inPilot, ageMonths: 48, locale: "en" }, []);
    expect(ordered.map((c) => c.id).sort()).toEqual(none.ordered.map((c) => c.id).sort());
    expect(hardMomentSheetOrder([{ id: "a" }, { id: "b" }, { id: "c" }], [{ id: "c" }, { id: "x" }]).map((c) => c.id)).toEqual(["c", "a", "b"]);
  });

  it("after the pilot expires the sheet offers nothing, EN and HE (every door's gate)", () => {
    expect(hardMomentSheetCards({ now: afterPilot, ageMonths: 48, locale: "en" }, refusals).ordered).toEqual([]);
    expect(hardMomentSheetCards({ now: afterPilot, ageMonths: 48, locale: "he" }, refusals).ordered).toEqual([]);
  });

  it("every door is gated on availableHardMomentCards (Ask chip, Behaviors shelf, Today tile)", () => {
    expect(COACH).toMatch(/\{hardMomentGuides\.length > 0 && \(/);
    expect(COACH).toContain("availableHardMomentCards({ now, ageMonths: ageMonthsFromProfile(childProfile, now)");
    expect(COACH).toContain("onClick={() => openHardMomentNow()}");
    expect(SHELF).toMatch(/if\s*\(cards\.length\s*===\s*0\)\s*return null/);
    expect(SHELF).toContain("onClick={() => openHardMomentNow(card.id)}");
    expect(TODAY).toContain("onHardMoment={hardMomentTile ? () => openHardMomentNow() : undefined}");
  });

  it("one sheet, mounted once in Shell, opened through the context seam", () => {
    expect((SHELL.match(/<HardMomentNowSheet\b/g) ?? []).length).toBe(1);
    expect(CTX).toContain("const openHardMomentNow = (cardId?: string) =>");
    for (const rel of ["components/tabs/CoachTab.tsx", "components/behaviors/HardMomentsSection.tsx", "components/tabs/OverviewTab.tsx"]) {
      expect(strip(read(rel)), rel).not.toMatch(/<HardMomentNowSheet\b/);
    }
  });

  it("no seed and no request: opening or reading a card never reaches /chat; Ask gets a reference card", () => {
    for (const [name, code] of [["sheet", SHEET], ["shelf", SHELF]] as const) {
      expect(code, name).not.toMatch(/seedCoach|buildHardMomentSeedPrompt|fetch\(|api\.|sendToCoach|handleChatSend/);
    }
    expect(COACH).not.toContain("buildHardMomentSeedPrompt");
    expect(COACH).not.toContain("publishedHardMomentCards");
    expect(SHEET).toContain("setAskHardMomentRef(card.id);");
    expect(COACH).toContain('data-testid="coach-hard-moment-ref"');
    // The reference card is display-only: nothing on the send path reads it.
    expect(CTX).not.toMatch(/askHardMomentRef[^\n]*\bbody\b|JSON\.stringify\([^)]*askHardMomentRef/);
  });

  it("'Try this tonight' books the governed doNow with source 'hard-moment' via the one seam", () => {
    expect(SHEET).toContain('acceptHardMomentStep(card.id, { now: new Date(), ageMonths: context.ageMonths, locale }, "standard", acceptTodayAction)');
  });

  it("neutral ink: no red/coral/peach/pink token, no 'SOS', the guide renders through HardMomentGuideContent; chips ≥44 px", () => {
    expect(SHEET).not.toMatch(/--arbor-(red|coral|peach|pink|clay)/);
    expect(SHEET).not.toMatch(/#[0-9a-fA-F]{3,8}\b/);
    expect(SHEET).not.toMatch(/\bSOS\b/);
    expect(SHEET).toContain("<HardMomentGuideContent");
    const chip = SHEET.slice(SHEET.indexOf('data-testid="hard-moment-now-chip"'), SHEET.indexOf('data-testid="hard-moment-now-chip"') + 400);
    expect(chip).toMatch(/min-h-11 min-w-11/);
  });

  it("the sheet copy exists in EN and HE, with no Latin on HE and no SOS in either", async () => {
    const { en, he } = await import("../../lib/i18n");
    for (const k of ["hm.now.title", "hm.now.pick", "hm.now.matched", "hm.now.back", "hm.now.tryTonight", "hm.now.talk", "hm.now.none", "hm.ref.eyebrow", "hm.ref.note", "hm.ref.open", "hm.ref.dismiss"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k], k).not.toMatch(/[A-Za-z]/);
      expect(`${en[k]} ${he[k]}`).not.toMatch(/\bSOS\b/i);
    }
    expect(he["hm.now.title"]).toBe("רגע קשה עכשיו");
  });
});

/**
 * Critic round 1 (behaviors · product · P0) — the shelf called the guides
 * "reviewed" while the content says the pilot guides have had no individual
 * clinical review. While the release is an editorial pilot, no hm.* or
 * elev.closeloop.hm.* string may claim review or approval, in either locale.
 */
describe("hard-moment copy claims only what the pilot release can back", async () => {
  const { HARD_MOMENT_PILOT } = await import("../../content/pilotRelease");
  const i18n = await import("../../lib/i18n");
  const closeloop = await import("../../lib/i18nElevation/closeloop");
  const CLAIM = /review|vetted|approved|נבדק|שנבדקו|מאושר|מאושרים/i;
  it("no hm.* / elev.closeloop.hm.* string says reviewed, vetted, נבדק or מאושר", () => {
    expect(HARD_MOMENT_PILOT.kind).toBe("editorial-pilot");
    const offenders: string[] = [];
    for (const dict of [i18n.en, i18n.he, closeloop.en, closeloop.he]) {
      for (const [k, v] of Object.entries(dict)) {
        if ((k.startsWith("hm.") || k.startsWith("elev.closeloop.hm.")) && CLAIM.test(String(v))) offenders.push(`${k}: ${v}`);
      }
    }
    expect(offenders).toEqual([]);
  });
  it("the shelf sub names the pilot in both locales", () => {
    expect(i18n.en["hm.sub"]).toMatch(/pilot/i);
    expect(i18n.he["hm.sub"]).toMatch(/פיילוט/);
  });
});

/**
 * Critic r1 (W2-ASKJB behaviors, design P1 G1): the capture card names its
 * move in a visible label, its field holds two lines (no mid-sentence clip),
 * the send arrow keeps the page's only primary fill ("Find the pattern" is an
 * outline secondary), and the hero's zero line is a quiet muted teach line.
 */
describe("critic r1 — behaviors capture reads first, one primary fill", async () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const BEH = strip(read("components/tabs/BehaviorsTab.tsx"));
  const HERO = strip(read("components/ui/HubHero.tsx"));
  const i18n = await import("../../lib/i18n");
  it("a visible heading names the move (the H1 on an empty week), in both locales", () => {
    // Critic r2: the 2-row field is gone (it swallowed keystrokes); the
    // heading is the page's H1 when the hero is absent (no data this week).
    expect(BEH).toMatch(/\{hasWeek && \(\s*<HubHero/);
    expect(BEH).toMatch(/<h1 data-testid="behaviors-capture-label"[^>]*>\s*\{t\("beh\.capture\.label", \{ name: behFirst \}\)\}/);
    expect(BEH).toMatch(/<h2 data-testid="behaviors-capture-label"[^>]*>\s*\{t\("beh\.capture\.label", \{ name: behFirst \}\)\}/);
    expect(i18n.en["beh.capture.label"]).toContain("{name}");
    expect(i18n.he["beh.capture.label"]).toContain("{name}");
  });
  it("one primary fill at rest: none on the hub's capture (QuickCaptureBar is neutral); Find the pattern is outline", () => {
    const find = BEH.slice(BEH.indexOf('data-testid="behaviors-find-pattern"') - 200, BEH.indexOf('data-testid="behaviors-find-pattern"') + 400);
    expect(find).not.toMatch(/gradientCta|gradient-cta|gradient-primary/);
    // The only fill left is the opened inline form's own submit.
    const fills = BEH.split("\n").filter((l) => /<button\b/.test(l) && /T\.gradientCta/.test(l));
    expect(fills).toHaveLength(1);
    expect(fills[0]).toContain('type="submit"');
  });
  it("the hero zero line is muted, regular weight", () => {
    const zero = HERO.slice(HERO.indexOf("{allZero && zeroLine && ("), HERO.indexOf("{zeroLine}"));
    expect(zero).toContain('color: "var(--arbor-muted)"');
    expect(zero).not.toMatch(/font-bold|p\.ink/);
  });
});

/** B-ASKJB-NEW-1f (4) — the shelf names why its guides are here, in the page's one warm accent. */
describe("B-ASKJB-NEW-1f — chosen-for note on the shelf", async () => {
  const i18n = await import("../../lib/i18n");
  const SHELF = read("components/behaviors/HardMomentsSection.tsx");
  it("keyed EN + HE with {name}; muted under the tiles; no verdict words", () => {
    for (const d of [i18n.en, i18n.he]) {
      expect(d["hm.chosenFor"]).toContain("{name}");
      expect(d["hm.chosenFor"]).not.toMatch(/review|risk|score|נבדק|סיכון/i);
    }
    const note = SHELF.slice(SHELF.indexOf('data-testid="hard-moments-chosen"'), SHELF.indexOf("</p>", SHELF.indexOf('data-testid="hard-moments-chosen"')));
    // Critic r2: the warm accent moved into the capture card; the shelf's
    // note is a muted line under the tiles.
    expect(note).toContain('color: "var(--arbor-muted)"');
    expect(note).not.toMatch(/--arbor-peach/);
    expect(note).toContain('t("hm.chosenFor", { name: childFirst })');
    expect(SHELF.indexOf('data-testid="hard-moment-tiles"')).toBeLessThan(SHELF.indexOf('data-testid="hard-moments-chosen"'));
  });
});

/**
 * Critic r2 (W2-ASKJB behaviors). Guide tiles above the fold at 375; the
 * capture is the one sheet; one warm line; a 7/5 grid at lg.
 */
describe("critic r2 — behaviors: guides under the capture, one warm line, no stretched column", async () => {
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const BEH = strip(read("components/tabs/BehaviorsTab.tsx"));
  const SHELF = strip(read("components/behaviors/HardMomentsSection.tsx"));
  const i18n = await import("../../lib/i18n");
  it("the shelf's tiles come right after its heading as a snap row, 'All {n} guides' trailing", () => {
    expect(SHELF.indexOf('id="hard-moments-title"')).toBeLessThan(SHELF.indexOf('data-testid="hard-moment-tiles"'));
    expect(SHELF.indexOf('data-testid="hard-moment-tiles"')).toBeLessThan(SHELF.indexOf('t("hm.sub")'));
    expect(SHELF).toMatch(/flex snap-x snap-mandatory gap-2 overflow-x-auto/);
    const at = SHELF.indexOf('data-testid="hard-moment-tiles"');
    const row = SHELF.slice(at, SHELF.indexOf("{expanded && (", at));
    expect(row).toContain('data-testid="hard-moments-door"');
    expect(row).toContain('t("elev.closeloop.hm.allGuides", { n: cards.length })');
    expect(SHELF).toMatch(/<h3 id="hard-moments-title" className="t-md"/);
  });
  it("at lg: a 7/5 grid — capture in the start column, the shelf as the end rail", () => {
    expect(BEH).toContain("lg:grid lg:grid-cols-12");
    expect(BEH).toMatch(/<div className="min-w-0 space-y-6 lg:col-span-7">\s*<section data-module="behaviors-capture"/);
    expect(BEH).toContain('<div data-module="behaviors-hard-moments" className="min-w-0 lg:col-span-5"><HardMomentsSection /></div>');
  });
  it("one warm line in the capture card: the parent's own words (<= 70 chars) or the top guide by name, EN + HE", () => {
    const at = BEH.indexOf('data-testid="behaviors-warm-line"');
    const line = BEH.slice(at, BEH.indexOf("</p>", at));
    expect(line).toContain("var(--font-editorial)");
    expect(line).toContain('background: "var(--arbor-peach-soft)", color: "var(--arbor-peach-ink)"');
    expect(BEH).toContain("words.length > 70 ? `${words.slice(0, 70).trimEnd()}");
    for (const d of [i18n.en, i18n.he]) {
      expect(d["beh.warm.quote"]).toContain("{words}");
      expect(d["beh.warm.guide"]).toContain("{guide}");
      expect(`${d["beh.warm.quote"]} ${d["beh.warm.guide"]}`).not.toMatch(/\d|%|streak|score|רצף|ציון/i);
    }
    for (const k of ["beh.warm.guide", "beh.warm.quote"]) expect(i18n.he[k].replace(/\{\w+\}/g, "")).not.toMatch(/[A-Za-z]/);
  });
});
