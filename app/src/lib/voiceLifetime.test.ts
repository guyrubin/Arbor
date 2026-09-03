import { describe, expect, it, vi } from "vitest";
import { createVoiceLifetime } from "./voiceLifetime";

describe("voice attempt ownership", () => {
  it("invalidates before abort/stop callbacks can act on shared state", () => {
    const lifetime = createVoiceLifetime();
    const attempt = lifetime.begin();
    const observed: boolean[] = [];
    attempt.signal.addEventListener("abort", () => observed.push(attempt.isCurrent()));
    attempt.adopt({ stop: () => observed.push(attempt.isCurrent()) });
    lifetime.cancel();
    expect(observed).toEqual([false, false]);
    expect(lifetime.current).toBeNull();
    expect(attempt.signal.aborted).toBe(true);
  });

  it("an old error/close/catch cannot stop or clear the next attempt", () => {
    const lifetime = createVoiceLifetime();
    const old = lifetime.begin();
    const oldStop = vi.fn();
    old.adopt({ stop: oldStop });
    const next = lifetime.begin();
    const nextStop = vi.fn();
    next.adopt({ stop: nextStop });
    let caption = "new attempt";
    for (const callback of ["error", "closed", "catch", "turn", "interim", "crisis", "blocked", "fail-closed"]) {
      const handle = () => {
        if (!old.isCurrent()) return;
        old.end();
        caption = callback;
      };
      handle();
    }
    expect(old.end()).toBe(false);
    expect(oldStop).toHaveBeenCalledTimes(1);
    expect(nextStop).not.toHaveBeenCalled();
    expect(caption).toBe("new attempt");
    expect(lifetime.current).toBe(next);
    lifetime.cancel();
  });

  it("a late resolved start releases only its own controller, never adopts it", async () => {
    const lifetime = createVoiceLifetime();
    const old = lifetime.begin();
    let resolve!: (resource: { stop(): void }) => void;
    const pending = new Promise<{ stop(): void }>((done) => { resolve = done; });
    const adoption = pending.then((resource) => old.adopt(resource));
    const next = lifetime.begin();
    const oldStop = vi.fn();
    const nextStop = vi.fn();
    next.adopt({ stop: nextStop });
    resolve({ stop: oldStop });
    expect(await adoption).toBe(false);
    expect(oldStop).toHaveBeenCalledTimes(1);
    expect(nextStop).not.toHaveBeenCalled();
    expect(next.isCurrent()).toBe(true);
    lifetime.cancel();
  });

  it("unmount cancellation rejects pending adoption and remains reusable under StrictMode", () => {
    const lifetime = createVoiceLifetime();
    const pending = lifetime.begin();
    lifetime.cancel();
    const stop = vi.fn();
    expect(pending.adopt({ stop })).toBe(false);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(pending.signal.aborted).toBe(true);
    expect(lifetime.begin().isCurrent()).toBe(true);
    lifetime.cancel();
  });

  it("a delayed screen/extraction result cannot mutate a replacement attempt", async () => {
    const lifetime = createVoiceLifetime();
    const attempt = lifetime.begin();
    let release!: () => void;
    const screen = new Promise<void>((resolve) => { release = resolve; });
    const append = vi.fn();
    const result = screen.then(() => { if (attempt.isCurrent()) append("screened old turn"); });
    lifetime.begin();
    release();
    await result;
    expect(append).not.toHaveBeenCalled();
    lifetime.cancel();
  });
});
