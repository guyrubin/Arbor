/**
 * OBJ-SHELL-04 / OBJ-SHELL-05 / OBJ-ASK-02 (item 7) — no parent ever reads an
 * identifier.
 *
 * `translate()` falls back to the KEY when a string is missing. That is a
 * sensible developer default and a terrible product one: every missing key
 * ships as visible text. Three of them were live at 7208d0db — search rows
 * printed `nav.journal`, the empty bell panel printed `bell.title` /
 * `bell.empty` (the `|| "Notifications"` fallbacks behind them were dead code,
 * because the key is a truthy string), and the coach attribution chips printed
 * the model's own vocabulary (`independence adaptive skills`, `3-5y`).
 *
 * This file is the ratchet, in three parts:
 *
 *  1. SOURCE SCAN, whole tree. Every literal key handed to `t("…")` or
 *     `translate(lang, "…")` in `src/**` must resolve in BOTH dictionaries.
 *     Deliberately not a named-file list: every leak so far lived just off
 *     whatever list somebody was maintaining.
 *  2. RENDERED OUTPUT of the search catalogue — the surface that had the bug —
 *     in both languages: no label, eyebrow or keyword may have key shape.
 *     This covers the DYNAMIC key sites (`"nav.cat." + sec.id`,
 *     `"nav.tab." + tab`, `"sm.extra." + tab`, `"hm.cat." + …`) by enumerating
 *     what they actually produce rather than by reading the source.
 *  3. The coach chip helpers over their full vocabularies.
 *
 * Negative controls are explicit and named at each part: the pre-fix
 * expression is reconstructed and asserted to FAIL the same predicate.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { translate, type UiLang } from "./i18n";
import { getSearchIndex } from "./searchIndex";
import { SECTIONS } from "./navigation";
import { domainChipLabel, ageBandChipLabel } from "../components/coach/CoachAnswerCards";
import { KNOWLEDGE_AGE_BANDS } from "../knowledge/retrievalKeys";
import framework from "../framework.json";

const SRC = path.resolve(__dirname, "..");
const LANGS: UiLang[] = ["en", "he"];

/** Key shape as a PARENT would see it: dotted lowercase identifier, no spaces.
 *  `Settings › Plan` and `3–5 years` are prose; `nav.journal` is not. */
const KEY_SHAPE = /^[a-z][a-z0-9]*(?:\.[a-z0-9][\w-]*)+$/i;
const looksLikeKey = (s: string): boolean => KEY_SHAPE.test(s.trim());

function sourceFiles(): string[] {
  const out: string[] = [];
  (function walk(dir: string) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, e.name);
      if (e.isDirectory()) walk(p);
      else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) out.push(p);
    }
  })(SRC);
  return out;
}

describe("1 · every literal i18n key in src/** resolves in EN and HE", () => {
  it("source scan finds no key that would render as itself", () => {
    const viaTranslate = /translate\(\s*[^,]+,\s*"([^"]+)"/g;
    const viaT = /(?<![\w.$])t\(\s*"([^"]+)"/g;
    const missing: string[] = [];
    for (const file of sourceFiles()) {
      const src = fs.readFileSync(file, "utf8");
      for (const re of [viaTranslate, viaT]) {
        re.lastIndex = 0;
        let m: RegExpExecArray | null;
        while ((m = re.exec(src))) {
          const key = m[1];
          // Only key-shaped literals; `t(someVar)` and prose arguments are not
          // this test's business.
          if (!/^[a-zA-Z][\w.-]*$/.test(key)) continue;
          // A trailing dot means this literal is the PREFIX half of a runtime
          // concatenation (`t("nav.cat." + id)`). Those sites are pinned by the
          // inventory below and their products are enumerated in part 2.
          if (key.endsWith(".")) continue;
          for (const lang of LANGS) {
            if (translate(lang, key) === key) missing.push(`${lang}:${key} — ${path.relative(SRC, file)}`);
          }
        }
      }
    }
    expect([...new Set(missing)]).toEqual([]);
  });

  it("the runtime-concatenated key sites are a pinned inventory, and `nav.` is no longer one", () => {
    // A dynamic site cannot be checked by looking at a literal, so each one is
    // declared here and must be enumerated somewhere. `"nav." + sec.id` is the
    // site that shipped the bug; its absence from this list is the fix.
    const dynSite = /(?:translate\(\s*[^,]+,|(?<![\w.$])t\()\s*"([a-zA-Z][\w]*(?:\.[\w]+)*\.)"\s*\+/g;
    const found = new Set<string>();
    for (const file of sourceFiles()) {
      dynSite.lastIndex = 0;
      const src = fs.readFileSync(file, "utf8");
      let m: RegExpExecArray | null;
      while ((m = dynSite.exec(src))) found.add(m[1]);
    }
    expect([...found].sort()).toEqual([
      "airail.b.", "attr.market.", "hm.cat.", "nav.cat.", "nav.short.",
      "nav.sub.", "nav.tab.", "nav.title.", "noticed.domain.", "ob.lang.", "sm.extra.",
    ]);
    expect(found.has("nav.")).toBe(false);
  });

  it("negative control: the two keys the bell shipped without would have failed this scan", () => {
    // Proven by construction — these are the exact keys TopbarBell asks for.
    // Before this item neither existed, so translate() returned the key and the
    // scan above would have listed four entries (2 keys × 2 languages).
    for (const key of ["bell.title", "bell.empty", "bell.unread", "bell.unreadOne", "aria.notifications"]) {
      for (const lang of LANGS) expect(translate(lang, key)).not.toBe(key);
    }
    expect(translate("en", "bell.thisKeyDoesNotExist")).toBe("bell.thisKeyDoesNotExist");
  });
});

