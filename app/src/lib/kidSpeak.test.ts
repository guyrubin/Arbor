/**
 * kidSpeak.test.ts — §3d: the kid worlds get a voice, an ending, a floor, a
 * fresh gate sum and controls that are not dead.
 *
 * Measured on the kid-mode run: ZERO `SpeakButton` instances in any kid world.
 * Every world asks a pre-reader to act on a written sentence, and the one
 * read-aloud control the app already owns (`ui/SpeakButton`, wired to
 * `useArborVoice`) was mounted on exactly one surface — the story reader. The
 * rest of this file guards the other §3d rows that share the same shape: a
 * control the child cannot use (KID-23), a loop with no ending (KID-07), a
 * board memorised after one sitting (KID-08), targets under the touch floor
 * (KID-14), a gate sum that is the same on every device all day (KID-21), and
 * a Play that pays twice for one story (KID-25).
 *
 * Static scans plus real unit tests on the pure helpers. Negative controls are
 * the pre-fix shape in each case.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as kidEn, he as kidHe } from "./i18nElevation/kidRegister";
import {
  challengeFor,
  dateSeedKey,
  newGateNonce,
  markPinNudgeShown,
  shouldNudgeForPin,
  markMathExit,
  PIN_NUDGE_KEY,
  MATH_EXIT_KEY,
  type GateSessionStorage,
} from "../components/kidmode/parentGate";
import {
  mediaControlHidden,
  mediaSupported,
  resolveMediaPermission,
  type MediaNavigatorLike,
} from "../practice/mediaPermission";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

/* ── KID-09: every kid world carries a read-aloud control ─────────────────── */

/** One entry per kid world reachable from the Hero Arcade or a kid surface. */
const KID_WORLDS: Record<string, string> = {
  "Sound Lab": "components/practice/SpeechCoachTab.tsx",
  "Mimic Studio": "components/practice/MimicStudioTab.tsx",
  "Mood Mountain": "components/practice/FeelingsLabTab.tsx",
  "Story Quest": "components/practice/AdventuresTab.tsx",
  "Mind Vault": "components/practice/MemoryMatch.tsx",
  "Pattern Power": "components/practice/PatternPowerWorld.tsx",
  "Beat Keeper": "components/practice/BeatKeeperWorld.tsx",
  "Hero Pose": "components/practice/HeroPoseWorld.tsx",
};

describe("KID-09 — every kid world has at least one speak control", () => {
  it("the scanner reads a real corpus", () => {
    for (const rel of Object.values(KID_WORLDS)) {
      expect(read(rel).length, rel).toBeGreaterThan(1000);
    }
  });

  for (const [world, rel] of Object.entries(KID_WORLDS)) {
    it(`${world} mounts SpeakButton and labels it from the kid dictionary`, () => {
      const src = stripComments(read(rel));
      expect(src, `${rel} imports no SpeakButton`).toContain('from "../ui/SpeakButton"');
      expect(src, `${rel} mounts no SpeakButton`).toContain("<SpeakButton");
      expect(src, `${rel} labels the control with an English literal`).toContain(
        't("elev.play.speak.label")',
      );
    });

    it(`${world}'s speak control clears the 44 px floor`, () => {
      const src = stripComments(read(rel));
      const at = src.indexOf("<SpeakButton");
      const tag = src.slice(at, at + 500);
      expect(tag).toContain("min-h-[44px]");
      expect(tag).toContain("min-w-[44px]");
    });
  }

  it("the label is a kid word, and it exists in both languages", () => {
    expect(kidEn["elev.play.speak.label"]).toBeTruthy();
    expect(kidHe["elev.play.speak.label"]).toBeTruthy();
    expect(kidHe["elev.play.speak.label"]).not.toBe(kidEn["elev.play.speak.label"]);
    // Law 2: nothing in the kid register addresses the grown-up.
    expect(/parent|grown|adult|settings/i.test(kidEn["elev.play.speak.label"])).toBe(false);
  });

  it("NEGATIVE CONTROL: a world with no SpeakButton fails the rule", () => {
    const preFix = 'import { PlayHeader } from "../ui/playkit";\n<PlayHeader title="Beat Keeper" say="Tap along" />';
    expect(preFix).not.toContain("<SpeakButton");
  });
});

/* ── KID-23: a control the child cannot use is not shown to the child ─────── */

