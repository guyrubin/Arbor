/**
 * B-SHELL-45 — a truncated heading keeps its one line.
 *
 * `.arbor-app h1–h3 { text-wrap: balance }` sat in an unlayered rule. `text-wrap`
 * is a shorthand that also sets `text-wrap-mode: wrap`, and an unlayered rule
 * outranks every layered Tailwind utility, so a heading carrying `truncate`
 * (`white-space: nowrap` in the utilities layer) wrapped again: the sharing
 * roster email (TrustedSharing.tsx) broke into three or four pieces at 375.
 *
 * jsdom is not in this repo, so this is the cascade itself, evaluated: every
 * index.css rule that sets a wrap property is matched against the roster
 * heading as it is written in the source, under `html[lang=en]` and
 * `html[lang=he][dir=rtl]`. Negative controls: the pre-change rule matches the
 * roster heading (the evaluator sees the defect), and a plain h1/h2/h3 still
 * takes `text-wrap: balance` at the old rule's specificity (no other heading
 * changes its wrap).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(here, rel), "utf8").replace(/\r\n/g, "\n");
const css = read("index.css");
const sharing = read("components/sections/TrustedSharing.tsx");

type El = { tag: string; classes: string[]; attrs: Record<string, string> };
type Rule = { selector: string; body: string };
type Spec = [number, number, number];

/** Innermost `selector { declarations }` blocks, inside @media/@layer too. */
function rules(source: string): Rule[] {
  const text = source.replace(/\/\*[\s\S]*?\*\//g, "");
  const out: Rule[] = [];
  for (const m of text.matchAll(/([^{};]+)\{([^{}]*)\}/g)) out.push({ selector: m[1].trim(), body: m[2] });
  return out;
}
const WRAP = /(?:^|;)\s*(text-wrap|text-wrap-mode|white-space)\s*:\s*([^;]+)/g;
const wrapDecls = (body: string) => [...body.matchAll(WRAP)].map((m) => `${m[1]}: ${m[2].trim()}`);

/** Split on `sep` at parenthesis depth 0. */
function splitTop(s: string, sep: (ch: string) => boolean): string[] {
  const parts: string[] = []; let depth = 0; let cur = "";
  for (const ch of s) {
    if (ch === "(" || ch === "[") depth++;
    if (ch === ")" || ch === "]") depth--;
    if (depth === 0 && sep(ch)) { parts.push(cur); cur = ""; } else cur += ch;
  }
  parts.push(cur);
  return parts.map((p) => p.trim()).filter(Boolean);
}
const list = (s: string) => splitTop(s, (ch) => ch === ",");

/** One compound selector against one element: its specificity, and whether it matches. */
function evaluate(sel: string, el: El): { spec: Spec; ok: boolean } {
  let i = 0; let spec: Spec = [0, 0, 0]; let ok = true;
  const ident = () => { const m = /^(?:\\.|[\w-])+/.exec(sel.slice(i)); if (!m) throw new Error(`unsupported selector: ${sel}`); i += m[0].length; return m[0].replace(/\\(.)/g, "$1"); };
  const add = (s: Spec) => { spec = [spec[0] + s[0], spec[1] + s[1], spec[2] + s[2]]; };
  if (sel[0] === "*") i++;
  else if (/[\w-]/.test(sel[0] ?? "")) { const tag = ident(); add([0, 0, 1]); ok &&= tag === el.tag; }
  while (i < sel.length) {
    const ch = sel[i];
    if (ch === ".") { i++; const c = ident(); add([0, 1, 0]); ok &&= el.classes.includes(c); continue; }
    if (ch === "#") { i++; ident(); add([1, 0, 0]); ok = false; continue; }
    if (ch === "[") {
      const end = sel.indexOf("]", i); const m = /^\[([\w-]+)(?:="?([^"\]]*)"?)?\]$/.exec(sel.slice(i, end + 1));
      if (!m) throw new Error(`unsupported selector: ${sel}`);
      i = end + 1; add([0, 1, 0]); ok &&= m[1] in el.attrs && (m[2] === undefined || el.attrs[m[1]] === m[2]); continue;
    }
    if (ch === ":") {
      const element = sel[i + 1] === ":"; i += element ? 2 : 1;
      const name = ident();
      let arg: string | null = null;
      if (sel[i] === "(") { let depth = 0; const start = i; do { if (sel[i] === "(") depth++; if (sel[i] === ")") depth--; i++; } while (depth > 0); arg = sel.slice(start + 1, i - 1); }
      if (element) { add([0, 0, 1]); ok = false; continue; } // ::before etc. style a pseudo-element, not the heading's text
      if (arg !== null && ["where", "is", "not"].includes(name)) {
        const args = list(arg).map((a) => evaluate(a, el));
        // :where() weighs nothing; :is() and :not() weigh their most specific argument.
        if (name !== "where") add(args.reduce<Spec>((m, a) => (cmp(a.spec, m) > 0 ? a.spec : m), [0, 0, 0]));
        ok &&= name === "not" ? args.every((a) => !a.ok) : args.some((a) => a.ok);
        continue;
      }
      add([0, 1, 0]); ok = false; // :hover, :focus, structural states: not the heading at rest
      continue;
    }
    throw new Error(`unsupported selector: ${sel}`);
  }
  return { spec, ok };
}
const compound = (sel: string, el: El): Spec | null => { const r = evaluate(sel, el); return r.ok ? r.spec : null; };
const cmp = (a: Spec, b: Spec) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];

