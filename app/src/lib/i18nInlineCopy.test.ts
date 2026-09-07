import { describe, it, expect } from "vitest";
import * as fs from "node:fs";
import * as path from "node:path";
import { en as careNetEn, he as careNetHe } from "./i18nElevation/careNetwork";

/**
 * TODAY-5 / PLAT-4 / CODEX-6 — anti-regression guard for the i18n registry
 * migration (2026-07-23 next-level wave 3).
 *
 * The standing constraint routes ALL UI copy through app/src/lib/i18n.ts so
 * the en/he parity test (i18n.test.ts) is the HE/EN enforcement mechanism.
 * The banned pattern is the inline per-language copy object/string:
 *
 *   const copy = uiLang === "he" ? { ... } : { ... };
 *   const copy = he ? { ... } : { ... };
 *   uiLang === "he" ? "טקסט בעברית" : "English copy"
 *
 * Such copy is invisible to the parity guard and to translation tooling, so a
 * dropped HE string silently falls back to English and never fails CI. Locale
 * SWITCHES (`uiLang === "he" ? "he-IL" : "en-US"`, dir/icon flips) carry no
 * Hebrew-script literal and stay allowed.
 */

const SRC_ROOT = path.resolve(__dirname, "..");
const COMPONENTS = path.join(SRC_ROOT, "components");

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...walk(full));
    else if (/\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) out.push(full);
  }
  return out;
}