describe("2 · the search catalogue renders sentences, in both languages", () => {
  it("no entry label, eyebrow or keyword has key shape", () => {
    const offenders: string[] = [];
    for (const entry of getSearchIndex()) {
      for (const lang of LANGS) {
        const title = entry.title[lang];
        const sub = entry.sub[lang];
        if (looksLikeKey(title)) offenders.push(`${entry.id} title ${lang}: ${title}`);
        if (looksLikeKey(sub)) offenders.push(`${entry.id} sub ${lang}: ${sub}`);
        for (const kw of entry.keywords[lang]) if (looksLikeKey(kw)) offenders.push(`${entry.id} kw ${lang}: ${kw}`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it("negative control: the shipped `nav.` + sec.id eyebrow printed the key for three hubs", () => {
    // Pre-fix expression, verbatim from searchIndex.ts:155. `nav.<id>` happens
    // to exist for seven hubs (with the WRONG text — `nav.growth` is "Growth
    // Plans", the hub is "Growth") and to be absent for three, which is exactly
    // the class of half-right that survives review.
    const keyShaped = SECTIONS.filter((sec) => LANGS.some((lang) => looksLikeKey(translate(lang, "nav." + sec.id))));
    expect(keyShaped.map((s) => s.id).sort()).toEqual(["behaviors", "journal", "profile"]);
    // Post-fix namespace resolves to a hub name for all ten, in both languages.
    for (const sec of SECTIONS) {
      for (const lang of LANGS) expect(looksLikeKey(translate(lang, "nav.cat." + sec.id))).toBe(false);
    }
  });
});

describe("3 · coach attribution chips speak parent words", () => {
  const domains: string[] = (framework as { domains: { id: string }[] }).domains.map((d) => d.id);

  it("every framework domain resolves to a label, in both languages", () => {
    for (const id of domains) {
      for (const lang of LANGS) {
        const label = domainChipLabel(id, lang);
        expect(looksLikeKey(label)).toBe(false);
        expect(label).not.toContain("_");
        expect(label).not.toBe(id.replace(/_/g, " "));
      }
    }
  });

  it("every retrieval age band resolves to a phrase, in both languages", () => {
    for (const band of KNOWLEDGE_AGE_BANDS) {
      for (const lang of LANGS) {
        const label = ageBandChipLabel(band, lang);
        expect(looksLikeKey(label)).toBe(false);
        expect(label).not.toBe(band);
      }
    }
  });

  it("an id outside either vocabulary degrades to words, never to a raw key", () => {
    expect(domainChipLabel("some_new_domain", "en")).toBe("Some new domain");
    expect(ageBandChipLabel("13-18y", "he")).toBe(translate("he", "elev.band.rangeYears", { from: "13", to: "18" }));
    expect(ageBandChipLabel("3-4y", "en")).toBe("3–4 years");
    expect(ageBandChipLabel("toddler", "en")).toBe("toddler");
    expect(looksLikeKey(domainChipLabel("some_new_domain", "he"))).toBe(false);
  });

  it("negative control: the shipped chip expressions printed the identifiers", () => {
    // CoachAnswerCards.tsx:311-313 as shipped.
    expect("independence_adaptive_skills".replace(/_/g, " ")).toBe("independence adaptive skills");
    expect(domainChipLabel("independence_adaptive_skills", "en")).toBe("Independence");
    expect(ageBandChipLabel("3-5y", "en")).not.toBe("3-5y");
  });
});
