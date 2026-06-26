import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForTab, primaryTabOf } from "./navigation";

/** Structural guard for the five-pillar information architecture — aligned to
 *  the "Arbor Web App" prototype: Today / My Child / Grow / Care / Academy.
 *  Ask Arbor (coach) is a top-bar action + Today coach card, NOT a sidebar row,
 *  but it stays a valid route whose fallback resolves to "today". Catches
 *  accidental drift: wrong section count, duplicate/colliding tabs, empty
 *  sections, a primary tab that doesn't belong, or a demoted leaf that no
 *  longer resolves. */
describe("navigation IA", () => {
  it("exposes exactly five task-based pillars", () => {
    expect(SECTIONS).toHaveLength(5);
    expect(SECTIONS.map((s) => s.id)).toEqual(["today", "child", "grow", "care", "academy"]);
  });

  it("My Child collapses the development leaves into one Development hub", () => {
    const child = SECTIONS.find((s) => s.id === "child");
    const tabs = child?.items.map((i) => i.tab) ?? [];
    expect(tabs).toEqual(["timeline", "development", "behaviors", "language"]);
  });

  it("Grow holds Daily Play, the Practice hub, and Growth Plans", () => {
    const grow = SECTIONS.find((s) => s.id === "grow");
    const tabs = grow?.items.map((i) => i.tab) ?? [];
    expect(tabs).toEqual(["daily-play", "practice", "plans"]);
  });

  it("Care leads with the consolidated Consult flow", () => {
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

  it("primaryTabOf returns a tab that belongs to the section", () => {
    for (const s of SECTIONS) expect(s.items.some((i) => i.tab === primaryTabOf(s))).toBe(true);
  });

  it("demoted leaves still resolve to a section via fallback (nothing deleted)", () => {
    // Former primary leaves are now reached via hubs/spines, but remain valid
    // routes; sectionForTab must still map them so the sidebar highlights right.
    expect(sectionForTab("copilot").id).toBe("child");   // → Development hub
    expect(sectionForTab("profile").id).toBe("child");
    expect(sectionForTab("milestones").id).toBe("child");
    expect(sectionForTab("screening").id).toBe("child");
    expect(sectionForTab("memory").id).toBe("child");
    expect(sectionForTab("speech").id).toBe("grow");      // → Practice hub
    expect(sectionForTab("adventures").id).toBe("grow");
    expect(sectionForTab("reports").id).toBe("care");     // → Consult
    expect(sectionForTab("find-pro").id).toBe("care");
    expect(sectionForTab("handoff").id).toBe("care");
    // Ask Arbor (coach) is folded into Today (top-bar action + coach card), not
    // a sidebar row — but it stays a valid route and must resolve to "today".
    expect(sectionForTab("coach").id).toBe("today");
    expect(sectionForTab("scholar").id).toBe("today");
  });
});
