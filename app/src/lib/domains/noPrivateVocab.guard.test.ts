import { describe, it, expect } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { DOMAIN_META } from "../../practice/content";

/* B-GROWTH-26 — no component keeps a private domain vocabulary for a LABEL.
 *
 * Every domain name a parent reads comes from the one registry
 * (lib/domains/registry.ts → lib/i18nElevation/domains.ts). The four private
 * label sources that used to drift apart are banned from components/:
 *   - framework.json (English-only `label`)
 *   - DOMAIN_LABEL / MONITORED_DOMAIN_LABEL (English-only screening labels)
 *   - PLAY_DOMAIN_LABEL (the Daily Play dictionary — deleted)
 *   - DOMAIN_META[…].label / .labelKey (practice names — fields removed)
 *   - the `screen.domain.<id>` dictionary resolved by template
 * Whole-tree walk, not a named-file list (a named list has blind spots). */

const SRC = path.resolve(__dirname, "..", "..");
const COMPONENTS = path.join(SRC, "components");

function walk(dir: string, out: string[] = []): string[] {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walk(p, out);
    else if (/\.(ts|tsx)$/.test(name) && !/\.test\.(ts|tsx)$/.test(name)) out.push(p);
  }
  return out;
}

const stripComments = (src: string) =>
  src.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

type Rule = { name: string; test: (code: string) => boolean };

export const RULES: Rule[] = [
  { name: "imports framework.json", test: (c) => /from\s+["'][^"']*framework\.json["']/.test(c) },
  { name: "DOMAIN_LABEL", test: (c) => /\bDOMAIN_LABEL\b/.test(c) },
  { name: "MONITORED_DOMAIN_LABEL", test: (c) => /\bMONITORED_DOMAIN_LABEL\b/.test(c) },
  { name: "PLAY_DOMAIN_LABEL", test: (c) => /\bPLAY_DOMAIN_LABEL\b/.test(c) },
  { name: "DOMAIN_META label", test: (c) => /DOMAIN_META(?:\[[^\]]*\]|\.\w+)\.label(?:Key)?\b/.test(c) },
  { name: "screen.domain dictionary", test: (c) => /`screen\.domain\.\$\{|["']screen\.domain\.["']\s*\+/.test(c) },
  // B-LOOP-03: shelf names resolve only through lib/shelves/registry shelfLabel.
  { name: "shelf label literal", test: (c) => /["'`]elev\.shelves\./.test(c) },
  { name: "private shelf dictionary", test: (c) => /\bSHELF_LABELS?\b|\bSHELF_NAMES?\b/.test(c) },
];

function violations(code: string): string[] {
  const c = stripComments(code);
  return RULES.filter((r) => r.test(c)).map((r) => r.name);
}

describe("B-GROWTH-26 — no private domain vocabulary under components/", () => {
  const files = walk(COMPONENTS);

  it("walks the real tree", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it("no component names a domain from a private vocabulary", () => {
    const hits: string[] = [];
    for (const f of files) {
      const v = violations(readFileSync(f, "utf8"));
      if (v.length) hits.push(`${path.relative(SRC, f)}: ${v.join(", ")}`);
    }
    expect(hits).toEqual([]);
  });

  it("DOMAIN_META carries visuals only (no label field to reach for)", () => {
    for (const m of Object.values(DOMAIN_META)) expect(Object.keys(m).sort()).toEqual(["color", "soft"]);
  });

  it("the Daily Play private dictionary is gone from the playbank", () => {
    const pb = stripComments(readFileSync(path.join(SRC, "playbank", "content.ts"), "utf8"));
    expect(pb).not.toMatch(/\bPLAY_DOMAIN_LABEL\b/);
  });

  it("POSITIVE CONTROL — each pre-fix shape trips its rule", () => {
    const samples: Record<string, string> = {
      "imports framework.json": 'import framework from "../../framework.json";',
      DOMAIN_LABEL: 'import { DOMAIN_LABEL } from "../../lib/screening";',
      MONITORED_DOMAIN_LABEL: "const l = MONITORED_DOMAIN_LABEL[d];",
      PLAY_DOMAIN_LABEL: "PLAY_DOMAIN_LABEL[domain].en",
      "DOMAIN_META label": "<span>{t(DOMAIN_META[b.domain].labelKey)}</span>",
      "screen.domain dictionary": "const key = `screen.domain.${id}`;",
      "shelf label literal": '<h3>{t("elev.shelves.sleep")}</h3>',
      "private shelf dictionary": "const SHELF_LABELS = { sleep: \"Sleep\" };",
    };
    for (const [rule, code] of Object.entries(samples)) expect(violations(code), rule).toContain(rule);
    expect(violations("DOMAIN_META.speech.label")).toContain("DOMAIN_META label");
    expect(violations('t("screen.domain." + id)')).toContain("screen.domain dictionary");
    // a comment that NAMES a banned source is not a use
    expect(violations("/* was framework.json's label */ // DOMAIN_LABEL")).toEqual([]);
  });
});
