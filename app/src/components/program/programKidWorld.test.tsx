/**
 * B-PROG-13 — the kid side of a program: links only.
 *
 *  - A program week may name `kidWorld` ("sound-lab" | "word-world"); Talk
 *    Together names Word World on weeks 6–7 (books) and Sound Lab on week 8.
 *  - The program page shows ONE door, "Play {world} together", that calls the
 *    EXISTING Kid Mode entry seam (useKidModeEntry → request({ view: "arcade",
 *    worldId })) — rendered only when the week names a world AND Kid Mode can
 *    open that world for this child (the parent doors' own rules).
 *  - The bedtime story request may carry `programTheme: { shelf, skill }`,
 *    ignored by the generator until the Kids session uses it.
 *  - No file under components/kidmode/ or lib/library/ changes (git diff pin in
 *    the commit message; this suite only imports from kidmode).
 */
import React from "react";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";

const harness = vi.hoisted(() => ({ lang: "en" as "en" | "he" }));
vi.mock("../../context/LanguageContext", async () => {
  const { translate } = await vi.importActual<typeof import("../../lib/i18n")>("../../lib/i18n");
  return {
    useLanguage: () => ({ uiLang: harness.lang, t: (k: string, v?: Record<string, string | number>) => translate(harness.lang, k, v) }),
  };
});

import { programKidWorldDoor, programKidWorldStudioId } from "./programKidWorld";
import type { AgedChild } from "../../lib/age/forChild";
import ProgramKidWorldDoor from "./ProgramKidWorldDoor";
import { ProgramPageView } from "./ProgramPage";
import { programPageModel, programStoryTheme } from "../../lib/programPage";
import { TALK_TOGETHER } from "../../content/programs";
import { translate } from "../../lib/i18n";
import type { ProgramEnrolment } from "../../lib/programs/enrolment";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const strip = (s: string) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, "").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const NOW = new Date(2026, 9, 10, 12, 0, 0);
// AgedChild requires the whole-year `age`; derive it from the birth date at NOW so the fixture stays one fact.
const child = (birthDate: string): AgedChild => ({ id: "child-1", birthDate, age: Math.floor((NOW.getTime() - new Date(birthDate).getTime()) / (365.25 * 86_400_000)) });
const FIVE = child("2021-06-01"); // 64 months
const TWO = child("2024-05-01"); // 29 months — Kid Mode opens from 36