// Drop /* */ and // comments so prose about the rule can't trip the scans.
function stripComments(code: string): string {
  return code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

type Offender = { file: string; line: number; text: string };

/**
 * Pre-existing kid-world / academy surfaces that still carry inline HE string
 * ternaries (kid register; HE copy sits behind the native transcreation gate).
 * FROZEN: files may only ever LEAVE this list (migrate → delete the entry).
 * The copy-OBJECT check below has NO allowlist — that pattern is banned
 * everywhere. New files must never appear here.
 */
const LEGACY_INLINE_HE_FILES = new Set([
  "components/sections/FamilyFormation.tsx",
  "components/sections/Masterclasses.tsx",
  "components/tabs/BedtimeStoriesTab.tsx",
  "components/tabs/ComicsTab.tsx",
  "components/tabs/HeroJourneyTab.tsx",
  "components/ui/SpeakButton.tsx",
]);

function scan(re: RegExp, opts?: { allowLegacy?: boolean }): Offender[] {
  const offenders: Offender[] = [];
  for (const file of walk(COMPONENTS)) {
    const rel = path.relative(SRC_ROOT, file).split(path.sep).join("/");
    if (opts?.allowLegacy && LEGACY_INLINE_HE_FILES.has(rel)) continue;
    const code = stripComments(fs.readFileSync(file, "utf8"));
    for (const [i, lineText] of code.split("\n").entries()) {
      if (re.test(lineText)) {
        offenders.push({ file: rel, line: i + 1, text: lineText.trim().slice(0, 120) });
      }
    }
  }
  return offenders;
}

const format = (o: Offender[]) => o.map((x) => `${x.file}:${x.line} → ${x.text}`).join("\n");

describe("i18n registry migration stays migrated (TODAY-5/PLAT-4/CODEX-6)", () => {
  it("no inline he-ternary copy OBJECT in components/ (use lib/i18n.ts keys + t())", () => {
    // `= he ? {` / `= uiLang === "he" ? {` — a whole per-language dictionary
    // built inline. Every string inside it bypasses the parity test.
    // NO legacy allowlist: this pattern is banned everywhere.
    const offenders = scan(/=\s*(?:uiLang\s*===\s*["']he["']|he)\s*\?\s*\{/);
    expect(offenders, `inline per-language copy objects found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("no NEW inline he-ternary TEMPLATE copy in components/ (frozen legacy files only)", () => {
    const offenders = scan(/(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*`/, { allowLegacy: true });
    expect(offenders, `inline per-language template copy found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("no NEW he-ternary with a Hebrew-script string literal in components/ (locale switches stay allowed)", () => {
    // Catches `uiLang === "he" ? "לשחק יחד" : "Try together"` while allowing
    // `uiLang === "he" ? "he-IL" : "en-US"` (no Hebrew script in the literal).
    const offenders = scan(/(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*(["'])(?:(?!\1).)*[֐-׿]/, { allowLegacy: true });
    expect(offenders, `inline Hebrew copy ternaries found — move the strings to lib/i18n.ts:\n${format(offenders)}`).toEqual([]);
  });

  it("the legacy allowlist only shrinks (every listed file still exists and still needs it)", () => {
    for (const rel of LEGACY_INLINE_HE_FILES) {
      const full = path.join(SRC_ROOT, rel);
      expect(fs.existsSync(full), `${rel} no longer exists — remove it from LEGACY_INLINE_HE_FILES`).toBe(true);
      const code = stripComments(fs.readFileSync(full, "utf8"));
      const stillHasInlineHe = /(?:uiLang\s*===\s*["']he["']|\bhe)\s*\?\s*(?:`|(["'])(?:(?!\1).)*[֐-׿])/.test(code);
      expect(stillHasInlineHe, `${rel} is clean now — delete it from LEGACY_INLINE_HE_FILES so it stays clean`).toBe(true);
    }
  });

  it("the OnboardingFlow progressbar label goes through i18n (ob.progress.step)", () => {
    const src = fs.readFileSync(path.join(COMPONENTS, "auth", "OnboardingFlow.tsx"), "utf8");
    expect(src).toContain('t("ob.progress.step"');
    expect(src).not.toContain("`Step ${step} of ${total}`");
  });
});

/* ── item 8 (LC-13) — the Learn·Care export surfaces ─────────────────────────
 *
 * The scans above catch inline HE ternaries. They do not catch the OTHER half
 * of the same defect: user-visible English written straight into JSX with no
 * `t()` at all, which is what the Reports catalogue, the Appointments form and
 * the consult packet's own scaffold were made of. This block scopes a
 * hardcoded-English scan to the files item 8 names, so the surfaces that were
 * migrated cannot drift back one literal at a time.
 */
const ITEM8_SCOPE = [
  "components/sections/Reports.tsx",
  "components/sections/Appointments.tsx",
  "components/sections/AskSpecialist.tsx",
  "components/sections/SchoolBrief.tsx",
  "components/sections/AcademyForYou.tsx",
  "components/sections/ScholarHubCard.tsx",
  "consult/packet.ts",
];

/** A user-visible attribute written as an English literal.
 *  R15: `eyebrow` and `label` join the list — PageHeader takes its kicker as
 *  `eyebrow=`, and #/appointments shipped `eyebrow="Care Network"` in Hebrew. */
const ENGLISH_ATTR = /(?:placeholder|aria-label|title|eyebrow|label)="[A-Za-z]/;
/** A JSX text node of two or more English words, closed on the SAME line. */
const ENGLISH_TEXT = />[A-Z][a-z]+(?: [A-Za-z’']+)+\s*</;
/** R15: the same text node when the closing tag sits on the NEXT line — the
 *  shape that let `<Icon … /> Add appointment` survive the scan for a whole
 *  wave. A line-scoped scan needs both ends of the node spelled out. */
const ENGLISH_TRAILING_TEXT = /\/>\s+[A-Z][a-z]+(?: [A-Za-z’']+)+\s*$/;

describe("item 8 — no hardcoded English on the Learn·Care export surfaces", () => {
  it("negative control: the pre-fix Reports.tsx card literal is what the scan rejects", () => {
    const PRE_FIX = `  { title: "Weekly Insight", desc: "This week's summary for your records or to share.", tone: "mint", type: "weekly" },`;
    // The catalogue row itself is data, so the scan that catches it is the
    // rendered one below — the row now carries titleKey/descKey and the JSX
    // renders t(r.titleKey). Both halves are asserted.
    expect(PRE_FIX).not.toContain("titleKey");
    const reports = fs.readFileSync(path.join(SRC_ROOT, "components/sections/Reports.tsx"), "utf8");
    expect(reports).toContain("titleKey: \"elev.reports.weekly.title\"");
    expect(reports).toContain("{t(r.titleKey)}");
    expect(reports).toContain("{t(r.descKey)}");
    expect(reports).not.toMatch(/>\{r\.title\}</);
  });

  it("no English placeholder / aria-label / title attributes remain", () => {
    const offenders: string[] = [];
    for (const rel of ITEM8_SCOPE) {
      const code = stripComments(fs.readFileSync(path.join(SRC_ROOT, rel), "utf8"));
      for (const [i, line] of code.split("\n").entries()) {
        if (ENGLISH_ATTR.test(line)) offenders.push(`${rel}:${i + 1} → ${line.trim().slice(0, 110)}`);
      }
    }
    expect(offenders, `hardcoded English attributes — route them through t():\n${offenders.join("\n")}`).toEqual([]);
  });

  it("no multi-word English JSX text nodes remain", () => {
    const offenders: string[] = [];
    for (const rel of ITEM8_SCOPE) {
      const code = stripComments(fs.readFileSync(path.join(SRC_ROOT, rel), "utf8"));
      for (const [i, line] of code.split("\n").entries()) {
        if (ENGLISH_TEXT.test(line) || ENGLISH_TRAILING_TEXT.test(line.trimEnd())) {
          offenders.push(`${rel}:${i + 1} → ${line.trim().slice(0, 110)}`);
        }
      }
    }
    expect(offenders, `hardcoded English copy — route it through t():\n${offenders.join("\n")}`).toEqual([]);
  });

  /* ── R15 — the #/appointments primary action ──────────────────────────────
   * Item 8 keyed the Appointments FORM, and the HE page still carried two
   * Latin strings in its header: the PageHeader eyebrow (an attribute the
   * scan did not name) and the "Add appointment" button label (a text node
   * whose closing tag sat on the next line, so the line-scoped scan missed
   * it). Both holes are widened above; these pin the two strings themselves. */
  it("R15 · the appointments header speaks the parent's language", () => {
    const appt = fs.readFileSync(path.join(SRC_ROOT, "components/sections/Appointments.tsx"), "utf8");
    expect(appt).toContain('eyebrow={t("elev.careNet.eyebrow")}');
    expect(appt).toContain('{t("elev.careNet.appt.add")}');
    expect(appt).not.toContain('eyebrow="Care Network"');
    expect(appt).not.toContain("/> Add appointment");
  });

  it("R15 · the key lands in both locales, transcreated (law 7)", () => {
    expect(careNetEn["elev.careNet.appt.add"]).toBe("Add appointment");
    expect(careNetHe["elev.careNet.appt.add"]).toMatch(/^[֐-׿\s]+$/);
  });

  it("R15 · NEGATIVE CONTROL: the two pre-fix lines are what the scan now rejects", () => {
    const preFixButton = '            <Icon name="add" size={18} /> Add appointment';
    const preFixEyebrow = '        eyebrow="Care Network"';
    // The scans as item 8 left them passed both lines…
    expect(ENGLISH_TEXT.test(preFixButton)).toBe(false);
    expect(/(?:placeholder|aria-label|title)="[A-Za-z]/.test(preFixEyebrow)).toBe(false);
    // …the widened ones do not.
    expect(ENGLISH_TRAILING_TEXT.test(preFixButton.trimEnd())).toBe(true);
    expect(ENGLISH_ATTR.test(preFixEyebrow)).toBe(true);
  });

  it("the consult packet's serializers take a language", () => {
    const packet = fs.readFileSync(path.join(SRC_ROOT, "consult/packet.ts"), "utf8");
    for (const fn of ["serializePacket", "serializePresetPacket", "presetPacketToPrintSections", "serializeForExport"]) {
      const at = packet.indexOf(`export function ${fn}(`);
      expect(at, `${fn} not found`).toBeGreaterThan(-1);
      expect(packet.slice(at, at + 400), `${fn} takes no lang`).toContain("lang: UiLang");
    }
    // …and the two header lines are keyed, not literals.
    expect(packet).toContain('translate(lang, "elev.packet.header"');
    expect(packet).toContain('translate(lang, "elev.packet.prepared"');
    expect(packet).not.toContain("— context for our conversation`");
  });

  it("the printable report shell carries lang and dir", () => {
    const rep = fs.readFileSync(path.join(SRC_ROOT, "lib/reportExport.ts"), "utf8");
    expect(rep).toContain('<html lang="${lang}" dir="${dir}">');
    expect(rep).toContain('const dir = lang === "he" ? "rtl" : "ltr";');
    expect(rep).toContain("padding-inline-start");
  });

  it("the Learning Map domain labels resolve through the shared screen.domain dictionary", () => {
    const academy = fs.readFileSync(path.join(SRC_ROOT, "components/sections/AcademyForYou.tsx"), "utf8");
    expect(academy).toContain("const key = `screen.domain.${id}`;");
    expect(academy).not.toMatch(/const labelFor = \(id: string\) => DOMAIN_LABEL\[id\]/);
  });

  it("the charter starter set is offered in the family's language", () => {
    const charter = fs.readFileSync(path.join(SRC_ROOT, "lib/familyCharter.ts"), "utf8");
    expect(charter).toContain("DEFAULT_CHARTER_VALUE_KEYS");
    expect(charter).toContain("export function defaultCharterValues(lang: UiLang");
    const family = fs.readFileSync(path.join(SRC_ROOT, "components/sections/FamilyFormation.tsx"), "utf8");
    expect(family).toContain("initialCharterValues(undefined, uiLang)");
  });
});

/* ── OBJ-PRACTICE-02 (§3f) — the practice suite and the two story tabs ───────
 *
 * item 8 scoped the hardcoded-English scan to the Learn·Care export surfaces.
 * The practice suite was never in scope, and it was where the defect actually
 * lived: JourneyTab was ~90 % English literals ("This week", "Mark done",
 * "Historical progression"), and the Practice Studio launcher printed the ten
 * Kid-Mode world names as literals on a right-to-left page.
 *
 * The doors are keyed now. The rest of the suite (kid worlds, the Copilot,
 * Word World) still carries literals this wave did not touch, so the scan is a
 * SHRINK-ONLY ratchet with an exact per-file count, measured 2026-09-07 — the
 * same contract as tokens.test.ts's HEX_ALLOWLIST and kidRegisterScan's FROZEN.
 * Fixing a literal must LOWER a number; adding one turns CI red.
 */
const PRACTICE_SCOPE_DIRS = ["components/practice"];
const PRACTICE_SCOPE_FILES = ["components/tabs/ComicsTab.tsx", "components/tabs/HeroJourneyTab.tsx"];

/** EXACT remaining English-literal lines per file. Shrink-only. */
const PRACTICE_ENGLISH_FROZEN: Record<string, number> = {
  "components/practice/BeatKeeperWorld.tsx": 3,
  // R22 (Builder L): DevelopmentCopilot was 4 and is 0 — the whole Full
  // Picture body is keyed. The entry LEAVES the freeze rather than sitting at
  // zero, and the file joins the CLEAN assertion below.
  "components/practice/HeroPoseWorld.tsx": 3,
  "components/practice/MemoryMatch.tsx": 2,
  "components/practice/PatternPowerWorld.tsx": 3,
  "components/practice/WordWorldTab.tsx": 2,
  "components/tabs/HeroJourneyTab.tsx": 1,
};

function practiceScopeFiles(): string[] {
  const out: string[] = [...PRACTICE_SCOPE_FILES];
  for (const dir of PRACTICE_SCOPE_DIRS) {
    for (const full of walk(path.join(SRC_ROOT, dir))) {
      out.push(path.relative(SRC_ROOT, full).split(path.sep).join("/"));
    }
  }
  return out.sort();
}

/** Lines carrying a user-visible English literal (attribute or JSX text). */
function englishLines(rel: string): string[] {
  const code = stripComments(fs.readFileSync(path.join(SRC_ROOT, rel), "utf8"));
  return code
    .split("\n")
    .map((line, i) => ({ line, i }))
    .filter(({ line }) => ENGLISH_ATTR.test(line) || ENGLISH_TEXT.test(line))
    .map(({ line, i }) => `${rel}:${i + 1} → ${line.trim().slice(0, 110)}`);
}

describe("OBJ-PRACTICE-02 — hardcoded English on the practice doors is a shrink-only ratchet", () => {
  const files = practiceScopeFiles();

  it("the scanner sees a real corpus", () => {
    expect(files.length).toBeGreaterThan(15);
    for (const rel of Object.keys(PRACTICE_ENGLISH_FROZEN)) {
      expect(files, `${rel} frozen but not in scope`).toContain(rel);
    }
  });

  it.each(files.map((f) => [f]))("%s", (rel) => {
    const hits = englishLines(rel);
    const frozen = PRACTICE_ENGLISH_FROZEN[rel] ?? 0;
    expect(
      hits.length,
      `${rel}: ${hits.length} English literal line(s), frozen at ${frozen} — route new copy through t() and LOWER the number:\n${hits.join("\n")}`,
    ).toBeLessThanOrEqual(frozen);
  });

  it("JourneyTab, the launcher and the Full Picture are CLEAN", () => {
    expect(englishLines("components/practice/JourneyTab.tsx")).toEqual([]);
    expect(englishLines("components/practice/PracticeStudioTab.tsx")).toEqual([]);
    // R22 (Builder L) — the ratchet reached zero on this file; pinned so a
    // future edit cannot re-add a literal under a restored freeze entry.
    expect(englishLines("components/practice/DevelopmentCopilot.tsx")).toEqual([]);
  });

  it("NEGATIVE CONTROL: the pre-fix JourneyTab literals are what the scan rejects", () => {
    const preFix = [
      '          <p className="text-[11px]">Active practice days this week</p>',
      '        <SectionCard title="Achievements" tone="yellow">',
    ].join("\n");
    const caught = preFix.split("\n").filter((l) => ENGLISH_ATTR.test(l) || ENGLISH_TEXT.test(l));
    expect(caught.length).toBeGreaterThan(0);
  });
});
