import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  __resetJourneyCache,
  markWowDone,
  markWowPending,
  readJourney,
  setCoachSeed,
  setRailClicked,
  setRailDismissed,
  subscribeJourney,
  takeCoachSeed,
} from "./onboardingJourney";

/** Minimal in-memory Storage stand-in for the node test env. */
class MemoryStorage {
  private m = new Map<string, string>();
  getItem(k: string): string | null {
    return this.m.has(k) ? (this.m.get(k) as string) : null;
  }
  setItem(k: string, v: string): void {
    this.m.set(k, String(v));
  }
  removeItem(k: string): void {
    this.m.delete(k);
  }
}

type G = { localStorage?: unknown };
const g = globalThis as G;

let store: MemoryStorage;

beforeEach(() => {
  store = new MemoryStorage();
  g.localStorage = store;
  __resetJourneyCache();
});

describe("onboardingJourney — migration matrix (legacy-absent MUST map to done)", () => {
  it("no legacy keys → wow done, empty rail, no seed (existing devices get NO surprise overlay)", () => {
    const j = readJourney();
    expect(j).toEqual({ v: 1, wow: "done", rail: {} });
    expect(store.getItem("arbor.journey")).not.toBeNull();
  });

  it('legacy wowPending "1" → pending', () => {
    store.setItem("arbor.wowPending", "1");
    expect(readJourney().wow).toBe("pending");
  });

  it('legacy wowPending "done" → done', () => {
    store.setItem("arbor.wowPending", "done");
    expect(readJourney().wow).toBe("done");
  });

  it("legacy firstSteps JSON folds into rail as-is", () => {
    store.setItem("arbor.firstSteps", JSON.stringify({ dismissed: true, clicked: { coach: true } }));
    const j = readJourney();
    expect(j.rail).toEqual({ dismissed: true, clicked: { coach: true } });
  });

  it("corrupt legacy firstSteps → empty rail, never throws", () => {
    store.setItem("arbor.firstSteps", "{not json");
    expect(readJourney().rail).toEqual({});
  });

  it("legacy coachSeed migrates and is consumed exactly once", () => {
    store.setItem("arbor.coachSeed", "Sleep is on my mind with Dylan.");
    expect(readJourney().coachSeed).toBe("Sleep is on my mind with Dylan.");
    expect(takeCoachSeed()).toBe("Sleep is on my mind with Dylan.");
    expect(takeCoachSeed()).toBeNull();
    expect(readJourney().coachSeed).toBeUndefined();
  });

  it("removes all three legacy keys after migrating", () => {
    store.setItem("arbor.wowPending", "1");
    store.setItem("arbor.firstSteps", "{}");
    store.setItem("arbor.coachSeed", "seed");
    readJourney();
    expect(store.getItem("arbor.wowPending")).toBeNull();
    expect(store.getItem("arbor.firstSteps")).toBeNull();
    expect(store.getItem("arbor.coachSeed")).toBeNull();
  });

  it("an existing arbor.journey wins over stray legacy keys (migration is one-time)", () => {
    store.setItem("arbor.journey", JSON.stringify({ v: 1, wow: "pending", rail: {} }));
    store.setItem("arbor.wowPending", "done"); // stale stray — must be ignored
    expect(readJourney().wow).toBe("pending");
  });

  it("corrupt arbor.journey → safe done default", () => {
    store.setItem("arbor.journey", "{not json");
    expect(readJourney()).toEqual({ v: 1, wow: "done", rail: {} });
  });
});

describe("onboardingJourney — storage unavailable never traps", () => {
  it("missing localStorage → done default; writes still hold in-session", () => {
    delete g.localStorage;
    __resetJourneyCache();
    expect(readJourney().wow).toBe("done");
    expect(() => markWowPending()).not.toThrow();
    expect(readJourney().wow).toBe("pending"); // in-memory cache carries the session
  });

  it("throwing storage → done default", () => {
    g.localStorage = {
      getItem: () => {
        throw new Error("denied");
      },
    };
    __resetJourneyCache();
    expect(readJourney()).toEqual({ v: 1, wow: "done", rail: {} });
  });
});

