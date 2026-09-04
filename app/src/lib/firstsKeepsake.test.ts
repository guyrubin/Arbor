import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  FIRSTS_KEEPSAKE_CAPTION_KEY,
  FIRSTS_KEEPSAKE_NAMESPACE,
  KEEPSAKE_ERROR_KEYS,
  KEEPSAKE_NOTE_MAX,
  firstsKeepsakeKey,
  keepsakeCount,
  localDayKey,
  parseKeepsakes,
  readKeepsakes,
  removeKeepsake,
  upsertKeepsake,
  validateKeepsake,
  writeKeepsakes,
  type KeepsakeMap,
} from "./firstsKeepsake";
import { clearChildLocalState, isChildScopedKey } from "./childLocalState";
import { resolveCaptionKey } from "./shareCaption";
import { en as waveEEn, he as waveEHe } from "./i18nElevation/waveE";
import { en as waveREn, he as waveRHe } from "./i18nElevation/waveR";

/**
 * GP-31 — "Firsts" keepsakes: a note and a date on every fresh milestone.
 *
 * Three things must hold:
 *  (1) a keepsake works with a note and a date ALONE — the photo is optional;
 *  (2) an uploaded photo is inside the subtree the child-erase already sweeps,
 *      and the device-local store is inside the sweep too. A stored child
 *      photo that survives deletion is the worst outcome this can produce;
 *  (3) the share caption is declared, never inherited — a growth_card with no
 *      captionKey publishes "{name}'s progress this month", which on ONE first
 *      on day 0 is a claim nobody made.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) => readFileSync(path.join(HERE, "..", rel), "utf8").replace(/\r\n/g, "\n");

const KID = "kid-keepsake-1";
const TODAY = "2026-09-04";

function memoryStore(): Storage {
  const map = new Map<string, string>();
  return {
    get length() { return map.size; },
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => map.get(k) ?? null,
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
    clear: () => map.clear(),
  } as Storage;
}

/* ── (1) the note and the date ARE the keepsake ───────────────────────────── */

describe("a keepsake is complete with just a note and a date", () => {
  it("validates with no photo at all", () => {
    expect(validateKeepsake({ milestoneId: "ms-1", note: "Three steps to me.", noticedOn: TODAY }, TODAY)).toBeNull();
  });

  it("saves, reads back and shares with no photo", () => {
    const local = memoryStore();
    const map = upsertKeepsake({}, { milestoneId: "ms-1", note: "Three steps to me.", noticedOn: "2026-09-01" }, "2026-09-04T09:00:00.000Z");
    writeKeepsakes(KID, map, local);
    const back = readKeepsakes(KID, local);
    expect(back["ms-1"].note).toBe("Three steps to me.");
    expect(back["ms-1"].noticedOn).toBe("2026-09-01");
    expect(back["ms-1"].photoUrl).toBeUndefined();
    expect(keepsakeCount(back)).toBe(1);
  });

  it("NEGATIVE CONTROL: a missing note or date is refused, with a real reason", () => {
    expect(validateKeepsake({ milestoneId: "ms-1", note: "   ", noticedOn: TODAY }, TODAY)).toBe("note");
    expect(validateKeepsake({ milestoneId: "ms-1", note: "x", noticedOn: "" }, TODAY)).toBe("date");
    expect(validateKeepsake({ milestoneId: "ms-1", note: "x", noticedOn: "not-a-date" }, TODAY)).toBe("date");
    expect(validateKeepsake({ milestoneId: "ms-1", note: "x", noticedOn: "2026-13-45" }, TODAY)).toBe("date");
    // A first that has not happened yet is not a record of anything.
    expect(validateKeepsake({ milestoneId: "ms-1", note: "x", noticedOn: "2026-09-05" }, TODAY)).toBe("future");
    // …and every refusal has copy in BOTH languages.
    for (const key of Object.values(KEEPSAKE_ERROR_KEYS)) {
      expect(waveREn[key], key).toBeTruthy();
      expect(waveRHe[key], key).toBeTruthy();
      expect(waveRHe[key]).not.toBe(waveREn[key]);
    }
  });

  it("an edit keeps the day the parent FIRST kept it, and clamps the note", () => {
    const first = upsertKeepsake({}, { milestoneId: "ms-1", note: "a", noticedOn: TODAY }, "2026-09-01T00:00:00.000Z");
    const edited = upsertKeepsake(first, { milestoneId: "ms-1", note: "b".repeat(KEEPSAKE_NOTE_MAX + 50), noticedOn: TODAY }, "2026-09-04T00:00:00.000Z");
    expect(edited["ms-1"].createdAt).toBe("2026-09-01T00:00:00.000Z");
    expect(edited["ms-1"].updatedAt).toBe("2026-09-04T00:00:00.000Z");
    expect(edited["ms-1"].note.length).toBe(KEEPSAKE_NOTE_MAX);
    // Pure: the input map is untouched.
    expect(first["ms-1"].note).toBe("a");
  });

  it("removal drops one keepsake and leaves the others", () => {
    let map: KeepsakeMap = upsertKeepsake({}, { milestoneId: "ms-1", note: "a", noticedOn: TODAY }, "t");
    map = upsertKeepsake(map, { milestoneId: "ms-2", note: "b", noticedOn: TODAY }, "t");
    const after = removeKeepsake(map, "ms-1");
    expect(Object.keys(after)).toEqual(["ms-2"]);
    expect(removeKeepsake(after, "nope")).toBe(after);
  });

  it("the day key is LOCAL, never a UTC shift", () => {
    // Probe the edge of the local day where a UTC read would roll over: late
    // evening west of UTC, early morning east of it. Whichever side this
    // machine sits on, the keepsake must carry the day the PARENT was living.
    const offsetMinutes = new Date(2026, 8, 4).getTimezoneOffset();
    const probe = offsetMinutes > 0 ? new Date(2026, 8, 4, 23, 30, 0) : new Date(2026, 8, 4, 0, 30, 0);
    expect(localDayKey(probe)).toBe("2026-09-04");
    // NEGATIVE CONTROL: on any machine that is not on UTC, the naive
    // toISOString() shortcut — the bug this helper exists to avoid — really
    // does produce a different day for that same instant.
    if (offsetMinutes !== 0) {
      expect(probe.toISOString().slice(0, 10)).not.toBe("2026-09-04");
    }
  });

  it("survives a corrupt store without throwing", () => {
    expect(parseKeepsakes(null)).toEqual({});
    expect(parseKeepsakes("[]")).toEqual({});
    expect(parseKeepsakes("{oops")).toEqual({});
    // A row whose key does not match its own milestoneId is dropped, not
    // rendered under the wrong milestone.
    expect(parseKeepsakes('{"ms-1":{"milestoneId":"ms-2","note":"x","noticedOn":"2026-09-01"}}')).toEqual({});
    expect(readKeepsakes(KID, null)).toEqual({});
  });
});

