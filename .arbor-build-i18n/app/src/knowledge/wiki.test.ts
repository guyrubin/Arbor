import { describe, expect, it } from "vitest";
import { filterKnowledgeCards, type KnowledgeCard } from "./wiki.js";

const cards: KnowledgeCard[] = [
  { id: "transition-bridge-3-5y", type: "intervention", domains: ["attachment_regulation"], age_bands: ["3-5y"], six_frame: "twoAxes", risk_level: "routine", allowed_uses: ["coach_context"], title: "Transition Bridge", body: "Use a transition bridge." },
  { id: "medical-acute", type: "escalation", domains: ["ecosystem_stressors"], age_bands: ["0-12m"], six_frame: "shepherd", risk_level: "urgent", allowed_uses: ["eval"], title: "Medical Acute", body: "Escalate." }
];

describe("knowledge retrieval filters", () => {
  it("filters by allowed use, age band, and domain", () => {
    const result = filterKnowledgeCards(cards, {
      allowedUse: "coach_context",
      ageBand: "3-5y",
      domains: ["attachment_regulation"]
    });
    expect(result.map((card) => card.id)).toEqual(["transition-bridge-3-5y"]);
  });

  it("returns no cards when allowed use does not match", () => {
    expect(filterKnowledgeCards(cards, { allowedUse: "coach_context", ageBand: "0-12m" })).toHaveLength(0);
  });
});
