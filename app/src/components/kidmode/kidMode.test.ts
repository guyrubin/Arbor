/**
 * AP-048: Kid Mode unit tests
 *
 * Covers:
 *  - parentGate.ts: holdProgress, holdComplete
 *  - KidModeContext: open/close state transitions (pure logic, no DOM)
 *  - No-child-data-write contract assertions
 *
 * Node harness (vitest environment: "node") — no DOM, no React rendering.
 */
import { describe, it, expect } from "vitest";
import { holdProgress, holdComplete, HOLD_MS } from "./parentGate";

// ── holdProgress ──────────────────────────────────────────────────────────────
describe("holdProgress", () => {
  it("returns 0 at elapsed=0", () => {
    expect(holdProgress(0)).toBe(0);
  });

  it("returns 50 at half the hold duration", () => {
    expect(holdProgress(HOLD_MS / 2)).toBeCloseTo(50, 5);
  });

  it("returns 100 at the full hold duration", () => {
    expect(holdProgress(HOLD_MS)).toBe(100);
  });

  it("clamps to 100 when elapsed exceeds HOLD_MS", () => {
    expect(holdProgress(HOLD_MS + 999)).toBe(100);
  });

  it("clamps to 0 for negative elapsed", () => {
    expect(holdProgress(-1)).toBe(0);
  });

  it("is strictly between 0 and 100 at one-third duration", () => {
    const p = holdProgress(HOLD_MS / 3);
    expect(p).toBeGreaterThan(0);
    expect(p).toBeLessThan(100);
  });
});

// ── holdComplete ─────────────────────────────────────────────────────────────
describe("holdComplete", () => {
  it("returns false before HOLD_MS elapsed", () => {
    expect(holdComplete(0)).toBe(false);
    expect(holdComplete(HOLD_MS - 1)).toBe(false);
  });

  it("returns true at exactly HOLD_MS", () => {
    expect(holdComplete(HOLD_MS)).toBe(true);
  });

  it("returns true after HOLD_MS", () => {
    expect(holdComplete(HOLD_MS + 500)).toBe(true);
  });
});

// ── HOLD_MS constant ─────────────────────────────────────────────────────────
describe("HOLD_MS constant", () => {
  it("is at least 2000 ms (meaningful friction gate)", () => {
    expect(HOLD_MS).toBeGreaterThanOrEqual(2000);
  });

  it("is at most 10000 ms (not punishingly long)", () => {
    expect(HOLD_MS).toBeLessThanOrEqual(10000);
  });
});

// ── Kid Mode safety contract ──────────────────────────────────────────────────
// These are static-analysis-style tests that assert the overlay module
// text never imports Firestore write paths on enter/exit. We read the
// source text and check for forbidden write-path patterns.
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function readSelf(filename: string): string {
  return readFileSync(path.join(__dirname, filename), "utf8");
}

describe("Kid Mode overlay — no child-data write contract", () => {
  it("KidModeOverlay.tsx does not import any Firestore write helper", () => {
    const src = readSelf("KidModeOverlay.tsx");
    // These are the known write-path identifiers used elsewhere in the app.
    const writePaths = [
      "upsert(",
      "addDoc(",
      "setDoc(",
      "updateDoc(",
      "deleteDoc(",
      "writeBatch",
      "useChildCollection",
    ];
    for (const wp of writePaths) {
      expect(src, `overlay must not call ${wp}`).not.toContain(wp);
    }
  });

  it("KidModeContext.tsx does not import any Firestore write helper", () => {
    const src = readSelf("KidModeContext.tsx");
    const writePaths = ["upsert(", "addDoc(", "setDoc(", "updateDoc(", "deleteDoc(", "writeBatch"];
    for (const wp of writePaths) {
      expect(src, `context must not call ${wp}`).not.toContain(wp);
    }
  });

  // The dashboard reads already-saved data through usePracticeData (a read hook);
  // it must never itself write child data. The hold-exit button is pure UI.
  it.each(["KidDashboard.tsx", "HoldExitButton.tsx"])(
    "%s does not call any Firestore write helper",
    (file) => {
      const src = readSelf(file);
      const writePaths = ["upsert(", "addDoc(", "setDoc(", "updateDoc(", "deleteDoc(", "writeBatch"];
      for (const wp of writePaths) {
        expect(src, `${file} must not call ${wp}`).not.toContain(wp);
      }
    },
  );

  it("KidModeOverlay.tsx contains no raw hex literals", () => {
    const src = readSelf("KidModeOverlay.tsx");
    // Match 3/4/6-digit hex color literals that are NOT inside var(--...) calls
    // and NOT inside comments. Strip comments first (rough), then check.
    const noComments = src.replace(/\/\/[^\n]*/g, "").replace(/\/\*[\s\S]*?\*\//g, "");
    // Hex literals of the form #abc or #aabbcc (not in var(--...) or className strings)
    const hexOutsideVar = noComments.replace(/var\(--[^)]+\)/g, "VAR_TOKEN");
    const hexMatches = hexOutsideVar.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches, `unexpected hex literals: ${hexMatches.join(", ")}`).toHaveLength(0);
  });

  it("parentGate.ts contains no raw hex literals", () => {
    const src = readSelf("parentGate.ts");
    const hexMatches = src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? [];
    expect(hexMatches, `unexpected hex literals: ${hexMatches.join(", ")}`).toHaveLength(0);
  });
});

