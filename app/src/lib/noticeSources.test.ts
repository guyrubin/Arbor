import { describe, expect, it } from "vitest";
import { noticeCarePacket, resolveNoticeSources, type NoticeSourceRecords } from "./noticeSources";
import { reviewedPortraitDraft } from "../components/companion/portraitEvidence";
import { exportPrintSections, serializeForExport } from "../consult/packet";
import type { Milestone } from "../types";

const milestone: Milestone = { id: "m1", domain: "language_communication", title: "Points to ask for something", description: "Catalogue context", ageGroup: "18 months", checked: false,
  observationStatus: "not_sure", observationSource: "parent_typed", observationUpdatedAt: "2026-10-16T13:00:00Z" };
const base = (): NoticeSourceRecords => ({ target: { childId: "c1", milestoneId: "m1" }, activeChildId: "c1", milestone, savedMilestone: milestone,
  keepsake: { id: "m1", milestoneId: "m1", note: "Pointed towards the red cup", noticedOn: "2026-10-15", createdAt: "2026-10-15", updatedAt: "2026-10-15" }, linkedMoment: null });

describe("B-GROWTH-44 · exact observation source projection", () => {
  for (const he of [false, true]) {
    for (const status of ["yes", "not_yet", "not_sure"] as const) {
      it(`${he ? "HE" : "EN"}: preserves ${status} as an answer, never a deficit or an inferred date`, () => {
        const input = base(); input.savedMilestone = { ...milestone, observationStatus: status, observedAt: "2020-01-01", checked: status === "yes" };
        const result = resolveNoticeSources(input, he);
        expect(result.state).toBe("ready");
        expect(result.sources[0].text).toContain(({ yes: he ? "ראיתי" : "Seen it", not_yet: he ? "עוד לא" : "Not yet", not_sure: he ? "לא בטוח" : "Not sure" })[status]);
        if (status !== "yes") expect(result.sources[0].text).not.toContain("2020-01-01");
        expect(result.sources[0].text).not.toMatch(/behind|delay|riskLevel|\d+\s*%/i);
      });
    }
  }
  it("requires a saved same-child document, even when the catalogue has a matching row", () => {
    expect(resolveNoticeSources({ ...base(), savedMilestone: null }, false).state).toBe("unavailable");
    expect(resolveNoticeSources({ ...base(), activeChildId: "c2" }, false).state).toBe("unavailable");
    expect(resolveNoticeSources({ ...base(), savedMilestone: { ...milestone, id: "other" } }, false).state).toBe("unavailable");
    expect(resolveNoticeSources({ ...base(), savedMilestone: { ...milestone, observationStatus: undefined, checked: false } }, false).state).toBe("unanswered");
  });
  it("keeps honest uncertainty in week/earlier dates and undated legacy answers", () => {
    for (const [when, phrase] of [["this_week", "During the week ending"], ["earlier", "On or before"]] as const) {
      const result = resolveNoticeSources({ ...base(), savedMilestone: { ...milestone, checked: true, observationStatus: "yes", observedWhen: when, observedAt: "2026-10-16" } }, false);
      expect(result.sources[0].text).toContain(`${phrase}: 2026-10-16`);
    }
    const result = resolveNoticeSources({ ...base(), savedMilestone: { ...milestone, checked: true, observationStatus: undefined, observationUpdatedAt: undefined, observationSource: undefined } }, false);
    expect(result.sources[0].at).toBe("Date not recorded");
    expect(result.sources[0].source).toContain("original source not recorded");
  });
  it("does not turn a quote, AI draft, duplicate id or another milestone's note into this source", () => {
    const note = base().keepsake!;
    for (const patch of [{ kind: "quote" }, { contentSource: "ai_draft" }, { id: "imported-copy" }, { milestoneId: "other" }, { noticedOn: "2026-02-30" }]) {
      const result = resolveNoticeSources({ ...base(), keepsake: { ...note, ...patch } as typeof note }, false);
      expect(result.sources.map(item => item.kind)).toEqual(["answer"]);
    }
  });
  it("resolves only the explicitly confirmed original moment and fails closed when it disappears or changes authorship", () => {
    const input = base(); input.savedMilestone = { ...milestone, observationSource: "ai_proposed_parent_confirmed", observationProvenance: "original" };
    expect(resolveNoticeSources(input, false).state).toBe("unavailable");
    input.linkedMoment = { id: "original", timestamp: "2026-10-14T08:00:00Z", behaviorType: "Moment", trigger: "Pointed towards the cup", durationMinutes: 0, milestoneId: "m1" };
    const ready = resolveNoticeSources(input, false);
    expect(ready.sources.map(item => item.id)).toEqual(["milestones:m1", "keepsakes:m1", "behaviorLogs:original"]);
    for (const patch of [{ id: "different" }, { contentSource: "ai_draft" }, { captureSource: "co_parent" }, { milestoneId: "other" }]) {
      expect(resolveNoticeSources({ ...input, linkedMoment: { ...input.linkedMoment, ...patch } as typeof input.linkedMoment }, false).state).toBe("unavailable");
    }
  });
  it("uses the same reviewed source facts for Talk and the existing Care serializer/PDF", () => {
    const sources = resolveNoticeSources(base(), false).sources;
    const selected = sources.filter(source => source.kind === "kept");
    const draft = reviewedPortraitDraft("What could we try together?", "c1", selected, false);
    expect(draft).toContain("keepsakes:m1"); expect(draft).not.toContain("milestones:m1");
    const packet = noticeCarePacket(selected, "Noa", "2026-10-18T08:00:00Z", false);
    expect(packet.sections.flatMap(section => section.items.map(item => item.id))).toEqual(["keepsakes:m1"]);
    for (const he of [false, true]) {
      const allItems = noticeCarePacket(sources, "Noa", "2026-10-18T08:00:00Z", he).sections.flatMap(section => section.items);
      expect(allItems.map(item => item.id)).toEqual(["milestones:m1", "keepsakes:m1"]);
      for (const item of allItems) expect(item.text).not.toContain(item.id);
    }
    const text = serializeForExport("pediatrician", packet);
    const pdf = exportPrintSections("pediatrician", packet).flatMap(section => section.body).join("\n");
    for (const output of [text, pdf]) {
      expect(output).toContain("Pointed towards the red cup"); expect(output).toContain("2026-10-15"); expect(output).not.toContain("keepsakes:m1");
      expect(output).not.toContain("milestones:m1"); expect(output).not.toContain("Catalogue context");
    }
    expect(() => serializeForExport("teacher", packet)).toThrow();
    expect(() => serializeForExport("pediatrician", noticeCarePacket([{ ...selected[0], text: "riskLevel: 90%" }], "Noa", "2026-10-18", false))).toThrow();
  });
});