/* ── the count cannot fall when the child ages into a new band ────────────── */

describe("CLINICAL FIREWALL — the keepsake count is the parent's own keeping", () => {
  it("takes no age, band or milestone-catalogue input at all", () => {
    const raw = read("lib/firstsKeepsake.ts");
    // Comments explain the rule (and say the word "scored"), so scan CODE only
    // — prose about a ban must never satisfy or trip the ban.
    const code = raw.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    expect(raw.length).toBeGreaterThan(2000);
    expect(code.length).toBeGreaterThan(1500);
    // The count is Object.keys of what the parent wrote. No band, age or
    // window term reaches the code, so ageing into a new band literally cannot
    // move it — the mechanism the band-window counts elsewhere are exposed to.
    for (const banned of ["ageWindow", "bandFor", "comparisonAgeMonths", "ageMonths", "percent", "score"]) {
      expect(code, `firstsKeepsake must not read ${banned}`).not.toContain(banned);
    }
    // NEGATIVE CONTROL: the stripper did not simply erase everything.
    expect(code).toContain("export function keepsakeCount");
    expect(code).toContain("Object.keys(map).length");
  });

  it("adding a keepsake only ever raises the count", () => {
    let map: KeepsakeMap = {};
    const counts = [keepsakeCount(map)];
    for (const id of ["ms-1", "ms-2", "ms-3"]) {
      map = upsertKeepsake(map, { milestoneId: id, note: "n", noticedOn: TODAY }, "t");
      counts.push(keepsakeCount(map));
    }
    expect(counts).toEqual([0, 1, 2, 3]);
    // NEGATIVE CONTROL: re-keeping the same first does not inflate it either.
    map = upsertKeepsake(map, { milestoneId: "ms-1", note: "edited", noticedOn: TODAY }, "t");
    expect(keepsakeCount(map)).toBe(3);
  });
});

/* ── (2) swept with the child ─────────────────────────────────────────────── */

describe("the device-local store is swept when the child is deleted", () => {
  it("mints the sweepable convention", () => {
    expect(firstsKeepsakeKey(KID)).toBe(`arbor.${FIRSTS_KEEPSAKE_NAMESPACE}.${KID}`);
    expect(isChildScopedKey(firstsKeepsakeKey(KID), KID)).toBe(true);
  });

  it("clearChildLocalState removes it, and leaves a sibling's alone", () => {
    const local = memoryStore();
    writeKeepsakes(KID, upsertKeepsake({}, { milestoneId: "ms-1", note: "a", noticedOn: TODAY }, "t"), local);
    writeKeepsakes(`${KID}-2`, upsertKeepsake({}, { milestoneId: "ms-1", note: "b", noticedOn: TODAY }, "t"), local);
    clearChildLocalState(KID, { local, session: null });
    expect(local.getItem(firstsKeepsakeKey(KID))).toBeNull();
    expect(local.getItem(firstsKeepsakeKey(`${KID}-2`))).toBeTruthy();
  });

  it("NEGATIVE CONTROL: the un-sweepable shape this convention avoids", () => {
    expect(isChildScopedKey(`arbor.firstsKeepsakes${KID}`, KID)).toBe(false);
    expect(isChildScopedKey(`firstsKeepsakes.${KID}`, KID)).toBe(false);
  });
});

