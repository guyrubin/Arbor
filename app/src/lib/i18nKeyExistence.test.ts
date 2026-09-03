import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en } from "./i18n";
import { elevationEn } from "./i18nElevation";

/**
 * W4 (store-polish audit 2026-08-28) — kills the dead-fallback footgun for good.
 *
 * `t("some.key") || "Fallback"` is dead code: translate() falls back
 * en → RAW KEY, never to "", so a missing key renders as the literal key on
 * screen in BOTH languages (bell.title/bell.empty shipped that way). This
 * guard makes a missing key a hard build failure instead: every string
 * LITERAL passed to t("...") in src/components must exist in the effective
 * English dictionary ({...elevationEn, ...en} — the same composition
 * translate() reads). Dynamic-prefix calls (t("nav.tab." + id)) are checked
 * more loosely: at least one dictionary key must carry the literal prefix.
 * Fully-dynamic calls (t(someVar), t(`a.${b}`)) are out of scope here — the
 * en/he parity test in i18n.test.ts still guards their dictionaries.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(SRC_ROOT, "components");
const EN: Record<string, string> = { ...elevationEn, ...en };
const EN_KEYS = Object.keys(EN);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Drop /* */ and // comments so prose mentioning t("...") can't trip the scan.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

describe("every t() string literal in components/ resolves to a real EN key (W4)", () => {
  it("no literal t() key is missing from the English dictionary", () => {
    const offenders: string[] = [];
    for (const file of walk(COMPONENTS)) {
      const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
      const code = stripComments(fs.readFileSync(file, "utf8"));
      // `t("key")`, `t("key", {...})`, `t("prefix." + id)` — not `x.t(...)`,
      // not `format(...)`, not template literals (dynamic, out of scope).
      for (const m of code.matchAll(/(?<![A-Za-z0-9_$.])t\(\s*"([^"]+)"\s*[,)+]/g)) {
        const key = m[1];
        if (key.endsWith(".")) {
          // Dynamic-prefix call: the concatenated literal must be a live namespace.
          if (!EN_KEYS.some((k) => k.startsWith(key))) offenders.push(`${rel} → prefix "${key}" matches no key`);
        } else if (!(key in EN)) {
          offenders.push(`${rel} → "${key}"`);
        }
      }
    }
    expect(
      offenders,
      `t() called with key(s) missing from lib/i18n.ts — they would render as raw keys on screen:\n${offenders.join("\n")}`
    ).toEqual([]);
  });
});
