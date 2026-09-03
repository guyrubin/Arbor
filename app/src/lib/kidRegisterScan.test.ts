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

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(__dirname, "..");

/* ── Scope: KidModeOverlay's surface graph ─────────────────────────────── */

const KID_SURFACE_GRAPH = [
  // the shell
  "components/kidmode/KidModeOverlay.tsx",
  "components/kidmode/KidDashboard.tsx",
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
  // child-facing primitives
  "components/ui/playkit.tsx",
  // child-adjacent parent surface (KID-17) — scanned for the clinical class
  "components/practice/JourneyTab.tsx",
];

/** In the WORLDS table but unreachable from Kid Mode: `isNew` filters it out
 *  of the arcade grid and no KidDashboard tile pre-selects it. It is a
 *  parent-register surface by its own header. Listed so the exclusion is a
 *  conscious decision, not an omission. */
const EXCLUDED: Record<string, string> = {
  "components/practice/WordWorldTab.tsx": "parent-register by design; not reachable from any Kid Mode tile (KID-06 sequencing)",
};

type RuleId = "pct" | "kitShell" | "nav" | "download" | "clinical" | "confetti" | "smallBtn";

/** Shrink-only baseline: EXACT counts. Fixing a hit must lower the number. */
const FROZEN: Partial<Record<string, Partial<Record<RuleId, { count: number; reason: string }>>>> = {
  "components/practice/EarlyReadingTrack.tsx": {
    kitShell: { count: 1, reason: "lane K deferred: the parent SectionCard shell inside Spell Forge → PlayPanel swap is a separate slice" },
  },
  "components/practice/JourneyTab.tsx": {
    kitShell: { count: 4, reason: "parent-register surface (#/journey) — SectionCard is its legitimate chrome; scanned for pct/nav/verdict copy" },
    nav: { count: 1, reason: "parent-register surface — the 'Aimed extra' link is a legitimate parent navigation" },
    clinical: { count: 1, reason: "parent-register disclaimer ('never a diagnostic chart') — legitimate honesty copy for the parent, not kid-facing" },
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
  confetti: (src) => [...src.matchAll(/\bconfetti\(/g)].map((m) => m[0]),
  smallBtn: (src) =>
    // `(?<==)>` lets an arrow function's `=>` inside an attribute pass without ending the tag.
    [...src.matchAll(/<button\b(?:[^>]|(?<==)>)*>/g)]
      .map((m) => m[0])
      .filter((tag) => /\b(?:py-1|py-1\.5|p-2)(?=["'\s])/.test(tag)),
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
    ["pct", "style={{ width: `${Math.round(coverage * 100)}%` }}"], // CSS length, not a numeral render
    ["pct", 'background: "linear-gradient(135deg, var(--a), #fff 75%)"'],
    ["kitShell", 'import { SectionCard, cardCls } from "../ui/kit";'], // an import is not a render
    ["nav", "const nav = useKidSafeNav(); {nav && <PlayButton onClick={() => nav(\"comics\")} />}"],
    ["download", 'import { downloadPracticeStampCanvas } from "../../lib/heroAvatarCanvas";'],
    ["clinical", "const emotionAccuracy = useMemo(() => 0, []);"], // an identifier, not copy
    ["clinical", '{t("prac.speech.progress.stat", { tries: s.attempts, accuracy: s.recentAccuracy })}'],
    ["confetti", 'import { celebrate } from "../../lib/celebrate"; celebrate({ kind: "play" });'],
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
      expect(src, `${rel} kid remainder must still render a PlayHeader`).toContain("<PlayHeader");
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

const LOSS_FRAMED = /in a row|streak|don'?t break|days? straight|consecutiv|hurry|time'?s up|missed|you lost/i;
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

  it("every HE placeholder for a kid key is marked for the GD-6 native reviewer", () => {
    const src = readFileSync(path.join(SRC, "lib", "i18nElevation", "kidRegister.ts"), "utf8");
    const heBlock = src.slice(src.indexOf("export const he"));
    const placeholderLines = heBlock.split("\n").filter((l) => /^\s*"elev\.(?:kid|play)\./.test(l));
    expect(placeholderLines.length).toBe(kidKeys.length);
    for (const l of placeholderLines) expect(l, `unmarked placeholder: ${l.trim()}`).toContain("// GD-6");
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
