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
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { en as fpEn, he as fpHe } from "../../lib/i18nElevation/fullpicture";

const here = path.dirname(fileURLToPath(import.meta.url));
const copilotSrc = readFileSync(path.join(here, "DevelopmentCopilot.tsx"), "utf8");
const devTabSrc = readFileSync(path.join(here, "..", "tabs", "DevelopmentTab.tsx"), "utf8");

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

describe("1.7 firewall guard — DevelopmentCopilot.tsx source is clean", () => {
  it("has no Discuss/Monitor verdict tags", () => {
    expect(copilotSrc).not.toMatch(B1_LEVEL_TAGS);
  });
  it("has no watch-level conditional driving a graded tone", () => {
    expect(copilotSrc).not.toMatch(B2_LEVEL_TONE);
  });
  it("has no dashboardRisk grade and no graded risk union type", () => {
    expect(copilotSrc).not.toMatch(B3_DASHBOARD_RISK);
    expect(copilotSrc).not.toMatch(B5_RISK_UNION);
  });
  it("never feeds TrustSafetyBar a risk prop (constant posture tone)", () => {
    expect(copilotSrc).not.toMatch(B4_TRUSTBAR_RISK);
    // …but the bar itself must still be mounted (posture text stays).
    expect(copilotSrc).toContain("<TrustSafetyBar");
  });
  it("renders no band value, watch level, score value, or trend helper (GD-10)", () => {
    expect(copilotSrc).not.toMatch(B6_SCORE_RENDER);
    expect(copilotSrc).not.toMatch(B7_BAND_OR_LEVEL_RENDER);
  });
  it("resolves its copy from i18nElevation/fullpicture (positive control)", () => {
    expect(copilotSrc).toContain("i18nElevation/fullpicture");
    expect(copilotSrc).toContain("elev.fullpicture.");
  });
});

describe("1.7 zero-regression — every capability stays reachable, reframed", () => {
  it("keeps the escalate path (find-pro), gated on the internal signal only", () => {
    expect(copilotSrc).toContain('setActiveTab("find-pro")');
    expect(copilotSrc).toContain("escalationSignal");
  });
  it("keeps all sections: domain picture, weekly focus, conversation rows, history, pulse, clinician summary", () => {
    expect(copilotSrc).toContain("Domain picture");
    expect(copilotSrc).toContain("This week's focus");
    expect(copilotSrc).toContain("elev.fullpicture.watch.title");
    expect(copilotSrc).toContain("Weekly history");
    expect(copilotSrc).toContain("Share with a professional");
    expect(copilotSrc).toContain('setActiveTab("reports")');
    expect(copilotSrc).toContain("copilot_summary_copied");
  });
  it("keeps the observational row register: neutral lav chips + observation counts", () => {
    expect(copilotSrc).toContain('Chip tone="lav"');
    expect(copilotSrc).toContain("elev.fullpicture.watch.row.");
  });
});

describe("1.7 mount — DevelopmentTab hosts the Full Picture card and the SpineRibbon", () => {
  it("mounts the SpineRibbon with the registered elev.spine.growth string", () => {
    expect(devTabSrc).toContain("<SpineRibbon");
    expect(devTabSrc).toContain("elev.spine.growth");
    expect(devTabSrc).toContain("growth-spine-ribbon");
  });
  it("hosts the Full Picture entry card (title, promise, count teaser, CTA)", () => {
    expect(devTabSrc).toContain('data-testid="full-picture-card"');
    expect(devTabSrc).toContain("elev.fullpicture.title");
    expect(devTabSrc).toContain("elev.fullpicture.card.promise");
    expect(devTabSrc).toContain("elev.fullpicture.card.teaser");
    expect(devTabSrc).toContain('setActiveTab("copilot")');
  });
  it("links to copilot exactly once (upgraded tile, no duplicate)", () => {
    expect((devTabSrc.match(/setActiveTab\("copilot"\)/g) ?? []).length).toBe(1);
  });
});

describe("1.7 i18n — fullpicture module en/he parity", () => {
  it("has identical key sets in both languages, all elev.fullpicture.*-namespaced", () => {
    const enKeys = Object.keys(fpEn).sort();
    const heKeys = Object.keys(fpHe).sort();
    expect(enKeys).toEqual(heKeys);
    for (const k of enKeys) expect(k.startsWith("elev.fullpicture.")).toBe(true);
  });
  it("keeps the surface title in parent language in both registers", () => {
    expect(fpEn["elev.fullpicture.title"]).toBe("The Full Picture");
    expect(fpHe["elev.fullpicture.title"]).toBe("התמונה המלאה");
  });
});
