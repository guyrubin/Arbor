import { describe, expect, it } from "vitest";
import { keptByMonth, keptDay, keptThings, type KeptSources } from "./keptThings";
import { buildMomentLog, keptMomentFields } from "../../content/behaviorTaxonomy";
import type { BehaviorLog, Milestone } from "../../types";
import { quoteKeepsakeDoc } from "../loop/tonight";
import { CDC_MILESTONES } from "../milestoneData";

const child = { id: "child-a" };
const moment = (id: string, patch: Partial<BehaviorLog> = {}): BehaviorLog => ({ id, timestamp: "2026-10-06T12:00:00Z", behaviorType: "Moment", durationMinutes: 0, trigger: "The moon is following us", kept: "said", ...patch });
const milestone = { id: "ms-a", checked: true, observationStatus: "yes", observationUpdatedAt: "2026-10-03T12:00:00Z", title: "Took a first step", domain: "sensory_motor_patterns" } as Milestone;
const sources: KeptSources = {
  langObs: [
    { id: "word-a", phrase: "moon", language: "English", timestamp: "2026-10-01T01:00:00+03:00" },
    { id: "word-b", phrase: "אור", language: "Hebrew", timestamp: "2026-10-05T12:00:00Z" },
  ],
  milestones: [milestone],
  keepsakes: [{ id: "ms-a", milestoneId: "ms-a", note: "Three steps to me", noticedOn: "2026-10-04", createdAt: "2026-10-04", updatedAt: "2026-10-04" }],
  behaviorLogs: [moment("kept"), moment("incident", { behaviorType: "Food Refusal" })],
};

