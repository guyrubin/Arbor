/**
 * TJB-08 + B-TODAY-19 — one capture sheet: photo in place, every door in place.
 *
 * Today's capture bar and the Journal's compose tiles offer text, voice and
 * photo. Voice and photo used to hand the capture to Behaviors
 * (`requestCapture(mode)` + `setActiveTab("behaviors")`): the route changed
 * under the parent and the photo was taken on a different hub, because
 * `addMoment` wrote no `photoAttachment`.
 *
 * Now every tile on both surfaces opens `QuickLogModal` — the ONE sheet,
 * portalled to `document.body` — in the tapped mode. The photo is the same
 * in-doc thumbnail the Behaviors form stores, and the answered prompt's key is
 * stored on the log (never the question text in the draft).
 *
 * Source-based where the env is node-only; `buildMomentLog` is the pure record
 * `addMoment` writes and is unit-tested directly.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildMomentLog, MOMENT_BEHAVIOR_TYPE } from "../../content/behaviorTaxonomy";
import { translate } from "../../lib/i18n";
import { todayLiveSource } from "../../testTodaySource";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
const TODAY = stripComments(todayLiveSource());
const MODAL = stripComments(read("components/overview/QuickLogModal.tsx"));
const CONTEXT = stripComments(read("context/ArborContext.tsx"));

/** The body of a surface's `startCapture`. */
const startCaptureOf = (src: string) => {
  const at = src.indexOf("const startCapture = (mode: CaptureMode");
  expect(at, "startCapture not found").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("\n  };", at));
};

describe("B-TODAY-19 · every capture tile opens the one sheet in place", () => {
  // Parity 9 Oct: Today (NowView) has no startCapture of its own — its doors
  // call the context seam openCaptureSheet (pinned below).
  for (const [name, src] of [["Journal", JOURNAL]] as const) {
    const body = startCaptureOf(src);
    it(`${name}: startCapture never switches hubs or hands off`, () => {
      expect(body).not.toContain('setActiveTab("behaviors")');
      expect(body).not.toContain("requestCapture(");
      expect(body).toContain("setQuickLogMode(mode)");
      expect(body).toContain("setQuickLogOpen(true)");
    });
    it(`${name}: the sheet receives the mode and the prompt key`, () => {
      expect(src).toMatch(/<QuickLogModal open=\{quickLogOpen\} mode=\{quickLogMode\} promptKey=\{quickLogPromptKey\}/);
      expect(src).toContain('import QuickLogModal from "../overview/QuickLogModal";');
      expect(src).not.toContain("handleAddLog");
    });
  }

  it("0 setActiveTab(\"behaviors\") in Today and in the Journal", () => {
    expect(TODAY).not.toContain('setActiveTab("behaviors")');
    // editOpenSignal hands an existing log to the one editor — not a capture door.
    // B-ASKJB-30: the row editor's hop is gone too — Edit opens the sheet in place.
    expect(JOURNAL.split('setActiveTab("behaviors")').length - 1).toBe(0);
    expect(JOURNAL).toMatch(/setOpenSignal\(null\);\s*openCaptureSheet\(\{ editLogId: logId \}\);/);
  });

  it("the shared launcher opens all three capture modes in place on Today", () => {
    const launcher = stripComments(read("components/companion/CompanionWorkspace.tsx"));
    for (const mode of ["text", "voice", "photo"]) expect(launcher).toContain(`capture("${mode}")`);
    const capture = launcher.slice(launcher.indexOf("const capture ="), launcher.indexOf("const visible ="));
    expect(capture).toContain("openCaptureSheet({ mode });");
    expect(capture).not.toContain("setActiveTab(");
    expect(capture).not.toContain("requestCapture(");
    expect(TODAY).not.toContain("requestCapture(");
  });

  it("the Journal's tapped writing prompt rides in as the sheet's cue", () => {
    expect(startCaptureOf(JOURNAL)).toContain("setQuickLogPromptKey(activePromptKey)");
    expect(JOURNAL).not.toContain("setCaptureCue");
  });
});