/** An active Talk Together enrolment whose week on NOW is `week`. */
const enrolment = (week: number, status: ProgramEnrolment["status"] = "active"): ProgramEnrolment => {
  const start = new Date(NOW);
  start.setDate(start.getDate() - (week - 1) * 7);
  const day = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`;
  return {
    id: `talk-together.${day}`,
    programId: "talk-together",
    startedAt: day,
    enrolledAt: `${day}T08:00:00.000Z`,
    currentWeek: week,
    status,
    ...(status === "paused" ? { pausedAt: "2026-10-10" } : {}),
    baseline: { childProxy: null, capturedAt: null },
    updatedAt: `${day}T08:00:00.000Z`,
  } as ProgramEnrolment;
};

describe("B-PROG-13 · the week names a kid world", () => {
  it("Talk Together: Word World on the two book weeks, Sound Lab on the songs-and-gaps week, nothing else", () => {
    expect(TALK_TOGETHER.weeks.map((w) => w.kidWorld ?? null)).toEqual([null, null, null, null, null, "word-world", "word-world", "sound-lab"]);
  });

  it("a kid id resolves through the kid world registry; a world with no kid seat keeps its studio id", () => {
    expect(programKidWorldStudioId("sound-lab")).toBe("speech");
    expect(programKidWorldStudioId("word-world")).toBe("word-world");
  });
});

describe("B-PROG-13 · the door renders only when the week names a world AND Kid Mode can open it", () => {
  it("Sound Lab for a five-year-old in English: the door opens the arcade on Sound Lab, named by its one name", () => {
    expect(programKidWorldDoor("sound-lab", FIVE, "en", NOW)).toEqual({ worldId: "speech", nameKey: "elev.practice.world.kid.speech" });
  });

  it("no world named → no door", () => {
    expect(programKidWorldDoor(undefined, FIVE, "en", NOW)).toBeNull();
  });

  it("under three Kid Mode does not open → no door", () => {
    expect(programKidWorldDoor("sound-lab", TWO, "en", NOW)).toBeNull();
  });

  it("Sound Lab's drill is English-only → no door in Hebrew (never a dead control)", () => {
    expect(programKidWorldDoor("sound-lab", FIVE, "he", NOW)).toBeNull();
  });

  it("Word World has no Kid Mode seat today (arcade parentOnly) → no door until the Kids session gives it one", () => {
    expect(programKidWorldDoor("word-world", FIVE, "en", NOW)).toBeNull();
  });

  it("a world outside the child's band → no door (Sound Lab is tagged from 48 months)", () => {
    expect(programKidWorldDoor("sound-lab", child("2022-12-01"), "en", NOW)).toBeNull(); // 46 months
  });
});

describe("B-PROG-13 · the program page", () => {
  const model = programPageModel([enrolment(8)], { childId: "child-1" }, NOW, "en", "boy")!;
  const view = (props: Partial<React.ComponentProps<typeof ProgramPageView>> = {}) =>
    renderToStaticMarkup(
      <ProgramPageView
        childName="Dylan"
        model={model}
        startable={[]}
        packetLine=""
        onBack={() => {}}
        onDoToday={() => {}}
        onResume={() => {}}
        onPause={() => {}}
        onFinish={() => {}}
        onEnrol={() => {}}
        {...props}
      />,
    );

  it("the door sits in the week band, under the ONE primary move, and adds no gradient", () => {
    expect(model.week).toBe(8);
    const html = view({ kidDoor: <ProgramKidWorldDoor worldId="speech" label={translate("en", "elev.program.kidWorld.door", { world: translate("en", "elev.practice.world.kid.speech") })} /> });
    const band = html.slice(html.indexOf('data-testid="program-week-band"'), html.indexOf('data-module="program-counts"'));
    expect(band.indexOf('data-testid="program-do-today"')).toBeLessThan(band.indexOf('data-testid="program-kid-world"'));
    expect(band).toContain(">Play Sound Lab together<");
    expect(band).toMatch(/data-testid="program-kid-world"[^>]*data-world="speech"[^>]*class="[^"]*min-h-11/);
    expect((html.match(/var\(--gradient-cta\)/g) ?? []).length).toBe(1);
    expect((html.match(/data-primary-move=/g) ?? []).length).toBe(1);
  });

  it("no door without one, and never on a paused week", () => {
    expect(view()).not.toContain("program-kid-world");
    const paused = programPageModel([enrolment(8, "paused")], { childId: "child-1" }, NOW, "en", "boy")!;
    expect(view({ model: paused, kidDoor: <span data-testid="program-kid-world" /> })).not.toContain("program-kid-world");
  });

  it("the container asks programKidWorldDoor with the active week's world and mounts the door only when it answers", () => {
    const page = strip(read("components/program/ProgramPage.tsx"));
    expect(page).toContain("const kidWorld = model && activeProgram ? programWeek(activeProgram, model.week)?.kidWorld : undefined;");
    expect(page).toContain("const door = programKidWorldDoor(kidWorld, childProfile, lang, now);");
    expect(page).toContain('kidDoor={door ? <ProgramKidWorldDoor worldId={door.worldId} label={t("elev.program.kidWorld.door", { world: t(door.nameKey) })} /> : undefined}');
  });

  it("the door calls the EXISTING Kid Mode entry seam on the named world and renders its step", () => {
    const door = strip(read("components/program/ProgramKidWorldDoor.tsx"));
    expect(door).toContain('import { useKidModeEntry } from "../kidmode/useKidModeEntry";');
    expect(door).toContain('onClick={() => request({ view: "arcade", worldId })}');
    expect(door).toContain("{step}");
    expect(door).not.toMatch(/openKidMode\(/);
  });

  it("EN + HE: the door label; the Hebrew carries the world's Hebrew name and no Latin", () => {
    expect(translate("en", "elev.program.kidWorld.door", { world: "Sound Lab" })).toBe("Play Sound Lab together");
    const he = translate("he", "elev.program.kidWorld.door", { world: translate("he", "elev.practice.world.kid.speech") });
    expect(he).toBe("לשחק יחד במעבדת הצלילים");
    expect(he).not.toMatch(/[A-Za-z]/);
  });
});

describe("B-PROG-13 · the bedtime request may carry the active program's theme", () => {
  it("active week 8 → the program's shelf and this week's skill, in the story language", () => {
    expect(programStoryTheme([enrolment(8)], NOW, "en")).toEqual({ shelf: "words", skill: TALK_TOGETHER.weeks[7].skill.en });
    const he = programStoryTheme([enrolment(8)], NOW, "he", "girl")!;
    expect(he.shelf).toBe("words");
    expect(he.skill).not.toMatch(/[A-Za-z]/);
    expect(he.skill).not.toContain("/"); // slash forms resolved from the child's gender
  });

  it("no active program (none, or paused) → no theme", () => {
    expect(programStoryTheme([], NOW, "en")).toBeNull();
    expect(programStoryTheme([enrolment(8, "paused")], NOW, "en")).toBeNull();
  });

  it("the request carries the field; the generator and the route do not read it (ignored until the Kids session uses it)", () => {
    const tab = strip(read("components/tabs/BedtimeStoriesTab.tsx"));
    expect(tab).toMatch(/api\.generateBedtimeStory\(\{[\s\S]*programTheme: programStoryTheme\(programs\.items, new Date\(\), aiLang === "he" \? "he" : "en", childProfile\.gender \?\? null\) \?\? undefined,[\s\S]*?\}\)/);
    const prompt = read("lib/bedtimeStories.ts");
    const builder = prompt.slice(prompt.indexOf("export function buildBedtimeStoryPrompt"), prompt.indexOf("export function latestNotedMoment"));
    expect(builder).not.toContain("programTheme");
    const routes = read("routes/api.ts");
    const route = routes.slice(routes.indexOf('router.post("/generate-bedtime-story"'), routes.indexOf('router.post("/generate-bedtime-story"') + 600);
    expect(route).toContain("const { childName, age, dayEvents, avatarDescription, language } = req.body;");
    expect(route).not.toContain("programTheme");
  });
});
