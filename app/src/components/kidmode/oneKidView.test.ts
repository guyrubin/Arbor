/**
 * B-KID-74 — only the open kid view is mounted (Fable render, 5 Oct: every
 * visited world's GameShell and the kid home stayed mounted under the open
 * one). The overlay's content is ONE keyed node with an enter-only fade; a
 * left view unmounts in the same commit, so its world's timers, audio and
 * streams stop. The home's scroll is restored, not kept alive.
 */
import { describe, expect, it, vi } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

vi.mock("./KidDashboard", () => ({ default: () => null, KID_GAME_TITLE_KEY: {} }));

import { arrivalScrollTop, kidViewKey } from "./KidModeOverlay";

const read = (rel: string) => readFileSync(path.resolve(__dirname, "..", rel), "utf8");
const overlay = read("kidmode/KidModeOverlay.tsx");
const content = overlay.slice(overlay.indexOf("── Content area"));

describe("B-KID-74: one mounted kid view", () => {
  it("each view has ONE key; each world is its own view", () => {
    expect(kidViewKey("home", null)).toBe("home");
    expect(kidViewKey("home", "memory")).toBe("home");
    expect(kidViewKey("journeys", "story-1")).toBe("journeys");
    expect(kidViewKey("arcade", "memory")).toBe("arcade:memory");
    expect(kidViewKey("arcade", "beat")).not.toBe(kidViewKey("arcade", "memory"));
  });

  it("the content area has no presence wrapper and no exit animation (nothing waits to unmount)", () => {
    expect(content).not.toContain("<AnimatePresence");
    expect(content).not.toMatch(/\bexit=\{/);
    expect(content.match(/<motion\.div/g)?.length).toBe(1);
    expect(content).toContain("key={kidViewKey(view, arcadeWorldId)}");
    // the only presence in the file is the overlay's own open/close
    expect(overlay.match(/<AnimatePresence/g)?.length).toBe(1);
    expect(overlay).toContain("<AnimatePresence initial={false}>");
  });

  it("the error boundary resets on the same key", () => {
    expect(overlay).toContain("resetKey={kidViewKey(view, arcadeWorldId)}");
  });

  it("the home's scroll is restored on return; every other view arrives at the top", () => {
    expect(arrivalScrollTop("home", 640)).toBe(640);
    expect(arrivalScrollTop("home", -3)).toBe(0);
    expect(arrivalScrollTop("arcade", 640)).toBe(0);
    expect(arrivalScrollTop("journeys", 640)).toBe(0);
    expect(overlay).toContain('onScroll={view === "home" ? (e) => { homeScrollRef.current = e.currentTarget.scrollTop; } : undefined}');
    expect(overlay).toContain("contentRef.current.scrollTop = arrivalScrollTop(view, homeScrollRef.current);");
    // a fresh open starts the home at the top
    expect(overlay).toMatch(/if \(isKidModeOpen && !wasOpenRef\.current\) \{\s*homeScrollRef\.current = 0;/);
  });
});

describe("B-KID-74: leaving a world releases what it held", () => {
  it("Beat Keeper closes its AudioContext and timers on unmount", () => {
    const beat = read("practice/BeatKeeperWorld.tsx");
    expect(beat).toMatch(/useEffect\(\(\) => \(\) => \{[\s\S]*?clearInterval\(timerRef\.current\)[\s\S]*?closeBeatAudio\(\);[\s\S]*?\}, \[\]\);/);
  });
  it("Sound Lab stops the mic on unmount, also when the stream arrives after leaving", () => {
    const sound = read("practice/SpeechCoachTab.tsx");
    expect(sound).toContain("unmountedRef.current = true;");
    expect(sound).toContain("if (unmountedRef.current) { stream.getTracks().forEach((t) => t.stop()); return; }");
    expect(sound).toContain("if (unmountedRef.current) return; // left the world: no count, no scoring");
  });
  it("Mimic stops the camera on unmount", () => {
    expect(read("practice/MimicStudioTab.tsx")).toContain("useEffect(() => () => stopMirror(), []);");
  });
  it("a game's spoken instruction stops when its shell unmounts", () => {
    expect(read("kidmode/game/GameShell.tsx")).toContain("return () => { clearTimeout(timer); stopVoice(); };");
  });
});