describe("B-TODAY-19 · QuickLogModal photo mode", () => {
  it("reuses the Behaviors photo seam (fileToThumbnail, accept image/*), in-doc only", () => {
    expect(MODAL).toContain('import { fileToThumbnail } from "../../lib/image";');
    expect(MODAL).toContain('accept={["image", "*"].join("/")}');
    expect(MODAL).not.toContain("uploadChildPhoto");
  });

  it("photo mode opens the picker and shows a preview with a 44 px remove control", () => {
    expect(MODAL).toMatch(/mode !== "photo"\) return;\s*const timer = window\.setTimeout\(\(\) => photoInputRef\.current\?\.click\(\), 120\)/);
    expect(MODAL).toContain('data-testid="quicklog-photo-remove"');
    const remove = MODAL.slice(MODAL.lastIndexOf("<button", MODAL.indexOf('data-testid="quicklog-photo-remove"')), MODAL.indexOf("</button>", MODAL.indexOf('data-testid="quicklog-photo-remove"')));
    expect(remove).toContain("min-h-11");
    expect(MODAL).toMatch(/<img src=\{photo\} alt=\{t\("elev\.capture\.photo\.alt"\)\}/);
  });

  it("the save writes the photo and the prompt key through addMoment", () => {
    // B-LOOP-11: opened from a journal shelf page, the moment is filed on that shelf (addMoment's shelf seam).
    expect(MODAL).toMatch(/addMoment\(words, \{\s*\.\.\.\(photo \? \{ photoAttachment: photo \} : \{\}\),\s*\.\.\.\(promptKey \? \{ promptKey \} : \{\}\),\s*\.\.\.\(shelf \? \{ shelf \} : \{\}\),[\s\S]*?\}\)/);
    expect(MODAL).toContain('trackCaptureStarted(mode === "voice" ? "voice" : mode === "photo" ? "photo" : "text")');
  });

  it("the prompt is a visible cue, never draft text", () => {
    expect(MODAL).toContain('data-testid="quicklog-prompt-cue"');
    expect(MODAL).not.toMatch(/setNewLog\w+\([^)]*promptKey/);
  });

  it("HE labels for the photo mode", () => {
    for (const key of ["elev.capture.photo.label", "elev.capture.photo.caption", "elev.capture.photo.alt", "elev.capture.photo.remove", "beh.addPhoto"]) {
      const en = translate("en", key);
      const he = translate("he", key);
      expect(en, key).not.toBe(key);
      expect(he, key).not.toBe(key);
      expect(he, key).not.toBe(en);
      expect(/[֐-׿]/.test(he), key).toBe(true);
    }
  });
});