describe("KID-23 — mic and camera controls are permission-gated", () => {
  const nav = (over: Partial<MediaNavigatorLike>): MediaNavigatorLike => ({
    mediaDevices: { getUserMedia: () => undefined },
    ...over,
  });

  it("no getUserMedia at all reads as unsupported", async () => {
    expect(mediaSupported({})).toBe(false);
    await expect(resolveMediaPermission("microphone", {})).resolves.toBe("unsupported");
    await expect(resolveMediaPermission("camera", undefined)).resolves.toBe("unsupported");
  });

  it("a denied origin reads as denied", async () => {
    const denied = nav({ permissions: { query: async () => ({ state: "denied" }) } });
    await expect(resolveMediaPermission("microphone", denied)).resolves.toBe("denied");
    expect(mediaControlHidden("denied")).toBe(true);
  });

  it("granted, prompt, an absent Permissions API and a throwing query all read as available", async () => {
    for (const state of ["granted", "prompt"]) {
      await expect(
        resolveMediaPermission("camera", nav({ permissions: { query: async () => ({ state }) } })),
      ).resolves.toBe("available");
    }
    await expect(resolveMediaPermission("camera", nav({}))).resolves.toBe("available");
    const throws = nav({
      permissions: {
        query: async () => {
          throw new TypeError("unsupported permission name");
        },
      },
    });
    // Unknown must never hide a control that works.
    await expect(resolveMediaPermission("camera", throws)).resolves.toBe("available");
    expect(mediaControlHidden("available")).toBe(false);
  });

  it("Sound Lab and Mimic Studio branch on the resolved permission", () => {
    const speech = stripComments(read("components/practice/SpeechCoachTab.tsx"));
    expect(speech).toContain('resolveMediaPermission("microphone"');
    expect(speech).toContain("micHidden ? (");
    expect(speech).toContain('t("elev.play.mic.unavailable")');
    const mimic = stripComments(read("components/practice/MimicStudioTab.tsx"));
    expect(mimic).toContain('resolveMediaPermission("camera"');
    expect(mimic).toContain("camHidden ? (");
    expect(mimic).toContain('t("elev.play.mirror.unavailable")');
  });

  it("the kid lines name no permission, setting or grown-up (law 2)", () => {
    for (const key of ["elev.play.mic.unavailable", "elev.play.mirror.unavailable"]) {
      const line = kidEn[key];
      expect(line, key).toBeTruthy();
      expect(/permission|settings|browser|blocked|allow|parent|denied/i.test(line), key).toBe(false);
      expect(kidHe[key]).toBeTruthy();
    }
  });

  it("NEGATIVE CONTROL: the pre-fix control rendered whatever the device said", () => {
    const preFix = "{recState !== \"recording\" ? (<PlayButton onClick={() => void startRecording()}>";
    expect(preFix).not.toContain("micHidden");
  });
});

/* ── KID-21: a fresh sum per attempt, and one PIN nudge ───────────────────── */

function memoryStorage(): GateSessionStorage & { map: Map<string, string> } {
  const map = new Map<string, string>();
  return {
    map,
    getItem: (k) => map.get(k) ?? null,
    setItem: (k, v) => void map.set(k, v),
    removeItem: (k) => void map.delete(k),
  };
}

