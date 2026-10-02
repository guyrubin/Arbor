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

describe("B-CAREPRO-34 — no child-profile riskLevel anywhere in the app", () => {
  it("the scan read the real tree", () => {
    expect(FILES.length).toBeGreaterThan(300);
    expect(FILES.some((f) => f.rel === "components/practice/DevelopmentCopilot.tsx")).toBe(true);
  });

  it("no source reads or writes riskLevel on a child profile", () => {
    const hits = FILES.filter((f) => PROFILE_ACCESS.test(f.src)).map((f) => f.rel);
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
