/**
 * W0.7 — unit tests for the shared age-fit helper (lib/ageFilter).
 *
 * Locks:
 *  - metadata normalizers for the three shapes actually in the repo
 *    (years min/max, ageRange tuple, "2-5" band strings)
 *  - classification edges: missing metadata, missing child age, exact
 *    boundary months, near-band via the EXISTING playbank stage grid
 *  - filterByAge: default view = in-band (+unknown), near-band backfill only
 *    when nearly empty, stable order, and the UC-1 zero-regression invariant
 *    (visible + hidden === input)
 *  - the arbor.* localStorage persistence contract
 *  - the masterclass data annotation this wave shipped (4–8 window on the
 *    "at 4, 6 and 8" course; NO invented windows elsewhere)
 */
import { beforeEach, describe, expect, it } from "vitest";
import {
  classifyAgeFit,
  filterByAge,
  isShownByDefault,
  ageFilterStorageKey,
  loadShowAllAges,
  saveShowAllAges,
  windowFromBandString,
  windowFromRange,
  windowFromYears,
  NEAR_BAND_BACKFILL_THRESHOLD,
  type AgeWindowMonths,
} from "./ageFilter";
import { MASTERCLASSES } from "./masterclasses";
import { HERO_STORIES } from "./heroJourneys";

// ── Normalizers ──────────────────────────────────────────────────────────────

describe("windowFromYears", () => {
  it("maps inclusive years to a half-open months window", () => {
    // "Ages 4–8" — the whole 8th year is in-band.
    expect(windowFromYears(4, 8)).toEqual({ minMonths: 48, maxMonths: 108 });
  });

  it("returns null when BOTH bounds are missing (no metadata ≠ age 0)", () => {
    expect(windowFromYears(undefined, undefined)).toBeNull();
    expect(windowFromYears(null, null)).toBeNull();
  });

  it("supports open-ended windows", () => {
    expect(windowFromYears(4, undefined)).toEqual({
      minMonths: 48,
      maxMonths: Number.POSITIVE_INFINITY,
    });
    expect(windowFromYears(undefined, 2)).toEqual({ minMonths: 0, maxMonths: 36 });
  });

  it("never produces an inverted window", () => {
    const w = windowFromYears(5, 3) as AgeWindowMonths;
    expect(w.maxMonths).toBeGreaterThan(w.minMonths);
  });
});

describe("windowFromRange", () => {
  it("normalizes the HeroStorySpec ageRange tuple", () => {
    expect(windowFromRange([4, 8])).toEqual({ minMonths: 48, maxMonths: 108 });
  });
  it("returns null for missing/short ranges", () => {
    expect(windowFromRange(null)).toBeNull();
    expect(windowFromRange([4])).toBeNull();
  });
});

describe("windowFromBandString", () => {
  it("parses the hardMomentCards band shape (hyphen and en-dash)", () => {
    expect(windowFromBandString("2-5")).toEqual({ minMonths: 24, maxMonths: 72 });
    expect(windowFromBandString("10–12")).toEqual({ minMonths: 120, maxMonths: 156 });
  });
  it("refuses to guess on unparseable strings", () => {
    expect(windowFromBandString("preschool")).toBeNull();
    expect(windowFromBandString("")).toBeNull();
    expect(windowFromBandString(undefined)).toBeNull();
  });
});

// ── Classification ───────────────────────────────────────────────────────────

describe("classifyAgeFit", () => {
  const ages4to8 = windowFromYears(4, 8) as AgeWindowMonths; // [48, 108)

  it("missing metadata → unknown (never hidden)", () => {
    expect(classifyAgeFit(null, 6)).toBe("unknown");
    expect(isShownByDefault("unknown")).toBe(true);
  });

  it("missing child age → unknown (cannot judge)", () => {
    expect(classifyAgeFit(ages4to8, null)).toBe("unknown");
    expect(classifyAgeFit(ages4to8, Number.NaN)).toBe("unknown");
  });

  it("boundary months: inclusive lower, exclusive upper", () => {
    expect(classifyAgeFit(ages4to8, 48)).toBe("in"); // exactly 4y
    expect(classifyAgeFit(ages4to8, 107)).toBe("in"); // 8y11m
    expect(classifyAgeFit(ages4to8, 108)).not.toBe("in"); // exactly 9y — out of window
  });

  it("a 6-month-old vs ages-4–8 content → out (the Maytal/Kinedu case)", () => {
    expect(classifyAgeFit(ages4to8, 6)).toBe("out");
    expect(isShownByDefault("out")).toBe(false);
  });

  it("near-band uses the playbank stage grid (age-proportional tolerance)", () => {
    // 42m = stage 3-4y; adjacent stages span [24, 60) which overlaps [48, 108).
    expect(classifyAgeFit(ages4to8, 42)).toBe("near");
    // 24m = stage 2-3y; adjacent span [18, 48) touches nothing of [48,108)?
    // It overlaps at the boundary? [18,48) vs [48,108) — no overlap → out.
    expect(classifyAgeFit(ages4to8, 24)).toBe("out");
    // Just past the window on the old side: 9y0m child, stage 9-12y,
    // adjacent span [84, 144) overlaps [48, 108) → near.
    expect(classifyAgeFit(ages4to8, 108)).toBe("near");
  });

  it("clamps negative child months to 0", () => {
    expect(classifyAgeFit(windowFromYears(0, 1) as AgeWindowMonths, -3)).toBe("in");
  });
});

