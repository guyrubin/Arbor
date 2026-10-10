/**
 * Masterplan 1.7 clinical-firewall guard — The Full Picture (route id
 * "copilot") + its Development-hub mount (constraints-lens ruling; IA canon
 * ARBOR-IA-WIREFRAME-MASTERPLAN-2026-07-03 L3: copilot's home = a CARD on the
 * Development Map Overview's Now region, never a hub pill).
 *
 * History: DevelopmentCopilot fused milestones + practice + screening + logs
 * but rendered verdict-shaped output: per-area "Discuss"/"Monitor" level chips
 * with a yellow-vs-sky tone flip, a dashboardRisk "Low"/"Moderate"/"High"
 * grade driving the TrustSafetyBar tone, the graded `${w.level}` tag in the
 * parent-visible summary, and the 0–100 developmentScore VALUE in the pulse
 * tiles (GD-10 bans band/score values). This is a Screening.firewall.test.ts-
 * style SOURCE scan: it fails the build if any of those mechanisms reappear.
 *
 * Deliberately NOT banned: outcome-gated CTA PRESENCE (the escalate button may
 * key its visibility on the internal signal — `watch.some(level === "discuss")`
 * / `riskLevel !== "Low"` — as long as no grade renders and no tone flips).
 */
import { readFileSync, readdirSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const copilotSrc = readFileSync(path.join(here, "..", "..", "consult", "clinicianSummary.ts"), "utf8");
// Parity 9 Oct: #/development is the child portrait (with its watch row and
// keepsake disclosure); the Growth hub file is gone.
const devTabSrc = ["ChildPortrait.tsx", "PortraitWatchRow.tsx", "PortraitKeepsakes.tsx"]
  .map((f) => readFileSync(path.join(here, "..", "companion", f), "utf8")).join("\n");

/* ── Banned patterns ─────────────────────────────────────────────────────────
   B1 — the "Discuss"/"Monitor" verdict chip labels (graded level tags).
        Exact-quoted so the "monitoring" icon name stays legal.
   B2 — any watch-level conditional driving a graded tone string within a JSX
        ternary window (the yellow-vs-sky chip flip and the section's
        yellow-vs-mint flip both lived inside 240 chars).
   B3 — the dashboardRisk identifier (the graded risk value) in any form.
   B4 — TrustSafetyBar receiving a risk prop (the grade drove its tone).
   B5 — the graded risk union type ("Low" | "Moderate" | "High").
   B6 — the developmentScore VALUE render ({data.score}) — GD-10.
   B7 — any JSX/template interpolation of a band value or watch level
        (`${w.level}`, `{b.band}`), and the banned trend helpers. */
const B1_LEVEL_TAGS = /["']Discuss["']|["']Monitor["']/;
const B2_LEVEL_TONE = /level\s*===?\s*["']discuss["'][\s\S]{0,240}?["'](?:yellow|pink|mint|sky)["']/;
const B3_DASHBOARD_RISK = /\bdashboardRisk\b/;
const B4_TRUSTBAR_RISK = /<TrustSafetyBar[\s\S]{0,200}?\brisk\s*=/;
const B5_RISK_UNION = /["']Low["']\s*\|\s*["']Moderate["']\s*\|\s*["']High["']/;
const B6_SCORE_RENDER = /\{\s*data\.score\s*\}/;
const B7_BAND_OR_LEVEL_RENDER = /\$\{w\.level\}|\{\s*\w+\.band\b\s*\}|\$\{\s*\w+\.band\b\s*\}|\bbandTrend\b|\bdevelopmentTrajectory\b/;

/* ── Negative controls: the regexes MUST catch the OLD mechanism ─────────────
   Verbatim fixtures of the pre-1.7 DevelopmentCopilot.tsx lines. If a refactor
   ever weakens a regex past recognizing these, this half fails first — the
   guard can never rot into a vacuous pass. */
const OLD_RISK_DECL = `const dashboardRisk: "Low" | "Moderate" | "High" =
    childProfile.riskLevel === "High" ? "High" :
    watch.some((w) => w.level === "discuss") || childProfile.riskLevel === "Moderate" ? "Moderate" :
    "Low";`;
const OLD_TRUSTBAR = `<TrustSafetyBar
        risk={dashboardRisk}`;
const OLD_SECTION_FLIP = `<SectionCard title="Watch signals" icon={<Icon name="warning" size={20} />} tone={watch.some((w) => w.level === "discuss") ? "yellow" : "mint"}>`;
const OLD_CHIP_FLIP = `const tone = w.level === "discuss" ? "yellow" : "sky";`;
const OLD_CHIP_TAG = `<Chip tone={tone}>{w.level === "discuss" ? "Discuss" : "Monitor"}</Chip>`;
const OLD_SUMMARY_LEVEL = 'watch.forEach((w) => lines.push(`  • ${w.area}: ${w.level}; evidence: ${w.evidence.join("; ")}`));';
const OLD_SCORE_TILE = `<p className="text-2xl font-extrabold" style={{ color: "var(--arbor-ink)" }}>{data.score}</p>`;

describe("1.7 firewall guard — regexes still recognize the OLD banned mechanism", () => {
  it("catches the graded dashboardRisk declaration and its union type", () => {
    expect(B3_DASHBOARD_RISK.test(OLD_RISK_DECL)).toBe(true);
    expect(B5_RISK_UNION.test(OLD_RISK_DECL)).toBe(true);
  });
  it("catches TrustSafetyBar being fed the graded risk", () => {
    expect(B4_TRUSTBAR_RISK.test(OLD_TRUSTBAR)).toBe(true);
    expect(B3_DASHBOARD_RISK.test(OLD_TRUSTBAR)).toBe(true);
  });
  it("catches the watch-level tone flips (section and chip)", () => {
    expect(B2_LEVEL_TONE.test(OLD_SECTION_FLIP)).toBe(true);
    expect(B2_LEVEL_TONE.test(OLD_CHIP_FLIP)).toBe(true);
  });
  it("catches the Discuss/Monitor verdict chip labels", () => {
    expect(B1_LEVEL_TAGS.test(OLD_CHIP_TAG)).toBe(true);
  });
  it("catches the graded ${w.level} tag in the parent-visible summary", () => {
    expect(B7_BAND_OR_LEVEL_RENDER.test(OLD_SUMMARY_LEVEL)).toBe(true);
  });
  it("catches the developmentScore value tile (GD-10)", () => {
    expect(B6_SCORE_RENDER.test(OLD_SCORE_TILE)).toBe(true);
  });
});

describe("B-GROWTH-22 — the migrated summary preserves the firewall", () => {
  it("no graded tag, tone, risk, score or band reaches the summary", () => {
    for (const pattern of [B1_LEVEL_TAGS, B2_LEVEL_TONE, B3_DASHBOARD_RISK, B4_TRUSTBAR_RISK, B5_RISK_UNION, B6_SCORE_RENDER, B7_BAND_OR_LEVEL_RENDER]) {
      expect(copilotSrc).not.toMatch(pattern);
    }
    expect(copilotSrc).toContain("assertClinicianExportCeiling(text)");
  });
  it("the current portrait keeps the existing count record without a duplicate copilot door", () => {
    expect(devTabSrc).not.toContain('setActiveTab("copilot")');
    for (const name of ["SpineRibbon", "PushPrimingCard", "RitualTurnCard"]) expect(devTabSrc).not.toContain(`<${name}`);
    expect(devTabSrc).toContain('view === "domain"');
  });
});

/* ── GP-05 / AI-08 (2026-09-03): the ONE-caller B4 assertion above is now a
   REPO-WIDE scan. TrustSafetyBar is constant-posture (kit.tsx): no call site
   anywhere under components/ may feed it a `risk` EXPRESSION or a graded
   literal. The two legacy `risk="Low"` literal sites (FeelingsLabTab,
   SpeechCoachTab — owned by another lane) are an inert constant (the prop
   type is narrowed to `"Low"` and ignored) and sit on a SHRINK-ONLY ratchet:
   the count may only go down. */
const componentsRoot = path.join(here, "..");
const listTsx = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    if (statSync(full).isDirectory()) return name === "__snapshots__" ? [] : listTsx(full);
    return /\.tsx$/.test(name) && !/\.test\.tsx$/.test(name) ? [full] : [];
  });
const TRUSTBAR_TAG = /<TrustSafetyBar\b[\s\S]*?\/?>/g;
const RISK_EXPRESSION = /\brisk\s*=\s*\{/;
const RISK_GRADED_LITERAL = /\brisk\s*=\s*["'](?:Moderate|High)["']/;
const RISK_LOW_LITERAL = /\brisk\s*=\s*["']Low["']/;
const RISK_LOW_LITERAL_BASELINE = 2;
const OLD_COACHTAB_TRUSTBAR = `<TrustSafetyBar
          risk={lastMessage.contract ? riskFromLevel(lastMessage.contract.riskLevel) : parseRisk(lastMessage.text)}
          note={t("coach.trust.note")}
          lang={uiLang}
          onEscalate={() => setActiveTab("consult")}
        />`;

describe("GP-05 repo-wide — no <TrustSafetyBar> call site passes a risk expression or grade", () => {
  const sites = listTsx(componentsRoot).flatMap((file) =>
    (readFileSync(file, "utf8").match(TRUSTBAR_TAG) ?? []).map((tag) => ({ file: path.relative(componentsRoot, file), tag })),
  );

  it("negative control: the regexes catch the OLD CoachTab and DevelopmentCopilot call sites", () => {
    expect(RISK_EXPRESSION.test(OLD_COACHTAB_TRUSTBAR)).toBe(true);
    expect(RISK_EXPRESSION.test(OLD_TRUSTBAR)).toBe(true);
    expect(RISK_GRADED_LITERAL.test('<TrustSafetyBar risk="High" />')).toBe(true);
    expect(TRUSTBAR_TAG.test(OLD_COACHTAB_TRUSTBAR)).toBe(true);
    TRUSTBAR_TAG.lastIndex = 0;
  });

  it("scans a non-trivial number of call sites (the walker is not vacuous)", () => {
    // Parity 9 Oct: 6 -> 5 — sections/ScreeningSheet.tsx (dead since the
    // companion rewrite, deleted with it) carried the sixth call site.
    expect(sites.length).toBeGreaterThanOrEqual(4);
    expect(sites.some((s) => s.file.endsWith("CoachTab.tsx"))).toBe(true);
  });

  it("no call site passes risk={…} or a Moderate/High literal", () => {
    for (const { file, tag } of sites) {
      expect(tag, `${file} feeds TrustSafetyBar a risk expression`).not.toMatch(RISK_EXPRESSION);
      expect(tag, `${file} feeds TrustSafetyBar a graded risk literal`).not.toMatch(RISK_GRADED_LITERAL);
    }
  });

  it(`legacy risk="Low" literal sites only shrink (baseline ${RISK_LOW_LITERAL_BASELINE})`, () => {
    const lowSites = sites.filter((s) => RISK_LOW_LITERAL.test(s.tag)).map((s) => s.file);
    expect(lowSites.length, `risk="Low" sites: ${lowSites.join(", ")}`).toBeLessThanOrEqual(RISK_LOW_LITERAL_BASELINE);
  });

  it("CoachTab dropped riskFromLevel/parseRisk and gates the escalate action on the internal signal", () => {
    const coachSrc = readFileSync(path.join(componentsRoot, "tabs", "CoachTab.tsx"), "utf8");
    expect(coachSrc).not.toMatch(/\bparseRisk\b|\briskFromLevel\b/);
    expect(coachSrc).toContain("onEscalate={escalationSignal ? () => setActiveTab(\"consult\") : undefined}");
  });
});
