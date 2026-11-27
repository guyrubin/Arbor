/**
 * B-GAME-18 — the sitting ledger: one event per sitting; Play again is its own;
 * a grown-up's door marks only that game's next open; the scope (a hash of
 * account and child) is never stored or sent; nothing breaks without storage.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent = vi.hoisted(() => ({ calls: [] as { event: string; props: Record<string, unknown> }[] }));
vi.mock("./analytics", () => ({ track: (event: string, props: Record<string, unknown> = {}) => { sent.calls.push({ event, props }); } }));

import { DOOR_MARK_MS, GAME_SITTING_KEY, SITTING_GAP_MS, leaveGameSitting, markGameDoor, openGameSitting, replayGameSitting, resetGameSittingsForTest, sittingScope } from "./gameSittings";
import { ACCOUNT_DEVICE_KEYS } from "./childDataSinks";

const CHILD_ID = ["child", "1780000000000"].join("-");
const A = sittingScope("owner-a", CHILD_ID);
const B = sittingScope("owner-a", ["child", "1780000000001"].join("-"));
const T0 = Date.UTC(2026, 9, 19, 10);
let stored: Map<string, string>;

beforeEach(() => {
  sent.calls = []; resetGameSittingsForTest(); stored = new Map();
  vi.stubGlobal("sessionStorage", { getItem: (k: string) => stored.get(k) ?? null, setItem: (k: string, v: string) => { stored.set(k, v); }, removeItem: (k: string) => { stored.delete(k); } });
});
afterEach(() => { vi.unstubAllGlobals(); });

describe("one event per sitting", () => {
  it("a re-open inside the gap is the same sitting; the gap counts from leaving", () => {
    expect(openGameSitting("puzzle", A, T0)).toBe(true);
    expect(openGameSitting("puzzle", A, T0 + 1000)).toBe(false);
    leaveGameSitting("puzzle", A, T0 + SITTING_GAP_MS); // played half an hour, then left
    expect(openGameSitting("puzzle", A, T0 + SITTING_GAP_MS + 60_000)).toBe(false);
    expect(openGameSitting("puzzle", A, T0 + 3 * SITTING_GAP_MS)).toBe(true);
    expect(sent.calls).toHaveLength(2);
  });
  it("Play again always sends, a different game or child starts fresh", () => {
    openGameSitting("puzzle", A, T0);
    replayGameSitting("puzzle", A, T0 + 1); replayGameSitting("puzzle", A, T0 + 2);
    openGameSitting("beat", A, T0 + 3); openGameSitting("puzzle", A, T0 + 4);
    openGameSitting("puzzle", B, T0 + 5);
    expect(sent.calls.map((c) => [c.props.game, c.props.replay])).toEqual([["puzzle", false], ["puzzle", true], ["puzzle", true], ["beat", false], ["puzzle", false], ["puzzle", false]]);
  });
  it("a reload continues the stored sitting; a scope change forgets it", () => {
    openGameSitting("puzzle", A, T0);
    resetGameSittingsForTest(); // a new page in the same tab
    expect(openGameSitting("puzzle", A, T0 + 5000)).toBe(false);
    expect(openGameSitting("puzzle", B, T0 + 6000)).toBe(true);
    expect(openGameSitting("puzzle", A, T0 + 7000)).toBe(true);
  });
  it("without storage the page still dedupes", () => {
    vi.stubGlobal("sessionStorage", { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); }, removeItem: () => { throw new Error("blocked"); } });
    expect(openGameSitting("puzzle", A, T0)).toBe(true);
    expect(openGameSitting("puzzle", A, T0 + 1)).toBe(false);
  });
  it("a non-catalogue id sends nothing and stores nothing", () => {
    expect(openGameSitting(CHILD_ID, A, T0)).toBe(false);
    replayGameSitting("1780000000000", A, T0);
    expect(sent.calls).toEqual([]); expect(stored.size).toBe(0);
  });
});

describe("prompted: a grown-up's door", () => {
  it("marks that game's next open and its replays; it is consumed", () => {
    markGameDoor("puzzle", T0);
    openGameSitting("puzzle", A, T0 + 1000); replayGameSitting("puzzle", A, T0 + 2000);
    openGameSitting("beat", A, T0 + 3000);
    expect(sent.calls.map((c) => c.props.prompted)).toEqual([true, true, false]);
  });
  it("a different game first, or an old mark, is the child's own choice", () => {
    markGameDoor("puzzle", T0); openGameSitting("beat", A, T0 + 1); openGameSitting("puzzle", A, T0 + 2);
    markGameDoor("calm-builder", T0); openGameSitting("calm-builder", A, T0 + DOOR_MARK_MS + 1);
    expect(sent.calls.map((c) => [c.props.game, c.props.prompted])).toEqual([["beat", false], ["puzzle", false], ["calm-builder", false]]);
  });
});

describe("privacy", () => {
  it("the stored row is a game id, a time and the flag; the scope and child id never leave memory", () => {
    openGameSitting("puzzle", A, T0);
    expect([...stored.keys()]).toEqual([GAME_SITTING_KEY]);
    expect(JSON.parse(stored.get(GAME_SITTING_KEY)!)).toEqual({ g: "puzzle", at: T0, p: false });
    const everything = JSON.stringify([...stored.values(), sent.calls]);
    expect(everything).not.toContain(CHILD_ID);
    expect(everything).not.toContain(A);
    expect(Object.keys(sent.calls[0].props).sort()).toEqual(["game", "prompted", "replay"]);
  });
  it("the device key is registered (account deletion sweeps it)", () => {
    expect(ACCOUNT_DEVICE_KEYS[GAME_SITTING_KEY]).toMatch(/no child id/);
  });
});
