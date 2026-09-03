/* LC-08 — components never build export text through the unguarded
 * `serializePacket`; the ONE seam is `serializeForExport` (audience-capped,
 * note-scanned). Source-scan guard in the cosmeticsFirewall style: every
 * component file is checked, and the checker is proven against a planted
 * pre-fix import (negative control). */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const COMPONENTS = path.join(here, "..", "components");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/** True when the source imports the bare `serializePacket` symbol from the
 *  consult packet module (not `serializePresetPacket` / `serializeForExport`). */
export function importsBareSerializePacket(src: string): boolean {
  for (const m of src.matchAll(/import\s*\{([^}]*)\}\s*from\s*["'][^"']*consult\/packet["']/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/)[0].trim());
    if (names.includes("serializePacket")) return true;
  }
  return /\bserializePacket\s*\(/.test(src);
}

describe("LC-08 — no component imports or calls serializePacket directly", () => {
  const files = walk(COMPONENTS);

  it("scans a real component tree", () => {
    expect(files.length).toBeGreaterThan(50);
  });

  it("every component file routes through serializeForExport / the preset serializers", () => {
    const offenders = files.filter((f) => importsBareSerializePacket(readFileSync(f, "utf8")));
    expect(offenders.map((f) => path.relative(COMPONENTS, f)), "components importing the unguarded serializePacket").toEqual([]);
  });

  it("AskSpecialist builds Copy / Download / Send text through serializeForExport", () => {
    const src = readFileSync(path.join(COMPONENTS, "sections", "AskSpecialist.tsx"), "utf8");
    expect(src).toContain("serializeForExport(");
    expect(src).toMatch(/import\s*\{[^}]*serializeForExport[^}]*\}\s*from\s*["']\.\.\/\.\.\/consult\/packet["']/);
    // The audience selector is a required first step of the export bar.
    expect(src).toContain('role="radiogroup"');
    expect(src).toContain("EXPORT_AUDIENCES");
  });

  it("NEGATIVE CONTROL: the pre-fix import is flagged by the checker", () => {
    const preFix = `import { appendParentNote, buildConsultPacket, serializePacket, countIncluded } from "../../consult/packet";`;
    expect(importsBareSerializePacket(preFix)).toBe(true);
    expect(importsBareSerializePacket(`const md = serializePacket(packet, excluded);`)).toBe(true);
    expect(importsBareSerializePacket(`import { serializePresetPacket, serializeForExport } from "../../consult/packet";`)).toBe(false);
  });
});
