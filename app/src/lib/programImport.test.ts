import { describe, expect, it } from "vitest";
import { parseRecommendationDraft, pastedRecommendations, parseProgramDocument } from "./programImport";

describe("home program extraction boundary", () => {
  it("never drops negation or a condition from a source line", () => {
    expect(parseRecommendationDraft({ sourceText: "Do not ask the child to repeat.", recommendations: ["ask the child to repeat."], unreadable: false, offTopic: false }).recommendations).toEqual([]);
  });
  it("keeps only exact source quotations, never invented additions", () => {
    expect(parseRecommendationDraft({ sourceText: "Read a book together.\nLet the child choose.", recommendations: ["Read a book together.", "Practise for an hour."], unreadable: false, offTopic: false }).recommendations).toEqual(["Read a book together."]);
  });
  it("keeps Hebrew unchanged", () => {
    const text = "קראו יחד ספר לפי בחירת הילד.";
    expect(pastedRecommendations(text).recommendations).toEqual([text]);
  });
  it("fails closed for unreadable and unrelated documents", () => {
    for (const flag of ["offTopic", "unreadable"]) expect(parseRecommendationDraft({ sourceText: "Read together.", recommendations: ["Read together."], unreadable: false, offTopic: false, [flag]: true }).recommendations).toEqual([]);
  });
  it("requires a boolean readability verdict and bounded transcription", () => {
    expect(() => parseRecommendationDraft({ sourceText: "x".repeat(12001), recommendations: [] })).toThrow();
    expect(() => parseRecommendationDraft({ sourceText: "text", recommendations: [], unreadable: "false", offTopic: false })).toThrow();
  });
  it("does not split or truncate a long recommendation into a changed instruction", () => {
    expect(pastedRecommendations("a".repeat(201)).recommendations).toEqual([]);
  });
  it("bounds input, deduplicates and offers at most eight selectable quotations", () => {
    expect(() => pastedRecommendations("a".repeat(12001))).toThrow();
    expect(pastedRecommendations("Read together.\nRead together.").recommendations).toEqual(["Read together."]);
    expect(pastedRecommendations(Array.from({length: 20}, (_, i) => `Read book ${i}.`).join("\n")).recommendations).toHaveLength(8);
  });
  it("accepts a real PDF header and rejects disguised or executable uploads", () => {
    expect(parseProgramDocument("data:application/pdf;base64,JVBERi0xLjc=").mimeType).toBe("application/pdf");
    expect(() => parseProgramDocument("data:image/png;base64,PGh0bWw+")).toThrow();
    expect(() => parseProgramDocument("data:image/svg+xml;base64,PHN2Zz4=")).toThrow();
    expect(() => parseProgramDocument("data:application/pdf;base64,broken!")).toThrow();
  });
});
