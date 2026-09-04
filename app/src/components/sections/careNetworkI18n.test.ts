/**
 * LC-16 — the Care Network directory screen speaks the parent's language.
 *
 * WHAT SHIPPED BEFORE THIS TEST
 * FindProfessional.tsx called t() five times and hard-coded everything else in
 * English: the empty state, the verification promise, the filter chips, the
 * specialty chips and the whole consult-request form. Arbor ships EN and HE
 * with full RTL, so half the user base met an English wall on the screen a
 * worried parent reaches. This file is the ratchet that keeps it fixed.
 *
 * THE TRAP THIS FILE ALSO GUARDS
 * The old matcher switched on the ENGLISH FILTER LABEL. Translating the labels
 * naively would have left every chip visibly selected and matching nothing on
 * a Hebrew UI — a worse defect than the untranslated wall. The filter's
 * identity is now a CareFilterId; the label is display-only. `legacyMatches`
 * below is the pre-change matcher, kept verbatim as the negative control: fed
 * a Hebrew label it falls through to `default: return true` and stops
 * filtering, and the tests prove it.
 *
 * WHAT IS DELIBERATELY NOT HERE
 * No professional. LC-16's directory is empty in production and stays empty
 * until a human vets real practitioners. The fixtures below are obviously
 * synthetic records used ONLY to exercise the matcher — they are never
 * shipped, never seeded, and the tests assert that both the app's fallback and
 * ARBOR_PROFESSIONALS remain empty arrays.
 *
 * SCAN DISCIPLINE (house rule)
 * Every source scan asserts the bytes it read are real and non-empty, and
 * every matcher is negative-controlled against the verbatim pre-change source
 * so a rule that has stopped matching cannot pass silently.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en, he } from "../../lib/i18nElevation/careNetwork";
import { elevationEn, elevationHe } from "../../lib/i18nElevation";
import { translate } from "../../lib/i18n";
import { ARBOR_PROFESSIONALS, type Professional } from "../../services/professionals";
import { CARE_FILTERS, matchesFilter, type CareFilterId } from "./FindProfessional";

const here = path.dirname(fileURLToPath(import.meta.url));
const SOURCE = readFileSync(path.join(here, "FindProfessional.tsx"), "utf8").replace(/\r\n/g, "\n");

/* ═══════════════════════════════════════════════════════════════════════════
   Synthetic matcher fixtures. NOT people, NOT seed data, NOT reachable from
   the app — three records shaped like the API contract so each filter has
   something to say yes and no to.
   ═══════════════════════════════════════════════════════════════════════════ */
const record = (over: Partial<Professional>): Professional => ({
  id: "fixture",
  name: "Fixture Record",
  role: "Fixture Role",
  creds: "",
  langs: "English",
  city: "Fixture City",
  mode: "In-person",
  ages: "7–12",
  approach: "",
  handles: "",
  price: "",
  rating: 0,
  verified: false,
  tone: "sky",
  ...over,
});

const YES: Record<CareFilterId, Professional> = {
  verified: record({ id: "a", verified: true }),
  online: record({ id: "b", mode: "Online" }),
  in_person: record({ id: "c", mode: "In-person" }),
  hebrew: record({ id: "d", langs: "Hebrew, English" }),
  english: record({ id: "e", langs: "English" }),
  ages_3_6: record({ id: "f", ages: "2–7" }),
  insurance: record({ id: "g" }),
};

/** `insurance` is an optional extension the matcher reads off the record. */
const withInsurance = (p: Professional, insurance: boolean): Professional =>
  ({ ...p, insurance }) as Professional;

const NO: Record<CareFilterId, Professional> = {
  verified: record({ id: "h", verified: false }),
  online: record({ id: "i", mode: "In-person", city: "Fixture City" }),
  in_person: record({ id: "j", mode: "Online" }),
  hebrew: record({ id: "k", langs: "English" }),
  english: record({ id: "l", langs: "Hebrew" }),
  ages_3_6: record({ id: "m", ages: "9–14" }),
  insurance: withInsurance(record({ id: "n" }), false),
};

