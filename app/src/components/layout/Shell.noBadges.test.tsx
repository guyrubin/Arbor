/**
 * B-SHELL-26 — no badges in parent mode: the pending-notes count on Ask
 * ("Ask Arbor 103") and the Growth milestone count are gone, whatever the
 * state holds; the data itself is untouched.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { badgeText } from "./Sidebar";

const STATE = { milestonesNoticed: 6, plansCount: 2, pendingReviewCount: 103 };

describe("B-SHELL-26 — the Shell renders no badge for pending notes", () => {
  it("every badge kind resolves to nothing (sidebar + mobile nav share badgeText)", () => {
    expect(badgeText({ kind: "count" }, STATE)).toBe("");
    expect(badgeText("milestone", STATE)).toBe("");
    expect(badgeText("plans", STATE)).toBe("");
    expect(badgeText({ kind: "dot" }, STATE)).toBe("");
    expect(badgeText(undefined, STATE)).toBe("");
  });

  it("the Ask hub's pulse no longer announces 'notes awaiting your review'", () => {
    const pulse = fs.readFileSync(path.resolve(__dirname, "../../lib/pulse.ts"), "utf8");
    expect(pulse).not.toMatch(/key: pickCountKey\("elev\.pulse\.ask\.review"/);
  });

  it("the badge derivation cannot quietly come back (source pin)", () => {
    const sidebar = fs.readFileSync(path.resolve(__dirname, "Sidebar.tsx"), "utf8");
    const fn = sidebar.slice(sidebar.indexOf("export function badgeText("), sidebar.indexOf("export default function Sidebar"));
    expect(fn).not.toMatch(/String\(state\./);
  });
});
