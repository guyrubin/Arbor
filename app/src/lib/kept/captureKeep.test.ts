import { describe, expect, it } from "vitest";
import { freshCaptureKeep, typedCaptureKeep, selectedCaptureKeep } from "./captureKeep";
import { buildMomentLog, keptMomentFields, BEHAVIOR_TYPES } from "../../content/behaviorTaxonomy";
import { keptThings } from "./keptThings";

const child = { id: "fixture-child", name: "Noa" };
describe("bounded kept capture provenance", () => {
  it.each(['"Hello"', "'I can't reach'", '“עוד פעם”', '‘My words’', '״שלום״'])("only the typed whole quotation %s preselects Said", text => {
    expect(typedCaptureKeep(freshCaptureKeep(), "", text).selected).toBe("said");
    expect(freshCaptureKeep(text).selected).toBeUndefined();
    expect(freshCaptureKeep(text, true).selected).toBeUndefined();
  });
  it.each(['" "', "' '", '“”', "I'm happy", 'She said "hello" today', '“still typing', 'unquoted'])("does not preselect %s", text => {
    expect(typedCaptureKeep(freshCaptureKeep(), "", text).selected).toBeUndefined();
  });
  it("cannot launder an externally replaced draft, even if old typed state was trusted", () => {
    const parent = typedCaptureKeep(freshCaptureKeep(), "", '"Real words"');
    const replaced = typedCaptureKeep(parent, '"Arbor prefill"', '"Arbor prefill!"');
    expect(replaced.parentWritten).toBe(false);
    expect(selectedCaptureKeep(replaced, replaced.text, false)).toBeUndefined();
    expect(selectedCaptureKeep(parent, '"Arbor prefill"', false)).toBeUndefined();
    expect(selectedCaptureKeep(parent, parent.text, true)).toBeUndefined();
  });
  it("the builder reuses the canonical plain Moment guard, and every incident drops forced markers", () => {
    for (const kind of ["said", "by_herself", "first"] as const) {
      expect(buildMomentLog("Parent words", "", { kept: kind })).toMatchObject({ behaviorType: "Moment", kept: kind });
      for (const row of BEHAVIOR_TYPES.filter(type => type.value !== "Moment")) expect(keptMomentFields(row.value, kind)).toEqual({});
      expect(keptMomentFields("unknown", kind)).toEqual({});
    }
    expect(buildMomentLog("Words", "")).not.toHaveProperty("kept");
  });
  it("the existing reader still rejects forged incident, proposal, AI, co-parent and practice sources", () => {
    const row = buildMomentLog('"Words"', "", { kept: "said" })!;
    for (const extra of [{ behaviorType: "Food Refusal" }, { conversationProposalId: "proposal" }, { source: "ai_proposed_parent_confirmed" }, { source: "kid_practice" }, { captureSource: "co_parent" }, { contentSource: "ai_draft" }, { contentSource: "unverified" }]) {
      const forged = { ...row, ...extra };
      expect(keptThings({ behaviorLogs: [forged] } as any, child)).toEqual([]);
      expect(forged).toHaveProperty("kept", "said"); // selector never rewrites history
    }
  });
});
