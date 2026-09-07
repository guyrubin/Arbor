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
