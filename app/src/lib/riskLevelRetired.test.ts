/**
 * B-CAREPRO-34 — the persisted `riskLevel` verdict is retired from the child
 * record.
 *
 * `ChildProfile.riskLevel: 'Low' | 'Moderate' | 'High'` was written at
 * onboarding, carried by the profile drawer and read by ONE internal boolean
 * (the Copilot escalation signal, which already OR-ed the parent's own watch
 * answers). A graded verdict about a child has no place in the record (law 1).
 *
 * What stays, on purpose:
 *  · `CoachContract.riskLevel` (types.ts) — the model ANSWER's own field, with
 *    its own tiering tests; a different object.
 *  · `FORBIDDEN_EXPORT_TOKENS` (consult/packet.ts) — no export may ever carry it.
 *  · `RETIRED_PROFILE_FIELDS` (lib/childAge.ts) — the migration: every profile
 *    write deletes the stored value.
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { RETIRED_PROFILE_FIELDS } from "./childAge";
import { FORBIDDEN_EXPORT_TOKENS } from "../consult/packet";
import { buildNewChildInput } from "./childProfileInput";
import { defaultChildProfile } from "../initialData";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\./.test(name)) out.push(full);
  }
  return out;
}

const FILES = walk(SRC).map((f) => ({ rel: path.relative(SRC, f).split(path.sep).join("/"), src: readFileSync(f, "utf8") }));

/** A read or write of the field on a CHILD PROFILE object. */
const PROFILE_ACCESS = /\b(?:childProfile|activeChild|profile|child|p)\.riskLevel\b|\briskLevel:\s*["'](?:Low|Moderate|High)["']/;

/**
 * Files allowed to WRITE the CoachContract answer field (never a profile), with
 * the reason. Only a CoachContract-shaped literal is waived there: `riskLevel`
 * immediately followed by `nonDiagnosticHypotheses` (the answer object's next
 * key). Any profile read or any other verdict literal in the file still fails.
 */
const CONTRACT_ANSWER_WRITERS: Record<string, string> = {
  "ai/mockProvider.ts": "B-INF-04: the mock coach_chat fixture fills CoachContract.riskLevel, the model answer's own field",
};
const CONTRACT_ANSWER_LITERAL = /\briskLevel:\s*["'](?:Low|Moderate|High)["'],\s*nonDiagnosticHypotheses:/g;
const violates = (rel: string, src: string): boolean =>
  PROFILE_ACCESS.test(rel in CONTRACT_ANSWER_WRITERS ? src.replace(CONTRACT_ANSWER_LITERAL, "") : src);

describe("B-CAREPRO-34 — no child-profile riskLevel anywhere in the app", () => {
  it("the scan read the real tree", () => {
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES.some((f) => f.rel === "components/practice/DevelopmentCopilot.tsx")).toBe(true);
  });

  it("no source reads or writes riskLevel on a child profile", () => {
    const hits = FILES.filter((f) => violates(f.rel, f.src)).map((f) => f.rel);
    expect(hits).toEqual([]);
    // NEGATIVE CONTROLS: the four pre-change sites are what the rule catches.
    for (const pre of [
      'childProfile.riskLevel !== "Low" || watch.some((w) => w.level === "discuss")',
      "riskLevel: activeChild.riskLevel,",
      'riskLevel: "Low",',
      "riskLevel: 'Low' | 'Moderate' | 'High';",
    ]) {
      expect(PROFILE_ACCESS.test(pre) || /'Low' \| 'Moderate' \| 'High'/.test(pre), pre).toBe(true);
    }
  });

  it("the CoachContract-answer waiver is narrow: a profile-shaped use in an allowed file still fails", () => {
    const mock = FILES.find((f) => f.rel === "ai/mockProvider.ts")!.src;
    // The waiver is what the file needs today (it does contain the answer field)...
    expect(PROFILE_ACCESS.test(mock)).toBe(true);
    expect(violates("ai/mockProvider.ts", mock)).toBe(false);
    // ...and nothing more. NEGATIVE CONTROLS: profile-shaped uses in the same file.
    for (const injected of [
      'const child = { name: "Noa", riskLevel: "Moderate", ageMonths: 40 };',
      "const r = activeChild.riskLevel;",
      'profile.riskLevel = "High";',
    ]) {
      expect(violates("ai/mockProvider.ts", `${mock}\n${injected}\n`), injected).toBe(true);
    }
    // The waiver is per-file: the answer-shaped literal anywhere else still fails.
    expect(violates("components/Other.tsx", 'x = { riskLevel: "Low", nonDiagnosticHypotheses: [] };')).toBe(true);
  });

  it("ChildProfile no longer declares the field; CoachContract keeps its own", () => {
    const types = FILES.find((f) => f.rel === "types.ts")!.src;
    const child = /export interface ChildProfile \{[\s\S]*?\n\}/.exec(types);
    expect(child).toBeTruthy();
    expect(child![0]).not.toContain("riskLevel");
    expect(types).toMatch(/export interface CoachContract \{[\s\S]*?riskLevel: string;/);
  });

  it("new and demo child records carry no verdict", () => {
    const input = buildNewChildInput({ name: "Noa", ageMonths: 40, gender: "girl", languages: ["Hebrew"], strengthsText: "", challengesText: "" });
    expect(input).not.toHaveProperty("riskLevel");
    expect(defaultChildProfile).not.toHaveProperty("riskLevel");
  });

  it("the migration deletes a stored value on the next profile write; the forbidden token stays", () => {
    expect(RETIRED_PROFILE_FIELDS).toContain("riskLevel");
    const ctx = FILES.find((f) => f.rel === "context/ProfileContext.tsx")!.src;
    expect(ctx).toContain("for (const k of RETIRED_PROFILE_FIELDS) firestorePatch[k] = deleteField();");
    expect(ctx).toContain("for (const k of RETIRED_PROFILE_FIELDS) delete next[k];");
    expect(FORBIDDEN_EXPORT_TOKENS).toContain("riskLevel");
  });
});
