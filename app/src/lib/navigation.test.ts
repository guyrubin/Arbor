import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForTab, primaryTabOf, subTabsForSection, hubTabsForSection } from "./navigation";
import { ALL_TABS } from "../context/ArborContext";

/** Structural guard for the UC-1 EIGHT-category information architecture —
 *  aligned to the "Arbor Web App" prototype: Today / Behaviors / Growth /
 *  Journal / Academy / Ask Arbor / Care Network / Profile. Catches accidental
 *  drift: wrong section count, duplicate/colliding tabs, empty sections, a
 *  primary tab that doesn't belong, or a leaf that no longer resolves. */
describe("navigation IA", () => {
  it("exposes exactly eight task-based categories", () => {
    expect(SECTIONS).toHaveLength(8);
    expect(SECTIONS.map((s) => s.id)).toEqual([
      "today", "behaviors", "growth", "journal", "academy", "ask", "care", "profile",
    ]);
  });

  it("Growth holds the Development hub + growth tools", () => {
    const growth = SECTIONS.find((s) => s.id === "growth");
    const tabs = growth?.items.map((i) => i.tab) ?? [];
    expect(tabs).toEqual(["development", "milestones", "language", "daily-play"]);
  });

  // Journal + Story render the SAME buildTimeline stream, so they are two
  // densities of one surface (TimelineTab), not two capabilities. The hub owns a
  // single leaf; the Story density is reached by the in-surface toggle and stays
  // a valid deep-link route that resolves back to Journal.
  it("Journal owns one timeline leaf; Story is a density that still resolves here", () => {
    const journal = SECTIONS.find((s) => s.id === "journal");
    expect(journal?.items.map((i) => i.tab)).toEqual(["journal"]);
    expect(sectionForTab("timeline").id).toBe("journal");
  });

  it("Ask Arbor is a first-class category leading with the coach", () => {
    const ask = SECTIONS.find((s) => s.id === "ask");
    expect(ask?.items[0].tab).toBe("coach");
  });

  it("Care leads with the consolidated Consult flow and keeps Safety", () => {
    const care = SECTIONS.find((s) => s.id === "care");
    expect(care?.items[0].tab).toBe("consult");
    expect(care?.items.some((i) => i.tab === "safety")).toBe(true);
  });

  it("every section has at least one capability", () => {
    for (const s of SECTIONS) expect(s.items.length).toBeGreaterThan(0);
  });

  it("no tab is registered in more than one section", () => {
    const tabs = SECTIONS.flatMap((s) => s.items.map((i) => i.tab));
    expect(new Set(tabs).size).toBe(tabs.length);
  });

  it("every item has a non-empty label and an icon", () => {
    for (const s of SECTIONS)
      for (const it of s.items) {
        expect(it.label.trim().length).toBeGreaterThan(0);
        expect(it.icon).toBeTruthy();
      }
  });

  it("sectionForTab resolves each surfaced tab back to its owning section", () => {
    for (const s of SECTIONS)
      for (const it of s.items) expect(sectionForTab(it.tab).id).toBe(s.id);
  });

  it("subTabsForSection is Overview-first (the section's primary item leads)", () => {
    for (const s of SECTIONS) {
      const sub = subTabsForSection(s);
      expect(sub[0].tab).toBe(primaryTabOf(s));
    }
  });

  // UC-3 fluid IA: the pill row is the CURATED primaryTabs (the wireframe's
  // short CATFEAT row), NOT the full items list. Every primaryTab must be a
  // real item of its section, and the row stays short (hub + at most 2 leaves).
  it("subTabsForSection returns the curated primaryTabs (short, hub-first, subset of items)", () => {
    for (const s of SECTIONS) {
      const sub = subTabsForSection(s);
      expect(sub).toBe(s.primaryTabs);
      expect(sub.length).toBeLessThanOrEqual(3); // hub + ≤2 primary leaves
      for (const it of sub) expect(s.items.some((i) => i.tab === it.tab)).toBe(true);
    }
  });

  // UC-3: at least one category must have been trimmed (pill row shorter than
  // its full items) — otherwise the "fluid" reorg did nothing.
  it("trims at least one over-stuffed category's pill row", () => {
    const trimmed = SECTIONS.some((s) => s.primaryTabs.length < s.items.length);
    expect(trimmed).toBe(true);
  });

  // UC-6 hub contextual pills: hubTabsForSection = primary + sub-tabs + the
  // hub's own tools, deduped. The pill set leads with the hub primary and has
  // no duplicate tabs (so a hub never shows the same capability twice).
  it("hubTabsForSection is hub-first and has no duplicate tabs", () => {
    for (const s of SECTIONS) {
      const pills = hubTabsForSection(s);
      expect(pills[0].tab).toBe(primaryTabOf(s));
      const tabs = pills.map((p) => p.tab);
      expect(new Set(tabs).size).toBe(tabs.length);
    }
  });

  // UC-6 no-duplicate-nav guard: the global TOOLS drawer is gone. Each tool now
  // lives in exactly ONE hub's contextual pill set, and a hub's tools never echo
  // its own primary/sub-tabs (the de-dup the helper guarantees). Concretely: the
  // union of {all primaryTabs} ∪ {all hub tools} must be collision-free — no tab
  // appears in two hubs' (primaryTabs ∪ tools), and no tool equals a category
  // primary (locks out the category-duplicating drawer bug this UC removes).
  it("every owned tool lives in exactly one hub (primaryTabs ∪ tools), no cross-hub dup", () => {
    const owned = SECTIONS.flatMap((s) => [
      ...s.primaryTabs.map((i) => i.tab),
      ...s.tools.map((i) => i.tab),
    ]);
    expect(new Set(owned).size, "a tab is owned by more than one hub's primaryTabs/tools").toBe(owned.length);
  });

  it("no hub tool equals any section's primaryTabOf (tools never echo a category)", () => {
    const categoryPrimaries = new Set(SECTIONS.map((s) => primaryTabOf(s)));
    for (const s of SECTIONS)
      for (const tl of s.tools)
        expect(
          categoryPrimaries.has(tl.tab),
          `tool "${tl.label}" (${tl.tab}) duplicates a category primary view`,
        ).toBe(false);
  });

  // UC-6 zero-regression floor: EVERY directly-owned ActiveTab (in some section's
  // items) must be REACHABLE — via a hub primary or one of its contextual pills
  // (primaryTabs ∪ tools). Guards against folding a leaf into a dead end.
  it("every directly-owned ActiveTab is reachable via a hub primary or a contextual pill", () => {
    const reachable = new Set<string>(
      SECTIONS.flatMap((s) => hubTabsForSection(s).map((i) => i.tab)),
    );
    for (const s of SECTIONS)
      for (const it of s.items)
        expect(reachable.has(it.tab), `tab "${it.tab}" is owned by a section but not reachable via any hub pill`).toBe(true);
  });

  // UC-4/6: The Science trust page is re-homed from Care → Profile.
  it("The Science resolves to Profile (re-homed from Care)", () => {
    expect(sectionForTab("science").id).toBe("profile");
  });

  it("hub tool entries are well-formed and every tab is a real ActiveTab", () => {
    for (const s of SECTIONS)
      for (const tl of s.tools) {
        expect(tl.label.trim().length).toBeGreaterThan(0);
        expect(tl.icon).toBeTruthy();
        expect(ALL_TABS).toContain(tl.tab);
      }
  });

  it("primaryTabOf returns a tab that belongs to the section", () => {
    for (const s of SECTIONS) expect(s.items.some((i) => i.tab === primaryTabOf(s))).toBe(true);
  });

  it("demoted leaves still resolve to a section via fallback (nothing deleted)", () => {
    expect(sectionForTab("copilot").id).toBe("growth");   // → Development hub
    expect(sectionForTab("journey").id).toBe("growth");
    expect(sectionForTab("screening").id).toBe("growth");
    expect(sectionForTab("strengths").id).toBe("growth");
    expect(sectionForTab("speech").id).toBe("growth");      // → Practice hub
    expect(sectionForTab("adventures").id).toBe("growth");
    expect(sectionForTab("weekly").id).toBe("profile");
    expect(sectionForTab("scholar").id).toBe("ask");
    expect(sectionForTab("reports").id).toBe("care");       // → Consult
    expect(sectionForTab("find-pro").id).toBe("care");
    expect(sectionForTab("handoff").id).toBe("care");
  });

  // UC-1 capability-floor enforcer: EVERY ActiveTab value (the full route
  // registry) must resolve to a section so the sidebar always highlights and no
  // leaf is orphaned. This is the 45-route floor guard.
  it("sectionForTab resolves for EVERY ActiveTab value (no orphaned route)", () => {
    for (const tab of ALL_TABS) {
      const sec = sectionForTab(tab);
      expect(sec, `tab "${tab}" did not resolve to a section`).toBeTruthy();
      expect(SECTIONS.map((s) => s.id)).toContain(sec.id);
    }
  });
});
