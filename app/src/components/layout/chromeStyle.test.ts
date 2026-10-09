import { describe, expect, it } from "vitest";
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

/**
 * B-INF-09 (source half) — the chrome meets the pages' weight limit: no upper
 * case, no letter-spaced labels, no gradient backgrounds, no second icon set,
 * no text under 12 px, no extra-bold weights.
 *
 * It WALKS the chrome folders (never a named-file list — every past leak lived
 * in a file a list forgot) plus the two profile files mounted in the chrome.
 * `chromeStyle.baseline.json` is shrink-only: a file may only lose hits; a file
 * absent from the baseline must have none. Regenerate it only after removing
 * hits: `CHROME_BASELINE_WRITE=1 npx vitest run src/components/layout/chromeStyle.test.ts`.
 * The rendered half (chrome weight in the sweep) is the B-INF-09 residue.
 */

const SRC = path.resolve(__dirname, "../..");
const FOLDERS = ["components/layout", "components/places", "components/search", "components/capture"];
const EXTRA = ["components/profile/ProfileSwitcher.tsx", "components/profile/FamilyGlanceCard.tsx"];
const BASELINE = path.join(__dirname, "chromeStyle.baseline.json");

export const RULES: Record<string, RegExp> = {
  uppercase: /\buppercase\b/g,
  letterSpacedLabel: /\btracking-wider?\b/g,
  gradientBackground: /background(?:Image)?\s*[:=]\s*["'`][^"'`]*linear-gradient\(/g,
  lucide: /from\s+["']lucide-react["']/g,
  under12px: /text-\[(?:[0-9]|1[01])(?:\.\d+)?px\]|fontSize:\s*["']?(?:[0-9]|1[01])(?:\.\d+)?(?:px)?["']?\s*[,}]/g,
  extraBold: /\bfont-(?:extrabold|black)\b|fontWeight:\s*["']?(?:800|900)\b/g,
};

export function countHits(source: string): Record<string, number> {
  const out: Record<string, number> = {};
  for (const [rule, re] of Object.entries(RULES)) {
    const n = (source.match(re) ?? []).length;
    if (n) out[rule] = n;
  }
  return out;
}

function walk(dir: string): string[] {
  if (!existsSync(dir)) return [];
  return readdirSync(dir).flatMap((name) => {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) return walk(p);
    return /\.(tsx?|css)$/.test(name) && !/\.test\./.test(name) ? [p] : [];
  });
}

function scan(): Record<string, Record<string, number>> {
  const files = [...FOLDERS.flatMap((f) => walk(path.join(SRC, f))), ...EXTRA.map((f) => path.join(SRC, f)).filter(existsSync)];
  const out: Record<string, Record<string, number>> = {};
  for (const f of files) {
    const hits = countHits(readFileSync(f, "utf8"));
    if (Object.keys(hits).length) out[path.relative(SRC, f).replace(/\\/g, "/")] = hits;
  }
  return out;
}

describe("B-INF-09 chrome style guard (source)", () => {
  it("the matchers are not vacuous", () => {
    expect(countHits('<p className="text-[10px] font-black uppercase tracking-wider" />')).toEqual({ uppercase: 1, letterSpacedLabel: 1, under12px: 1, extraBold: 1 });
    expect(countHits('style={{ background: "linear-gradient(120deg,#fff,#000)", fontSize: "9px", fontWeight: 800 }}')).toEqual({ gradientBackground: 1, under12px: 1, extraBold: 1 });
    expect(countHits('import { X } from "lucide-react";')).toEqual({ lucide: 1 });
    expect(countHits('<p className="text-xs font-semibold" style={{ fontSize: 12 }} />')).toEqual({});
  });

  it("no chrome file gains a hit (baseline is shrink-only)", () => {
    const now = scan();
    if (process.env.CHROME_BASELINE_WRITE === "1") {
      writeFileSync(BASELINE, JSON.stringify(now, null, 2) + "\n");
    }
    const base = JSON.parse(readFileSync(BASELINE, "utf8")) as Record<string, Record<string, number>>;
    const grown: string[] = [];
    for (const [file, hits] of Object.entries(now)) {
      for (const [rule, n] of Object.entries(hits)) {
        const allowed = base[file]?.[rule] ?? 0;
        if (n > allowed) grown.push(`${file}: ${rule} ${allowed} -> ${n}`);
      }
    }
    expect(grown).toEqual([]);
  });

  it("files fixed in the B-INF-09 slice stay at zero", () => {
    const now = scan();
    for (const f of ["components/search/SearchModal.tsx", "components/search/TopbarSearch.tsx", "components/layout/KidModeButton.tsx"]) {
      expect(now[f] ?? {}).toEqual({});
    }
  });
});
