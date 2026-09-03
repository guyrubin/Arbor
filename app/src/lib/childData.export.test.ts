/* LC-02 — "Export all data" must export ALL data.
 *
 * `exportChildData` (this module) sweeps every CHILD_SUBCOLLECTIONS sink plus
 * the server-side memory ledger + share grants; it is the ONLY complete
 * export. Any `downloadJson(` call outside lib/childData.ts must therefore
 * receive `exportChildData`'s return (optionally spread with extra top-level
 * fields such as `exportNote`). A hand-built object under an "all data" label
 * is a false statement on a GDPR Art. 15/20 surface — the pre-fix
 * TrustedSharing shape, kept here as the negative control. */

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(here, "..");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) walk(full, out);
    else if (/\.(ts|tsx)$/.test(name) && !name.includes(".test.")) out.push(full);
  }
  return out;
}

/** Return the source text of the Nth argument of the call starting at `open`
 *  (the index of its "("), bracket-aware. */
function argAt(src: string, open: number, n: number): string {
  let depth = 0;
  let argStart = open + 1;
  let idx = 0;
  for (let i = open; i < src.length; i++) {
    const ch = src[i];
    if (ch === "(" || ch === "{" || ch === "[") depth++;
    else if (ch === ")" || ch === "}" || ch === "]") {
      depth--;
      if (depth === 0) return idx === n ? src.slice(argStart, i).trim() : "";
    } else if (ch === "," && depth === 1) {
      if (idx === n) return src.slice(argStart, i).trim();
      idx++;
      argStart = i + 1;
    }
  }
  return "";
}

/** Every `downloadJson(` call's payload must be the value bound from
 *  `await exportChildData(...)` — bare, or spread first into an object. */
export function downloadJsonViolations(src: string): string[] {
  const bound = [...src.matchAll(/(?:const|let)\s+(\w+)\s*=\s*await\s+exportChildData\(/g)].map((m) => m[1]);
  const out: string[] = [];
  for (const m of src.matchAll(/\bdownloadJson\s*\(/g)) {
    const payload = argAt(src, (m.index ?? 0) + m[0].length - 1, 1);
    const ok = bound.some((v) => new RegExp(`^(\\{\\s*\\.\\.\\.)?${v}\\b`).test(payload));
    if (!ok) out.push(payload.slice(0, 80));
  }
  return out;
}

describe("LC-02 — every downloadJson call site exports the complete child record", () => {
  const files = walk(SRC).filter((f) => !f.endsWith(path.join("lib", "childData.ts")));
  const callers = files.filter((f) => /\bdownloadJson\s*\(/.test(readFileSync(f, "utf8")));

  it("finds the export call sites (TrustedSharing + ProfileEditDrawer)", () => {
    const names = callers.map((f) => path.basename(f));
    expect(names).toContain("TrustedSharing.tsx");
    expect(names).toContain("ProfileEditDrawer.tsx");
  });

  it("each call site passes exportChildData's return (optionally spread with top-level extras)", () => {
    for (const f of callers) {
      expect(downloadJsonViolations(readFileSync(f, "utf8")), path.relative(SRC, f)).toEqual([]);
    }
  });

  it("TrustedSharing keeps the parent-facing exportNote as a top-level field", () => {
    const src = readFileSync(path.join(SRC, "components", "sections", "TrustedSharing.tsx"), "utf8");
    expect(src).toMatch(/exportNote:\s*t\("sec\.sharing\.data\.exportNote"\)/);
  });

  it("NEGATIVE CONTROL: the pre-fix hand-built payload is flagged", () => {
    const preFix = `
      const exportData = () => {
        downloadJson(\`arbor-\${first}-data.json\`, {
          exportedAt: new Date().toISOString(),
          child: childProfile,
          behaviorLogs,
          actionPlans,
          note: t("sec.sharing.data.exportNote"),
        });
      };`;
    expect(downloadJsonViolations(preFix)).toHaveLength(1);
    const fixed = `const data = await exportChildData(user?.uid, childProfile);
      downloadJson("x.json", { ...data, exportNote: t("sec.sharing.data.exportNote") });`;
    expect(downloadJsonViolations(fixed)).toEqual([]);
  });
});
