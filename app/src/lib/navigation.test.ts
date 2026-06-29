import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForTab, primaryTabOf, subTabsForSection } from "./navigation";
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
    expect(tabs).toEqual(["development", "milestones", "language", "daily-play", "practice", "plans"]);
  });

  it("Journal surfaces the new journal leaf and keeps the Story spine", () => {
    const journal = SECTIONS.find((s) => s.id === "journal");
    const tabs = journal?.items.map((i) => i.tab) ?? [];
    expect(tabs).toEqual(["journal", "timeline"]);
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