describe("an uploaded photo lives inside the subtree child deletion already sweeps", () => {
  const UID = "uid-sentinel";
  const CHILD = "child-sentinel";

  /** Harvest `users/...` template literals and make them concrete. */
  const paths = (src: string): string[] =>
    [...src.matchAll(/`users\/[^`]*`/g)].map((m) =>
      m[0].slice(1, -1).replace(/\$\{([^}]*)\}/g, (_, expr: string) => {
        if (/uid/i.test(expr)) return UID;
        if (/child/i.test(expr)) return CHILD;
        return "x";
      }),
    );

  const storageSrc = read("lib/storage.ts");
  const childEraseSrc = read("routes/api.ts");
  const accountEraseSrc = read("server/accountDeletion.ts");

  it("the scanned sources are real", () => {
    expect(storageSrc.length).toBeGreaterThan(200);
    expect(childEraseSrc.length).toBeGreaterThan(50_000);
    expect(accountEraseSrc.length).toBeGreaterThan(2000);
    expect(storageSrc).toContain("uploadChildPhoto");
    expect(childEraseSrc).toContain("/privacy/erase");
    expect(accountEraseSrc).toContain("deleteFiles");
  });

  it("uploadChildPhoto writes under users/<uid>/children/<childId>/", () => {
    const uploadPaths = paths(storageSrc);
    expect(uploadPaths.length).toBeGreaterThan(0);
    for (const p of uploadPaths) {
      expect(p, `lib/storage.ts writes "${p}"`).toContain(`users/${UID}/children/${CHILD}/`);
    }
  });

  it("the child-erase prefix in routes/api.ts CONTAINS that path", () => {
    const prefix = paths(childEraseSrc).find((p) => p === `users/${UID}/children/${CHILD}/`);
    expect(prefix, "routes/api.ts no longer deletes the per-child Storage prefix").toBeTruthy();
    for (const p of paths(storageSrc)) {
      expect(p.startsWith(prefix!), `"${p}" is OUTSIDE the swept prefix "${prefix}"`).toBe(true);
    }
  });

  it("the account-delete prefix in server/accountDeletion.ts contains it too", () => {
    const prefix = paths(accountEraseSrc).find((p) => p === `users/${UID}/`);
    expect(prefix, "accountDeletion.ts no longer deletes the user Storage prefix").toBeTruthy();
    for (const p of paths(storageSrc)) {
      expect(p.startsWith(prefix!)).toBe(true);
    }
  });

  it("NEGATIVE CONTROL: a photo written outside the prefix would FAIL this test", () => {
    // The exact shape a future author produces by inventing their own path —
    // e.g. a per-feature bucket folder rather than the per-child one.
    const rogue = `keepsakes/${CHILD}/${Date.now()}.jpg`;
    expect(rogue.startsWith(`users/${UID}/children/${CHILD}/`)).toBe(false);
    expect(rogue.startsWith(`users/${UID}/`)).toBe(false);
  });
});

/* ── (3) the share caption is declared, never inherited ───────────────────── */

describe("a shared first never claims a month of progress", () => {
  it("the keepsake declares the honest caption", () => {
    expect(FIRSTS_KEEPSAKE_CAPTION_KEY).toBe("elev.share.caption.firsts");
    expect(waveEEn[FIRSTS_KEEPSAKE_CAPTION_KEY]).toBeTruthy();
    expect(waveEHe[FIRSTS_KEEPSAKE_CAPTION_KEY]).toBeTruthy();
    expect(waveEEn[FIRSTS_KEEPSAKE_CAPTION_KEY]).not.toMatch(/month|progress/i);
  });

  it("NEGATIVE CONTROL: the same share WITHOUT the key resolves to the month claim", () => {
    // This is the defect, reconstructed. It must still be reachable — that is
    // what makes declaring the key load-bearing rather than decorative.
    const inherited = resolveCaptionKey({ artifact: "growth_card", surface: "firsts_keepsake" });
    expect(inherited).toBe("share.caption.growth");
    // …and the string it would have published.
    expect(waveEEn["elev.share.caption.month"]).toBeTruthy();
    // With the key declared, the honest caption wins.
    expect(
      resolveCaptionKey({ artifact: "growth_card", surface: "firsts_keepsake", captionKey: FIRSTS_KEEPSAKE_CAPTION_KEY }),
    ).toBe(FIRSTS_KEEPSAKE_CAPTION_KEY);
  });
});
