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

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const JOURNAL = stripComments(read("components/tabs/JournalTab.tsx"));
const TODAY = stripComments(read("components/tabs/OverviewTab.tsx"));
const MODAL = stripComments(read("components/overview/QuickLogModal.tsx"));
const CONTEXT = stripComments(read("context/ArborContext.tsx"));

/** The body of a surface's `startCapture`. */
const startCaptureOf = (src: string) => {
  const at = src.indexOf("const startCapture = (mode: CaptureMode");
  expect(at, "startCapture not found").toBeGreaterThan(-1);
  return src.slice(at, src.indexOf("\n  };", at));
};

describe("B-TODAY-19 · every capture tile opens the one sheet in place", () => {
  for (const [name, src] of [["Journal", JOURNAL], ["Today", TODAY]] as const) {
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

  it("Today's prompt card passes its promptKey into the sheet", () => {
    expect(TODAY).toMatch(/startCapture\("text", todayChoice\.kind === "prompt" \? todayChoice\.promptKey : null\)/);
  });

  it("the Journal's tapped writing prompt rides in as the sheet's cue", () => {
    expect(startCaptureOf(JOURNAL)).toContain("setQuickLogPromptKey(activePromptKey)");
    expect(JOURNAL).not.toContain("setCaptureCue");
  });
});

describe("B-TODAY-19 · QuickLogModal photo mode", () => {
  it("reuses the Behaviors photo seam (fileToThumbnail, accept image/*), in-doc only", () => {
    expect(MODAL).toContain('import { fileToThumbnail } from "../../lib/image";');
    expect(MODAL).toMatch(/type="file"\s+accept="image\/\*"/);
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
    expect(MODAL).toMatch(/addMoment\(words, \{\s*\.\.\.\(photo \? \{ photoAttachment: photo \} : \{\}\),\s*\.\.\.\(promptKey \? \{ promptKey \} : \{\}\),\s*\}\)/);
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
      intensity: 1,
      resolved: true,
      photoAttachment: "data:image/jpeg;base64,AAA",
      promptKey: "elev.prompt.toddler.1",
      timestamp: now.toISOString(),
    });
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
    expect(CONTEXT).toMatch(/const addMoment = \(\s*text: string,\s*opts: \{ photoAttachment\?: string; promptKey\?: string \} = \{\},/);
    expect(CONTEXT).toContain("buildMomentLog(text, newLogContext, opts)");
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
    expect(CTX).toContain("if (opts.editLogId) startEditLog(opts.editLogId);");
  });

  it("an edit opens the incident form prefilled; Save goes through handleAddLog's editingLogId branch; closing unsaved disarms it", () => {
    expect(MODAL).toMatch(/else if \(editLogId\) \{\s*setHardMoment\(true\);/);
    expect(MODAL).toContain("if (editLogId) cancelEditLog();");
    // handleAddLog is called from confirm only — the review step is the one write.
    expect(MODAL.match(/handleAddLog\(/g)?.length).toBe(1);
    expect(MODAL.slice(MODAL.indexOf("const confirm = "), MODAL.indexOf("const discard = "))).toContain("handleAddLog(e)");
    expect(CTX).toContain("const existing = editingLogId ? behaviorLogs.find((l) => l.id === editingLogId) : null;");
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
    expect(SHEET).toContain('onClick={() => { setConfirmDelete(false); onDelete?.(); }}');
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
    expect(JOURNAL).toContain('data-capture-bar {...primaryMoveProps}');
  });

  it("tiles come before the prompt chips; one gradient, on the Text tile", () => {
    expect(JOURNAL.indexOf("data-capture-bar")).toBeLessThan(JOURNAL.indexOf('data-testid="journal-prompt-chips"'));
    expect((JOURNAL.match(/--gradient-cta|--arbor-gradient-primary/g) || []).length).toBe(1);
    expect(JOURNAL).toMatch(/key === "text"\s*\? \{ borderRadius: "var\(--r\)", background: "var\(--gradient-cta\)"/);
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
describe("critic r2 — Journal: real modules, an honest aside, the quote at every width, one search surface", async () => {
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

  it("NEXTLEVEL critic r1 (Law 9): the aside never prints a numeral — the week count is said once, in the story line; its title is 'From the story' (EN + HE), sentence case", () => {
    const aside = JOURNAL.slice(JOURNAL.indexOf('data-testid="journal-week-aside"'), JOURNAL.indexOf("</header>"));
    expect(aside).not.toContain("{weekCount}");
    expect(aside).not.toContain('"journal.week.sub"');
    expect(aside).not.toContain('"journal.week.title"');
    expect(aside).not.toMatch(/\buppercase\b|tracking-/);
    expect(aside).toContain('t("elev.journal.lastKept.title")');
    expect(dict.en["elev.journal.lastKept.title"]).toBe("From the story");
    expect(dict.he["elev.journal.lastKept.title"]).toBe("מהסיפור");
    for (const d of [dict.en, dict.he]) expect(d["elev.journal.lastKept.title"]).not.toMatch(/week|השבוע/i);
    expect(translate("en", "journal.week.title")).toMatch(/week/i);
  });

  it("the quiet week quotes the parent in the story line at every width (no md-only quote), the type label is the fallback", () => {
    expect(JOURNAL).toContain('const quotedLastKept = storyState === "quiet-week" && !!lastKept?.words;');
    const line = JOURNAL.slice(JOURNAL.indexOf('data-story="quoted"'), JOURNAL.indexOf('data-story="quoted"') + 900);
    expect(line).toContain('<bdi dir="auto">{lastKept!.words}</bdi>');
    expect(line).toContain("var(--font-editorial)");
    expect(line).toContain("line-clamp-2");
    expect(line).not.toMatch(/hidden md:block/);
    // The aside no longer repeats the quote.
    const aside = JOURNAL.slice(JOURNAL.indexOf('data-testid="journal-last-kept"'), JOURNAL.indexOf("journal-week-zero-line"));
    expect(aside).not.toContain("lastKept.words");
    // One door per width: the story line's door is md:hidden, the aside is md+.
    expect(JOURNAL).toContain('<div className="md:hidden">{lastKeptDoor("journal-story-door")}</div>');
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
  it("a parent-written moment row leads with the words verbatim (editorial, t-lg, FreeText); the type label + time are one quiet caption; no provenance chip", () => {
    expect(JOURNAL).toContain('const parentLead = prov === "manual" && signal.kind === "moment" && !!detail.trim();');
    const lead = JOURNAL.slice(JOURNAL.indexOf("{parentLead ? ("), JOURNAL.indexOf(") : (", JOURNAL.indexOf("{parentLead ? (")));
    expect(lead).toContain('data-testid="journal-row-words"');
    expect(lead).toContain("<FreeText text={detail} />");
    expect(lead).toContain('fontFamily: "var(--font-editorial)", fontSize: "var(--t-lg)"');
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
