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
 *
 * v3 F-NOW-3 re-pins (the Weekly report as the v3 mock): the chip strip became
 * Previous week / Next week, which still name a week through chipLabel (§2);
 * the letter and its watch line left the route, so §3 now pins that no watch
 * line and no caution token exist at all; the Retell CTA left with the letter,
 * so §4 pins ONE gradient, on the band's accept, and a plain text link to
 * write the report; §5's module lists read the report's states, its one
 * <details> holds the invite (B-SHELL-29), and the email row left #/weekly
 * for #/smart-reminders' Delivery section (WeeklyEmailRow). The summary door
 * opens the Care summary (#/handoff, FEAT-09) instead of #/consult, and the
 * stale "Back to Today" key (elev.wk.back) is deleted: the band's
 * elev.wk.carry.back is the page's one back key.
 */
import { WEEKLY_COPY } from "../weekly/v10/weeklyCopy";
import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { resolveWeekLabel, formatWeekLabel } from "../../hooks/useWeeklyRecap";
import { SURFACE_CONTRACTS } from "../../lib/surfaceContract";
import { SECTIONS } from "../../lib/navigation";
import { backTargetFor } from "../../lib/companionPlaces";
import { translate } from "../../lib/i18n";

const tab = fs.readFileSync(path.resolve(__dirname, "WeeklyTab.tsx"), "utf8");

describe("1 · TJB-10 · back goes to the hub that owns Weekly, at 44 px", () => {
  it("the target is Today and the control declares the floor", () => {
    expect(tab).not.toContain('t("elev.wk.back")');
    expect(tab).not.toContain('setActiveTab("timeline")');
    const shell = fs.readFileSync(path.resolve(__dirname, "../layout/Shell.tsx"), "utf8");
    // v3 IA-01 re-pin: Shell's Back goes to the route's home (backTargetFor),
    // and for Weekly that home is still Today.
    expect(shell).toContain("setActiveTab(back.tab)");
    expect(backTargetFor("weekly")?.tab).toBe("overview");
    expect(shell).toMatch(/data-testid="secondary-place-back"[\s\S]{0,220}min-h-11/);
  });

  it("Today genuinely owns the weekly route", () => {
    const today = SECTIONS.find((s) => s.id === "today")!;
    expect([...today.items, ...(today.tools ?? [])].map((i) => i.tab)).toContain("weekly");
  });

  it("negative control: the shipped label pointed at the child's story, not Today", () => {
    expect(translate("en", "wk.backStory", { first: "Noa" })).toContain("Story");
    expect(tab).not.toContain('t("wk.backStory"');
    // v3 F-NOW-3: the stale back key is deleted (translate returns the key);
    // the band's elev.wk.carry.back is the one back key left on the page.
    expect(translate("en", "elev.wk.back")).toBe("elev.wk.back");
    expect(translate("he", "elev.wk.back")).toBe("elev.wk.back");
  });

  /* v3 F-NOW-3: the report's carry band ends with its own way back to Today
     (the v3 "Now"), at the 44 px floor, under its own key. */
  it("v3 F-NOW-3: the band's way back goes to Today, at 44 px, in both languages", () => {
    const back = tab.slice(tab.indexOf('data-testid="weekly-carry-back"'), tab.indexOf("</button>", tab.indexOf('data-testid="weekly-carry-back"')));
    expect(back).toContain('onClick={() => setActiveTab("overview")}');
    expect(back).toMatch(/className=\{acceptRendered \? "ds-link" : "btn primary sm"\}/);
    expect(back).toContain('t("elev.wk.carry.back")');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.wk.carry.back")).not.toBe("elev.wk.carry.back");
    }
  });
});