/** A full selector (descendant and child combinators) against the target at the end of `chain`. */
function matches(selector: string, chain: El[]): Spec | null {
  const tokens = selector.replace(/\s*>\s*/g, " > ").trim();
  if (/[+~]/.test(tokens.replace(/\([^)]*\)/g, ""))) throw new Error(`unsupported combinator: ${selector}`);
  const parts = splitTop(tokens, (ch) => ch === " ");
  const compounds: { sel: string; child: boolean }[] = [];
  for (let k = 0; k < parts.length; k++) if (parts[k] !== ">") compounds.push({ sel: parts[k], child: parts[k - 1] === ">" });
  const last = compounds.length - 1;
  const own = compound(compounds[last].sel, chain[chain.length - 1]);
  if (!own) return null;
  let spec = own;
  const walk = (ci: number, ei: number): Spec | null => {
    if (ci < 0) return [0, 0, 0];
    const lo = compounds[ci + 1].child ? ei : 0;
    for (let e = ei; e >= lo; e--) {
      const s = compound(compounds[ci].sel, chain[e]);
      if (!s) continue;
      const rest = walk(ci - 1, e - 1);
      if (rest) return [s[0] + rest[0], s[1] + rest[1], s[2] + rest[2]];
    }
    return null;
  };
  const up = walk(last - 1, chain.length - 2);
  if (!up) return null;
  spec = [spec[0] + up[0], spec[1] + up[1], spec[2] + up[2]];
  return spec;
}

const page = (lang: "en" | "he"): El[] => [
  { tag: "html", classes: [], attrs: lang === "he" ? { lang: "he", dir: "rtl" } : { lang: "en", dir: "ltr" } },
  { tag: "body", classes: [], attrs: {} },
  { tag: "div", classes: ["arbor-app", "arbor-parent"], attrs: {} },
  { tag: "div", classes: ["flex-1", "min-w-0"], attrs: {} },
];
const heading = (tag: string, className: string): El => ({ tag, classes: className.split(/\s+/).filter(Boolean), attrs: {} });
/** The wrap declarations that reach `el`, with the selector and specificity that carry each. */
function wrapRulesFor(source: string, el: El, lang: "en" | "he") {
  const hits: { selector: string; spec: Spec; decls: string[] }[] = [];
  for (const rule of rules(source)) {
    const decls = wrapDecls(rule.body);
    if (decls.length === 0) continue;
    for (const sel of list(rule.selector)) {
      const spec = matches(sel, [...page(lang), el]);
      if (spec) hits.push({ selector: sel, spec, decls });
    }
  }
  return hits;
}

const roster = /<div className="([^"]*)">\s*<h3 className="([^"]*)"[^>]*>\{g\.recipientEmail\}<\/h3>/.exec(sharing);

describe("B-SHELL-45 · a truncated heading keeps its one line", () => {
  it("the sharing roster email is a truncated h3 in a shrinkable flex cell (the ellipsis has an edge to cut at)", () => {
    expect(roster).toBeTruthy();
    expect(roster![1].split(/\s+/)).toEqual(expect.arrayContaining(["flex-1", "min-w-0"]));
    expect(roster![2].split(/\s+/)).toContain("truncate");
  });

  it.each(["en", "he"] as const)("%s: no index.css rule turns wrapping back on for the roster email", (lang) => {
    expect(wrapRulesFor(css, heading("h3", roster![2]), lang)).toEqual([]);
  });

  it.each(["en", "he"] as const)("%s negative control: the pre-change rule reached the roster email", (lang) => {
    const before = ".arbor-app h1,\n.arbor-app h2,\n.arbor-app h3 {\n  line-height: 1.18;\n  text-wrap: balance;\n}";
    expect(wrapRulesFor(before, heading("h3", roster![2]), lang)).toEqual([
      { selector: ".arbor-app h3", spec: [0, 1, 1], decls: ["text-wrap: balance"] },
    ]);
  });

  it.each(["en", "he"] as const)("%s: every other h1–h3 still balances, at the old rule's specificity", (lang) => {
    for (const tag of ["h1", "h2", "h3"]) {
      for (const className of ["", "arbor-type-title", "text-base font-bold", "arbor-type-hero line-clamp-2"]) {
        expect(wrapRulesFor(css, heading(tag, className), lang), `${tag}.${className}`).toEqual([
          { selector: `.arbor-app ${tag}:where(:not(.truncate, .whitespace-nowrap, .text-nowrap))`, spec: [0, 1, 1], decls: ["text-wrap: balance"] },
        ]);
      }
    }
  });

  it("every h1–h3 written with a one-line utility in src is left out of balance", () => {
    const files: string[] = [];
    const walk = (dir: string) => { for (const name of readdirSync(dir)) { const p = path.join(dir, name); if (statSync(p).isDirectory()) walk(p); else if (p.endsWith(".tsx") && !p.includes(".test.")) files.push(p); } };
    walk(path.join(here, "components"));
    const oneLine = [...files.flatMap((f) => [...readFileSync(f, "utf8").matchAll(/<(h[1-3])\b[^>]*?className="([^"]*\b(?:truncate|whitespace-nowrap|text-nowrap)\b[^"]*)"/g)].map((m) => ({ file: path.relative(here, f), tag: m[1], className: m[2] })))];
    expect(oneLine.length).toBeGreaterThan(0);
    for (const h of oneLine) for (const lang of ["en", "he"] as const) expect(wrapRulesFor(css, heading(h.tag, h.className), lang), `${h.file} ${h.tag}`).toEqual([]);
  });
});