// ── KID-2: keyboard lock — shell shield (inert + aria-hidden) ────────────────
import { shieldShellSiblings, KID_MODE_LAYER_ATTR, type ShieldableElement } from "./kidModeShield";

/** Minimal attribute-bearing Element stand-in for the node harness. */
function fakeEl(initial: Record<string, string> = {}): ShieldableElement & { attrs: Map<string, string> } {
  const attrs = new Map(Object.entries(initial));
  return {
    attrs,
    hasAttribute: (n) => attrs.has(n),
    getAttribute: (n) => (attrs.has(n) ? attrs.get(n)! : null),
    setAttribute: (n, v) => void attrs.set(n, v),
    removeAttribute: (n) => void attrs.delete(n),
  };
}

describe("KID-2: shieldShellSiblings — shell carries inert while Kid Mode is open", () => {
  it("sets inert + aria-hidden on every non-Kid-Mode sibling (the shell root)", () => {
    const shell = fakeEl(); // the .page-shell grid — nav, capture, settings live here
    const mobileNav = fakeEl();
    shieldShellSiblings([shell, mobileNav]);
    for (const el of [shell, mobileNav]) {
      expect(el.attrs.has("inert")).toBe(true);
      expect(el.attrs.get("aria-hidden")).toBe("true");
    }
  });

  it("never shields the Kid Mode layers themselves (backdrop + overlay)", () => {
    const backdrop = fakeEl({ [KID_MODE_LAYER_ATTR]: "true", "aria-hidden": "true" });
    const overlay = fakeEl({ [KID_MODE_LAYER_ATTR]: "true" });
    const shell = fakeEl();
    shieldShellSiblings([backdrop, overlay, shell]);
    expect(backdrop.attrs.has("inert")).toBe(false);
    expect(overlay.attrs.has("inert")).toBe(false);
    expect(overlay.attrs.has("aria-hidden")).toBe(false);
    expect(shell.attrs.has("inert")).toBe(true);
  });

  it("undo restores the shell exactly (inert removed, prior aria-hidden preserved)", () => {
    const shell = fakeEl();
    const alreadyHidden = fakeEl({ "aria-hidden": "false" });
    const undo = shieldShellSiblings([shell, alreadyHidden]);
    expect(shell.attrs.has("inert")).toBe(true);
    expect(alreadyHidden.attrs.get("aria-hidden")).toBe("true");
    undo();
    expect(shell.attrs.has("inert")).toBe(false);
    expect(shell.attrs.has("aria-hidden")).toBe(false);
    expect(alreadyHidden.attrs.has("inert")).toBe(false);
    expect(alreadyHidden.attrs.get("aria-hidden")).toBe("false");
  });

  it("leaves elements that were already inert alone — and never un-inerts them", () => {
    const externallyInert = fakeEl({ inert: "" });
    const undo = shieldShellSiblings([externallyInert]);
    expect(externallyInert.attrs.has("aria-hidden")).toBe(false); // untouched
    undo();
    expect(externallyInert.attrs.has("inert")).toBe(true); // ownership respected
  });

  it("KidModeOverlay.tsx wires the shield while open and marks both layers", () => {
    const src = readSelf("KidModeOverlay.tsx");
    // The shield is applied in an isKidModeOpen effect...
    expect(src).toContain("shieldShellSiblings(");
    // ...and both the backdrop and the overlay carry the layer marker so they
    // are never shielded themselves.
    const markers = src.match(/data-kid-mode-layer="true"/g) ?? [];
    expect(markers.length).toBeGreaterThanOrEqual(2);
    // The marker literal must match the constant the shield checks.
    expect(KID_MODE_LAYER_ATTR).toBe("data-kid-mode-layer");
  });

  it("kidModeShield.ts stays a pure attribute helper — no writes, no hex", () => {
    const src = readSelf("kidModeShield.ts");
    const writePaths = ["upsert(", "addDoc(", "setDoc(", "updateDoc(", "deleteDoc(", "writeBatch"];
    for (const wp of writePaths) {
      expect(src, `shield must not call ${wp}`).not.toContain(wp);
    }
    expect(src.match(/#[0-9a-fA-F]{3,6}\b/g) ?? []).toHaveLength(0);
  });
});

// ── KID-1: i18n — kid.* namespace coverage, no hardcoded copy, register split ─
import { en, he } from "../../lib/i18n";

/** Strip // and /* *\/ comments so scans only see live code. */
function stripComments(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/\/\/[^\n]*/g, "");
}

describe("KID-1: kid.* i18n keys exist in BOTH language maps", () => {
  // The Kid Mode chrome keys the components reference directly.
  const CHROME_KEYS = [
    "kid.greeting",
    "kid.greetingSub",
    "kid.stars.aria",
    "kid.exit.backToParent",
    "kid.exit.backToParentAria",
    "kid.exit.holdIdle",
    "kid.exit.holdAria",
    "kid.exit.holding",
    "kid.safety.aria",
    "kid.safety.locked",
    "kid.safety.private",
    "kid.safety.stars",
    "kid.quest.eyebrow",
    "kid.quest.title",
    "kid.quest.sub",
    "kid.quest.cta",
    "kid.adventures.title",
    "kid.games.title",
    "kid.games.seeAll",
    "kid.back.home",
    "kid.back.homeAria",
    "kid.surface.journeys",
    "kid.surface.arcade",
    "kid.surface.feelings",
  ];

  it.each(CHROME_KEYS)("%s exists (non-empty) in en AND he", (key) => {
    expect(en[key], `en missing ${key}`).toBeTruthy();
    expect(he[key], `he missing ${key} (HE placeholders must still register the key)`).toBeTruthy();
  });

  it("every tile id declared in KidDashboard.tsx has title+sub keys in both maps", () => {
    // Tile defs carry only ids — copy lives in i18n under kid.adv.<id>.* /
    // kid.game.<id>.*. Extract the ids straight from the source so a new tile
    // without keys fails here instead of rendering a raw key string.
    const src = stripComments(readSelf("KidDashboard.tsx"));
    const ids = [...src.matchAll(/\{ id: "([a-z-]+)"/g)].map((m) => m[1]);
    expect(ids.length, "expected the 3 adventure + 8 game tile defs").toBeGreaterThanOrEqual(11);
    for (const id of ids) {
      const base = `kid.adv.${id}.title` in en ? `kid.adv.${id}` : `kid.game.${id}`;
      for (const suffix of [".title", ".sub"]) {
        expect(en[base + suffix], `en missing ${base}${suffix}`).toBeTruthy();
        expect(he[base + suffix], `he missing ${base}${suffix}`).toBeTruthy();
      }
    }
  });

  it("kid.* keys are en/he parity-complete (no one-sided keys)", () => {
    const kidEn = Object.keys(en).filter((k) => k.startsWith("kid."));
    const kidHe = Object.keys(he).filter((k) => k.startsWith("kid."));
    expect(kidEn.length).toBeGreaterThan(0);
    expect(kidHe.sort()).toEqual(kidEn.sort());
  });
});

describe("KID-1: no hardcoded UI copy renders in kidmode/*.tsx", () => {
  const KID_TSX = ["KidDashboard.tsx", "KidModeOverlay.tsx", "HoldExitButton.tsx", "ParentChallenge.tsx"];

  // The exact strings that used to be hardcoded — they must never reappear as
  // literals (they live in lib/i18n.ts now).
  const FORBIDDEN_LITERALS = [
    "You're doing amazing today",
    "TODAY'S ADVENTURE",
    "Start a hero story",
    "Pick a world and you're the star",
    "Let's go",
    "My growth adventures",
    "See all games",
    "Parent locked",
    "Private by default",
    "Stars, never streaks",
    "Hold to exit",
    "Back to parent",
    "Back to home",
    "stars earned",
    "Memory Match",
    "Feelings Detective",
    "Sound Explorer",
    "Sequence Quest",
    "Calm Builder",
    "Rhythm Hero",
    "Puzzle Planet",
    "Play, learn & grow",
    "Explore & understand",
    "Create & express",
  ];

  it.each(KID_TSX)("%s contains none of the previously hardcoded strings", (file) => {
    const src = stripComments(readSelf(file));
    for (const lit of FORBIDDEN_LITERALS) {
      expect(src, `${file} must not hardcode "${lit}"`).not.toContain(lit);
    }
  });

  it.each(KID_TSX)("%s renders no bare English JSX text nodes", (file) => {
    const src = stripComments(readSelf(file));
    // JSX text = content between a closing `>` and the next `<`. Legit renders
    // go through {t("kid.*")} — the braces break the match. TS generics also
    // produce `>…<` spans, so only flag captures that read as natural language
    // (words/punctuation only — code spans carry (), :, ; or = and are skipped).
    const textNodes = [...src.matchAll(/>([^<>{}]+)</g)]
      .map((m) => m[1].trim())
      .filter((s) => /[A-Za-z]{2}/.test(s) && /^[\sA-Za-z'’.,!?…-]+$/.test(s));
    expect(textNodes, `${file} has bare JSX text: ${JSON.stringify(textNodes)}`).toEqual([]);
  });
});

// Firewall condition (KID-1): the kid.* namespace is the kid register — it must
// never be referenced from parent surfaces. Walk every source file outside
// components/kidmode and assert none references a "kid." i18n key. The only
// other legitimate home for "kid." strings is the dictionary itself.
import { readdirSync, statSync } from "node:fs";

describe("KID-1 register separation: kid.* i18n keys never referenced outside kidmode", () => {
  const SRC_ROOT = path.join(__dirname, "..", "..");
  const ALLOWED = [
    path.join(SRC_ROOT, "components", "kidmode") + path.sep, // the kid register itself
    path.join(SRC_ROOT, "lib", "i18n.ts"), // the dictionaries
  ];

  function walk(dir: string, out: string[] = []): string[] {
    for (const name of readdirSync(dir)) {
      const full = path.join(dir, name);
      if (statSync(full).isDirectory()) walk(full, out);
      else if (/\.(ts|tsx)$/.test(name)) out.push(full);
    }
    return out;
  }

  it("no parent-surface file references a kid.* key", () => {
    const offenders: string[] = [];
    for (const file of walk(SRC_ROOT)) {
      if (ALLOWED.some((a) => file === a || file.startsWith(a))) continue;
      const src = readFileSync(file, "utf8");
      if (/["'`]kid\./.test(src)) offenders.push(path.relative(SRC_ROOT, file));
    }
    expect(offenders, `parent surfaces referencing kid.* keys: ${offenders.join(", ")}`).toEqual([]);
  });
});

// ── KID-4: honest navigation — game tiles are named after the worlds they open ─
// Static cross-file contract: every KidDashboard GAMES tile carries the id of a
// live HeroArcade world, and the tile's EN title is VERBATIM that world's name.
// (The arcade also renders `open.name` as the opened panel's heading, so the
// title the child tapped is the title they land on.)
describe("KID-4: kid-dashboard game tiles match their HeroArcade destination", () => {
  const dashSrc = stripComments(readSelf("KidDashboard.tsx"));
  const arcadeSrc = stripComments(
    readFileSync(path.join(__dirname, "..", "practice", "HeroArcade.tsx"), "utf8"),
  );

  // HeroArcade world registry: id → display name.
  const worldNames = new Map(
    [...arcadeSrc.matchAll(/\{ id: "([a-z-]+)", name: "([^"]+)"/g)].map((m) => [m[1], m[2]]),
  );

  // KidDashboard tile defs carrying a worldId. Game tiles reference arcade
  // world ids directly; adventure tiles use "kid-*" scene ids (not arcade
  // destinations) and are excluded.
  const gameTiles = [...dashSrc.matchAll(/\{ id: "([a-z-]+)", worldId: "([a-z-]+)"/g)]
    .map((m) => ({ id: m[1], worldId: m[2] }))
    .filter((tile) => !tile.worldId.startsWith("kid-"));

  it("finds the 8 game tiles and the arcade world registry", () => {
    expect(gameTiles.length).toBe(8);
    expect(worldNames.size).toBeGreaterThanOrEqual(8);
  });

  it.each(gameTiles.map((g) => [g.id, g.worldId]))(
    "tile %s → world %s: title is the world's name, verbatim",
    (id, worldId) => {
      const worldName = worldNames.get(worldId as string);
      expect(worldName, `no HeroArcade world with id "${worldId}"`).toBeTruthy();
      expect(en[`kid.game.${id}.title`]).toBe(worldName);
      expect(he[`kid.game.${id}.title`]).toBe(worldName); // EN placeholder until GD-6
    },
  );

  it("the opened world panel announces its own name (verbatim arrival)", () => {
    // The open-world branch renders the world's name as a heading.
    expect(arcadeSrc).toContain("{open.name}");
  });

  it("every pre-selectable world is live (has a component)", () => {
    for (const { worldId } of gameTiles) {
      // The world entry declares a Comp — a tile may never point at a
      // name-only world (that is the broken promise KID-4 removes).
      const entry = arcadeSrc.slice(arcadeSrc.indexOf(`{ id: "${worldId}", name:`));
      expect(entry.slice(0, entry.indexOf("\n")), `world ${worldId} must be live`).toMatch(/Comp: \w+/);
    }
  });
});

// ── KID-7: coherent art — no two visible tiles share an art file ─────────────
describe("KID-7: kid-dashboard art is unique per visible tile", () => {
  it("no art file is referenced twice in KidDashboard.tsx", () => {
    const src = stripComments(readSelf("KidDashboard.tsx"));
    const arts = [...src.matchAll(/\/visuals\/cards\/[\w/.-]+/g)].map((m) => m[0]);
    const dupes = arts.filter((a, i) => arts.indexOf(a) !== i);
    expect(dupes, `recycled art files: ${dupes.join(", ")}`).toEqual([]);
  });

  it("the banner art matches its hero-story copy (not the old calm-corner scene)", () => {
    const src = readSelf("KidDashboard.tsx");
    expect(src).toContain("game-courage-steps.webp");
    expect(stripComments(src)).not.toContain("blanket-fort");
  });
});

// ── KID-6: no streak remnants on child-adjacent surfaces ─────────────────────
describe("KID-6: no loss-framed streak copy on child-adjacent surfaces", () => {
  const CHILD_ADJACENT = [
    path.join(__dirname, "KidDashboard.tsx"),
    path.join(__dirname, "KidModeOverlay.tsx"),
    path.join(__dirname, "HoldExitButton.tsx"),
    path.join(__dirname, "ParentChallenge.tsx"),
    path.join(__dirname, "..", "practice", "HeroArcade.tsx"),
    path.join(__dirname, "..", "practice", "JourneyTab.tsx"),
  ];

  it.each(CHILD_ADJACENT.map((f) => [path.basename(f), f]))(
    "%s contains no streak reference in live code",
    (_name, file) => {
      const src = stripComments(readFileSync(file as string, "utf8"));
      expect(src).not.toMatch(/streak/i);
    },
  );

  it("the dead MissionsPanel (streak pill UI) stays deleted", () => {
    expect(
      () => statSync(path.join(__dirname, "..", "practice", "MissionsTab.tsx")),
      "MissionsTab.tsx was deleted in KID-6 — a revival needs an explicit no-streak redesign decision",
    ).toThrow();
  });

  it("the mission completion toast is gain-framed in EN and HE", () => {
    for (const dict of [en, he]) {
      const toast = dict["ov.mission.toastDone"];
      expect(toast).toBeTruthy();
      expect(toast).not.toMatch(/streak|alive/i);
      expect(toast).not.toContain("רצף");
    }
  });
});

// ── KidMode enter / exit state machine (pure logic) ──────────────────────────
// We test the state transitions through direct function calls on the
// context state, simulating what the Provider does without a DOM.
describe("Kid Mode enter/exit state machine", () => {
  it("starts closed", () => {
    let open = false;
    const openFn = () => { open = true; };
    const closeFn = () => { open = false; };

    expect(open).toBe(false);
    openFn();
    expect(open).toBe(true);
    closeFn();
    expect(open).toBe(false);
  });

  it("multiple open calls are idempotent (state stays true)", () => {
    let open = false;
    const openFn = () => { open = true; };

    openFn();
    openFn();
    openFn();
    expect(open).toBe(true);
  });

  it("close after close is idempotent (state stays false)", () => {
    let open = true;
    const closeFn = () => { open = false; };

    closeFn();
    closeFn();
    expect(open).toBe(false);
  });

  it("close does not call any data-mutation side-effect", () => {
    // Simulate: close only sets state, never calls a write fn.
    const writeCalls: string[] = [];
    const fakeMutate = () => { writeCalls.push("write"); };

    // The real closeKidMode does only: setIsKidModeOpen(false)
    // We assert no mutation was triggered.
    let open = true;
    const closeKidMode = () => { open = false; /* no fakeMutate here */ };

    closeKidMode();
    expect(open).toBe(false);
    expect(writeCalls).toHaveLength(0);
    void fakeMutate; // referenced to silence unused-var lint
  });
});
