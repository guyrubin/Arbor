import { describe, expect, it } from "vitest";
import { renderSpokenContext, type SpokenContext } from "./spokenContext.js";

const empty: SpokenContext = { profile: null, approvedMemory: "", approvedMemoryFactsUsed: 0, recentTurns: [] };

describe("spoken context availability instructions", () => {
  it("requires positive recall when completed same-thread turns contain an accepted step", () => {
    const prompt = renderSpokenContext({
      ...empty,
      recentTurns: [
        { role: "coach", text: "Try a quiet greeting at pickup." },
        { role: "parent", text: "Yes, we'll try that today." },
      ],
    });
    expect(prompt).toContain("CONVERSATION CONTINUITY IS AVAILABLE");
    expect(prompt).toContain("recall the relevant specific step");
    expect(prompt).toContain("parental acceptance establishes an agreed next step");
    expect(prompt).not.toContain("NO PRIOR CONVERSATION");
    expect(prompt).not.toContain("NO PRIOR FAMILY CONTEXT");
  });

  it("treats approved memory as available continuity even before a new thread has turns", () => {
    const prompt = renderSpokenContext({ ...empty, approvedMemory: "A quiet greeting helped.", approvedMemoryFactsUsed: 1 });
    expect(prompt).toContain("CONVERSATION CONTINUITY IS AVAILABLE");
    expect(prompt).toContain("A quiet greeting helped.");
    expect(prompt).not.toContain("NO PRIOR CONVERSATION");
  });

  it("requires clarification for an empty or profile-only context without inferring a past plan", () => {
    for (const context of [undefined, empty, { ...empty, profile: { age: 4 } }]) {
      const prompt = renderSpokenContext(context);
      expect(prompt).toContain("NO PRIOR CONVERSATION OR APPROVED MEMORY");
      expect(prompt).toContain("ask one short clarifying question");
      expect(prompt).not.toContain("CONVERSATION CONTINUITY IS AVAILABLE");
    }
  });
});
