/**
 * kidRegisterScan.test.ts — the KID-REGISTER SCANNER (Wave T lane K).
 *
 * One static scan over every file reachable from KidModeOverlay's surface
 * graph (listed explicitly below — a move must update the list, never
 * silently empty the scan). Outside PARENT-ONLY branches (`{!kidMode && (…)}`,
 * `if (!kidMode) {…}`, `!isKidModeActive() && (…)`), a kid-surface file may
 * not contain:
 *
 *   pct        — a `%` numeral render (`{value}%`), KID-03/04/16/27
 *   kitShell   — <TrustSafetyBar> / <SectionCard> parent chrome, KID-03/04
 *   nav        — a bare `setActiveTab(` (frozen in Kid Mode → dead button),
 *                KID-05 — use components/kidmode/useKidSafeNav
 *   download   — a `download` attribute or `download…Canvas(` file save, KID-26
 *   clinical   — development / diagnos… / assess… / accuracy / video-modeling
 *                in a string literal or JSX text, KID-29
 *   confetti   — a direct `confetti(` call (only lib/celebrate may), KID-15
 *   smallBtn   — a <button> styled py-1 / py-1.5 / p-2 (< 44 px), KID-14
 *   adultWords — copy (a literal, a JSX text node, or the RESOLVED value of an
 *                i18n key referenced in kid-reachable code) carrying a word
 *                written for the grown-up in the room — test / score / assess /
 *                privacy / judge / parent / camera, OBJ-KID-03
 *   lockGlyph  — a padlock (<Icon name="lock">, the emoji) reachable by the
 *                child: a greyed silhouette with its unlock requirement is the
 *                pressure mechanic law 3 forbids, OBJ-KID-02
 *
 * Mechanics follow lib/cosmeticsFirewall.test.ts. Every class has a positive
 * (planted-violation) and a negative control, and the parent-only stripper is
 * itself proven on a synthetic snippet. Files that could not be made clean in
 * this pass sit in FROZEN with a reason and an EXACT count — shrink-only: fixing
 * one must lower the number, adding one turns CI red.
 *
 * The kid dictionary (lib/i18nElevation/kidRegister.ts) is scanned too: every
 * elev.kid.* / elev.play.* VALUE passes the clinical + loss-framing regexes and
 * the en/he key sets are identical (HE placeholders behind GD-6).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as kidEn, he as kidHe } from "./i18nElevation/kidRegister";
import { en as baseEn, he as baseHe } from "./i18n";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..");

/* ── Scope: KidModeOverlay's surface graph ─────────────────────────────── */

const KID_SURFACE_GRAPH = [
  // the shell
  "components/kidmode/KidModeOverlay.tsx",
  "components/kidmode/KidDashboard.tsx",
  "components/kidmode/KidComicsShelf.tsx",
  "components/kidmode/KidErrorBoundary.tsx",
  "components/kidmode/HoldExitButton.tsx",
  "components/kidmode/ParentChallenge.tsx",
  // arcade surface (KidSurface "arcade")
  "components/practice/PracticeHubTab.tsx",
  "components/practice/WeeklyMissionsStrip.tsx",
  "components/practice/HeroArcade.tsx",
  "components/practice/WorldScene.tsx",
  "components/practice/SpeechCoachTab.tsx",
  "components/practice/MimicStudioTab.tsx",
  "components/practice/MimicMatch.tsx",
  "components/practice/AdventuresTab.tsx",
  "components/practice/MemoryMatch.tsx",
  "components/practice/MindVaultWorld.tsx",
  "components/practice/SpellForgeWorld.tsx",
  "components/practice/EarlyReadingTrack.tsx",
  "components/practice/BeatKeeperWorld.tsx",
  "components/practice/HeroPoseWorld.tsx",
  "components/practice/PatternPowerWorld.tsx",
  // feelings surface (KidSurface "feelings")
  "components/practice/FeelingsLabTab.tsx",
  // stories surface (KidSurface "journeys") — cross-lane files, frozen below
  "components/tabs/HeroJourneyTab.tsx",
  "components/stories/HeroScenePlayer.tsx",
  "components/stories/SavedComicReader.tsx",
  // child-facing primitives
  "components/ui/playkit.tsx",
  // child-adjacent parent surface (KID-17) — scanned for the clinical class
  "components/practice/JourneyTab.tsx",
];

/** In the WORLDS table but unreachable from Kid Mode: its entry is flagged
 *  `parentOnly`, so the arcade grid skips it and no KidDashboard tile
 *  pre-selects it. It is a parent-register surface by its own header. Listed so
 *  the exclusion is a conscious decision, not an omission. (Until KID-06 the
 *  exclusion rode on the `isNew` filter, which hid three real kid worlds with
 *  it — the flag now says what is actually meant.) */
const EXCLUDED: Record<string, string> = {
  "components/practice/WordWorldTab.tsx": "parent-register by design; its WORLDS entry carries parentOnly, so no Kid Mode tile or arcade cell reaches it",
};