describe("B-TODAY-19 · addMoment stores the photo (unit)", () => {
  const now = new Date("2026-10-02T08:00:00Z");

  it("a photo moment saves with its image and the prompt key", () => {
    const log = buildMomentLog("Built a tower", "Home", { photoAttachment: "data:image/jpeg;base64,AAA", promptKey: "elev.prompt.toddler.1" }, now);
    expect(log).toMatchObject({
      behaviorType: MOMENT_BEHAVIOR_TYPE,
      trigger: "Built a tower",
      resolved: true,
      photoAttachment: "data:image/jpeg;base64,AAA",
      promptKey: "elev.prompt.toddler.1",
      timestamp: now.toISOString(),
    });
    expect("intensity" in log!).toBe(false); // B-DATA-09: a moment stores no intensity
  });

  it("a plain moment carries no photo or prompt keys at all (never undefined)", () => {
    const log = buildMomentLog("She said butterfly", "Home", {}, now)!;
    expect("photoAttachment" in log).toBe(false);
    expect("promptKey" in log).toBe(false);
  });

  it("no words → no row (the sheet supplies a caption for a photo-only moment)", () => {
    expect(buildMomentLog("   ", "Home", { photoAttachment: "x" }, now)).toBeNull();
    expect(MODAL).toContain('newLogTrigger.trim() || (photo ? t("elev.capture.photo.caption") : "")');
  });

  it("ArborContext.addMoment writes the builder's record (one path)", () => {
    // B-LOOP-07/10: the opts also carry the shelf + milestone Tonight files the line on; the builder gets the rest.
    expect(CONTEXT).toMatch(/const addMoment = async \(\s*text: string,\s*opts: \{ photoAttachment\?: string; promptKey\?: string; kept\?: BehaviorLog\["kept"\]; contentSource\?: BehaviorLog\["contentSource"\]; shelf\?: ShelfId; milestoneId\?: string; context\?: BehaviorContext; notes\?: string; callerShowsFailure\?: boolean \} = \{\},/);
    expect(CONTEXT).toContain('buildMomentLog(text, context ?? "", buildOpts)');
  });

  it("the Journal row reads the stored photo (signalTimeline maps photoAttachment)", () => {
    expect(read("lib/signalTimeline.ts")).toContain("photo: log.photoAttachment");
    expect(JOURNAL).toContain("signal.photo &&");
  });
});

describe("negative control — the pre-fix handler fails the guard", () => {
  it("the old hand-off shape is recognised", () => {
    const prefix = [
      "const startCapture = (mode: CaptureMode) => {",
      '    if (mode === "text") { setQuickLogOpen(true); return; }',
      "    requestCapture(mode);",
      '    setActiveTab("behaviors");',
      "  };",
    ].join("\n");
    const body = startCaptureOf(prefix);
    expect(body).toContain('setActiveTab("behaviors")');
    expect(body).toContain("requestCapture(");
    expect(body).not.toContain("setQuickLogMode(mode)");
  });
});


/**
 * B-ASKJB-30 — capture and edit open the ONE sheet in place from every
 * screen in the Ask lane; an AI draft still cannot be saved without review.
 */
describe("B-ASKJB-30 · edit and review in place", () => {
  const rd = (rel: string) => readFileSync(path.resolve(__dirname, "..", "..", rel), "utf8");
  const strip = (s: string) => s.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const MODAL = strip(rd("components/overview/QuickLogModal.tsx"));
  const CTX = strip(rd("context/ArborContext.tsx"));
  const SHELL = strip(rd("components/layout/Shell.tsx"));
  const SHEET = strip(rd("components/journal/JournalEntrySheet.tsx"));

  it("rg setActiveTab(\"behaviors\") = 0 in Coach, Journal, Story, the capture tray and Search", () => {
    for (const rel of [
      "components/tabs/CoachTab.tsx", "components/tabs/JournalTab.tsx", "components/tabs/StoryTimelineTab.tsx",
      "components/capture/CaptureProposalsTray.tsx", "components/search/SearchModal.tsx",
    ]) {
      expect(strip(rd(rel)), rel).not.toContain('setActiveTab("behaviors")');
    }
  });

  it("the Journal's Edit opens the sheet with the log id — the route stays #/journal", () => {
    const journal = strip(rd("components/tabs/JournalTab.tsx"));
    expect(journal).toContain("openCaptureSheet({ editLogId: logId });");
    expect(journal).not.toMatch(/setActiveTab\(/);
    expect(CTX).toContain("if (opts.editLogId) startEditLog(opts.editLogId, opts.editLog);");
  });

  it("an edit opens its original neutral or incident form; Save goes through handleAddLog's editingLogId branch; closing unsaved disarms it", () => {
    expect(MODAL).toMatch(/else if \(editLogId\) \{\s*setHardMoment\(isIncidentType\(newLogType\)\);/);
    expect(MODAL).toContain("if (editLogId) cancelEditLog();");
    // handleAddLog is called from confirm only — the review step is the one write.
    expect(MODAL.match(/handleAddLog\(/g)?.length).toBe(1);
    expect(MODAL.slice(MODAL.indexOf("const confirm = "), MODAL.indexOf("const discard = "))).toContain("handleAddLog(e, { callerShowsFailure: true, ...contentProvenance })");
    expect(CTX).toContain("editingLogSnapshotRef.current?.id === editingLogId");
    expect(CTX).toContain("...existing,");
  });

  it("fail-closed: a review-mode sheet opens ON the review step, and the AI handoffs all use it", () => {
    expect(MODAL).toMatch(/if \(review\) \{\s*setSource\(review\);\s*setHardMoment\(true\);\s*setReviewing\(true\);/);
    expect(strip(rd("components/capture/CaptureProposalsTray.tsx"))).toContain('openCaptureSheet({ review: "ai-draft" });');
    // The seam never arms pendingCaptureMode (Behaviors would re-open it later).
    const seam = CTX.slice(CTX.indexOf("const openCaptureSheet = "), CTX.indexOf("const closeCaptureSheet"));
    expect(seam).not.toContain("setPendingCaptureMode");
    expect(seam).toContain("trackCaptureStarted(");
  });

  it("one sheet mounted once in Shell through the context seam", () => {
    expect((SHELL.match(/<QuickLogModal\b/g) ?? []).length).toBe(1);
    expect(SHELL).toContain("open={captureSheet.open}");
    expect(SHELL).toContain("editLogId={captureSheet.editLogId}");
    expect(SHELL).toContain("review={captureSheet.review}");
  });

  it("hard moments resolve and delete from the entry sheet; delete asks through a keyed modal, never window.confirm", () => {
    expect(SHEET).toContain('data-testid="journal-entry-resolve"');
    expect(SHEET).toContain('data-testid="journal-entry-delete-confirm"');
    expect(SHEET).toContain('onClick={() => void confirmRemoval()}');
    expect(SHEET).toContain("await onDelete();");
    expect(SHEET).not.toContain("window.confirm");
    const journal = strip(rd("components/tabs/JournalTab.tsx"));
    expect(journal).toContain("hardMoment={openLog && isIncidentType(openLog.behaviorType) ? { resolved: !!openLog.resolved } : undefined}");
  });

  it("EN + HE copy for the edit toast and the entry-sheet actions", async () => {
    const { en, he } = await import("../../lib/i18n");
    for (const k of ["capture.edit.saved", "journal.entry.markResolved", "journal.entry.reopen", "journal.entry.delete", "journal.entry.deleteConfirm.title", "journal.entry.deleteConfirm.body", "journal.entry.deleteConfirm.yes", "journal.entry.deleteConfirm.no"]) {
      expect(en[k], k).toBeTruthy();
      expect(he[k], k).toBeTruthy();
      expect(he[k]).not.toMatch(/[A-Za-z]/);
    }
  });
});

/**
 * Critic r1 (W2-ASKJB journal). Source guards for what the render showed:
 *  · the capture-moment stamp rides on the capture tiles (data-capture-bar),
 *    never on TimelineTab's 1 500 px timeline-stream wrapper;
 *  · the tiles come BEFORE the prompt chips (primary move first at 375);
 *  · exactly one gradient on the page, on the Text tile;
 *  · type from the --t-* scale (no text-[Npx], no H1 breakpoint jump), radii
 *    from --r tokens;
 *  · an empty week with a non-empty record never says "begin"/"first".
 */
describe("critic r1 — the journal's primary move is the capture tiles", async () => {
  const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
  const TIMELINE = stripComments(read("components/tabs/TimelineTab.tsx"));
  const { lastKeptMoment, journalStoryState } = await import("../../lib/journalLastKept");
  const dict = await import("../../lib/i18nElevation/journal");

  it("the stamp is spread on the tile grid, not the stream wrapper", () => {
    // Critic r2: the feed density's stream carries no stamp at all (the
    // Journal's own three modules are the top level); Story keeps its wrapper.
    expect(TIMELINE).toContain("<JournalTab primaryMoveProps={primaryMove} densityToggle={densityToggle} />");
    expect(TIMELINE).toMatch(/story \? \(\s*<div data-module="timeline-stream">\s*<StoryTimelineTab \/>/);
    // P5-LOOP c2 r1: on ?view=all the stamp rides "All shelves", the page's FIRST item;
    // the tiles carry none (they follow the thread below lg)
    expect(JOURNAL).toContain('data-capture-bar>');
    expect(JOURNAL).not.toContain("data-capture-bar {...primaryMoveProps}");
    expect(JOURNAL).toMatch(/data-testid="journal-all-back"\s*onClick=\{\(\) => goToRoute\("journal"\)\}\s*\{\.\.\.primaryMoveProps\}/);
    const header = JOURNAL.slice(JOURNAL.indexOf('data-module="journal-header"'), JOURNAL.indexOf("</header>"));
    expect(header.indexOf('data-testid="journal-all-back"')).toBeLessThan(header.indexOf("{densityToggle}"));
    expect(JOURNAL).toMatch(/data-module="journal-compose" className="[^"]*max-lg:order-last/);
  });

  it("tiles come before the prompt chips; no gradient — the Text tile is the one solid accent fill", () => {
    expect(JOURNAL.indexOf("data-capture-bar")).toBeLessThan(JOURNAL.indexOf('data-testid="journal-prompt-chips"'));
    // P1-NEXTLEVEL critic r2: B-ASKJB-34 acceptance is 0 gradients on #/journal.
    expect((JOURNAL.match(/--gradient-cta|--arbor-gradient-primary/g) || []).length).toBe(0);
    expect(JOURNAL).toMatch(/key === "text"\s*\? \{ borderRadius: "var\(--r\)", background: "var\(--arbor-clay\)"/);
    expect(JOURNAL).not.toContain('key === "voice" ? "var(--arbor-green-soft)"');
  });

  it("type from the scale, radii from tokens", () => {
    expect(JOURNAL).not.toMatch(/text-\[\d+(\.\d+)?px\]/);
    expect(JOURNAL).not.toMatch(/sm:text-\[/);
    expect(JOURNAL).not.toMatch(/rounded-\[\d+px\]/);
  });

  it("an empty week with kept moments names the last moment, never 'begin'", () => {
    const sig = (id: string, at: string, detail: string) => ({ id, kind: "moment" as const, at, detail, tone: "lav" as const });
    const last = lastKeptMoment([sig("moment-a", "2026-05-20T08:00:00Z", "older"), sig("moment-b", "2026-05-23T08:00:00Z", "Setting off for preschool")]);
    expect(last).toEqual({ id: "moment-b", at: "2026-05-23T08:00:00Z", words: "Setting off for preschool" });
    expect(journalStoryState(0, last)).toBe("quiet-week");
    expect(journalStoryState(0, null)).toBe("empty-record");
    expect(journalStoryState(2, last)).toBe("week");
    for (const d of [dict.en, dict.he]) {
      expect(d["elev.journal.story.quietWeek"]).toBeTruthy();
      expect(d["elev.journal.story.quietWeek"]).not.toMatch(/begin|first|הראשון|להתחיל/i);
      expect(d["elev.journal.lastKept.caption"]).toContain("{date}");
      expect(d["elev.journal.lastKept.next"]).toContain("{name}");
    }
    expect(JOURNAL).toContain('t("elev.journal.story.quietWeek", { title: signalTitle(lastKeptSignal, tt), date: lastKeptDate })');
  });
});

/**
 * Critic r2 (W2-ASKJB journal). What the round-2 render showed:
 *  · the sweep counted 2 modules (density toggle + stream wrapper) while the
 *    parent saw 4 — the budget gate measured a wrapper (Law 7);
 *  · "This week in the story" headed a May moment beside "Nothing kept this
 *    week" (a false claim, G0);
 *  · the parent's own words hid below md — the phone read a type label;
 *  · the search pill drew a field inside a field (global input fill).
 */
describe("Journal: real modules, expandable entry context at every width, one search surface", async () => {
  const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
  const TIMELINE = stripComments(read("components/tabs/TimelineTab.tsx"));
  const CSS = read("index.css");
  const dict = await import("../../lib/i18nElevation/journal");
  const { translate } = await import("../../lib/i18n");

  it("on #/journal the density toggle rides in journal-header; the stream wrapper is unstamped", () => {
    expect(TIMELINE).toContain('data-module={story ? "timeline-density" : undefined}');
    expect(TIMELINE).toContain("{story && densityToggle}");
    expect(TIMELINE.match(/data-module="timeline-stream"/g)?.length).toBe(1);
    const header = JOURNAL.slice(JOURNAL.indexOf('data-module="journal-header"'), JOURNAL.indexOf("</header>"));
    expect(header).toContain("{densityToggle}");
    expect(header.indexOf("{densityToggle}")).toBeLessThan(header.indexOf('t("journal.title")'));
  });

  it("the empty-record guidance appears only in teach-empty, with no duplicate aside or zero count", () => {
    const header = JOURNAL.slice(JOURNAL.indexOf('data-module="journal-header"'), JOURNAL.indexOf("</header>"));
    expect(header).not.toContain("journal-week-aside");
    expect(header).not.toContain('t("elev.journal.week.zero")');
    expect(header).toContain(') : weekCount > 0 ? (');
    expect(header).not.toMatch(/\buppercase\b|tracking-/);
    expect(JOURNAL).toContain('statesText("elev.states.journal.head"');
    expect(JOURNAL).toContain('ctaTestId="journal-empty-cta"');
  });

  it("the last entry is a native, initially closed disclosure at every width; the full words use the readable bilingual body treatment", () => {
    const context = JOURNAL.slice(JOURNAL.indexOf('<details data-testid="journal-last-context"'), JOURNAL.indexOf("</details>", JOURNAL.indexOf('<details data-testid="journal-last-context"')));
    expect(context).toBeTruthy();
    expect(context.split(">")[0]).not.toMatch(/\bopen[=> ]/);
    expect(context).toContain('<summary');
    expect(context).toContain('data-testid="journal-last-context-toggle"');
    expect(context).toContain('<bdi dir="auto">{lastKept!.words}</bdi>');
    expect(context).toContain("var(--font-sans)");
    expect(context).toContain("font-normal leading-relaxed");
    expect(context).toContain("line-clamp-2");
    expect(context).not.toMatch(/hidden md:block/);
    expect(JOURNAL).not.toMatch(/lastKeptDoor|journal-story-door|journal-last-kept-next/);
  });

  it("latest-entry date and child context stay available; opening full words uses the real entry sheet without changing filters", () => {
    const context = JOURNAL.slice(JOURNAL.indexOf('<details data-testid="journal-last-context"'), JOURNAL.indexOf("</details>", JOURNAL.indexOf('<details data-testid="journal-last-context"')));
    expect(context).toContain('aria-label={`${t("elev.journal.lastEntry.summary", { date: lastKeptDate })} · ${childFirstName}`}');
    expect(context).toContain('t("elev.journal.lastEntry.summary", { date: lastKeptDate })');
    expect(context).toContain("onClick={() => setOpenSignal(lastKeptSignal)}");
    expect(context).not.toContain("requestJournalFocus(");
    expect(context).toContain('borderColor: "var(--arbor-clay-dim)"');
    expect(context).toContain('{weekCount > 0 && <p data-testid="journal-week-line"');
    for (const lang of ["en", "he"] as const) {
      expect(translate(lang, "elev.journal.lastEntry.summary", { date: "date-probe" })).toContain("date-probe");
      expect(translate(lang, "elev.journal.lastEntry.open")).not.toContain("elev.");
    }
    expect(dict.en["elev.journal.lastWrote.caption"]).toBe("Last thing you wrote about {name} · {date}");
    expect(dict.he["elev.journal.lastWrote.caption"]).toBe("הדבר האחרון שכתבתם על {name} · {date}");
  });

  it("the search pill is one surface: the input is field-bare, the pill and month select share field-pill", () => {
    const search = JOURNAL.slice(JOURNAL.indexOf("field-pill flex min-h-11"), JOURNAL.indexOf("journal-filter-empty"));
    expect(search).toMatch(/className="field-bare /);
    expect(search).not.toMatch(/bg-transparent/);
    expect(search).toMatch(/className="field-pill min-h-11 rounded-xl px-3/);
    expect(search).not.toMatch(/background: "var\(--arbor-paper-elevated\)"/);
    // The scoped rule beats `.arbor-app input` (both !important; higher specificity).
    expect(CSS).toMatch(/\.arbor-app input\.field-bare,[\s\S]{0,200}\{\s*background-color: transparent !important;/);
    expect(CSS).toMatch(/\.arbor-app \.field-pill \{\s*background-color: var\(--arbor-paper-elevated\) !important;/);
    expect(read("components/search/TopbarSearch.tsx")).toContain('className="field-bare min-h-11 self-stretch"');
  });
});

/* NEXTLEVEL critic round 1 — the parent's words lead their row (B-ASKJB-34),
   and the parent register carries no upper-case labels. */
describe("NEXTLEVEL r1 — Journal: the parent's words are the row; sentence case", () => {
  const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
  const SHEET = stripComments(read("components/journal/JournalEntrySheet.tsx"));
  it("a parent-written moment row leads with the words verbatim (body face, t-lg, FreeText); the type label + time are one quiet caption; no provenance chip", () => {
    expect(JOURNAL).toContain('const parentLead = prov === "manual" && (signal.kind === "moment" || signal.kind === "memory") && !!detail.trim();');
    const lead = JOURNAL.slice(JOURNAL.indexOf(": parentLead ? ("), JOURNAL.indexOf(") : (", JOURNAL.indexOf(": parentLead ? (")));
    expect(lead).toContain('data-testid="journal-row-words"');
    expect(lead).toContain("<FreeText text={detail} />");
    expect(lead).toContain('fontFamily: "var(--font-sans)", fontSize: "var(--t-lg)"');
    expect(lead).toContain("font-normal leading-relaxed");
    expect(lead).toContain('data-testid="journal-row-caption"');
    expect(lead.indexOf("journal-row-words")).toBeLessThan(lead.indexOf("<bdi>{title}</bdi>"));
    expect(lead).not.toContain("{provLabel}");
  });
  it("no upper-case or letter-spaced labels on #/journal or its entry sheet (Hebrew must not be letter-spaced)", () => {
    for (const src of [JOURNAL, SHEET]) {
      expect(src).not.toMatch(/\buppercase\b/);
      expect(src).not.toMatch(/tracking-(wide|wider|widest|\[0\.)/);
      expect(src).not.toMatch(/text-\[(10|9)px\]/);
    }
    expect(JOURNAL).not.toContain('t("journal.eyebrow")');
  });
});

describe("P1-NEXTLEVEL critic r2 — #/journal targets, chips and the compose question", () => {
  it("the quoted last words are a 44 px target (sub44AboveFold held only the skip link)", () => {
    const at = JOURNAL.indexOf('data-testid="journal-last-words"');
    const tag = JOURNAL.slice(at, JOURNAL.indexOf("className=", at) + 80);
    expect(tag).toContain("min-h-11");
  });
  it("from sm the spark chips may shrink and wrap inside the 20rem rail (no chip past the card edge)", () => {
    const at = JOURNAL.indexOf('data-testid="journal-prompt-chips"');
    expect(JOURNAL.slice(at, at + 1400)).toContain("sm:max-w-full sm:flex-shrink");
  });
  it("the compose card asks the question its tiles answer, naming the child; no 'New moment' eyebrow", () => {
    expect(JOURNAL).toContain('t("elev.journal.compose.ask", { name: childFirstName })');
    expect(JOURNAL).not.toContain('t("journal.compose.eyebrow")');
  });
});
