/* AI-11 — Child Memory was hard-coded English.
 *
 * This is the surface where a parent APPROVES, KEEPS or FORGETS what Arbor may
 * remember about their child: the consent surface of the memory moat. Its
 * section titles, its empty state and — worst — its three decision buttons
 * ("Approve" / "Dismiss" / "Forget") shipped as English literals, so a
 * Hebrew-reading parent was asked to make an irreversible privacy decision in
 * a language the rest of the app had promised them it would not use.
 *
 * The guard below is generic on purpose: it fails on ANY new user-visible
 * English literal on this surface, not just the ones fixed today.
 */
import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en, he } from "../../lib/i18nElevation/childmemory";

const SRC = fs.readFileSync(path.join(__dirname, "ChildMemory.tsx"), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "").replace(/\{\/\*[\s\S]*?\*\/\}/g, "");
const CODE = stripComments(SRC);

/** JSX text nodes — the `>text<` between tags, ignoring pure-whitespace and
 *  expression-only children. Two or more Latin words is the signal. */
function jsxTextLiterals(code: string): string[] {
  const out: string[] = [];
  for (const m of code.matchAll(/>([^<>{}]+)</g)) {
    const text = m[1].replace(/\s+/g, " ").trim();
    if (/[A-Za-z]{2,}\s+[A-Za-z]{2,}/.test(text)) out.push(text);
  }
  return out;
}

/** Text-bearing props given a raw string instead of a t() call. */
function literalTextProps(code: string): string[] {
  const props = ["title", "subtitle", "eyebrow", "note", "label", "retryLabel", "headline", "body", "placeholder", "aria-label"];
  const out: string[] = [];
  for (const p of props) {
    for (const m of code.matchAll(new RegExp(`\\b${p}=\\"([^\\"]{2,})\\"`, "g"))) out.push(`${p}="${m[1]}"`);
  }
  return out;
}

describe("AI-11 — no user-visible English literal survives on Child Memory", () => {
  it("FAILS WITHOUT THE CHANGE — the decision buttons and section titles are gone from the source", () => {
    for (const gone of [
      "My Child",
      "You control everything here. Nothing is shared without your approval.",
      "Pending your review (",
      '"Approved memory"',
      "No memory yet",
      "As you log moments and talk with Arbor",
      "Time-boxed · {m.retention}",
      "> Approve",
      "> Dismiss",
      "> Forget",
    ]) {
      expect(CODE.includes(gone), `still hard-coded: ${gone}`).toBe(false);
    }
  });

  it("and each is now a t() call against the registered elev.childmem.* keys", () => {
    for (const key of Object.keys(en)) {
      expect(CODE.includes(`"${key}"`), `key never used on the surface: ${key}`).toBe(true);
    }
  });

  it("GENERIC GUARD — no JSX text node and no text-bearing prop carries raw English", () => {
    expect(jsxTextLiterals(CODE)).toEqual([]);
    expect(literalTextProps(CODE)).toEqual([]);
  });

  it("NEGATIVE CONTROL — the same guard run on the PRE-CHANGE source shape catches it", () => {
    const preFix = `
      <PageHeader eyebrow="My Child" title={t("sec.mem.title")} />
      <TrustSafetyBar note="You control everything here. Nothing is shared without your approval." />
      <SectionCard title="Approved memory">
        <p className="text-sm font-bold">No memory yet</p>
      </SectionCard>
      <button onClick={onForget}><Icon name="delete" size={14} /> Forget</button>
    `;
    expect(literalTextProps(preFix).length).toBeGreaterThan(0);
    expect(jsxTextLiterals(preFix)).toContain("No memory yet");
    // …and the live source is clean under the identical matchers.
    expect(literalTextProps(CODE)).toEqual([]);
  });
});

describe("AI-11 — the Hebrew half actually exists", () => {
  it("en and he carry the same keys, and he is in Hebrew script", () => {
    expect(Object.keys(he).sort()).toEqual(Object.keys(en).sort());
    for (const [k, v] of Object.entries(he)) {
      expect(/[֐-׿]/.test(v), `he["${k}"] carries no Hebrew: "${v}"`).toBe(true);
    }
  });

  it("the three decision verbs are translated, and stay unambiguous", () => {
    expect(he["elev.childmem.action.approve"]).toBeTruthy();
    expect(he["elev.childmem.action.dismiss"]).toBeTruthy();
    expect(he["elev.childmem.action.forget"]).toBeTruthy();
    // "forget" must not read as "hide" — the three verbs stay distinct.
    const verbs = new Set([
      he["elev.childmem.action.approve"],
      he["elev.childmem.action.dismiss"],
      he["elev.childmem.action.forget"],
    ]);
    expect(verbs.size).toBe(3);
  });
});
