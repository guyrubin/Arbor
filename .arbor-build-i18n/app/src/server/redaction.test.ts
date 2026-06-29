import { describe, expect, it } from "vitest";
import { CHILD_ALIAS, createRedaction } from "./redaction.js";

describe("PII redaction before model calls (SEC/CMP P0)", () => {
  it("replaces the child's name with the alias, case-insensitively, on word boundaries", () => {
    const r = createRedaction("Maya");
    expect(r.redact("Maya threw the truck. maya calmed down. Mayan ruins.")).toBe(
      `${CHILD_ALIAS} threw the truck. ${CHILD_ALIAS} calmed down. Mayan ruins.`
    );
  });

  it("redacts the name inside serialized profile JSON", () => {
    const r = createRedaction("Noa");
    const json = JSON.stringify({ name: "Noa", age: 4, notes: "Noa loves trucks" });
    const redacted = r.redact(json);
    expect(redacted).not.toContain("Noa");
    expect(redacted).toContain(CHILD_ALIAS);
  });

  it("scrubs emails and long phone numbers but leaves ages/durations alone", () => {
    const r = createRedaction("Maya");
    const out = r.redact("Contact dad@example.com or +31 6 1234 5678. She is 4 years old, tantrum lasted 25 minutes.");
    expect(out).toContain("[email]");
    expect(out).toContain("[phone]");
    expect(out).toContain("4 years old");
    expect(out).toContain("25 minutes");
  });

  it("restores the alias to the real name, tolerating case drift", () => {
    const r = createRedaction("Maya");
    expect(r.restore(`Tell ${CHILD_ALIAS} it's time. [child] will be fine.`)).toBe(
      "Tell Maya it's time. Maya will be fine."
    );
  });

  it("restoreDeep walks nested structures", () => {
    const r = createRedaction("Maya");
    const restored = r.restoreDeep({
      text: `${CHILD_ALIAS} did well`,
      list: [`praise ${CHILD_ALIAS}`],
      nested: { script: `"${CHILD_ALIAS}, shoes on please"` },
      num: 3,
    });
    expect(restored.text).toBe("Maya did well");
    expect(restored.list[0]).toBe("praise Maya");
    expect(restored.nested.script).toBe('"Maya, shoes on please"');
    expect(restored.num).toBe(3);
  });

  it("stream restorer restores an alias split across chunks", () => {
    const r = createRedaction("Maya");
    const s = r.createStreamRestorer();
    const out = s.push("Tell [Chi") + s.push("ld] it's bedtime") + s.flush();
    expect(out).toBe("Tell Maya it's bedtime");
  });

  it("does nothing when no child name is available", () => {
    const r = createRedaction(undefined);
    expect(r.redact("Maya threw the truck")).toBe("Maya threw the truck");
    expect(r.restore(`${CHILD_ALIAS} is fine`)).toBe(`${CHILD_ALIAS} is fine`);
  });

  it("skips single-character names rather than shredding text", () => {
    const r = createRedaction("A");
    expect(r.redact("A big day for a small child")).toBe("A big day for a small child");
  });
});
