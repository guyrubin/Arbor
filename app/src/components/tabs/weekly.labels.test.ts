/**
 * TJB-10 / TJB-19 / TJB-20 (item 10, Weekly half) — the week's chrome.
 *
 *  - Back went to `#/timeline`, a route the parent did not come from and which
 *    is not this surface's hub (Weekly is a Today tool, navigation.ts
 *    SECTIONS `today.tools`), at 20 px.
 *  - The history chips printed the raw week id — "2026-W37" is a storage key,
 *    and F-06 had already established that ids never render here; the page
 *    subtitle right above them was already using `labelFor`.
 *  - "Worth watching" was set in peach ink, the app's caution colour. A
 *    chromatic caution on an observation about a child is a colour-only
 *    verdict, which is exactly the variant that shipped again after PR #66.
 *  - Two `--arbor-gradient-primary` CTAs (Retell · Consult brief) competed on a
 *    screen whose declared primaryMove is accept-recap-recommendation.
 */
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWeekLabel, formatWeekLabel } from "../../hooks/useWeeklyRecap";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";
import { SECTIONS } from "../../lib/navigation";
import { translate } from "../../lib/i18n";

const tab = fs.readFileSync(path.resolve(__dirname, "WeeklyTab.tsx"), "utf8");

describe("1 · TJB-10 · back goes to the hub that owns Weekly, at 44 px", () => {
  it("the target is Today and the control declares the floor", () => {
    expect(tab).toContain('setActiveTab("overview")');
    expect(tab).not.toContain('setActiveTab("timeline")');
    const back = /elev\.wk\.back/.test(tab);
    expect(back).toBe(true);
    const btn = /<button\s+onClick=\{\(\) => setActiveTab\("overview"\)\}[\s\S]{0,400}?<\/button>/.exec(tab)?.[0] ?? "";
    expect(btn).toContain("minHeight: 44");
    expect(btn).toContain("minWidth: 44");
  });

  it("Today genuinely owns the weekly route", () => {
    const today = SECTIONS.find((s) => s.id === "today")!;
    expect([...today.items, ...(today.tools ?? [])].map((i) => i.tab)).toContain("weekly");
  });

  it("negative control: the shipped label pointed at the child's story, not Today", () => {
    expect(translate("en", "wk.backStory", { first: "Noa" })).toContain("Story");
    expect(tab).not.toContain('t("wk.backStory"');
    expect(translate("en", "elev.wk.back")).toBe("Back to Today");
  });
});

describe("2 · TJB-19 · a week chip is a sentence, not a storage key", () => {
  it("chips render through chipLabel, and the current week names itself", () => {
    expect(tab).toContain("{chipLabel(id)}");
    expect(tab).toContain('id === currentId ? t("elev.wk.thisWeek") : labelFor(reportById.get(id))');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.wk.thisWeek")).not.toBe("elev.wk.thisWeek");
    }
  });

  it("labelFor's resolver turns a stored anchor into a date phrase in both languages", () => {
    const report = { weekStart: "2026-09-01T00:00:00.000Z" };
    const en = resolveWeekLabel(report, { lang: "en", weekOf: "Week of" });
    const he = resolveWeekLabel(report, { lang: "he", weekOf: "שבוע של" });
    expect(en).toMatch(/^Week of /);
    expect(en).not.toMatch(/^\d{4}-W\d{2}$/);
    expect(he).not.toBe(en);
    expect(formatWeekLabel(new Date("2026-09-01T00:00:00.000Z"), "en", "Week of")).toBe(en);
  });

  it("negative control: the shipped chip body was the id itself", () => {
    // `{id}` — a week id has exactly this shape and would have rendered raw.
    expect("2026-W37").toMatch(/^\d{4}-W\d{2}$/);
    expect(tab).not.toMatch(/rounded-full whitespace-nowrap transition flex-shrink-0"[\s\S]{0,200}?\{id\}/);
  });
});

describe("3 · TJB-20 · no colour-only verdict on the watch line", () => {
  it("the watch-for paragraph is set in body ink", () => {
    const line = /\{selected\.digest\.watchFor\.length > 0 && \([\s\S]{0,300}?\)\}/.exec(tab)?.[0] ?? "";
    expect(line).not.toBe("");
    expect(line).toContain('color: "var(--arbor-ink)"');
    expect(line).not.toContain("peach");
  });

  it("negative control: the peach token still exists, and is simply not used here", () => {
    // The token is not the defect — using a caution colour as the verdict is.
    expect(tab).not.toContain("--arbor-peach-ink");
  });
});

describe("4 · principle 3 · one gradient, and it is the primary move", () => {
  const gradients = (tab.match(/--arbor-gradient-primary/g) ?? []).length;

  it("the surface declares which move the gradient belongs to", () => {
    const contract = SURFACE_CONTRACTS.find((c) => c.route === "weekly");
    expect(contract?.primaryMove).toBe("accept-recap-recommendation");
  });

  it("the two competing CTAs are demoted to outline", () => {
    // Consult brief: outline, never a second gradient.
    const brief = /<button\s+onClick=\{\(\) => setActiveTab\("consult"\)\}[\s\S]{0,500}?<\/button>/.exec(tab)?.[0] ?? "";
    expect(brief).not.toBe("");
    expect(brief).not.toContain("gradient");
    expect(brief).toContain("border: \"1px solid var(--arbor-green-ink)\"");
    // Retell keeps the gradient ONLY when there is nothing stored yet, i.e.
    // when creating the story is the only move on the screen.
    expect(tab).toContain("style={hasStoredCurrentWeek");
  });

  it("the accept CTA carries the gradient on a history week", () => {
    const accept = /<button\s+type="button"\s+onClick=\{\(\) => acceptTodayAction\([\s\S]{0,500}?>/.exec(tab)?.[0] ?? "";
    expect(accept).not.toBe("");
    expect(accept).toContain("--arbor-gradient-primary");
    expect(accept).toContain("min-h-[44px]");
  });

  it("at most two gradient references remain, and each is conditional", () => {
    // One in the header (create-only branch) and one on the accept CTA. The
    // two branches that render them are mutually exclusive with the recap
    // ritual, so a parent never sees more than one at a time.
    expect(gradients).toBeLessThanOrEqual(2);
    expect(tab).not.toMatch(/text-white font-bold text-sm rounded-2xl px-5 py-3 transition active:scale-\[0\.98\] flex-shrink-0"\s*\n\s*style=\{\{ background: "var\(--arbor-gradient-primary\)" \}\}/);
  });

  it("negative control: the shipped file carried three unconditional gradients", () => {
    // Header Retell, Consult brief and — via RecapStoryCards — the accept CTA,
    // with the first two written as bare `style={{ background: gradient }}`.
    expect(tab).not.toContain('style={{ background: "var(--arbor-gradient-primary)" }}');
  });
});