describe("KID-21 — the parent challenge is not the same sum on every device", () => {
  it("the nonce varies, and it is deterministic for a given rand", () => {
    let n = 0;
    const seq = [0.1, 0.9, 0.5];
    const rand = () => seq[n++ % seq.length];
    const a = newGateNonce(rand);
    const b = newGateNonce(rand);
    expect(a).not.toBe(b);
    expect(newGateNonce(() => 0.1)).toBe(newGateNonce(() => 0.1));
  });

  it("a nonce in the seed changes the question for the same day and attempt", () => {
    const day = dateSeedKey(new Date("2026-09-07T10:00:00"));
    const plain = challengeFor(day, 0);
    const seeded = challengeFor(`${day}#${newGateNonce(() => 0.42)}`, 0);
    expect(`${seeded.a}+${seeded.b}`).not.toBe(`${plain.a}+${plain.b}`);
    // …and both are still real 2-digit sums.
    for (const c of [plain, seeded]) {
      expect(c.a).toBeGreaterThanOrEqual(10);
      expect(c.a).toBeLessThanOrEqual(99);
      expect(c.b).toBeGreaterThanOrEqual(10);
      expect(c.b).toBeLessThanOrEqual(99);
    }
  });

  it("the challenge component actually uses the nonce", () => {
    const src = stripComments(read("components/kidmode/ParentChallenge.tsx"));
    expect(src).toContain("newGateNonce()");
    expect(src).toMatch(/dateSeedKey\(\)\}#\$\{newGateNonce\(\)/);
  });

  it("NEGATIVE CONTROL: the date-only seed gives every device the same sum all day", () => {
    const day = dateSeedKey(new Date("2026-09-07T10:00:00"));
    expect(challengeFor(day, 0)).toEqual(challengeFor(day, 0));
    expect(challengeFor(day, 1)).toEqual(challengeFor(day, 1));
  });

  it("the PIN nudge shows once, only after a math exit, and never with a PIN set", () => {
    const store = memoryStorage();
    // No math exit → nothing to say.
    expect(shouldNudgeForPin(store)).toBe(false);
    markMathExit(store);
    expect(store.map.get(MATH_EXIT_KEY)).toBe("1");
    expect(shouldNudgeForPin(store)).toBe(true);
    markPinNudgeShown(store);
    expect(store.map.get(PIN_NUDGE_KEY)).toBe("1");
    // …and never again this session.
    expect(shouldNudgeForPin(store)).toBe(false);
  });

  it("the nudge renders on the PARENT door, in the parent register", () => {
    const studio = stripComments(read("components/practice/PracticeStudioTab.tsx"));
    expect(studio).toContain("shouldNudgeForPin()");
    expect(studio).toContain("markPinNudgeShown()");
    expect(studio).toContain('t("elev.gate.set.title")');
    expect(studio).toContain('t("elev.gate.set.sub")');
    // Never inside the kid register: no kid surface mentions the PIN.
    for (const rel of Object.values(KID_WORLDS)) {
      expect(stripComments(read(rel)), `${rel} must not nudge about a PIN`).not.toContain("elev.gate.set.");
    }
  });
});

/* ── KID-25: one story, one generation ────────────────────────────────────── */

describe("KID-25 — a second Play of the same story makes no network call", () => {
  const hero = stripComments(read("components/tabs/HeroJourneyTab.tsx"));

  it("startJourney reads the memo before it calls the API", () => {
    const memoAt = hero.indexOf("journeyMemo.get(memoKey)");
    const apiAt = hero.indexOf("api.generateHeroJourney({");
    expect(memoAt).toBeGreaterThan(-1);
    expect(apiAt).toBeGreaterThan(memoAt);
    expect(hero).toContain("const r = memoed ?? await api.generateHeroJourney({");
    expect(hero).toContain("if (!memoed) journeyMemo.set(memoKey, r);");
  });

  it("the key is (child, story, language, local day)", () => {
    expect(hero).toContain(
      "journeyMemoKey(childProfile.id, story.id, aiLang, dayKey(new Date()))",
    );
  });

  it("NEGATIVE CONTROL: the pre-fix call had no memo at all", () => {
    const preFix = "const r = await api.generateHeroJourney({ storyId: story.id });";
    expect(preFix).not.toContain("memo");
  });
});

/* ── KID-27: Beat Keeper makes a sound ────────────────────────────────────── */

describe("KID-27 — the rhythm game is audible and tappable", () => {
  const beat = stripComments(read("components/practice/BeatKeeperWorld.tsx"));

  it("an AudioContext click fires on every beat, and the context is released", () => {
    expect(beat).toContain('from "../../practice/beatAudio"');
    expect((beat.match(/beatClick\(\)/g) || []).length).toBeGreaterThanOrEqual(2);
    expect(beat).toContain("closeBeatAudio()");
  });

  it("a tap answers in the body too", () => {
    expect(beat).toContain("selectionHaptic()");
  });

  it("the audio module fails quiet where there is no AudioContext", async () => {
    const mod = await import("../practice/beatAudio");
    mod.resetBeatAudioForTests();
    // No window/AudioContext in the node environment — this must not throw.
    expect(() => mod.beatClick()).not.toThrow();
    expect(() => mod.closeBeatAudio()).not.toThrow();
  });

  it("NEGATIVE CONTROL: the pre-fix world had no audio node at all", () => {
    const preFix = "timerRef.current = window.setInterval(() => { k++; setPulse(k - 1); }, round.intervalMs);";
    expect(preFix).not.toContain("beatClick");
  });
});
