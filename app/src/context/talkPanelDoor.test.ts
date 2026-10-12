/**
 * F-TALK-1 (review r1) — Talk is a panel, never a page. The build brief's
 * shared contract 2: opening Talk goes through requestCompanionConversation,
 * never setActiveTab("coach"). Two callers in files this lane does not own
 * (the Sidebar's Talk door and a search thread row) still name the
 * conversation as a tab, and #/coach was pushed into history only to be
 * replaced, so Back looked dead. The one tab setter now turns a conversation
 * tab into the panel's door, after Kid Mode's freeze and before any state or
 * address change. A typed or linked #/coach still arrives through the hash
 * listener, and CompanionWorkspace returns it to the place.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ctx = fs.readFileSync(path.resolve(__dirname, "ArborContext.tsx"), "utf8").replace(/\r\n/g, "\n");
const START = "const setActiveTab = (t: ActiveTab) => {";
const setter = ctx.slice(ctx.indexOf(START), ctx.indexOf("\n  };", ctx.indexOf(START)));
const DOOR = 'if (t === "coach" || t === "scholar") {';

describe("F-TALK-1 · setActiveTab on a conversation tab opens the panel, never a page", () => {
  it("the setter is found", () => {
    expect(ctx.indexOf(START)).toBeGreaterThan(-1);
    expect(setter).toContain("setActiveTabState(t)");
  });

  it("coach and scholar go through the panel's one door and return before any state, hash or view_tab change", () => {
    const door = setter.indexOf(DOOR);
    expect(door).toBeGreaterThan(-1);
    const state = setter.indexOf("setActiveTabState(t)");
    const branch = setter.slice(door, state);
    expect(branch).toContain('requestCompanionConversation({ source: "nav" });');
    expect(branch).toMatch(/requestCompanionConversation\(\{ source: "nav" \}\);\s*return;\s*\}/);
    expect(door).toBeLessThan(state);
    expect(door).toBeLessThan(setter.indexOf("window.location.hash = `/${t}`"));
    expect(door).toBeLessThan(setter.indexOf('track("view_tab"'));
  });

  it("Kid Mode's freeze still comes first: no panel opens under the overlay", () => {
    const guard = setter.indexOf("if (isKidModeActive())");
    expect(guard).toBeGreaterThan(-1);
    expect(guard).toBeLessThan(setter.indexOf(DOOR));
  });
});
