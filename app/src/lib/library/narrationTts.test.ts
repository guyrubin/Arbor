/**
 * K2 2a — the narration's TTS input: the fully pointed Hebrew matches the
 * display text letter for letter (the proof's he_tts_build --check), the style
 * prompt names only this page's sounds, the direction never changes a word,
 * and the JSON brief carries the five name-bearing files per voice.
 */
import { describe, expect, it } from "vitest";
import { fiveSmoothStones as book } from "./books/fiveSmoothStones";
import { bookNarrationFiles, VOICE_FOLDERS } from "./narrationFiles";
import { bookTtsOf, checkPointed, direct, narrationJson, narrationTtsRequest, narrationTtsRows, plainOf, stripNikud, stylePrompt } from "./narrationTts";

const tts = bookTtsOf(book)!;
const NAME_BEARING = ["cover.mp3", "p1.mp3", "p10.a.mp3", "p10.b.mp3", "p10.c.mp3"];

describe("K2 2a: the pointed Hebrew TTS input", () => {
  it("every Hebrew file of both genders has pointed text whose letters are the display text's (two deliberate respellings)", () => {
    for (const folder of ["he-m", "he-f"] as const) {
      const map = folder === "he-f" ? tts.he.f : tts.he.m;
      for (const f of bookNarrationFiles(book, folder)) {
        const stem = f.file.replace(/\.mp3$/, "");
        expect(map[stem], `${folder}/${stem}`).toBeTruthy();
        expect(checkPointed(f.text, map[stem], tts.respell), `${folder}/${stem}`).toEqual([]);
        // fully pointed: hardly a bare Hebrew letter run is left
        expect(stripNikud(map[stem]).length).toBeLessThan(map[stem].normalize("NFC").length);
      }
    }
  });

  it("the check bites: a changed letter, a dropped manuscript point", () => {
    expect(checkPointed("דוד רץ", "דָּוִד רָצָה")).toContain("letters differ");
    expect(checkPointed("בּוּם.", "בום.")).toContain("a manuscript-pointed word changed: בּוּם");
  });

  it("HE-f differs from HE-m only on the frame lines (p1, p10)", () => {
    const differ = Object.keys(tts.he.m).filter((k) => tts.he.f[k] !== tts.he.m[k]);
    expect(differ.sort()).toEqual(["p1", "p10.a", "p10.b", "p10.c"]);
  });
});

describe("K2 2a: style and direction", () => {
  it("the style prompt names only this page's sound words, adds the nikud rule in Hebrew and the page's note", () => {
    const p6b = stylePrompt("en", bookNarrationFiles(book, "en").find((f) => f.file === "p6b.mp3")!.text, "p6b", tts.pageNotes);
    expect(p6b).toContain("'CLANK' is a funny, clumsy metal clatter");
    expect(p6b).not.toMatch(/Whirr|BOOM|CLACK/);
    expect(p6b).toContain("This page is comic");
    const p10 = narrationTtsRows(book, "he-f").find((r) => r.file === "p10.c.mp3")!;
    expect(p10.style).toContain("following the vowel points (nikud) exactly");
    expect(p10.style).toContain("This page is the quiet ending at dusk");
    expect(p10.style).toContain("soft, sleepy sheep sound");
  });

  it("direction inserts tags between sentences and never changes a word", () => {
    for (const folder of VOICE_FOLDERS) for (const r of narrationTtsRows(book, folder)) expect(plainOf(direct(r.ttsText)), `${folder}/${r.file}`).toBe(r.ttsText.normalize("NFC").replace(/\s+/g, " ").trim());
    const p9 = narrationTtsRows(book, "en").find((r) => r.file === "p9.mp3")!;
    expect(p9.tagged).toContain("[medium pause] The stone flew.");
    expect(p9.tagged).toContain("[medium pause] BOOM.");
    const p3 = narrationTtsRows(book, "he-m").find((r) => r.file === "p3.mp3")!;
    expect(p3.tagged).toContain("[shouting]");
  });

  it("the request fills the child's first name into the frame lines and keeps the voice's language", () => {
    const en = narrationTtsRequest(book, "en", "p1.mp3", "Maya")!;
    expect(en.text.startsWith("Today, Maya is David")).toBe(true);
    expect(en.text).not.toContain("{name}");
    expect(en.languageCode).toBe("en-US");
    const he = narrationTtsRequest(book, "he-f", "p10.a.mp3", "מאיה")!;
    expect(he.text).toContain("מאיה הָיְתָה דָּוִד");
    expect(he.languageCode).toBe("he-IL");
    expect(narrationTtsRequest(book, "en", "p99.mp3", "Maya")).toBeNull();
  });

  it("the JSON brief: 32 files per voice, the five name-bearing ones flagged", () => {
    const j = narrationJson(book);
    for (const folder of VOICE_FOLDERS) {
      expect(j.folders[folder], folder).toHaveLength(32);
      expect(j.folders[folder].filter((r) => r.nameBearing).map((r) => r.file), folder).toEqual(NAME_BEARING);
    }
    expect(j.voice.voice).toBe("Sulafat");
  });
});
