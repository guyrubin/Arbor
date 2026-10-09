import { describe, expect, it } from "vitest";
import { cleanFileTurnDocument, FILE_DECLINED_FALLBACK, renderCoachResponse, renderFileDeclinedResponse, toFileTurnContract } from "./coach";

/**
 * Parity 9 Oct (companion_attachments 1.2.0): the /chat FILE turn owns two
 * shapes the retired /vision route had — the off-topic DECLINE and the
 * DOCUMENT block. The route, not the model, decides the declined shape.
 */
const FULL = {
  text: "Here is what the note says.", riskLevel: "Low", ageBand: "3-4", domains: ["language_communication"],
  nonDiagnosticHypotheses: [], todayPlan: ["Offer two books."], parentScript: "Which one shall we read?",
  avoid: [], observe: [], escalateIf: ["Talk to your professional if this worries you."],
  frameRouting: { aim: "a", twoAxes: "b", story: "c", shadow: "d", marriage: "e", shepherd: "f" },
  memoryProposals: [], handoffNotes: { teacher: "", professional: "" }, sourceCardsUsed: [],
};

describe("toFileTurnContract — the declined shape", () => {
  it("keeps the words, empties every card section, whatever the model returned", () => {
    const declined = toFileTurnContract({ ...FULL, fileDeclined: true, text: "  I can only look at child photos.  " });
    expect(declined.fileDeclined).toBe(true);
    expect(declined.text).toBe("I can only look at child photos.");
    for (const key of ["domains", "todayPlan", "avoid", "observe", "escalateIf", "nonDiagnosticHypotheses", "memoryProposals"] as const) expect(declined[key]).toEqual([]);
    expect(declined.parentScript).toBe("");
    expect(declined.handoffNotes).toEqual({ teacher: "", professional: "" });
    expect(declined.document).toBeUndefined();
    expect(renderFileDeclinedResponse(declined)).toBe("I can only look at child photos.");
  });

  it("a decline with empty arrays and no text never throws, and speaks the session language", () => {
    expect(toFileTurnContract({ fileDeclined: true, domains: [], todayPlan: [] }, "he").text).toBe(FILE_DECLINED_FALLBACK.he);
    expect(toFileTurnContract({ fileDeclined: true }, "en").text).toBe(FILE_DECLINED_FALLBACK.en);
  });

  it("NEGATIVE CONTROL: without the flag, a read file keeps every min(1) of the contract", () => {
    expect(() => toFileTurnContract({ ...FULL, domains: [], todayPlan: [] })).toThrow();
    expect(() => toFileTurnContract({ ...FULL, fileDeclined: "true" })).not.toThrow();
    expect(toFileTurnContract({ ...FULL, fileDeclined: "true" }).fileDeclined).toBeUndefined();
  });
});

describe("the document block — trimmed and capped at the parse seam", () => {
  it("drops blanks, caps the lists and lengths, and disappears when empty", () => {
    const doc = cleanFileTurnDocument({
      documentType: "  daycare note ", keyPoints: [" a ", "", "b", "c", "d", "e", "f", 7], questionsForProfessional: ["q1", "q2", "q3", "q4"],
      handoffNote: "x".repeat(900), suggestedMemory: ["m1", "  ", "m2"],
    })!;
    expect(doc.documentType).toBe("daycare note");
    expect(doc.keyPoints).toEqual(["a", "b", "c", "d", "e"]);
    expect(doc.questionsForProfessional).toHaveLength(3);
    expect(doc.handoffNote).toHaveLength(600);
    expect(doc.suggestedMemory).toEqual(["m1", "m2"]);
    expect(cleanFileTurnDocument({ documentType: "x", keyPoints: [], suggestedMemory: [""] })).toBeUndefined();
    expect(cleanFileTurnDocument("not an object")).toBeUndefined();
  });

  it("a read document is carried on the contract and rendered into the SCREENED text", () => {
    const contract = toFileTurnContract({ ...FULL, document: { documentType: "school report", keyPoints: ["Reads with a partner."], questionsForProfessional: ["How can we help at home?"], handoffNote: "", suggestedMemory: ["Reading group on Mondays"] } });
    expect(contract.document?.keyPoints).toEqual(["Reads with a partner."]);
    const text = renderCoachResponse(contract, "en");
    expect(text).toContain("From the document: school report");
    expect(text).toContain("- Reads with a partner.");
    expect(text).toContain("- How can we help at home?");
    expect(text).toContain("- Reading group on Mondays");
    expect(renderCoachResponse(contract, "he")).toContain("מתוך המסמך: school report");
  });

  it("a turn without a document renders byte-identically to before", () => {
    const plain = toFileTurnContract(FULL);
    expect(plain.document).toBeUndefined();
    expect(renderCoachResponse(plain, "en")).not.toContain("From the document");
  });
});