describe("2 · TJB-19 · a week is named by a sentence, not a storage key", () => {
  /* v3 F-NOW-3 re-pin: the chip strip is now Previous week / Next week; each
     step names the week it opens through chipLabel (its aria-label). */
  it("Previous / Next name their week through chipLabel, and the current week names itself", () => {
    expect(tab).toContain('aria-label={t(dir === "prev" ? "elev.wk.prev.aria" : "elev.wk.next.aria", { week: chipLabel(id) })}');
    expect(tab).toContain('id === currentId ? t("elev.wk.thisWeek") : labelFor(reportById.get(id))');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.wk.thisWeek")).not.toBe("elev.wk.thisWeek");
      expect(translate(lang, "elev.wk.prev.aria", { week: "W" })).toContain("W");
      expect(translate(lang, "elev.wk.next.aria", { week: "W" })).toContain("W");
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
    expect(tab).not.toMatch(/>\s*\{id\}\s*</);
    expect(tab).not.toMatch(/rounded-full whitespace-nowrap transition flex-shrink-0"[\s\S]{0,200}?\{id\}/);
  });
});

describe("3 · TJB-20 · no colour-only verdict on the page", () => {
  /* v3 F-NOW-3 re-pin: the watch line left with the letter. The rule holds
     harder: no watch line at all, and no caution token in the report. */
  it("no watch line is rendered, in any ink", () => {
    expect(tab).not.toMatch(/watchFor/);
  });

  it("negative control: the peach token still exists, and is simply not used here", () => {
    // The token is not the defect — using a caution colour as the verdict is.
    expect(tab).not.toContain("--arbor-peach-ink");
    const dir = path.resolve(__dirname, "../weekly/v10");
    const v10 = fs.readdirSync(dir).filter((f) => !f.includes(".test.")).map((f) => fs.readFileSync(path.join(dir, f), "utf8")).join("\n");
    expect(v10).not.toMatch(/peach/);
  });
});

describe("4 · principle 3 · one gradient, and it is the primary move", () => {
  const gradients = (tab.match(/--arbor-gradient-primary/g) ?? []).length;

  it("the surface declares which move the gradient belongs to", () => {
    const contract = SURFACE_CONTRACTS.find((c) => c.route === "weekly");
    expect(contract?.primaryMove).toBe("accept-recap-recommendation");
  });

  /* v3 F-NOW-3 re-pin: Retell (generateIsMove) left with the letter. The
     report writes itself; while none exists, one plain text link can ask for
     it, never a gradient and never the stamp. The summary door stays outline. */
  it("the competing CTAs are outline or a text link", () => {
    const door = /const summaryDoor = [\s\S]*?<\/button>/.exec(tab)?.[0] ?? "";
    expect(door).not.toBe("");
    expect(door).toContain("onClick={openSummary}");
    expect(door).not.toMatch(/gradient|primary/);
    expect(door).toContain("btn ghost");
    expect(tab).toContain('const openSummary = () => setActiveTab("handoff");');
    const write = tab.slice(tab.indexOf('data-testid="weekly-generate"'), tab.indexOf("</button>", tab.indexOf('data-testid="weekly-generate"')));
    expect(write).toContain('className="ds-link"');
    expect(write).not.toMatch(/gradient|ACCEPT_STAMP|data-primary-move/);
    expect(tab).not.toContain("generateIsMove");
  });

  /* v10: the design system's one filled control (`btn primary`) is the
     primary move; the page carries no gradient. */
  it("the accept CTA is the filled primary control and carries the stamp", () => {
    const at = tab.indexOf('data-testid="weekly-accept"');
    const accept = tab.slice(tab.lastIndexOf("<button", at), tab.indexOf("</button>", at));
    expect(accept).toContain("{...ACCEPT_STAMP}");
    expect(accept).toContain('className="btn primary sm"');
  });

  it("no gradient on the page; the filled primary appears only on the two stamped controls", () => {
    expect(gradients).toBe(0);
    expect((tab.match(/btn primary sm/g) ?? []).length).toBe(2);
  });

  it("negative control: the shipped file carried three unconditional gradients", () => {
    // Header Retell, Consult brief and — via RecapStoryCards — the accept CTA,
    // with the first two written as bare `style={{ background: gradient }}`.
    expect(tab).not.toContain('style={{ background: "var(--arbor-gradient-primary)" }}');
  });
});

/**
 * B-TODAY-22 — Weekly page: one story, one secondary door. The generated
 * week renders ≤3 non-demoted modules with one nested level at most; the
 * Scholar spotlight and the weekly read (picked by devScore.focusDomain, a
 * hidden weakest-domain pointer) are gone; ONE outline door to the visit
 * summary; the email row hides until the channel exists or the parent opted
 * in; the empty state is stamped with its explicit secondary move; no
 * bg-white.
 */
describe("5 · B-TODAY-22 · one report, one secondary door", () => {
  const code = tab.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const stamps = [...code.matchAll(/<div data-module="(weekly-[a-z]+)"([^>]*)>/g)].map((m) => ({ id: m[1], demoted: /data-module-demoted/.test(m[2]) }));

  /* v3 F-NOW-3 re-pin: the letter's states (weekly-recap, weekly-insight)
     left the route. The tab stamps the empty card and the carry band; the
     dashboard (weekly-glance) is stamped by WeekGlance and takes the empty
     card's place. The invite is the one demoted module. */
  /* v10 re-pin: four numbered stops, each stamped by the tab: the week
     (weekly-glance) or the empty card, what helped (only beside records), the
     carry band and your day. The invite stays the one demoted module. */
  it("the non-demoted modules fit the contract; the empty card and the week exclude each other", () => {
    const top = stamps.filter((s) => !s.demoted).map((s) => s.id).sort();
    expect(top).toEqual(["weekly-carry", "weekly-day", "weekly-helped"]);
    // + the stage's one shared stamp (the week or the empty card).
    expect(code.match(/\{\.\.\.stageStamp\}/g)).toHaveLength(2);
    expect(top.length + 1).toBeLessThanOrEqual(SURFACE_CONTRACTS.find((c) => c.route === "weekly")!.moduleBudget);
    expect(stamps.filter((s) => s.demoted).map((s) => s.id).sort()).toEqual(["weekly-invite"]);
    expect(code).toMatch(/\{stage === "weekly-glance" && week \? \(\s*<div \{\.\.\.stageStamp\} data-testid="weekly-glance"[\s\S]*?\) : stage === "weekly-empty" \? \(\s*<div \{\.\.\.stageStamp\}/);
  });

  it("the week's stage carries no move of its own", () => {
    const stage = code.slice(code.indexOf('stage === "weekly-glance" && week ? ('), code.indexOf('stage === "weekly-empty" ? ('));
    expect(stage).not.toMatch(/data-primary-move|ACCEPT_STAMP|data-secondary-move/);
  });

  /* v3 F-NOW-3 re-pin: the milestone wins left with the letter (the
     Milestones tile is their door now); the page's one <details> holds the
     invite (B-SHELL-29 keeps its home on Weekly). */
  it("one <details>, holding the invite only — one nested level at most", () => {
    expect((code.match(/<details\b/g) ?? []).length).toBe(1);
    const details = code.slice(code.indexOf("<details"), code.indexOf("</details>"));
    expect(details).toContain('data-module="weekly-invite"');
    expect(details).toContain('t("elev.words.invite.title")');
    expect(details).toContain("<InviteCard />");
    expect(details).not.toMatch(/weekly-email|weekly-share|weekly-detail|aria-expanded|setActiveTab\("overview"\)/);
  });

  it("no Scholar spotlight and no weekly read — no Latin catalogue copy on the Hebrew route", () => {
    expect(code).not.toMatch(/spotlight|weeklyRead|scholarsInfo|useDevScore|setActiveTab\("scholar"\)/);
    const hook = fs.readFileSync(path.resolve(__dirname, "../../hooks/useWeeklyRecap.ts"), "utf8");
    expect(hook).not.toMatch(/scholarsInfo|spotlight: \{ name/);
  });

  /* v3 F-NOW-3 re-pin (orchestrator decision, adversarial review finding 2):
     the one door opens the Care summary (#/handoff, FEAT-09), the summary the
     v3 mock's "Add to the summary" names. Still exactly ONE door handler, and
     #/consult is no longer opened from the report at all. */
  /* v10 re-pin: the door is named "Visit summary" (COPY-RULES) and still
     opens the summary (#/handoff folds into Care › Visits). The Next visit
     tile's "Prepare" link is the one way to Care › Visits from the report. */
  it("ONE outline door, 'Add to the visit summary' → #/handoff (EN + HE); one Prepare link → #/consult", () => {
    expect((code.match(/setActiveTab\("handoff"\)/g) ?? []).length).toBe(1);
    expect((code.match(/setActiveTab\("consult"\)/g) ?? []).length).toBe(1);
    expect(code).toContain("{copy.addToSummary}");
    expect(WEEKLY_COPY.en.addToSummary).toBe("Add to the visit summary");
    expect(WEEKLY_COPY.he.addToSummary).toBe("להוסיף לסיכום לביקור");
    expect(code).toContain("onPrepare={() => setActiveTab(\"consult\")}");
  });

  /* v3 F-NOW-3 re-pin: the email row left #/weekly for #/smart-reminders'
     Delivery section (WeeklyEmailRow, beside the phone-reminder card): the
     one place the parent decides what Arbor may send. The opt-in store is
     kept and the row is guarded in components/weekly/WeeklyEmailRow.test.tsx. */
  it("the email row left the report for the reminders' Delivery section; the opt-in store is kept", () => {
    expect(code).not.toMatch(/weekly-email|emailOptIn|emailStatus|WeeklyEmailRow/);
    const store = fs.readFileSync(path.resolve(__dirname, "../weekly/recapEmail.ts"), "utf8");
    expect(store).toContain("writeEmailOptIn");
    const panel = fs.readFileSync(path.resolve(__dirname, "../sections/SmartRemindersPanel.tsx"), "utf8")
      .replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(panel).toContain('import WeeklyEmailRow from "../weekly/WeeklyEmailRow";');
    expect(panel.match(/<WeeklyEmailRow\b/g)).toHaveLength(1);
    const delivery = panel.indexOf('data-module="reminders-delivery"');
    expect(delivery).toBeGreaterThan(0);
    expect(panel.indexOf("<WeeklyEmailRow")).toBeGreaterThan(delivery);
    // v10.1 (N-Remind): no disclosure on the page; the row closes the Delivery block.
    expect(panel).not.toContain("<details");
    expect(panel.indexOf("<WeeklyEmailRow")).toBeLessThan(panel.indexOf("</div>;", delivery));
  });

  it("the empty state is stamped and its ONE move is the explicit secondary capture-moment", () => {
    expect(code).toContain('!selected ? "weekly-empty" : null');
    expect(code).toMatch(/data-secondary-move="capture-moment"\s*data-testid="weekly-log-a-moment"/);
    const contract = fs.readFileSync(path.resolve(__dirname, "../../lib/surfaceContract.ts"), "utf8");
    expect(contract).toContain('data-secondary-move="capture-moment"');
  });

  it("0 bg-white in the file", () => {
    expect(tab).not.toContain("bg-white");
  });

  it("#/learn stays in its hub; #/scholar retired into Ask (B-ASKJB-12)", () => {
    const tabs = SECTIONS.flatMap((s) => [...s.items, ...(s.tools ?? [])].map((i) => i.tab));
    expect(tabs).toContain("learn");
    // Scholar (hub: ask) never had a nav item; the Weekly spotlight was its
    // only in-page door. B-ASKJB-12 (which depended on this cut) retired it:
    // the hash resolves to #/coach and the search entries open Ask with the
    // lens preselected.
    const search = fs.readFileSync(path.resolve(__dirname, "../../lib/searchIndex.ts"), "utf8");
    expect(search).not.toMatch(/EXTRA_ROUTE_TABS[^\n]*"scholar"/);
    const routes = fs.readFileSync(path.resolve(__dirname, "../../lib/routes.ts"), "utf8");
    expect(routes).toMatch(/scholar: "coach"/);
  });
});
