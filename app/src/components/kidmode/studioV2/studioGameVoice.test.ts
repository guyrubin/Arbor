import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { STUDIO_GAME_SELECTION, STUDIO_MAKER_IDS, studioActivity } from "./studioCatalog";
import { STUDIO_GAME_VOICES, studioGameVoice } from "./studioGameVoice";
import { STUDIO_NEXT_FLAG_KEY, STUDIO_NEXT_HOSTS, resetStudioNextFlagForTests } from "./studioNextFlag";
import { resetHeroBandFlagForTests } from "./heroBandFlag";

const LANGS = ["en", "he"] as const;
/** Kid register: counts never, verdicts never (app/PRODUCT.md). */
const VERDICT = /good job|great job|well done|perfect|smart|clever|amazing|best|כל הכבוד|מצוין|מושלם|חכם/i;
/** Canon: Pep and Chock bark, Aya has her sounds. Only Sprout speaks in first person. */
const FIRST_PERSON = /\b(I|I'm|I'll|I've|me|my)\b|(^|[^֐-׿])(אני|שלי|איתי)(?![֐-׿])/;

const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
  resetStudioNextFlagForTests(); resetHeroBandFlagForTests();
});
afterEach(() => { vi.unstubAllGlobals(); resetStudioNextFlagForTests(); resetHeroBandFlagForTests(); });

describe("B-GAME-42 studio game voice", () => {
  it("gives every legacy menu game its own guide, three beats and a finish, in both languages", () => {
    localStorage.setItem(STUDIO_NEXT_FLAG_KEY, "0"); resetStudioNextFlagForTests();
    for (const id of STUDIO_GAME_SELECTION) for (const lang of LANGS) {
      const voice = studioGameVoice(id, lang, studioActivity(id)?.worldId);
      expect(STUDIO_GAME_VOICES.base[id], id).toBeDefined();
      expect(voice.beats, `${id} ${lang}`).toHaveLength(3);
      expect(voice.intro.length, `${id} ${lang}`).toBeGreaterThan(20);
      expect(voice.finish, `${id} ${lang}`).not.toMatch(/whole game|כל המשחק/);
    }
  });

  it("follows the next-games switch on the host tiles", () => {
    localStorage.setItem(STUDIO_NEXT_FLAG_KEY, "1"); resetStudioNextFlagForTests();
    for (const id of [...STUDIO_NEXT_HOSTS, "rhythm-garden" as const]) for (const lang of LANGS) {
      const voice = studioGameVoice(id, lang);
      expect(voice.finish).toBe(STUDIO_GAME_VOICES.next[id]![lang].finish);
      expect(voice.transfer, `${id} ${lang}`).toBeTruthy();
    }
    expect(studioGameVoice("puzzle", "en").guide).toBe("chock");
    expect(studioGameVoice("river-rescue", "en").guide).toBe("pep");
  });

  it("gives every maker a crew guide, its own finish and its carry-over line", () => {
    for (const id of STUDIO_MAKER_IDS) for (const lang of LANGS) {
      const voice = studioGameVoice(id, lang);
      expect(voice.guide, id).not.toBe("sprout");
      expect(voice.finish, `${id} ${lang}`).not.toMatch(/whole game|כל המשחק/);
      expect(voice.transfer, `${id} ${lang}`).toBeTruthy();
    }
  });

  it("keeps the kid register and the crew canon in every authored line", () => {
    for (const table of [STUDIO_GAME_VOICES.base, STUDIO_GAME_VOICES.next]) for (const [id, voice] of Object.entries(table)) for (const lang of LANGS) {
      const lines = voice![lang];
      const all = [lines.intro, lines.finish, lines.finishLine, ...lines.beats].join(" ");
      expect(all, `${id} ${lang}`).not.toMatch(VERDICT);
      if (voice!.guide !== "sprout") expect(all, `${id} ${lang}: an animal guide never speaks`).not.toMatch(FIRST_PERSON);
    }
  });
});
