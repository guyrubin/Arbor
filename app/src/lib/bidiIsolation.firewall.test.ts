import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";
import { isolate } from "./i18n";

/**
 * E8 / F-10 guard — bidi isolation for interpolated names.
 *
 * The correct twin lives in lib/i18n.ts: translate() FSI/PDI-wraps every
 * RTL-bearing interpolated value, so `t("x", { name })` can never let a Hebrew
 * name reorder the surrounding English sentence (the audit's symptom: the
 * possessive "'s" rendering on the wrong visual side of "נועה").
 *
 * The bypass class is the raw template literal: `${name}'s story` composed
 * outside t(). This SOURCE-BASED guard (same style as
 * StoryTimelineTab.firewall.test.ts / clinicalFirewall.wave3.test.ts) forbids
 * possessive name-interpolation templates anywhere in src/ unless the value is
 * routed through isolate(...) — or through privacy.redact(...), whose output is
 * a structurally LTR placeholder that gets restored by restoreDeep.
 *
 * i18n.ts itself is excluded (it holds isolate() and the `{name}` dictionary
 * tokens); test files are excluded (they may assert on the banned pattern).
 */

const SRC_ROOT = path.resolve(__dirname, "..");

// `${ <expr containing a name-ish identifier> }'s` where the expression does
// NOT start with isolate( / privacy.redact(. [^{}\n] keeps the match inside a
// single interpolation hole, so nested `${isolate(x)}` templates never bleed
// into a following interpolation.
const RAW_POSSESSIVE = /\$\{(?!\s*(?:isolate|privacy\.redact)\()[^{}\n]*[nN]ame[^{}\n]*\}'s/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.(ts|tsx)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

describe("bidi isolation firewall — no raw `${...name...}'s` possessive templates outside i18n.ts", () => {
  it("the regex catches the bypass class (self-test)", () => {
    // eslint-disable-next-line no-template-curly-in-string
    for (const bad of ["`${name}'s day`", "`${childProfile.name}'s week`", "`keeps ${childName}'s story sharp`", "`${opts.name}'s progress`"]) {
      expect(bad, `guard regex must catch: ${bad}`).toMatch(RAW_POSSESSIVE);
    }
    // eslint-disable-next-line no-template-curly-in-string
    for (const ok of ["`${isolate(name)}'s day`", "`${isolate(childProfile.name)}'s week`", "`${privacy.redact(childName)}'s week`", "`${title}'s`"]) {
      expect(ok, `guard regex must allow: ${ok}`).not.toMatch(RAW_POSSESSIVE);
    }
  });

  it("isolate() FSI/PDI-wraps RTL names and leaves LTR names byte-identical", () => {
    expect(isolate("נועה")).toBe("⁨נועה⁩");
    expect(isolate("Maya")).toBe("Maya");
    expect(`${isolate("נועה")}'s week`).toBe("⁨נועה⁩'s week");
  });

  it("no source file composes a possessive on a raw interpolated name", () => {
    const files = walk(path.join(SRC_ROOT));
    expect(files.length).toBeGreaterThan(100); // the walk really covers src/
    const offenders: string[] = [];
    for (const file of files) {
      if (path.resolve(file) === path.resolve(SRC_ROOT, "lib", "i18n.ts")) continue;
      const code = stripComments(fs.readFileSync(file, "utf8"));
      const m = RAW_POSSESSIVE.exec(code);
      if (m) offenders.push(`${path.relative(SRC_ROOT, file)} → ${m[0]}`);
    }
    expect(offenders, `raw \`\${...name...}'s\` template(s) found — route the name through isolate() from lib/i18n (display-time only):\n${offenders.join("\n")}`).toEqual([]);
  });
});
