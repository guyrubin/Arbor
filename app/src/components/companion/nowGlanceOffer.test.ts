import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";
import { primaryDomain } from "../../lib/domains/registry";
import { routeHash } from "../../lib/routes";
import { todayFile } from "../../testTodaySource";

/**
 * v3 F-NOW-2 r2 — the glance's ONE offer line and the notice's door.
 * The glance draws the coordinator's slot only for a PREP/CALM rhythm cue, as a
 * ruled line (no card fill) that keeps "See the hours" (#/day-windows); every
 * other kind keeps its own home (the step lead, the visit row, Talk). The
 * notice line opens Milestones on the milestone's own area.
 */
const SRC = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "..");
const strip = (c: string) =>
  c.replace(/\r\n/g, "\n").replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const read = (rel: string) => strip(readFileSync(path.join(SRC, rel), "utf8"));

describe("v3 F-NOW-2 r2 — the glance's rhythm line", () => {
  const view = strip(todayFile("NowView.tsx"));
  const slot = read("components/overview/CompanionOfferSlot.tsx");
  const cue = read("components/coach/RhythmCue.tsx");

  it("Now gates its ONE slot on a rhythm cue, and the slot refuses any other kind in the glance", () => {
    expect((view.match(/<CompanionOfferSlot\b/g) ?? []).length).toBe(1);
    expect(view).toContain('{todayOffer.offer?.kind === "rhythm" && <CompanionOfferSlot surface="today" offer={todayOffer.offer} controls={todayOffer} placement="glance" />}');
    expect(slot).toContain('if (placement === "glance" && offer.kind !== "rhythm") return null;');
    expect(slot).toContain('variant={placement === "glance" ? "line" : "card"}');
  });

  it("the line variant is a ruled row: no card fill, a logical rule, the same doors at 44 px", () => {
    expect(cue).toContain('variant = "card"');
    expect(cue).toContain("data-variant={variant}");
    expect(cue).toContain('style={line ? { borderBlockEnd: "1px solid var(--arbor-rule)" }');
    expect(cue).not.toMatch(/border(Left|Right)|margin(Left|Right)|padding(Left|Right)/);
    // ONE "See the hours" door, PREP/CALM only, in both variants.
    expect((cue.match(/data-testid="rhythm-cue-day-windows"/g) ?? []).length).toBe(1);
    expect(cue).toMatch(/\(visible\.kind === "prep" \|\| visible\.kind === "calm"\) && \(/);
    // The cue's own action keeps the 44 px floor in both variants.
    const cta = cue.slice(cue.indexOf("setActiveTab(visible.action);"), cue.indexOf("{t(visible.ctaKey, visible.vars)}"));
    expect((cta.match(/min-h-\[44px\]/g) ?? []).length).toBe(2);
  });
});

describe("v3 F-NOW-2 r2 — the notice opens Milestones on its area", () => {
  const changes = strip(todayFile("useNowChanges.ts"));

  it("the notice line goes to #/development with the milestone's registry area; a changed line stays on Development", () => {
    expect(changes).toContain('goToRoute("development", { area: primaryDomain("developmental", notice.milestone.domain) })');
    expect(changes).toContain('if (line.kind === "milestone" || line.kind === "noticed" || line.kind === "first") { setActiveTab("development"); return; }');
    expect(changes).not.toContain('setActiveTab("screening")');
  });

  it("the route carries a registry area and drops an unknown one", () => {
    const area = primaryDomain("developmental", "language_communication");
    expect(area).toBe("talking");
    expect(routeHash("development", { area })).toBe("/development?area=talking");
    expect(routeHash("development", { area: primaryDomain("developmental", "not-a-domain") })).toBe("/development");
  });
});
