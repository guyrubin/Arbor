/**
 * B-CAREPRO-05 · CN-004 — "no proportional fill of a child record".
 *
 * Clinical firewall (law 1): a parent surface shows COUNTS of parent-noticed
 * things. A bar or ring filled to checked/total of the child's record reads as
 * "how far along" the child is — a verdict, whatever the comment beside it says
 * (the Profile milestone bar carried "never a score" in its own comment).
 *
 * The rule is enforced by WALKING components/** (never a named-file list) and
 * classifying every proportional-fill site found:
 *   - an inline `width: \`${…}%\`` template, or
 *   - a `<ProgressBar` / `<RadialProgress` call (the kit primitives render a
 *     value/total ratio).
 * Every site must sit in exactly one ledger below. A new site fails until a
 * human classifies it; a child-record site may only exist as a NAMED pending
 * debt with its ticket, so it cannot pass silently.
 */
import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { translate } from "./i18n";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const COMPONENTS = path.join(SRC, "components");

const walk = (dir: string): string[] =>
  readdirSync(dir).flatMap((name) => {
    const full = path.join(dir, name);
    return statSync(full).isDirectory() ? walk(full) : [full];
  });

/** The detector — proven by the negative controls below. */
const FILL_SITE = /width:\s*`\$\{[^`]*\}%`|<ProgressBar\b|<RadialProgress\b/g;

function fillSites(src: string): string[] {
  return [...src.replace(/\r\n/g, "\n").matchAll(FILL_SITE)].map((m) => m[0]);
}

type Entry = { file: string; match: string; why: string };

/** Child-record fills that still ship, each NAMED with the item that removes
 *  it. A pending entry whose site has already gone is tolerated (the fix
 *  landed in a parallel lane) — delete the entry when you see it. */
const PENDING_CHILD_RECORD: Entry[] = [
];

/** Fills that are NOT a record of the child. */
const NOT_CHILD_RECORD: Entry[] = [
  { file: "components/ui/kit.tsx", match: "${pct}%", why: "the ProgressBar primitive itself — every call site is classified here" },
  { file: "components/overview/CourseCard.tsx", match: "progress.percent", why: "the parent's own course progress" },
  { file: "components/tabs/RoutinesTab.tsx", match: "<ProgressBar", why: "today's routine steps — a parent task list, reset daily" },
  { file: "components/practice/EarlyReadingTrack.tsx", match: "coverage * 100", why: "live trace coverage of the stroke being drawn (kid register), never stored" },
  { file: "components/practice/MimicMatch.tsx", match: "${pct}%", why: "live match meter inside the kid game, never stored" },
];

const SOURCES = walk(COMPONENTS)
  .filter((f) => /\.tsx$/.test(f) && !/\.test\.tsx$/.test(f))
  .map((f) => ({ rel: path.relative(SRC, f).replace(/\\/g, "/"), src: readFileSync(f, "utf8").replace(/\r\n/g, "\n") }));

const classified = (rel: string, site: string): Entry | undefined =>
  [...PENDING_CHILD_RECORD, ...NOT_CHILD_RECORD].find((e) => e.file === rel && site.includes(e.match));

describe("CN-004 · no proportional fill of a child record", () => {
  it("the walk is real (non-vacuity)", () => {
    expect(SOURCES.length).toBeGreaterThan(100);
    const total = SOURCES.reduce((n, f) => n + fillSites(f.src).length, 0);
    expect(total).toBeGreaterThanOrEqual(NOT_CHILD_RECORD.length);
  });

  it("every proportional-fill site in components/** is classified (a new one fails)", () => {
    const unclassified: string[] = [];
    for (const f of SOURCES) {
      for (const site of fillSites(f.src)) if (!classified(f.rel, site)) unclassified.push(`${f.rel}: ${site}`);
    }
    expect(unclassified, "classify each site: a child-record fill is a firewall breach (law 1)").toEqual([]);
  });

  it("the Profile milestone chapter carries the count sentence and no fill", () => {
    const profile = SOURCES.find((f) => f.rel === "components/sections/ChildProfile.tsx");
    expect(profile, "ChildProfile.tsx found by the walk").toBeTruthy();
    expect(fillSites(profile!.src)).toEqual([]);
    expect(profile!.src).not.toContain("windowRecord.share");
    // W2-GROWTH r1 (law 1): the count sentence carries no denominator either —
    // "{checked} of {total} noticed in the window" became "{n} milestones noticed".
    expect(profile!.src).not.toContain('t("elev.growthTruth.window.noticed"');
    expect(profile!.src).toContain('t("elev.profile.ms.noticed", { n: noticedCount })');
  });

  it("B-CAREPRO-44 · RewardsCard says a count sentence: no fill, no next-reward target, no pending entry", () => {
    const rewards = SOURCES.find((f) => f.rel === "components/profile/RewardsCard.tsx");
    expect(rewards, "RewardsCard.tsx found by the walk").toBeTruthy();
    expect(fillSites(rewards!.src)).toEqual([]);
    expect(rewards!.src).not.toMatch(/next\.progress|next\.cosmetic|<b>Next:/);
    expect(rewards!.src).toContain("rewardsCountLine(t, stats.totalSessions, name)");
    expect(PENDING_CHILD_RECORD.some((e) => e.file === "components/profile/RewardsCard.tsx")).toBe(false);
    // the sentence exists in both locales and carries no target or percentage
    for (const lang of ["en", "he"] as const) {
      const line = translate(lang, "profile.rewards.count", { n: 3 });
      expect(line, lang).toContain("3");
      expect(line).not.toMatch(/%|next|הבא/i);
      expect(translate(lang, "profile.rewards.count.one")).not.toBe("profile.rewards.count.one");
      expect(translate(lang, "profile.rewards.none", { name: "Noa" })).toContain("Noa");
    }
    expect(translate("en", "profile.rewards.count", { n: 3 })).toBe("3 adventures so far");
    expect(translate("he", "profile.rewards.count", { n: 3 })).toBe("3 הרפתקאות עד כה");
    // the pre-change bar is detected and would be unclassified now
    const pre = '<div className="h-full rounded-full" style={{ width: `${Math.round(next.progress * 100)}%`, background: "var(--arbor-clay)" }} />';
    const sites = fillSites(pre);
    expect(sites).toHaveLength(1);
    expect(classified("components/profile/RewardsCard.tsx", sites[0])).toBeUndefined();
  });

  it("B-PLAY-07: the Speech dose bar is gone — no exemption, and no fill site left in the file", () => {
    expect(PENDING_CHILD_RECORD.some((e) => e.file === "components/practice/SpeechCoachTab.tsx")).toBe(false);
    const speech = SOURCES.find((s) => s.rel === "components/practice/SpeechCoachTab.tsx");
    expect(speech, "SpeechCoachTab.tsx is scanned").toBeTruthy();
    expect(fillSites(speech!.src)).toEqual([]);
  });

  it("every NOT_CHILD_RECORD entry still matches a live site (no stale exemptions)", () => {
    for (const e of NOT_CHILD_RECORD) {
      const f = SOURCES.find((s) => s.rel === e.file);
      expect(f, `${e.file} no longer exists — drop the entry`).toBeTruthy();
      expect(fillSites(f!.src).some((site) => site.includes(e.match)), `${e.file} no longer carries "${e.match}" — drop the entry`).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: the pre-change Profile bar is detected and is not classified", () => {
    const pre = '<div className="h-full rounded-full transition-all" style={{ width: `${windowRecord.share}%`, background: "var(--arbor-gradient-progress)" }} />';
    const sites = fillSites(pre);
    expect(sites).toHaveLength(1);
    expect(classified("components/sections/ChildProfile.tsx", sites[0])).toBeUndefined();
    // and a new kit-primitive call on a child surface is caught too
    expect(fillSites("<ProgressBar value={s.checked} total={s.total} />")).toEqual(["<ProgressBar"]);
    expect(classified("components/sections/ChildProfile.tsx", "<ProgressBar")).toBeUndefined();
  });
});