/** The PRE-CHANGE matcher, verbatim: it switched on the English label. */
function legacyMatches(p: Professional, f: string): boolean {
  switch (f) {
    case "Verified by Arbor": return !!p.verified;
    case "Online": return /online|remote/i.test(`${p.mode} ${p.city}`);
    case "In-person": return /in.?person/i.test(p.mode);
    case "Hebrew": return /hebrew/i.test(p.langs);
    case "English": return /english/i.test(p.langs);
    case "Ages 3–6": return agesOverlapLegacy(p.ages, 3, 6);
    case "Insurance accepted": return (p as { insurance?: boolean }).insurance !== false;
    default: return true;
  }
}
function agesOverlapLegacy(ages: string, lo: number, hi: number): boolean {
  const m = ages.match(/(\d+)\s*[–-]\s*(\d+)/);
  if (!m) return true;
  return Number(m[1]) <= hi && Number(m[2]) >= lo;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Registration — an unregistered module is invisible to the app.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("registration", () => {
  it("every key reaches the merged Elevation dictionaries, EN and HE", () => {
    expect(Object.keys(en).length).toBeGreaterThan(40);
    for (const key of Object.keys(en)) {
      expect(elevationEn[key], `${key} missing from elevationEn`).toBeTruthy();
      expect(elevationHe[key], `${key} missing from elevationHe`).toBeTruthy();
    }
  });

  it("EN and HE cover exactly the same keys", () => {
    expect(Object.keys(en).sort()).toEqual(Object.keys(he).sort());
  });

  it("every key is namespaced elev.* (a bare key would silently lose the merge)", () => {
    for (const key of Object.keys(en)) expect(key.startsWith("elev.careNet.")).toBe(true);
  });

  it("t() resolves every key in BOTH languages, and never falls back to the key", () => {
    for (const key of Object.keys(en)) {
      expect(translate("en", key)).toBe(en[key]);
      expect(translate("he", key)).toBe(he[key]);
      expect(translate("he", key)).not.toBe(key);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The Hebrew is real Hebrew — not an English string copied across.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("the Hebrew half exists", () => {
  const HEBREW = /[\u0590-\u05FF]/;

  it("every Hebrew value contains Hebrew letters and differs from the English", () => {
    for (const key of Object.keys(en)) {
      expect(HEBREW.test(he[key]), `${key} has no Hebrew letters: ${he[key]}`).toBe(true);
      expect(he[key], `${key} was left in English`).not.toBe(en[key]);
    }
  });

  it("interpolation placeholders survive the transcreation", () => {
    for (const key of Object.keys(en)) {
      const holes = (s: string) => (s.match(/\{[a-zA-Z]+\}/g) ?? []).sort();
      expect(holes(he[key]), `${key} lost or invented a placeholder`).toEqual(holes(en[key]));
    }
  });

  it("the Hebrew age range is bidi-isolated so '3–6' cannot render as '6–3'", () => {
    // U+2066 LRI … U+2069 PDI around the numeric range.
    expect(he["elev.careNet.filter.ages36"]).toContain("\u2066");
    expect(he["elev.careNet.filter.ages36"]).toContain("\u2069");
    const inner = he["elev.careNet.filter.ages36"].split("\u2066")[1]?.split("\u2069")[0];
    expect(inner).toBe("3–6");
    // NEGATIVE CONTROL: the un-isolated form is what this guard exists to reject.
    expect("גילאי 3–6").not.toContain("\u2066");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The empty state keeps its three promises — in both languages.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("the empty-state promise is preserved, not softened", () => {
  it("English still says: opening soon · nobody until reviewed · a real alternative", () => {
    expect(en["elev.careNet.empty.title"]).toBe("The verified directory is opening soon.");
    expect(en["elev.careNet.empty.body"]).toContain("only show professionals after their identity and credentials have been reviewed");
    expect(en["elev.careNet.empty.body"]).toContain("prepare a private summary for someone you already trust");
    expect(en["elev.careNet.footer.verification"]).toContain("No profile appears here until Arbor has completed its verification process");
  });

  it("Hebrew carries the same three promises", () => {
    // 1. opening soon
    expect(he["elev.careNet.empty.title"]).toContain("ייפתח בקרוב");
    // 2. nobody is shown until identity AND credentials are reviewed
    expect(he["elev.careNet.empty.body"]).toContain("הזהות");
    expect(he["elev.careNet.empty.body"]).toContain("ההסמכות");
    expect(he["elev.careNet.empty.body"]).toContain("רק אחרי");
    // 3. a real alternative right now
    expect(he["elev.careNet.empty.body"]).toContain("סיכום פרטי");
    // and the standing verification line
    expect(he["elev.careNet.footer.verification"]).toContain("תהליך האימות");
  });

  it("no string claims a professional already exists", () => {
    const BANNED_EN = [
      "available now",
      "browse our",
      "our professionals",
      "book now",
      "specialists near you",
      "matched with",
    ];
    for (const key of Object.keys(en)) {
      for (const phrase of BANNED_EN) {
        expect(en[key].toLowerCase(), `${key} implies a live directory`).not.toContain(phrase);
      }
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The directory stays empty. No practitioner is invented anywhere.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("no professional data is invented", () => {
  it("the screen's offline fallback is an empty array", () => {
    expect(SOURCE).toContain("const FALLBACK: Professional[] = [];");
    expect(SOURCE).not.toMatch(/const FALLBACK: Professional\[\] = \[\s*\{/);
  });

  it("the shipped provider list is still empty", () => {
    expect(ARBOR_PROFESSIONALS).toEqual([]);
  });

  it("the string module names no practitioner and no credential body", () => {
    const all = [...Object.values(en), ...Object.values(he)].join(" ");
    for (const forbidden of ["Dr.", "PhD", "M.D.", "ד\"ר", "MSc", "@"]) {
      expect(all, `careNetwork.ts must not name a practitioner (${forbidden})`).not.toContain(forbidden);
    }
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   Filters: identity is the id, the label is only what a parent reads.
   ═══════════════════════════════════════════════════════════════════════════ */
describe("filters match on a stable id, in both languages", () => {
  it("the filter set is the seven the screen ships", () => {
    expect(CARE_FILTERS.map((f) => f.id)).toEqual([
      "verified", "online", "in_person", "hebrew", "english", "ages_3_6", "insurance",
    ]);
  });

  it("every filter label is genuinely different in Hebrew (so the trap is live)", () => {
    for (const f of CARE_FILTERS) {
      const enLabel = translate("en", f.labelKey);
      const heLabel = translate("he", f.labelKey);
      expect(enLabel, `${f.id} has no English label`).toBeTruthy();
      expect(heLabel, `${f.id} was never translated`).not.toBe(enLabel);
    }
  });

  it("every filter matches the same records whichever language is displayed", () => {
    for (const f of CARE_FILTERS) {
      for (const lang of ["en", "he"] as const) {
        // Resolving the label is what a language switch actually does.
        expect(translate(lang, f.labelKey), `${f.id} label in ${lang}`).toBeTruthy();
        expect(matchesFilter(YES[f.id], f.id), `${f.id} should match its YES fixture in ${lang}`).toBe(true);
        expect(matchesFilter(NO[f.id], f.id), `${f.id} should reject its NO fixture in ${lang}`).toBe(false);
      }
    }
  });

  it("NEGATIVE CONTROL: the label-switching matcher stops filtering in Hebrew", () => {
    const broken: string[] = [];
    for (const f of CARE_FILTERS) {
      const heLabel = translate("he", f.labelKey);
      // Fed the translated label the old switch falls through to `default: true`
      // — every record passes, including the one the filter must reject.
      if (legacyMatches(NO[f.id], heLabel) === true) broken.push(f.id);
    }
    expect(broken, "the pre-change matcher must be shown to break under Hebrew").toEqual(
      CARE_FILTERS.map((f) => f.id),
    );
    // ...and the same legacy matcher still worked on the English labels, which
    // is exactly why the defect would have shipped unnoticed.
    for (const f of CARE_FILTERS) {
      expect(legacyMatches(NO[f.id], translate("en", f.labelKey)), `${f.id} EN`).toBe(false);
    }
  });

  it("the selected-filter state holds ids, never labels", () => {
    expect(SOURCE).toContain('useState<CareFilterId[]>(["verified"])');
    expect(SOURCE).not.toContain('useState<string[]>(["Verified by Arbor"])');
    expect(SOURCE).toMatch(/case "verified": return !!p\.verified;/);
    expect(SOURCE).not.toMatch(/case "Verified by Arbor"/);
  });

  it("specialty chips keep a canonical English search term (records are English)", () => {
    // Translating the QUERY would make every chip match nothing; only the
    // label is translated.
    expect(SOURCE).toContain('{ query: "Speech Therapist", labelKey: "elev.careNet.spec.speech" }');
    expect(SOURCE).toContain("setQuery(s.query)");
  });
});

/* ═══════════════════════════════════════════════════════════════════════════
   The ratchet: no hard-coded user-visible English may return to this screen.
   ═══════════════════════════════════════════════════════════════════════════ */

/** Strip block comments and whole-line // comments — prose in a comment is
 *  documentation, not copy. */
function strip(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .split("\n")
    .filter((l) => !/^\s*\/\//.test(l))
    .join("\n");
}

/** JSX text nodes: a run between `>` (not the `=>` of an arrow) and the next
 *  `<` or `{`. Quotes, braces and `;`/`=` are excluded so TypeScript generics
 *  (`useState<Foo>(...)`) and attribute values never look like text. */
const JSX_TEXT = /(?<!=)>([^<>{}"'`;=]*?)[<{]/g;
/** Copy-bearing props must be an expression that calls t(). */
const COPY_PROP = /\b(placeholder|title|aria-label|alt|eyebrow|subtitle|label)=(\{[^\n]*?\}|"[^"\n]*"|'[^'\n]*')/g;
/** A toast is parent-facing copy; it may never start from a literal. */
const TOAST_LITERAL = /\btoast\(\s*["'`]/g;
const WORD = /[A-Za-z]{3,}/;
const T_CALL = /(?<![A-Za-z0-9_.])t\(/;

interface Offenders {
  jsxText: string[];
  copyProps: string[];
  toasts: string[];
}

function offenders(raw: string): Offenders {
  const src = strip(raw);
  return {
    jsxText: [...src.matchAll(JSX_TEXT)].map((m) => m[1]).filter((r) => WORD.test(r)).map((r) => r.trim()),
    copyProps: [...src.matchAll(COPY_PROP)].filter((m) => !T_CALL.test(m[2])).map((m) => `${m[1]}=${m[2]}`),
    toasts: [...src.matchAll(TOAST_LITERAL)].map((m) => m[0]),
  };
}

/** The pre-change screen, verbatim from the audited source — the negative
 *  control. Each rule below must be shown to catch it. */
const PRE_CHANGE = [
  '        <PageHeader eyebrow="Care Network" title={t("sec.findpro.title")} />',
  '          <input placeholder="Search by specialty, concern, or name" />',
  "          <p>The verified directory is opening soon.</p>",
  "          <button>Prepare a shareable summary</button>",
  "          <p>No profile appears here until Arbor has completed its verification process.</p>",
  '                  onClick={() => { toast("Build a shareable summary in Consult.", "info"); }}',
  "                placeholder={`A sentence or two about what you'd like help with for ${first}.`}",
  '      <Modal title={consultPro ? `Request a consultation — ${consultPro.name}` : "Request a consultation"}>',
  "              <span>Preferred format</span>",
].join("\n");

describe("the scan is real, not vacuous", () => {
  it("read the actual component source", () => {
    expect(SOURCE.length).toBeGreaterThan(8000);
    expect(SOURCE).toContain("export default function FindProfessional");
    expect(strip(SOURCE).length).toBeGreaterThan(6000);
  });

  it("every rule catches the pre-change source", () => {
    const bad = offenders(PRE_CHANGE);
    expect(bad.jsxText.length, "JSX-text rule went blind").toBeGreaterThanOrEqual(4);
    expect(bad.jsxText).toContain("The verified directory is opening soon.");
    expect(bad.copyProps.length, "copy-prop rule went blind").toBeGreaterThanOrEqual(4);
    expect(bad.copyProps.some((c) => c.startsWith('eyebrow="Care Network"'))).toBe(true);
    expect(bad.toasts.length, "toast rule went blind").toBeGreaterThanOrEqual(1);
  });
});

describe("no hard-coded user-visible English remains on the screen", () => {
  const found = offenders(SOURCE);

  it("no English JSX text node", () => {
    expect(
      found.jsxText,
      "move this copy into lib/i18nElevation/careNetwork.ts and render it with t()",
    ).toEqual([]);
  });

  it("every placeholder / title / aria-label / eyebrow goes through t()", () => {
    expect(found.copyProps, "these props render to the parent — translate them").toEqual([]);
  });

  it("no toast starts from a string literal", () => {
    expect(found.toasts, "toasts are parent-facing copy — pass t(...)").toEqual([]);
  });

  it("the pre-change strings left the component and landed in the dictionary", () => {
    // Both halves matter: absent from the .tsx (the fix) AND present in the
    // English dictionary (the copy was MOVED, not quietly dropped).
    const dictionary = Object.values(en).join("\n");
    for (const moved of [
      "The verified directory is opening soon.",
      "Arbor will only show professionals after their identity",
      "Search by specialty, concern, or name",
      "What's going on? (shared with the professional)",
      "Preferred format",
      "Request recorded",
      "No profile appears here until Arbor has completed",
      "Insurance accepted",
      "Couldn't record the request",
    ]) {
      expect(SOURCE, `"${moved}" is still hard-coded in the component`).not.toContain(moved);
      expect(dictionary, `"${moved}" was dropped instead of moved`).toContain(moved);
    }
  });

  it("every careNetwork key the module defines is actually used by the screen", () => {
    const unused = Object.keys(en).filter((k) => !SOURCE.includes(k));
    expect(unused, "dead copy — delete it or wire it").toEqual([]);
  });

  it("every elev.careNet.* key the screen asks for exists in the dictionary", () => {
    const asked = [...SOURCE.matchAll(/"(elev\.careNet\.[a-zA-Z0-9.]+)"/g)].map((m) => m[1]);
    expect(asked.length).toBeGreaterThan(30);
    for (const key of asked) {
      expect(en[key], `${key} is asked for but undefined`).toBeTruthy();
      expect(he[key], `${key} has no Hebrew`).toBeTruthy();
    }
  });
});

describe("documented exception: the persisted appointment mode stays English", () => {
  it("the value written to the appointments store is canonical, not display copy", () => {
    // The record outlives a language switch, and the provider-matching regexes
    // read English, so this ONE string is data rather than copy. Kept explicit
    // so a future reader does not "fix" it into a half-translated stored record.
    expect(SOURCE).toContain('mode: consultMode === "in_person" ? "In person" : "Online"');
  });

  it("...and is translated at RENDER, so the parent never reads the stored English", () => {
    // Storing canonical English is only correct if something localizes it on
    // the way out. It did not, and appt.mode reached a Hebrew-reading parent
    // verbatim. The exception above is legitimate ONLY while this holds.
    const appts = readFileSync(path.join(here, "Appointments.tsx"), "utf8").replace(/\r\n/g, "\n");
    expect(appts.length).toBeGreaterThan(2000);
    expect(appts).toContain("const modeLabel =");
    expect(appts).toContain('t("elev.careNet.mode.inPerson")');
    expect(appts).toContain("{modeLabel}");
    expect(appts, "the row is back to printing the stored English").not.toContain("· {appt.mode}");
  });

  it("NEGATIVE CONTROL: the render check fails on the pre-fix row", () => {
    const before = `<p className="text-xs" dir="auto">{appt.role} · {appt.mode}</p>`;
    expect(before).toContain("· {appt.mode}");
    expect(before).not.toContain("const modeLabel =");
  });
});
