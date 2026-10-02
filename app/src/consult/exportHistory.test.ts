/**
 * CARE-7 — per-audience export history: the delta section's "prior export
 * exists" gate. Metadata only (audience → ISO timestamp), fail quiet.
 */
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { getLastExportedAt, recordExport } from "./exportHistory";

// Node environment (no DOM) — minimal in-memory localStorage shim, matching
// the useFamilyGlance.test.ts pattern.
function installLocalStorage() {
  const store = new Map<string, string>();
  (globalThis as unknown as { localStorage: Storage }).localStorage = {
    getItem: (k: string) => (store.has(k) ? store.get(k)! : null),
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as Storage;
}

describe("consult export history (CARE-7)", () => {
  beforeEach(() => installLocalStorage());
  afterEach(() => { delete (globalThis as unknown as { localStorage?: Storage }).localStorage; });

  it("no prior export → null (the delta section never renders on a first export)", () => {
    expect(getLastExportedAt("child-1", "pediatrician")).toBeNull();
  });

  it("records and reads back per audience — audiences never bleed into each other", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    recordExport("child-1", "slp", "2026-06-10T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "pediatrician")).toBe("2026-06-01T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "slp")).toBe("2026-06-10T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "therapist")).toBeNull();
  });

  it("keys per child — siblings have independent histories", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    expect(getLastExportedAt("child-2", "pediatrician")).toBeNull();
  });

  it("a later export overwrites the audience timestamp", () => {
    recordExport("child-1", "pediatrician", "2026-06-01T10:00:00.000Z");
    recordExport("child-1", "pediatrician", "2026-07-01T10:00:00.000Z");
    expect(getLastExportedAt("child-1", "pediatrician")).toBe("2026-07-01T10:00:00.000Z");
  });

  it("fails quiet on corrupt storage or an invalid stored timestamp", () => {
    localStorage.setItem("arbor.consultExports.child-bad", "{not json");
    expect(getLastExportedAt("child-bad", "pediatrician")).toBeNull();
    localStorage.setItem("arbor.consultExports.child-odd", JSON.stringify({ pediatrician: "not-a-date" }));
    expect(getLastExportedAt("child-odd", "pediatrician")).toBeNull();
  });

  it("fails quiet with no localStorage at all (node/SSR) — never throws, never blocks an export", () => {
    delete (globalThis as unknown as { localStorage?: Storage }).localStorage;
    expect(() => recordExport("child-1", "teacher")).not.toThrow();
    expect(getLastExportedAt("child-1", "teacher")).toBeNull();
  });
});

/* ── B-CAREPRO-17 — the Consult screen shows "Since you last shared", and every
 * egress records ─────────────────────────────────────────────────────────────
 * Before: only the PDF path recorded an export, and the Consult screen built
 * its packet WITHOUT lastExportedAt, so the delta existed only inside PDFs. */
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildConsultPacket, serializeForExport, type BuildPacketInput } from "./packet";

const ASK = readFileSync(
  path.join(path.dirname(fileURLToPath(import.meta.url)), "..", "components", "sections", "AskSpecialist.tsx"),
  "utf8",
).replace(/\r\n/g, "\n");

/** The body of a `const name = (...) => { ... };` arrow in AskSpecialist. */
function fnBody(name: string): string {
  const m = new RegExp(`const ${name} = (?:async )?\\(\\) => \\{[\\s\\S]*?\\n  \\};`).exec(ASK);
  expect(m, `${name} extracted`).toBeTruthy();
  return m![0];
}

describe("B-CAREPRO-17 · every Consult egress records the export for its audience", () => {
  it("Copy, Save as PDF and Send-to-someone-you-trust each call recordExport(child, audience) after the act", () => {
    expect(ASK.length).toBeGreaterThan(5000);
    for (const [name, act] of [
      ["copy", "navigator.clipboard.writeText(exportText)"],
      ["savePdf", "printPdf(audience, sections)"],
      ["sendToTrusted", "window.location.href = href"],
    ] as const) {
      const body = fnBody(name);
      expect(body, name).toContain(act);
      expect(body, name).toContain("recordExport(childProfile.id, audience);");
      expect(body.indexOf(act), `${name} records only after the act`).toBeLessThan(body.indexOf("recordExport("));
    }
    // NEGATIVE CONTROL: the pre-change copy handler recorded nothing.
    const preCopy = 'const copy = async () => {\n    await navigator.clipboard.writeText(exportText);\n    toast(t("elev.packet.copied"), "success");\n  };';
    expect(preCopy).not.toContain("recordExport(");
  });

  it("the on-screen packet is built with the audience's last export, so the preview shows the section", () => {
    expect(ASK).toContain("lastExportedAt: getLastExportedAt(childProfile.id, audience) ?? undefined,");
    expect(ASK).toContain("lastExportedAudience: audience,");
  });
});

describe("B-CAREPRO-17 · the delta names who last received it; the teacher preset never carries it", () => {
  const NOW = Date.UTC(2026, 9, 2);
  const input: BuildPacketInput = {
    profile: { name: "Noa", age: 4, languages: ["Hebrew"], schoolContext: "Gan", strengths: ["curious"], challenges: [] },
    logs: [
      { behaviorType: "Bedtime", intensity: 2, timestamp: new Date(NOW - 2 * 86_400_000).toISOString() },
      { behaviorType: "Bedtime", intensity: 2, timestamp: new Date(NOW - 20 * 86_400_000).toISOString() },
    ],
    milestones: [],
    plans: [{ title: "Wind-down", createdAt: NOW - 86_400_000 }],
    memory: [],
    nowMs: NOW,
    lastExportedAt: new Date(NOW - 10 * 86_400_000).toISOString(),
    lastExportedAudience: "pediatrician",
  };

  it("pediatrician copy: 'Since you last shared with the pediatrician (date)' + three counts", () => {
    const md = serializeForExport("pediatrician", buildConsultPacket(input));
    expect(md).toContain("## Since you last shared with the pediatrician (2026-09-22)");
    expect(md).toContain("- 1 new moment logged.");
    expect(md).toContain("- 1 action plan added.");
    expect(md).toContain("- 0 milestones newly noticed.");
    const he = serializeForExport("pediatrician", buildConsultPacket(input), new Set(), "", "", "he");
    expect(he).toMatch(/מאז ששיתפתם בפעם האחרונה עם רופא\/ת הילדים/);
  });

  it("no prior export → no section; the teacher preset never carries it", () => {
    const first = serializeForExport("pediatrician", buildConsultPacket({ ...input, lastExportedAt: undefined }));
    expect(first).not.toContain("Since you last shared");
    const packet = buildConsultPacket({ ...input, lastExportedAudience: "teacher" });
    expect(packet.sections.find((s) => s.id === "since-last-visit")?.titleKey).toBe("elev.packet.section.sinceLast");
  });
});