describe("onboardingJourney — transitions", () => {
  it("markWowPending → pending; markWowDone → done", () => {
    markWowPending();
    expect(readJourney().wow).toBe("pending");
    markWowDone({ comicShown: false });
    expect(readJourney().wow).toBe("done");
    expect(readJourney().rail.clicked?.comic).toBeUndefined();
  });

  it("markWowDone with a real comic also checks the rail's comic step", () => {
    markWowPending();
    markWowDone({ comicShown: true });
    const j = readJourney();
    expect(j.wow).toBe("done");
    expect(j.rail.clicked?.comic).toBe(true);
  });

  it("rail dismiss/click writes persist and merge", () => {
    setRailClicked("coach");
    setRailDismissed();
    setRailClicked("comic");
    __resetJourneyCache(); // force a re-read from storage
    expect(readJourney().rail).toEqual({ dismissed: true, clicked: { coach: true, comic: true } });
  });

  it("setCoachSeed → takeCoachSeed round-trips read-once", () => {
    setCoachSeed("Focus is on my mind with Mia (3 years). Where should I start?");
    expect(takeCoachSeed()).toBe("Focus is on my mind with Mia (3 years). Where should I start?");
    expect(takeCoachSeed()).toBeNull();
  });

  it("notifies subscribers on every write, and unsubscribe works", () => {
    const fn = vi.fn();
    const off = subscribeJourney(fn);
    markWowPending();
    markWowDone({ comicShown: true });
    expect(fn).toHaveBeenCalledTimes(2);
    off();
    setRailDismissed();
    expect(fn).toHaveBeenCalledTimes(2);
  });
});

// ── B-SHELL-09: onboarding has no avatar step; the wow asks once ─────────────
import { wowEntryStep } from "./onboardingJourney";
import * as fs from "node:fs";
import * as path from "node:path";

describe("B-SHELL-09 — four onboarding steps; a new child meets the hero question once, in the wow", () => {
  const root = path.resolve(__dirname, "..");
  const flow = fs.readFileSync(path.join(root, "components/auth/OnboardingFlow.tsx"), "utf8");
  const wow = fs.readFileSync(path.join(root, "components/onboarding/WowOnboarding.tsx"), "utf8");
  const journey = fs.readFileSync(path.join(root, "lib/onboardingJourney.ts"), "utf8");

  it("a hero-less new child enters the wow at the avatar card; a child with a hero at the comic", () => {
    expect(wowEntryStep(false)).toBe("avatar");
    expect(wowEntryStep(true)).toBe("comic");
  });

  it("a legacy avatarSkipped flag no longer diverts the wow; markWowDone still strips it", () => {
    store.setItem("arbor.journey", JSON.stringify({ v: 1, wow: "pending", rail: {}, avatarSkipped: true }));
    expect(wowEntryStep(false)).toBe("avatar");
    markWowDone({ comicShown: true });
    expect(readJourney().avatarSkipped).toBeUndefined();
    expect(readJourney().wow).toBe("done");
  });

  it("B-SHELL-36: three steps and no new journey flag writes", () => {
    expect(flow).toContain("aria-valuemax={3}");
    expect(flow).not.toMatch(/StepAvatar|AvatarCreator|markWowPending|setCoachSeed/);
    expect(journey).not.toMatch(/export function (markAvatarSkipped|clearAvatarSkipped)/);
  });

  it("the wow is the one place the hero is asked: entry via wowEntryStep, its own skip shows the Sprout note", () => {
    expect(wow).toContain("useState<WowStep>(() => wowEntryStep(hero.hasHero))");
    expect(wow).toContain("onClick={() => { setAvatarSkipped(true); setStep(\"comic\"); }}");
    expect(wow).not.toContain("readJourney().avatarSkipped");
    expect(wow).toContain('t("elev.storeshell.wow.sproutStars", { name })');
  });

  it("B-SHELL-36 retires automatic wow without deleting journey history", () => {
    expect(wow).toContain("export function WowOnboarding() { return null; }");
    expect(flow).not.toContain("patch.photoUrl");
    expect(flow).not.toMatch(/removeItem|markWowDone|readJourney/);
  });
});