type RuleId = "pct" | "kitShell" | "nav" | "download" | "clinical" | "confetti" | "smallBtn" | "lockGlyph" | "adultWords" | "gradedStars";

/**
 * B-KID-04 (law 3): a `stars={…}` whose expression is not literally the same
 * as its `starsTotal={…}` grades the child — 1 of 3 stars after a hard round is
 * a verdict with a picture on it. Completion lights every star. Returns every
 * offending pair, so a failure names the expression.
 */
function gradedStarsHits(src: string): string[] {
  const hits: string[] = [];
  const exprAt = (openIdx: number): string | null => {
    const close = matchBracket(src, openIdx);
    return close < 0 ? null : src.slice(openIdx + 1, close).trim();
  };
  for (const m of src.matchAll(/\bstars=\{/g)) {
    const open = m.index! + m[0].length - 1;
    const value = exprAt(open);
    // The total sits in the same tag: look a short way either side.
    const from = Math.max(0, m.index! - 400);
    const window = src.slice(from, Math.min(src.length, m.index! + 600));
    let total: string | null = null;
    for (const t of window.matchAll(/\bstarsTotal=\{/g)) {
      total = exprAt(from + t.index! + t[0].length - 1);
      break;
    }
    if (value === null || total === null || value !== total) hits.push(`stars={${value}} starsTotal={${total}}`);
  }
  return hits;
}

/** Shrink-only baseline: EXACT counts. Fixing a hit must lower the number. */
const FROZEN: Partial<Record<string, Partial<Record<RuleId, { count: number; reason: string }>>>> = {
  "components/practice/EarlyReadingTrack.tsx": {
    kitShell: { count: 1, reason: "lane K deferred: the parent SectionCard shell inside Spell Forge → PlayPanel swap is a separate slice" },
  },
  "components/kidmode/KidModeOverlay.tsx": {
    adultWords: { count: 2, reason: "kid.exit.backToParent(.Aria) — the hold-to-exit control is the PARENT's own affordance (3 s gate); the word names its owner, not the child's game" },
  },
  "components/kidmode/KidDashboard.tsx": {
    adultWords: { count: 2, reason: "the same two hold-to-exit labels, rendered in the kid home header" },
  },
  "components/practice/MimicMatch.tsx": {
    // OBJ-KID-03 fixup: MimicStudioTab now renders this block on the parent door
    // only ({!kidMode && <MimicMatch …>}), so no child reaches these five. The file
    // stays in the graph — and frozen — so removing that gate turns CI red instead
    // of silently re-crossing the register. The fifth hit is the photo_camera
    // ligature the extended rule can now see; kid-register rewrite = OBJ-KID-03-a.
    adultWords: { count: 5, reason: "Face Match is parent-register (gated in MimicStudioTab): 4 prac.mimic.face.* keys + the photo_camera ligature — MimicMatch.tsx is another builder's file" },
  },
  "components/practice/HeroArcade.tsx": {
    adultWords: { count: 1, reason: "the Comic Studio CTA's photo_camera ligature, surfaced by the OBJ-KID-03 fixup rule extension — HeroArcade.tsx is another builder's file; the swap is filed as OBJ-KID-03-b in FOLLOW-UPS" },
  },
  "components/practice/JourneyTab.tsx": {
    kitShell: { count: 4, reason: "parent-register surface (#/journey) — SectionCard is its legitimate chrome; scanned for pct/nav/verdict copy" },
    nav: { count: 1, reason: "parent-register surface — the 'Aimed extra' link is a legitimate parent navigation" },
    // OBJ-PRACTICE-02 ratchet-down: the "never a diagnostic chart" disclaimer
    // moved into lib/i18nElevation/practiceDoors.ts with the rest of this
    // door's copy, so the file itself now carries zero clinical spans.
  },
};

/* ── Helpers ───────────────────────────────────────────────────────────── */

function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

/** Index of the bracket closing the one at `openIdx`, skipping strings/templates. -1 if unbalanced. */
export function matchBracket(src: string, openIdx: number): number {
  const open = src[openIdx];
  const close = open === "(" ? ")" : open === "{" ? "}" : open === "[" ? "]" : "";
  if (!close) return -1;
  let depth = 0;
  for (let i = openIdx; i < src.length; i++) {
    const ch = src[i];
    if (ch === '"' || ch === "'" || ch === "`") {
      const q = ch;
      i++;
      while (i < src.length && src[i] !== q) {
        if (src[i] === "\\") i++;
        i++;
      }
      continue;
    }
    if (ch === open) depth++;
    else if (ch === close) {
      depth--;
      if (depth === 0) return i;
    }
  }
  return -1;
}

const PARENT_ONLY_MARKERS = [
  /!kidMode\s*&&\s*\(/,
  /!isKidModeActive\(\)\s*&&\s*\(/,
  /if\s*\(\s*!kidMode\s*\)\s*\{/,
  /if\s*\(\s*!isKidModeActive\(\)\s*\)\s*\{/,
  /if\s*\(\s*!kidMode\s*\)\s*return\s*\(/,
];

/** Replaces every parent-only branch with a marker token so the scan sees only kid-reachable code. */
export function stripParentOnly(src: string): string {
  let out = src;
  for (let guard = 0; guard < 200; guard++) {
    let hit: { index: number; len: number } | null = null;
    for (const re of PARENT_ONLY_MARKERS) {
      const m = re.exec(out);
      if (m && (hit === null || m.index < hit.index)) hit = { index: m.index, len: m[0].length };
    }
    if (!hit) return out;
    const openIdx = hit.index + hit.len - 1;
    const closeIdx = matchBracket(out, openIdx);
    if (closeIdx < 0) return out;
    out = `${out.slice(0, hit.index)}PARENT_ONLY_BRANCH${out.slice(closeIdx + 1)}`;
  }
  return out;
}

/** String literals + JSX text nodes — where copy lives; identifiers are excluded. */
function copySpans(src: string): string[] {
  const out: string[] = [];
  for (const m of src.matchAll(/"([^"\n]*)"|'([^'\n]*)'|`([^`]*)`/g)) out.push(m[1] ?? m[2] ?? m[3] ?? "");
  for (const m of src.matchAll(/>([^<>{}]+)</g)) out.push(m[1]);
  return out;
}

/** Words written for the grown-up in the room. `\b` keeps them out of
 *  identifiers (`photo_camera`, `scoreFaceMatch`) — only prose is scanned. */
const ADULT_WORDS = /\b(?:tests?|scor(?:e|es|ed|ing)|assess\w*|privacy|judge|judges|parent|parents|camera)\b/i;

/** The full EN dictionary a kid surface can resolve: base keys + the kid
 *  register elevation module (base keys win on merge, as at runtime). */
const ALL_EN: Record<string, string> = { ...kidEn, ...baseEn };

const CLINICAL = /\b(?:development|diagnos\w*|assess\w*|accuracy|video-modeling)\b/i;
const CSS_LENGTH_CONTEXT = /(?:width|height|left|right|top|bottom|inset|translate|flex|basis)[A-Za-z]*\s*:\s*`[^`\n]*\}%`/;

const RULES: Record<RuleId, (src: string) => string[]> = {
  pct: (src) =>
    [...src.matchAll(/\}%/g)]
      .map((m) => {
        const lineStart = src.lastIndexOf("\n", m.index!) + 1;
        const lineEnd = src.indexOf("\n", m.index!);
        return src.slice(lineStart, lineEnd < 0 ? undefined : lineEnd).trim();
      })
      .filter((line) => !CSS_LENGTH_CONTEXT.test(line)),
  kitShell: (src) => [...src.matchAll(/<(?:TrustSafetyBar|SectionCard)\b/g)].map((m) => m[0]),
  nav: (src) => [...src.matchAll(/\bsetActiveTab\(/g)].map((m) => m[0]),
  download: (src) => [...src.matchAll(/\bdownload[A-Za-z]*Canvas\(|<a\b[^>]*\sdownload(?:[\s=>])/g)].map((m) => m[0]),
  clinical: (src) => copySpans(src).filter((s) => CLINICAL.test(s)),
  gradedStars: (src) => gradedStarsHits(src),
  confetti: (src) => [...src.matchAll(/\bconfetti\(/g)].map((m) => m[0]),
  smallBtn: (src) =>
    // `(?<==)>` lets an arrow function's `=>` inside an attribute pass without ending the tag.
    [...src.matchAll(/<button\b(?:[^>]|(?<==)>)*>/g)]
      .map((m) => m[0])
      .filter((tag) => /\b(?:py-1|py-1\.5|p-2)(?=["'\s])/.test(tag)),
  // OBJ-KID-02: `name="lock"` (the Icon glyph) or the padlock emoji anywhere the
  // child can reach. Parent-only branches are already stripped before the rule
  // runs, so the arcade's parent-side "next gear" hint passes and the same chip
  // rendered unguarded fails.
  lockGlyph: (src) => [...src.matchAll(/name="lock(?:_\w+)?"|\u{1F512}/gu)].map((m) => m[0]),
  // OBJ-KID-03 (law 2). Two halves, because the copy a child reads arrives two
  // ways: as a literal in the file, and as an i18n KEY whose value lives in the
  // dictionary. A key written for the parent door leaking into a kid branch is
  // the exact defect this item found ("prac.adventures.sub" → "…It never feels
  // like a test."), and a literal-only scan cannot see it.
  adultWords: (src) => {
    const hits: string[] = [];
    for (const span of copySpans(src)) {
      // Prose only: a phrase (has a space), on one line, that is not a
      // statement (no `;`) and reads like a sentence (a capital or punctuation)
      // — so class lists, ids and code caught by the span regexes drop out.
      if (!/ /.test(span) || /[\n;]/.test(span)) continue;
      if (!/[A-Z]|['’.,!?…]/.test(span)) continue;
      if (ADULT_WORDS.test(span)) hits.push(span.trim());
    }
    for (const m of src.matchAll(/\bt\(\s*"([\w.]+)"/g)) {
      const value = ALL_EN[m[1]];
      if (value && ADULT_WORDS.test(value)) hits.push(`${m[1]}: ${value}`);
    }
    // Third source (OBJ-KID-03 fixup): a Material Symbols LIGATURE is the icon
    // span's own text content. The font paints a glyph, but innerText — and any
    // check that reads the page as text — returns "photo_camera". The rendered
    // acceptance run counted five camera words on the kid Mimic surface; the two
    // this scan could not see were icons, because a rule that reads only prose
    // and t() keys never looks at the `name` attribute. Ligature parts are matched
    // word-by-word (split on `_`) so "photo_camera" is a hit and "face" /
    // "no_photography" are not.
    for (const m of src.matchAll(/<Icon\s[^>]*name="([a-z0-9_]+)"/g)) {
      if (m[1].split("_").some((part) => ADULT_WORDS.test(part))) hits.push(`<Icon name="${m[1]}">`);
    }
    return hits;
  },
};

const RULE_IDS = Object.keys(RULES) as RuleId[];

function scanFile(rel: string): Record<RuleId, string[]> {
  const raw = readFileSync(path.join(SRC, rel), "utf8");
  const src = stripParentOnly(stripComments(raw));
  const out = {} as Record<RuleId, string[]>;
  for (const id of RULE_IDS) out[id] = RULES[id](src);
  return out;
}

/* ── Controls: the scanner can see each class, and only that class ─────── */

describe("kid-register scanner — positive controls (planted violations are seen)", () => {
  const PLANTED: [RuleId, string][] = [
    ["adultWords", '<span>Camera privacy</span>'],
    // OBJ-KID-03 fixup: the ligature IS the rendered text, so the icon that stood
    // here as a negative control ("identifier, not prose") was in fact two of the
    // five camera words the rendered check counted on the kid Mimic surface.
    ["adultWords", '<Icon name="photo_camera" size={16} /> Turn on mirror'],
    ["adultWords", '<Icon name="photo_camera" size={32} className="mx-auto mb-3" />'],
    ["adultWords", '<p>use the mirror game above and you be the judge!</p>'],
    ["adultWords", 'say={t("prac.adventures.sub", { name: first })}'], // the KEY resolves to "…never feels like a test."
    ["lockGlyph", '<Icon name="lock" size={14} /> {cosmeticLabel(next.cosmetic.id)}'],
    ["lockGlyph", "<span>🔒 All-rounder - Play in all 5 areas</span>"],
    ["pct", "<span>{powerPct}%</span>"],
    ["pct", "value={`${emotionAccuracy}%`}"],
    ["pct", "{copy} ({score}%)"],
    ["kitShell", '<TrustSafetyBar note="x" />'],
    ["kitShell", '<SectionCard title="x">'],
    ["nav", 'onClick={() => setActiveTab("comics")}'],
    ["download", "void downloadPracticeStampCanvas({ name })"],
    ["download", '<a href={url} download="hero.png">'],
    ["clinical", '"taught us something for Mia\'s development picture."'],
    ["clinical", "<p>in video-modeling practice the effort matters</p>"],
    ["clinical", '`Recognition ${x}` + "accuracy"'],
    ["confetti", "confetti({ particleCount: 70 })"],
    // B-KID-04: the synthetic grade the item names, and the two pre-fix shapes.
    ["gradedStars", "<Celebrate title={x} stars={1} starsTotal={3}>"],
    ["gradedStars", "<Celebrate title={x} stars={gradeStars(avg)} starsTotal={3}>"],
    ["gradedStars", "<Celebrate\n  title={x}\n  stars={sessionCorrect}\n  starsTotal={scenario.scenes.length}\n>"],
    ["smallBtn", '<button onClick={() => x()} className="p-2 rounded-xl">'],
    ["smallBtn", '<button className="rounded-full px-3.5 py-1.5 text-[11.5px]">'],
    ["smallBtn", '<button\n  onClick={() => y()}\n  className="px-3 py-1 rounded-xl">'],
  ];
  it.each(PLANTED)("%s flags %j", (id, snippet) => {
    expect(RULES[id](snippet).length).toBeGreaterThan(0);
  });
});

describe("kid-register scanner — negative controls (legitimate code passes)", () => {
  const LEGAL: [RuleId, string][] = [
    ["adultWords", '<Icon name="face" size={16} /> {t("elev.play.mimic.mirrorSay")}'], // a clean ligature beside a kid line
    ["adultWords", '<Icon name={mirrorGlyph} size={16} /> Turn on mirror'], // an expression: the !kidMode split above it decides the glyph
    ["adultWords", 'className="arbor-app arbor-parent flex items-center"'], // a class list is not copy
    ["adultWords", 'const s = scoreFaceMatch(blendshapesToMap(cats), target);'], // code, not copy
    ["adultWords", 'say={t("elev.play.adventures.say", { name: first })}'], // the kid line
    ["lockGlyph", "const locked = useKidLock(); const lockRef = 1; // identifiers are not glyphs"],
    ["lockGlyph", '<Icon name="check" size={14} /> <span>Earned</span>'], // an earned chip has no padlock
    ["pct", "style={{ width: `${Math.round(coverage * 100)}%` }}"], // CSS length, not a numeral render
    ["pct", 'background: "linear-gradient(135deg, var(--a), #fff 75%)"'],
    ["kitShell", 'import { SectionCard, cardCls } from "../ui/kit";'], // an import is not a render
    ["nav", "const nav = useKidSafeNav(); {nav && <PlayButton onClick={() => nav(\"comics\")} />}"],
    ["download", 'import { downloadPracticeStampCanvas } from "../../lib/heroAvatarCanvas";'],
    ["clinical", "const emotionAccuracy = useMemo(() => 0, []);"], // an identifier, not copy
    ["clinical", '{t("prac.speech.progress.stat", { tries: s.attempts, accuracy: s.recentAccuracy })}'],
    ["confetti", 'import { celebrate } from "../../lib/celebrate"; celebrate({ kind: "play" });'],
    ["gradedStars", "<Celebrate title={x} stars={3} starsTotal={3}>"],
    ["gradedStars", "<Celebrate title={x} stars={pack.prompts.length} starsTotal={pack.prompts.length}>"],
    ["gradedStars", '<Stars n={stars} aria={t("elev.play.arcade.starsAria", { n: stars })} />'], // not a stars= prop
    ["smallBtn", '<button className="p-3 min-w-[44px] min-h-[44px] rounded-xl">'],
    ["smallBtn", '<button className="px-3.5 py-2.5 min-h-[44px]">'],
    ["smallBtn", '<span className="px-2.5 py-1">badge</span>'], // not a button
  ];
  it.each(LEGAL)("%s passes %j", (id, snippet) => {
    expect(RULES[id](snippet)).toEqual([]);
  });
});

describe("kid-register scanner — parent-only branches are excluded, everything else is not", () => {
  it("strips {!kidMode && (…)} and if (!kidMode) {…} blocks, balanced across nested JSX", () => {
    const src = [
      "const a = 1;",
      "{!kidMode && (",
      "  <div>{st.recentAccuracy}% <SectionCard title={`${x}`}>{(y)}</SectionCard></div>",
      ")}",
      "if (!kidMode) {",
      "  return (<TrustSafetyBar note={`a ) b`} />);",
      "}",
      "<span>{kidValue}%</span>",
    ].join("\n");
    const out = stripParentOnly(src);
    expect(out).not.toContain("recentAccuracy");
    expect(out).not.toContain("TrustSafetyBar");
    expect(out.match(/PARENT_ONLY_BRANCH/g)?.length).toBe(2);
    // the kid-reachable violation after the branches is STILL visible
    expect(RULES.pct(out)).toEqual(["<span>{kidValue}%</span>"]);
  });

  it("OBJ-KID-02: a !kidMode-guarded padlock is stripped; the same chip unguarded is not", () => {
    const guarded = '{next && !kidMode && (<span><Icon name="lock" size={14} /> {label}</span>)}';
    const unguarded = '{next && (<span><Icon name="lock" size={14} /> {label}</span>)}';
    expect(RULES.lockGlyph(stripParentOnly(guarded))).toEqual([]);
    expect(RULES.lockGlyph(stripParentOnly(unguarded))).toEqual(['name="lock"']);
  });

  it("a kidMode-positive branch is NOT stripped (only the parent side is)", () => {
    const src = "{kidMode && (<span>{n}%</span>)}";
    expect(stripParentOnly(src)).toBe(src);
    expect(RULES.pct(src).length).toBe(1);
  });
});

/* ── The scan ──────────────────────────────────────────────────────────── */

describe("kid-register scan scope", () => {
  it("every graph file exists (a move must update the list, never empty the scan)", () => {
    for (const rel of KID_SURFACE_GRAPH) expect(existsSync(path.join(SRC, rel)), `${rel} missing`).toBe(true);
    for (const rel of Object.keys(EXCLUDED)) expect(existsSync(path.join(SRC, rel)), `${rel} (excluded) missing`).toBe(true);
    for (const rel of Object.keys(FROZEN)) expect(KID_SURFACE_GRAPH, `FROZEN entry ${rel} must be in the graph`).toContain(rel);
  });

  it("the split surfaces really have a parent-only branch AND a kid remainder", () => {
    for (const rel of ["components/practice/SpeechCoachTab.tsx", "components/practice/FeelingsLabTab.tsx"]) {
      const src = stripParentOnly(stripComments(readFileSync(path.join(SRC, rel), "utf8")));
      expect(src, `${rel} lost its if (!kidMode) branch`).toContain("PARENT_ONLY_BRANCH");
      // IA-08 / RUN-12: the kid remainder now renders through `RegisterShell`
      // (playkit), which mounts PlayShell + PlayHeader under `kidMode` and the
      // parent register otherwise. The header itself lives one file away;
      // `playShell.register.test.ts` owns the register rule.
      expect(src, `${rel} kid remainder must still render its own shell`).toContain("<RegisterShell");
    }
  });
});

describe("kid-register scan — no verdicts, parent chrome, dead nav, file saves, clinical copy, raw confetti or small buttons reach the child", () => {
  it.each(KID_SURFACE_GRAPH.map((rel) => [rel]))("%s", (rel) => {
    const hits = scanFile(rel);
    for (const id of RULE_IDS) {
      const frozen = FROZEN[rel]?.[id];
      if (frozen) {
        expect(
          hits[id].length,
          `${rel} [${id}] frozen at ${frozen.count} (${frozen.reason}); now ${hits[id].length}: ${JSON.stringify(hits[id])} — fixing one must LOWER the FROZEN count, never raise it`,
        ).toBe(frozen.count);
      } else {
        expect(hits[id], `${rel} [${id}] ${JSON.stringify(hits[id])}`).toEqual([]);
      }
    }
  });
});

/* ── The kid dictionary ────────────────────────────────────────────────── */

const HEBREW = /[\u0590-\u05FF]/;
// B-KID-04: Hebrew loss-framing too (in a row / streak / missed / you lost /
// time's up / don't break / hurry) — the HE dictionary was scanned with
// English-only terms, so a transcreated pressure line passed.
// B-PLAY-04 residue (law 3): "come back tomorrow" is a return-pressure line
// (elev.play.mimic.packComplete.sub said it to the child on the Mimic pack-win
// card, and the dead base key prac.mimic.packWin.sub carried it too, EN + HE).
const LOSS_FRAMED = /in a row|streak|don'?t break|days? straight|consecutiv|hurry|time'?s up|missed|you lost|come back tomorrow|ברצף|רצף|פספס|הפסד|נגמר הזמן|אל תשבר|מהרו|תמהר|(?:תחזור|תחזרי|תחזרו|חזרו|חזור|חזרי|לחזור)\s+מחר/i;
const KID_KEY = /^elev\.(?:kid|play)\./;

describe("kid dictionary (lib/i18nElevation/kidRegister.ts) — counts never verdicts", () => {
  const kidKeys = Object.keys(kidEn).filter((k) => KID_KEY.test(k));

  it("has kid keys, and en/he key sets are identical", () => {
    expect(kidKeys.length).toBeGreaterThan(20);
    expect(Object.keys(kidHe).sort()).toEqual(Object.keys(kidEn).sort());
  });

  it.each(kidKeys)("%s carries no %, no clinical or loss-framed copy (EN + HE)", (key) => {
    for (const dict of [kidEn, kidHe]) {
      const v = dict[key];
      expect(v, `${key} empty`).toBeTruthy();
      expect(v, `${key} renders a %`).not.toContain("%");
      expect(CLINICAL.test(v), `${key} clinical: ${v}`).toBe(false);
      expect(LOSS_FRAMED.test(v), `${key} loss-framed: ${v}`).toBe(false);
    }
  });

  it("every HE kid line is either transcreated Hebrew or an EN placeholder marked for GD-6", () => {
    // The marker means "a native reviewer still owes this line" (GD-6). A line
    // that HAS been transcreated must therefore lose it — otherwise the GD-6
    // worklist grows a permanent tail of already-done keys and the reviewer can
    // no longer grep what is actually outstanding.
    const src = readFileSync(path.join(SRC, "lib", "i18nElevation", "kidRegister.ts"), "utf8");
    const heBlock = src.slice(src.indexOf("export const he"));
    const heLines = heBlock.split("\n").filter((l) => /^\s*"elev\.(?:kid|play)\./.test(l));
    expect(heLines.length).toBe(kidKeys.length);
    for (const l of heLines) {
      const key = /^\s*"([^"]+)"/.exec(l)![1];
      const value = kidHe[key];
      if (HEBREW.test(value)) {
        expect(l, `transcreated line still marked GD-6: ${l.trim()}`).not.toContain("// GD-6");
      } else {
        expect(l, `unmarked EN placeholder: ${l.trim()}`).toContain("// GD-6");
      }
    }
  });

  it("negative control — both marker failure shapes are detectable", () => {
    // A transcreated line that kept the marker, and a placeholder that lost it.
    const transcreatedButMarked = '"elev.play.hero.rest": "הסיפור נח עכשיו!", // GD-6';
    const placeholderUnmarked = '"elev.play.hero.rest": "The story is resting",';
    expect(HEBREW.test("הסיפור נח עכשיו!") && transcreatedButMarked.includes("// GD-6")).toBe(true);
    expect(HEBREW.test("The story is resting") || placeholderUnmarked.includes("// GD-6")).toBe(false);
  });

  it("negative control — the copy the scanner replaced would have failed", () => {
    for (const old of [
      "…every answer taught us something for Mia's development picture.",
      "Every attempt counts — in video-modeling practice, the imitation effort matters more than a perfect copy.",
      "Play across 3 areas in a week",
    ]) {
      expect(CLINICAL.test(old) || /in a week/.test(old)).toBe(true);
    }
  });
});

/* ── OBJ-KID-03: the kid namespaces carry no adult vocabulary ──────────── */

/** Kid-namespace keys that legitimately name a grown-up thing, each with the
 *  reason. Kept exact: a key that gets fixed must LEAVE this list (proved
 *  below), so the list can never grow a tail of already-clean entries. */
const DICT_ADULT_ALLOWED: Record<string, string> = {
  "kid.exit.backToParent":
    "the hold-to-exit control belongs to the parent (3 s parent gate) — the label names its owner, and the child is not its reader",
  "kid.exit.backToParentAria": "the aria half of the same control",
  "kid.safety.aria":
    "retired from the kid home by KID-20/RUN-04 — the parent-side door renders elev.practice.door.* instead; key kept for dictionary parity",
  "kid.safety.locked": "the second retired reassurance chip, same reason",
};

describe("OBJ-KID-03: kid-namespace copy is written for the child, in both locales", () => {
  const KID_NS = /^(?:kid\.|elev\.(?:kid|play)\.)/;
  const flagged = (dict: Record<string, string>) =>
    Object.entries(dict)
      .filter(([k, v]) => KID_NS.test(k) && typeof v === "string" && ADULT_WORDS.test(v))
      .map(([k]) => k);

  it.each([
    ["i18n en", baseEn as Record<string, string>],
    ["i18n he", baseHe as Record<string, string>],
    ["kidRegister en", kidEn],
    ["kidRegister he", kidHe],
  ])("%s carries no undocumented adult word", (_label, dict) => {
    const undocumented = flagged(dict).filter((k) => !(k in DICT_ADULT_ALLOWED));
    expect(undocumented, `undocumented adult copy: ${undocumented.join(", ")}`).toEqual([]);
  });

  it("every allow-listed key is still a real hit (a fixed key must leave the list)", () => {
    const live = new Set([
      ...flagged(baseEn as Record<string, string>),
      ...flagged(baseHe as Record<string, string>),
      ...flagged(kidEn),
      ...flagged(kidHe),
    ]);
    for (const key of Object.keys(DICT_ADULT_ALLOWED)) {
      expect(live.has(key), `${key} is clean now — remove it from DICT_ADULT_ALLOWED`).toBe(true);
    }
  });

  it("negative control — the copy this item replaced would have failed", () => {
    for (const old of [
      "Little stories with big thinking inside — it never feels like a test.",
      "Camera privacy",
      "Copy the face — Dylan's camera scores the shape, right on the device.",
      "use the mirror game above and you be the judge!",
    ]) {
      expect(ADULT_WORDS.test(old), old).toBe(true);
    }
    // …and the kid lines that replaced them pass.
    for (const key of ["elev.play.adventures.say", "elev.play.mimic.say", "elev.play.mimic.mirrorSay", "elev.play.mimic.mirrorRest", "elev.play.mimic.rateAsk"]) {
      for (const dict of [kidEn, kidHe]) expect(ADULT_WORDS.test(dict[key]), `${key}: ${dict[key]}`).toBe(false);
    }
  });
});

/* ── KID-17: badges + objectives are EFFORT, never ability ─────────────── */

describe("KID-17: achievements and monthly objectives key on effort only", () => {
  it("no `earned` predicate references recentAccuracy or a score", () => {
    const src = stripComments(readFileSync(path.join(SRC, "practice", "achievements.ts"), "utf8"));
    const body = src.slice(src.indexOf("export function computeAchievements"));
    expect(body).not.toMatch(/recentAccuracy/);
    expect(body).not.toMatch(/\.score\b/);
    expect(body).not.toMatch(/\d+%/);
  });

  it("objective templates carry no accuracy / first-try / % target, and the picker never sorts by signal", () => {
    const src = stripComments(readFileSync(path.join(SRC, "practice", "journey.ts"), "utf8"));
    const templates = src.slice(src.indexOf("OBJECTIVE_TEMPLATES"), src.indexOf("DOMAIN_ROTATION"));
    expect(templates).not.toMatch(/%|accuracy|first-try|mostly/i);
    const picker = src.slice(src.indexOf("export function suggestObjectives"));
    expect(picker).not.toMatch(/\.signal\b/);
    expect(picker).not.toMatch(/\.sort\(/);
  });

  it("JourneyTab renders counts, never the 0–100 score or a 'Not yet' verdict", () => {
    const src = stripComments(readFileSync(path.join(SRC, "components", "practice", "JourneyTab.tsx"), "utf8"));
    expect(src).not.toMatch(/\{data\.score\}/);
    expect(src).not.toMatch(/consistency score/i);
    expect(src).not.toMatch(/Not yet/);
    expect(src).toContain("aimDomains(aimVirtues(loadCharter()))");
  });
});

describe("B-KID-04 · flat stars on completion in the kid register", () => {
  it("Beat Keeper, Pattern Power, Mind Vault and Story Quest light every star on completion (0/6 Pattern → 3 of 3)", () => {
    const read = (rel: string) => stripParentOnly(stripComments(readFileSync(path.join(SRC, rel), "utf8")));
    for (const rel of ["components/practice/BeatKeeperWorld.tsx", "components/practice/PatternPowerWorld.tsx", "components/practice/MemoryMatch.tsx"]) {
      const src = read(rel);
      expect(src, rel).toMatch(/stars=\{3\}\s*starsTotal=\{3\}/);
      expect(src, rel).not.toContain("gradeStars");
      expect(RULES.gradedStars(src), rel).toEqual([]);
    }
    expect(read("components/practice/AdventuresTab.tsx")).toContain("stars={scenario.scenes.length}");
  });

  it("the Celebrate aria is keyed EN + HE: '3 of 3 stars'", async () => {
    const { translate } = await import("./i18n");
    expect(translate("en", "elev.play.celebrate.starsAria", { n: 3, total: 3 })).toBe("3 of 3 stars");
    const he = translate("he", "elev.play.celebrate.starsAria", { n: 3, total: 3 });
    expect(he).toMatch(HEBREW);
    expect(he).toContain("3");
    const kit = readFileSync(path.join(SRC, "components/ui/playkit.tsx"), "utf8");
    expect(kit).toContain('aria-label={t("elev.play.celebrate.starsAria", { n: stars, total: starsTotal })}');
    expect(kit).not.toContain("`${stars} of ${starsTotal} stars`");
  });

  it("HE loss-framing is seen by the dictionary scan (negative control)", () => {
    for (const bad of ["שלושה ימים ברצף!", "אל תשברו את הרצף", "פספסת יום", "נגמר הזמן"]) expect(LOSS_FRAMED.test(bad), bad).toBe(true);
    expect(LOSS_FRAMED.test("כל הכבוד, סיימתם!")).toBe(false);
  });
});

/* ── B-PLAY-04 residue (law 3) — no return pressure in any key a kid surface renders ── */
describe("law 3: i18n keys referenced on kid surfaces carry no loss/return-pressure line (EN + HE)", () => {
  const ALL_HE: Record<string, string> = { ...kidHe, ...baseHe };
  const referenced = new Set<string>();
  for (const rel of KID_SURFACE_GRAPH) {
    const src = stripParentOnly(stripComments(readFileSync(path.join(SRC, rel), "utf8")));
    for (const m of src.matchAll(/\bt\(\s*"([\w.]+)"/g)) referenced.add(m[1]);
  }

  it("the scan resolved real keys, the Mimic pack-win line among them", () => {
    expect(referenced.size).toBeGreaterThan(50);
    expect(referenced.has("elev.play.mimic.packComplete.sub")).toBe(true);
  });

  it("0 referenced values are loss-framed or say 'come back tomorrow'", () => {
    const hits: string[] = [];
    for (const key of referenced) {
      for (const [lang, dict] of [["en", ALL_EN], ["he", ALL_HE]] as const) {
        const v = dict[key];
        if (v && LOSS_FRAMED.test(v)) hits.push(`${lang} ${key}: ${v}`);
      }
    }
    expect(hits).toEqual([]);
  });

  it("the pack-win close is neutral in both locales", () => {
    expect(kidEn["elev.play.mimic.packComplete.sub"]).toContain("That was a good round.");
    expect(kidHe["elev.play.mimic.packComplete.sub"]).toContain("זה היה סיבוב טוב.");
    expect(baseEn["prac.mimic.packWin.sub"]).toContain("That was a good round.");
    expect(baseHe["prac.mimic.packWin.sub"]).toContain("זה היה סבב טוב.");
  });

  it("POSITIVE CONTROL — the pre-fix EN and HE lines trip the rule", () => {
    expect(LOSS_FRAMED.test("{name} played every round in {pack}. Pick another, or come back tomorrow.")).toBe(true);
    expect(LOSS_FRAMED.test("{name} שיחק/ה את כל הסבבים ב{pack}. בחרו עוד אחת, או חזרו מחר.")).toBe(true);
    expect(LOSS_FRAMED.test("תחזור מחר!")).toBe(true);
    expect(LOSS_FRAMED.test("{name} עבר/ה את כל הסיבובים ב{pack}. אפשר לבחור ערכה אחרת, או לחזור מחר.")).toBe(true);
    expect(LOSS_FRAMED.test("That was a good round.")).toBe(false);
  });
});
