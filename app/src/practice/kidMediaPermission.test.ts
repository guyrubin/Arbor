/**
 * B-KID-41 (KC-15) — media permissions are never asked of the child.
 * In Kid Mode: the camera mirror is not rendered and never starts; the Sound
 * Lab record button exists only when the microphone was ALREADY granted on the
 * parent side, so no browser permission prompt appears in front of the child.
 * Pure + static (no jsdom in this repo); the rendered check is Fable's.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { mediaAlreadyGranted, resolveMediaPermission } from "./mediaPermission";

const nav = (state: string | null, opts: { throws?: boolean } = {}) => {
  const getUserMedia = vi.fn();
  return {
    getUserMedia,
    nav: {
      mediaDevices: { getUserMedia },
      ...(state === null ? {} : { permissions: { query: async () => { if (opts.throws) throw new Error("unknown name"); return { state }; } } }),
    },
  };
};

describe("B-KID-41: 'already granted' is the only state Kid Mode offers a capture control in", () => {
  it("granted → true; prompt / denied / no Permissions API / unknown name / no device → false", async () => {
    expect(await mediaAlreadyGranted("microphone", nav("granted").nav)).toBe(true);
    expect(await mediaAlreadyGranted("microphone", nav("prompt").nav)).toBe(false);
    expect(await mediaAlreadyGranted("microphone", nav("denied").nav)).toBe(false);
    expect(await mediaAlreadyGranted("microphone", nav(null).nav)).toBe(false);
    expect(await mediaAlreadyGranted("camera", nav("granted", { throws: true }).nav)).toBe(false);
    expect(await mediaAlreadyGranted("microphone", {})).toBe(false);
  });
  it("resolving the state never calls getUserMedia (querying shows no prompt)", async () => {
    const n = nav("prompt");
    await mediaAlreadyGranted("microphone", n.nav);
    await resolveMediaPermission("microphone", n.nav);
    expect(n.getUserMedia).not.toHaveBeenCalled();
  });
  it("NEGATIVE CONTROL: the parent rule (resolveMediaPermission) reads 'prompt' as available — a tap there would prompt", async () => {
    expect(await resolveMediaPermission("microphone", nav("prompt").nav)).toBe("available");
  });
});

describe("B-KID-41: the two kid worlds wire it", () => {
  const SRC = path.resolve(__dirname, "..");
  const mimic = readFileSync(path.join(SRC, "components/practice/MimicStudioTab.tsx"), "utf8");
  const sound = readFileSync(path.join(SRC, "components/practice/SpeechCoachTab.tsx"), "utf8");
  it("Mimic: the mirror is not rendered in Kid Mode and startMirror returns before getUserMedia", () => {
    expect(mimic).toContain("{!kidMode && (\n          <div className={`${cardCls} overflow-hidden relative flex items-center justify-center`}");
    const start = mimic.slice(mimic.indexOf("const startMirror = async () => {"));
    expect(start.indexOf("if (kidMode) return;")).toBeGreaterThan(-1);
    expect(start.indexOf("if (kidMode) return;")).toBeLessThan(start.indexOf("getUserMedia"));
  });
  it("Sound Lab: in Kid Mode the record button needs an already-granted microphone; startRecording guards the same rule", () => {
    expect(sound).toContain("const micHidden = mediaControlHidden(micPermission) || (kidMode && !micGranted);");
    expect(sound).toContain('void mediaAlreadyGranted("microphone", navigator)');
    const start = sound.slice(sound.indexOf("const startRecording = async () => {"));
    expect(start.indexOf("if (micHidden) return;")).toBeGreaterThan(-1);
    expect(start.indexOf("if (micHidden) return;")).toBeLessThan(start.indexOf("getUserMedia"));
    // the hidden branch is the existing say-it-aloud line, not a dead button
    expect(sound).toContain('{micHidden ? (\n          <MascotSay mood="happy" tone="sky">{t("elev.play.mic.unavailable")}</MascotSay>');
  });
});
