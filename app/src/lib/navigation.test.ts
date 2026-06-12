import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForTab, primaryTabOf } from "./navigation";

/** Structural guard for the seven-section information architecture (IA v2 +
 *  Practice Studio). Catches accidental drift: wrong section count,
 *  duplicate/colliding tabs, empty sections, or a primary tab that doesn't
 *  belong to its section. */
describe("navigation IA", () => {
  it("exposes exactly seven primary sections", () => {
    expect(SECTIONS).toHaveLength(7);
  });

  it("Practice Studio carries the speech & language suite", () => {
    const practice = SECTIONS.find((s) => s.id === "practice");
    const tabs = practice?.items.map((i) => i.tab) ?? [];
    expect(tabs).toEqual(expect.arrayContaining(["missions", "speech", "mimic", "adventures"]));
  });

  it("Development Dashboard (Copilot) lives under My Child", () => {
    expect(sectionForTab("copilot").id).toBe("intelligence");
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

  it("sectionForTab resolves each tab back to its owning section", () => {
    for (const s of SECTIONS)
      for (const it of s.items) expect(sectionForTab(it.tab).id).toBe(s.id);
  });

  it("primaryTabOf returns a tab that belongs to the section", () => {
    for (const s of SECTIONS) expect(s.items.some((i) => i.tab === primaryTabOf(s))).toBe(true);
  });

  it("Safety has a primary home under Care Network (Wave 1: no longer orphaned)", () => {
    const care = SECTIONS.find((s) => s.id === "care");
    expect(care?.items.some((i) => i.tab === "safety")).toBe(true);
  });

  it("consolidated tabs still resolve to a section via fallback (Wave 1 demotions)", () => {
    // These views were removed from the primary nav but remain valid routes;
    // sectionForTab must still map them so the sidebar highlights correctly.
    expect(sectionForTab("strengths").id).toBe("intelligence");
    expect(sectionForTab("weekly").id).toBe("intelligence");
    expect(sectionForTab("scholar").id).toBe("ask");
    expect(sectionForTab("handoff").id).toBe("care");
  });
});