describe("parent-kept selector", () => {
  it("keeps a parent-noticed catalogue first without mistaking its citation for authorship", () => {
    const first = { ...CDC_MILESTONES[0], checked: true, observationStatus: "yes" as const, observationSource: "parent_typed" as const, observedAt: "2026-10-04" };
    const note = { ...sources.keepsakes![0], id: first.id, milestoneId: first.id };
    const kept = keptThings({ milestones: [first], keepsakes: [note] }, child);
    expect(kept).toHaveLength(1);
    expect(kept[0]).toMatchObject({ id: `milestones:${first.id}`, text: note.note, attribution: "parent" });
    expect(first.source).toEqual(CDC_MILESTONES[0].source);
    expect(keptThings({ milestones: [{ ...first, observationSource: "ai_proposed_parent_confirmed" }], keepsakes: [note] }, child)).toEqual([]);
    expect(keptThings({ milestones: [{ ...first, source: "ai_proposed_parent_confirmed" } as unknown as Milestone], keepsakes: [note] }, child)).toEqual([]);
    expect(keptThings({ milestones: [{ ...first, source: { kind: "ai" } } as unknown as Milestone], keepsakes: [note] }, child)).toEqual([]);
    expect(keptThings({ milestones: [{ ...first, captureSource: "co_parent" } as Milestone], keepsakes: [note] }, child)).toEqual([]);
    expect(keptThings({ keepsakes: [{ ...note, kind: "quote", milestoneId: undefined, source: first.source }] as any }, child)).toEqual([]);
  });

  it("folds two words, a noticed first plus its note, and an explicitly kept Moment into four dated items", () => {
    const items = keptThings({ ...sources, practiceEvents: [{ id: "practice", source: "kid_practice", phrase: "invented quote", timestamp: "2026-10-09" }] } as KeptSources, child);
    expect(items.map(item => item.id)).toEqual(["behaviorLogs:kept", "langObs:word-b", "milestones:ms-a", "langObs:word-a"]);
    expect(items[2].text).toBe("Three steps to me");
    expect(keptByMonth(items).map(month => [month.monthKey, month.items.map(item => item.id)])).toEqual([
      ["2026-10", ["behaviorLogs:kept", "langObs:word-b", "milestones:ms-a"]], ["2026-09", ["langObs:word-a"]],
    ]);
  });

  it("keeps explicit quote documents verbatim without adding them to the observation record", () => {
    const quote = quoteKeepsakeDoc("Why does the moon follow us?", new Date("2026-10-04T12:00:00Z"))!;
    expect(keptThings({ keepsakes: [quote] }, child)).toEqual([{ id: `keepsakes:${quote.id}`, kind: "said", at: quote.noticedOn, text: quote.note, attribution: "parent" }]);
  });

  it("rejects incidents, unknown types, unmarked free notes, co-parent text, and AI/practice provenance", () => {
    const unsafe = [
      moment("incident", { behaviorType: "Food Refusal" }), moment("unknown", { behaviorType: "Future problem" }),
      moment("unmarked", { kept: undefined }), moment("ai", { conversationProposalId: "proposal" }),
      moment("coparent", { captureSource: "co_parent" }),
      { ...moment("ai-source"), source: "ai_proposed_parent_confirmed" }, { ...moment("practice"), source: "kid_practice" },
    ];
    expect(keptThings({ behaviorLogs: unsafe }, child)).toEqual([]);
    // True negative control: selecting only on a forced keep flag leaks six of these rows.
    expect(unsafe.filter(row => row.kept).length).toBe(6);
  });

  it("rejects forged AI provenance on words, notes, and noticed milestones", () => {
    const quote = quoteKeepsakeDoc("Generated child quote", new Date("2026-10-04T12:00:00Z"))!;
    for (const source of ["ai_proposed_parent_confirmed", "ai_proposed_unconfirmed", "kid_practice", "document_extracted"]) {
      expect(keptThings({ langObs: [{ ...sources.langObs![0], source }], keepsakes: [{ ...quote, source }], milestones: [{ ...milestone, observationSource: source }] } as unknown as KeptSources, child)).toEqual([]);
    }
  });

  it("does not promote unobserved or uncertain milestones, orphan notes, blank words, or invalid dates", () => {
    expect(keptThings({ milestones: [{ ...milestone, checked: false }, { ...milestone, id: "uncertain", observationStatus: "not_sure" } as Milestone], keepsakes: sources.keepsakes, langObs: [{ ...sources.langObs![0], phrase: " " }], behaviorLogs: [moment("invalid", { timestamp: "not a date" })] }, child)).toEqual([]);
    expect(keptDay("2026-02-30")).toBeNull();
    expect(keptDay("2026-02-30T12:00:00Z")).toBeNull();
    expect(keptDay("2026-10-01T01:00:00+03:00")).toBe("2026-09-30");
  });

  it("uses the saved note's own date when an older seen milestone has no timestamp", () => {
    expect(keptThings({ milestones: [{ ...milestone, observationUpdatedAt: undefined }], keepsakes: sources.keepsakes }, child)).toMatchObject([{ id: "milestones:ms-a", at: "2026-10-04", text: "Three steps to me" }]);
  });

  it("declares independent firsts without inferring from plain parent prose", () => {
    expect(keptThings({ behaviorLogs: [moment("first", { kept: "first" }), moment("alone", { kept: "by_herself" })] }, child).map(item => item.kind).sort()).toEqual(["by_herself", "first"]);
  });
});

describe("keep never from a problem", () => {
  it("drops the marker for every non-Moment type, even when forced into input", () => {
    for (const type of ["Food Refusal", "Sleep Meltdown", "Transition Refusal", "new incident"]) expect(keptMomentFields(type, "said")).toEqual({});
    expect(keptMomentFields("Moment", "said")).toEqual({ kept: "said" });
    expect(keptMomentFields("Moment", "generated" as "said")).toEqual({});
  });
  it("buildMomentLog applies the shared guard and never preselects a kind", () => {
    expect(buildMomentLog("A moment", "Home")).not.toHaveProperty("kept");
    expect(buildMomentLog("Her own words", "Home", { kept: "said" })).toMatchObject({ behaviorType: "Moment", kept: "said" });
  });
});
