/**
 * ask-cadence (ASK-1 + AIR-1) — unit tests for the streaming JSON text-field
 * extractor that feeds /chat's sentence-delta preview stream. The invariants
 * that matter clinically: append-only unescaped output (a delta never shows a
 * half-decoded escape), top-level-only key matching (a nested "text" key can
 * never leak someone else's prose into the parent bubble), and single-shot
 * capture.
 */
import { describe, it, expect } from "vitest";
import { createJsonTextFieldExtractor } from "./jsonTextStream.js";

const drain = (chunks: string[], field?: string) => {
  const ex = createJsonTextFieldExtractor(field);
  let out = "";
  const perPush: string[] = [];
  for (const c of chunks) {
    const got = ex.push(c);
    perPush.push(got);
    out += got;
  }
  return { out, perPush, finished: ex.finished() };
};

describe("createJsonTextFieldExtractor", () => {
  it("extracts the top-level text field from a whole document", () => {
    const doc = JSON.stringify({ text: "Hello there. Take a breath.", riskLevel: "Low" });
    const { out, finished } = drain([doc]);
    expect(out).toBe("Hello there. Take a breath.");
    expect(finished).toBe(true);
  });

  it("streams the value incrementally across arbitrary chunk boundaries", () => {
    const doc = `{"text": "One sentence. Two sentences.", "todayPlan": ["a"]}`;
    const chunks = doc.match(/.{1,3}/gs)!;
    const { out } = drain(chunks);
    expect(out).toBe("One sentence. Two sentences.");
  });

  it("push() output is append-only: concatenated pushes equal the final value", () => {
    const doc = `{"riskLevel":"Low","text":"Alpha. Beta. Gamma.","ageBand":"3-4"}`;
    const { out, perPush } = drain(doc.match(/.{1,5}/gs)!);
    expect(perPush.join("")).toBe(out);
    expect(out).toBe("Alpha. Beta. Gamma.");
  });

  it("unescapes JSON escapes, holding back partial escapes at chunk boundaries", () => {
    // Split right inside \" and inside א.
    const chunks = [`{"text":"Say \\`, `"hi\\" now \\u05d`, `0 done."}`];
    const { out } = drain(chunks);
    expect(out).toBe(`Say "hi" now א done.`);
  });

  it("never captures a nested 'text' key (depth guard)", () => {
    const doc = `{"meta":{"text":"NESTED-NEVER"},"items":[{"text":"ALSO-NEVER"}],"text":"Real prose."}`;
    const { out } = drain([doc]);
    expect(out).toBe("Real prose.");
    expect(out).not.toContain("NEVER");
  });

  it("ignores 'text' appearing as a string VALUE of another key", () => {
    const doc = `{"kind":"text","text":"The real value."}`;
    const { out } = drain([doc]);
    expect(out).toBe("The real value.");
  });

  it("is single-shot: content after the closing quote is never emitted", () => {
    const ex = createJsonTextFieldExtractor();
    const first = ex.push(`{"text":"Done here.","other":"`);
    expect(first).toBe("Done here.");
    expect(ex.finished()).toBe(true);
    expect(ex.push(`ignored","text":"again"}`)).toBe("");
  });

  it("returns nothing when the document has no top-level text field", () => {
    const { out, finished } = drain([`{"riskLevel":"Low","todayPlan":["step"]}`]);
    expect(out).toBe("");
    expect(finished).toBe(false);
  });

  it("handles Hebrew content untouched", () => {
    const doc = JSON.stringify({ text: "זה מאבק מוכר. ננסה צעד אחד." });
    const { out } = drain(doc.match(/.{1,4}/gs)!);
    expect(out).toBe("זה מאבק מוכר. ננסה צעד אחד.");
  });

  it("supports a custom field name", () => {
    const { out } = drain([`{"prose":"Custom field.","text":"not this"}`], "prose");
    expect(out).toBe("Custom field.");
  });
});
