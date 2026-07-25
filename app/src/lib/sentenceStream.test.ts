/**
 * EVAL-2 — unit tests for the extracted voice sentence splitter
 * (lib/sentenceStream). Pins byte-equivalence with the original inline
 * CoachTab logic so the extraction is a pure refactor, plus the streaming
 * feedback contract (rest feeds back in as the next call's prefix).
 */
import { describe, it, expect } from "vitest";
import { splitCompleteSentences, SENTENCE_BOUNDARY } from "./sentenceStream.js";

/** The ORIGINAL CoachTab implementation, verbatim — the equivalence oracle. */
const legacySplit = (buf: string): { spoken: string[]; rest: string } => {
  const spoken: string[] = [];
  const parts = buf.split(/(?<=[.!?])\s+/);
  while (parts.length > 1) spoken.push(parts.shift() as string);
  return { spoken, rest: parts[0] || "" };
};

describe("splitCompleteSentences", () => {
  it("holds a fragment with no boundary entirely in rest", () => {
    expect(splitCompleteSentences("Take a slow breath")).toEqual({
      complete: [],
      rest: "Take a slow breath",
    });
  });

  it("releases a sentence only once its terminator is followed by whitespace", () => {
    // Terminator seen but no trailing whitespace yet — still buffering.
    expect(splitCompleteSentences("Name the feeling.")).toEqual({
      complete: [],
      rest: "Name the feeling.",
    });
    // The following space closes the boundary.
    expect(splitCompleteSentences("Name the feeling. ")).toEqual({
      complete: ["Name the feeling."],
      rest: "",
    });
  });

  it("splits a multi-sentence buffer into complete sentences + trailing fragment", () => {
    const { complete, rest } = splitCompleteSentences(
      "Get low and quiet. Name what you see! Then hold the boundary gently? Afterwards reconnect",
    );
    expect(complete).toEqual([
      "Get low and quiet.",
      "Name what you see!",
      "Then hold the boundary gently?",
    ]);
    expect(rest).toBe("Afterwards reconnect");
  });

  it("handles Hebrew sentences (same . ! ? terminators — VC-6 parity)", () => {
    const { complete, rest } = splitCompleteSentences("זה מאבק מוכר מאוד. נסו להכין שתי אפשרויות ");
    expect(complete).toEqual(["זה מאבק מוכר מאוד."]);
    expect(rest).toBe("נסו להכין שתי אפשרויות ");
  });

  it("streams correctly when rest is fed back as the next chunk's prefix", () => {
    const chunks = ["First, get low and qu", "iet. Name what you see in one sh", "ort sentence. Then hold"];
    let buf = "";
    const enqueued: string[] = [];
    for (const chunk of chunks) {
      buf += chunk;
      const { complete, rest } = splitCompleteSentences(buf);
      enqueued.push(...complete);
      buf = rest;
    }
    expect(enqueued).toEqual(["First, get low and quiet.", "Name what you see in one short sentence."]);
    expect(buf).toBe("Then hold");
  });

  it("is byte-equivalent to the original inline CoachTab logic", () => {
    const cases = [
      "",
      "One.",
      "One. ",
      "One. Two",
      "One. Two! Three? Four",
      "No terminator at all",
      "Ellipsis wait... then more. tail",
      "Mr. Rogers said hi. next", // known abbreviation trade-off — identical both sides
      "שלום. מה קורה? עוד",
    ];
    for (const input of cases) {
      const legacy = legacySplit(input);
      const next = splitCompleteSentences(input);
      expect(next.complete, `complete for "${input}"`).toEqual(legacy.spoken);
      expect(next.rest, `rest for "${input}"`).toBe(legacy.rest);
    }
  });

  it("exports the boundary regex for server-side reuse (AI-V1 sentence screening)", () => {
    expect("A. B".split(SENTENCE_BOUNDARY)).toEqual(["A.", "B"]);
  });
});