// ── List filtering ───────────────────────────────────────────────────────────

interface Item { id: string; min?: number; max?: number }
const win = (i: Item) => windowFromYears(i.min, i.max);

describe("filterByAge", () => {
  const items: Item[] = [
    { id: "all-ages" }, // no metadata → unknown
    { id: "baby", min: 0, max: 1 },
    { id: "mid", min: 4, max: 8 },
    { id: "teen", min: 10, max: 12 },
  ];

  it("default view keeps in-band + unknown, hides out-of-band", () => {
    // 5-year-old (60 months): in-band = all-ages, mid.
    const r = filterByAge(items, win, 60);
    expect(r.visible.map((i) => i.id)).toEqual(["all-ages", "mid"]);
    expect(r.hidden.map((i) => i.id)).toEqual(["baby", "teen"]);
    expect(r.fits.get(items[2])).toBe("in");
    expect(r.fits.get(items[0])).toBe("unknown");
  });

  it("UC-1 zero-regression: visible + hidden always re-covers every input item", () => {
    for (const months of [0, 6, 24, 42, 60, 108, 200, null]) {
      const r = filterByAge(items, win, months);
      expect(r.visible.length + r.hidden.length).toBe(items.length);
      expect(new Set([...r.visible, ...r.hidden]).size).toBe(items.length);
    }
  });

  it("near-band backfills only when the in-band list is nearly empty", () => {
    // 42-month-old: "mid" (4–8) is near. In-band = only "all-ages" (unknown)
    // → below threshold → near items backfill.
    const r = filterByAge(items, win, 42);
    expect(r.visible.map((i) => i.id)).toContain("mid");
    expect(r.fits.get(items[2])).toBe("near");

    // Same child, but with ≥ threshold in-band items → near stays hidden.
    const rich: Item[] = [
      { id: "a", min: 3, max: 4 },
      { id: "b", min: 3, max: 4 },
      { id: "c", min: 3, max: 4 },
      { id: "near-only", min: 4, max: 8 },
    ];
    expect(NEAR_BAND_BACKFILL_THRESHOLD).toBe(3);
    const r2 = filterByAge(rich, win, 42);
    expect(r2.visible.map((i) => i.id)).toEqual(["a", "b", "c"]);
    expect(r2.hidden.map((i) => i.id)).toEqual(["near-only"]);
  });

  it("unknown child age shows everything (all unknown)", () => {
    const r = filterByAge(items, win, null);
    expect(r.hidden).toEqual([]);
    expect(r.visible.map((i) => i.id)).toEqual(items.map((i) => i.id));
  });

  it("keeps input order in both partitions (never re-ranks)", () => {
    const r = filterByAge(items, win, 6); // baby: visible = all-ages + baby
    expect(r.visible.map((i) => i.id)).toEqual(["all-ages", "baby"]);
    expect(r.hidden.map((i) => i.id)).toEqual(["mid", "teen"]);
  });
});

// ── Persistence (arbor.* key convention) ─────────────────────────────────────

describe("show-all persistence", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    (globalThis as Record<string, unknown>).localStorage = {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
      removeItem: (k: string) => void store.delete(k),
    };
  });

  it("uses the arbor.* key convention, one key per surface", () => {
    expect(ageFilterStorageKey("masterclasses")).toBe("arbor.agefilter.showAll.masterclasses");
  });

  it("round-trips per surface and defaults to false", () => {
    expect(loadShowAllAges("comics")).toBe(false);
    saveShowAllAges("comics", true);
    expect(loadShowAllAges("comics")).toBe(true);
    expect(loadShowAllAges("hero-journeys")).toBe(false); // isolated per surface
    saveShowAllAges("comics", false);
    expect(loadShowAllAges("comics")).toBe(false);
  });
});

// ── Data contracts this wave relies on ───────────────────────────────────────

describe("content metadata contracts", () => {
  it("the 'at 4, 6 and 8' masterclass carries its authored window — others stay all-ages", () => {
    const pinned = MASTERCLASSES.find((m) => m.id === "building-responsibility-by-age");
    expect(pinned?.ageMinYears).toBe(4);
    expect(pinned?.ageMaxYears).toBe(8);
    // No invented windows: every OTHER course remains age-general until its
    // authored text pins an age (do-not-fake-metadata rule).
    for (const m of MASTERCLASSES) {
      if (m.id === "building-responsibility-by-age") continue;
      expect(m.ageMinYears).toBeUndefined();
      expect(m.ageMaxYears).toBeUndefined();
    }
  });

  it("every canon hero story has a normalizable ageRange (journeys + comics filter input)", () => {
    for (const s of HERO_STORIES) {
      const w = windowFromRange(s.ageRange);
      expect(w, s.id).not.toBeNull();
      expect((w as AgeWindowMonths).maxMonths).toBeGreaterThan((w as AgeWindowMonths).minMonths);
    }
  });

  it("a 6-month-old's default masterclass catalog excludes the 4–8 course but keeps it reachable", () => {
    const r = filterByAge(
      MASTERCLASSES,
      (m) => windowFromYears(m.ageMinYears, m.ageMaxYears),
      6,
    );
    expect(r.hidden.map((m) => m.id)).toEqual(["building-responsibility-by-age"]);
    expect(r.visible.length + r.hidden.length).toBe(MASTERCLASSES.length);
  });
});
