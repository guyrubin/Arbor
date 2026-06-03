import { describe, it, expect } from "vitest";
import { SECTIONS, sectionForTab, primaryTabOf } from "./navigation";

/** Structural guard for the six-section information architecture (IA v2).
 *  Catches accidental drift: wrong section count, duplicate/colliding tabs,
 *  empty sections, or a primary tab that doesn't belong to its section. */
describe("navigation IA", () => {
  it("exposes exactly six primary sections", () => {
    expect(SECTIONS).toHaveLength(6);
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

  it("Safety is not a primary navigation item (embedded as Trust & Safety)", () => {
    const tabs = SECTIONS.flatMap((s) => s.items.map((i) => i.tab));
    expect(tabs).not.toContain("safety");
  });
});
