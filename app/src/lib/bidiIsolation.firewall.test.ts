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
 * The bypass classes are copy composed outside t():
 *  1. the raw template literal — `${name}'s story`;
 *  2. (N5) the JSX-text form — `{name}&apos;s rewards` / `{first}'s profile`,
 *     where the possessive lives in JSX text right after an expression hole.
 * This SOURCE-BASED guard (same style as StoryTimelineTab.firewall.test.ts /
 * clinicalFirewall.wave3.test.ts) forbids possessive name-interpolation in
 * either form anywhere in src/ unless the value is routed through
 * isolate(...) — or through privacy.redact(...), whose output is a
 * structurally LTR placeholder that gets restored by restoreDeep.
 *
 * For the JSX form, double-quoted and backtick string literals are stripped
 * first: `"...{name}'s day"` inside a string is a DICTIONARY TOKEN (i18n /
 * i18nElevation / routines / dailyPlan maps), interpolated by an accessor
 * that itself isolates — translate(), statesText()-style helpers, or an
 * isolate()-wrapped .replace at the call site. JSX text is not a string
 * literal, so real offenders survive the stripping.
 *
 * i18n.ts itself is excluded (it holds the isolate re-export and the `{name}`
 * dictionary tokens); test files are excluded (they may assert on the banned
 * pattern).
 */

const SRC_ROOT = path.resolve(__dirname, "..");

// `${ <expr containing a name-ish identifier> }'s` where the expression does
// NOT start with isolate( / privacy.redact(. [^{}\n] keeps the match inside a
// single interpolation hole, so nested `${isolate(x)}` templates never bleed
// into a following interpolation. N5: `first` joined the name-ish class (the
// codebase's conventional first-name variable — `${first}'s` is the same bug).
const RAW_POSSESSIVE = /\$\{(?!\s*(?:isolate|privacy\.redact)\()[^{}\n]*(?:[nN]ame|first)[^{}\n]*\}'s/;

// N5: the JSX-text twin — `{name}&apos;s` / `{name}'s` / `{name}'s` (the three
// apostrophe spellings that appear in JSX text). Applied AFTER string-literal
// stripping, so dictionary tokens inside "..." / `...` never match; the
// template-literal form stays covered by RAW_POSSESSIVE on unstripped source.
const JSX_RAW_POSSESSIVE = /\{(?!\s*(?:isolate|privacy\.redact)\()[^{}\n]*(?:[nN]ame|first)[^{}\n]*\}(?:&apos;|['’])s/;

function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/(^|\s)\/\/.*$/gm, "");
}

// Strip backtick template literals and double-quoted strings (this codebase's
// string style) so the JSX check only sees actual JSX/text positions. Single
// quotes are deliberately NOT stripped — JSX text legitimately contains bare
// apostrophes, and a naive '...' strip would swallow real offenders.
function stripQuotedStrings(src: string): string {
  return src
    .replace(/`(?:[^`\\]|\\.)*`/g, "``")
    .replace(/"(?:[^"\\\n]|\\.)*"/g, '""');
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
    for (const bad of ["`${name}'s day`", "`${childProfile.name}'s week`", "`keeps ${childName}'s story sharp`", "`${opts.name}'s progress`", "`${first}'s development picture`"]) {
      expect(bad, `guard regex must catch: ${bad}`).toMatch(RAW_POSSESSIVE);
    }
    // eslint-disable-next-line no-template-curly-in-string
    for (const ok of ["`${isolate(name)}'s day`", "`${isolate(childProfile.name)}'s week`", "`${privacy.redact(childName)}'s week`", "`${title}'s`", "`${isolate(first)}'s story`"]) {
      expect(ok, `guard regex must allow: ${ok}`).not.toMatch(RAW_POSSESSIVE);
    }
  });

  it("the JSX regex catches the pre-fix JSX possessive class (self-test)", () => {
    // The exact shapes N5 removed from the tree.
    for (const bad of [
      "{name}&apos;s rewards",
      "Play a world to earn {hero.name}&apos;s first gear.",
      "Create {childName}&apos;s avatar",
      "Export {activeChild.name}&apos;s data (JSON)",
      "Nothing from {first}'s profile is shared",
      "reads {first}’s profile",
    ]) {
      expect(bad, `JSX guard regex must catch: ${bad}`).toMatch(JSX_RAW_POSSESSIVE);
    }
    for (const ok of [
      "{isolate(name)}&apos;s rewards",
      "Create {isolate(childName)}&apos;s avatar",
      "Nothing from {isolate(first)}'s profile",
      "{privacy.redact(childName)}&apos;s week",
      "{heroPossessive} first gear", // possessive pre-composed with isolate()
      "{title}&apos;s", // not a name-ish identifier
    ]) {
      expect(ok, `JSX guard regex must allow: ${ok}`).not.toMatch(JSX_RAW_POSSESSIVE);
    }
    // Dictionary tokens live inside double-quoted / backtick strings — the
    // stripping pass removes them before the JSX regex runs.
    const dict = 'const en = { "rhythm.title": "How {name}\'s day tends to go" };';
    expect(stripQuotedStrings(dict)).not.toMatch(JSX_RAW_POSSESSIVE);
    expect(dict, "un-stripped dictionary token should match (proves stripping is load-bearing)").toMatch(JSX_RAW_POSSESSIVE);
  });

  it("isolate() FSI/PDI-wraps RTL names and leaves LTR names byte-identical", () => {
    expect(isolate("נועה")).toBe("⁨נועה⁩");
    expect(isolate("Maya")).toBe("Maya");
    expect(`${isolate("נועה")}'s week`).toBe("⁨נועה⁩'s week");
  });

  it("no source file composes a possessive on a raw interpolated name (template or JSX form)", () => {
    const files = walk(path.join(SRC_ROOT));
    expect(files.length).toBeGreaterThan(100); // the walk really covers src/
    const offenders: string[] = [];
    for (const file of files) {
      if (path.resolve(file) === path.resolve(SRC_ROOT, "lib", "i18n.ts")) continue;
      const code = stripComments(fs.readFileSync(file, "utf8"));
      const m = RAW_POSSESSIVE.exec(code);
      if (m) offenders.push(`${path.relative(SRC_ROOT, file)} → ${m[0]}`);
      const jsx = JSX_RAW_POSSESSIVE.exec(stripQuotedStrings(code));
      if (jsx) offenders.push(`${path.relative(SRC_ROOT, file)} → ${jsx[0]} (JSX form)`);
    }
    expect(offenders, `raw possessive on an interpolated name found — route the name through isolate() from lib/i18n (display-time only):\n${offenders.join("\n")}`).toEqual([]);
  });
});
