import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as waveREn, he as waveRHe } from "../../lib/i18nElevation/waveR";
import {
  firstsKeepsakeKey, keepsakeMapFromDocs, localKeepsakesToMigrate, migrateLocalKeepsakes,
  upsertKeepsake, writeKeepsakes, type KeepsakeDoc, type KeepsakeMap,
} from "../../lib/firstsKeepsake";
import { buildTimeline } from "../../lib/signalTimeline";
import type { Milestone } from "../../types";

/**
 * GP-31 — the keepsake is BUILT and WIRED, and its photo cannot escape the
 * child's own Storage prefix.
 *
 * Source-based structural guards (node-only vitest env), house pattern. Every
 * scanned file is asserted real first, and every rule carries a negative
 * control reconstructing the shape the defect produces.
 */

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.join(HERE, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8").replace(/\r\n/g, "\n");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");

const sheetRaw = read("components/milestones/FirstKeepsakeSheet.tsx");
/**
 * `accept="image/*"` contains a literal `/*`, which a naive comment stripper
 * reads as the START of a block comment — it then swallows everything up to
 * the next `*​/` (in this file: the Save button). That is exactly the class of
 * vacuous scan this repo has been bitten by, so the attribute is neutralised
 * BEFORE stripping, and its presence is asserted below so the workaround can
 * never quietly outlive the attribute it exists for.
 */
const sheet = stripComments(sheetRaw.replace(/accept="image\/\*"/g, 'accept="image"'));
const tab = stripComments(read("components/tabs/MilestonesTab.tsx"));
const keptRow = stripComments(read("components/milestones/MilestoneKeptNote.tsx"));

describe("the scan is real", () => {
  it("read actual files", () => {
    expect(sheet.length).toBeGreaterThan(2000);
    expect(tab.length).toBeGreaterThan(10_000);
  });

  it("the comment stripper did not swallow the component (the image/* trap)", () => {
    // The neutralised attribute is still really there…
    expect(sheetRaw).toContain('accept="image/*"');
    // …and the code AFTER it survived the strip. Without the workaround above
    // everything from that attribute to the next comment vanishes, and every
    // assertion below it passes vacuously.
    expect(sheet).toContain("export default function FirstKeepsakeSheet");
    expect(sheet).toContain("<ShareButton");
    expect(sheet).toContain("Boolean(problem)");
  });
});

describe("the keepsake is reachable from the milestone the parent just marked", () => {
  it("MilestonesTab offers it, and mounts the editor", () => {
    expect(tab).toContain('import FirstKeepsakeSheet from "../milestones/FirstKeepsakeSheet"');
    expect(tab).toContain("<FirstKeepsakeSheet");
    expect(tab).toContain('data-testid="ms-keepsake-add"');
    expect(tab).toContain("<MilestoneKeptNote");
    expect(keptRow).toContain('data-testid="ms-keepsake"');
  });

  it("the offer appears on a MARKED milestone — a keepsake belongs to a first that happened", () => {
    // Existing notes remain editable after an answer is corrected. The add
    // offer is the no-note branch, so a new note still requires checked.
    const offer = tab.slice(tab.indexOf('{(item.checked || keepsakes[item.id]) && ('), tab.indexOf('{item.custom && renamingId'));
    expect(offer).toContain('{keepsakes[item.id] ? (');
    expect(offer).toContain('{renderKeepsake(item)}');
    expect(offer).toMatch(/\) : \(\s*<button[\s\S]*data-testid="ms-keepsake-add"/);
    const requiresSeenOrSaved = (code: string) => /\{\(item\.checked \|\| keepsakes\[item\.id\]\) && \(/.test(code);
    expect(requiresSeenOrSaved(offer)).toBe(true);
    expect(requiresSeenOrSaved(offer.replace('(item.checked || keepsakes[item.id])', 'true'))).toBe(false);
  });

  it("save and remove go through the pure helpers and this child's registered subcollection (B-GROWTH-10)", () => {
    expect(tab).toContain('useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes")');
    expect(tab).toContain("upsertKeepsake(keepsakes, draft");
    expect(tab).toContain("keepsakeCol.upsert(keepsakeDoc(next[draft.milestoneId]))");
    expect(tab).toContain("keepsakeCol.remove(milestoneId)");
    expect(tab).toContain("migrateLocalKeepsakes(childProfile.id, keepsakes, keepsakeCol.upsert)");
    // NEGATIVE CONTROL: the device-local persistence is gone from the surface.
    expect(tab).not.toContain("writeKeepsakes(");
    expect(tab).not.toContain("readKeepsakes(");
  });

  it("the milestone record itself is never rewritten by a keepsake", () => {
    const save = /const saveKeepsake = [\s\S]*?;\n/.exec(tab)?.[0] ?? "";
    expect(save).toBeTruthy();
    for (const banned of ["setMilestoneObservation", "updateMilestoneTitle", "milestonesCol"]) {
      expect(save, `saving a keepsake must not call ${banned}`).not.toContain(banned);
    }
  });
});

describe("the photo is optional", () => {
  it("Save is gated on the validator, which never looks at the photo", () => {
    expect(sheet).toContain("const problem = validateKeepsake(draft, today)");
    expect(sheet).toMatch(/disabled=\{Boolean\(problem\)\}/);
    // NEGATIVE CONTROL: the shape that would make a photo mandatory.
    expect(sheet).not.toMatch(/disabled=\{[^}]*!photoUrl/);
    expect(sheet).not.toMatch(/if \(!photoUrl\) return;/);
  });

  it("the photo block is its own optional section, with honest copy", () => {
    expect(sheet).toContain('t("elev.waveR.keepsake.photoLabel")');
    expect(waveREn["elev.waveR.keepsake.intro"]).toMatch(/optional/i);
    expect(waveRHe["elev.waveR.keepsake.intro"]).toContain("רשות");
  });
});

describe("an uploaded photo is inside the subtree child deletion sweeps", () => {
  it("uploadChildPhoto is the ONLY upload route, and it is scoped to this child", () => {
    expect(sheet).toContain('import { uploadChildPhoto } from "../../lib/storage"');
    expect(sheet).toMatch(/uploadChildPhoto\(user\.uid, childId, thumb\)/);
    // No second pipe to storage: a bespoke ref()/uploadString()/uploadBytes()
    // would let a child's photo land outside users/{uid}/children/{childId}/,
    // which both erase paths delete by PREFIX. lib/firstsKeepsake.test.ts
    // proves that prefix containment against the real source of all three.
    for (const banned of ["uploadString(", "uploadBytes(", "getDownloadURL(", 'from "firebase/storage"']) {
      expect(sheet, `the keepsake sheet must not use ${banned}`).not.toContain(banned);
    }
  });

  it("no photo is ever inlined into the device-local keepsake instead", () => {
    // A data: URL in the local store would put an image of a child in a place
    // the server erase cannot reach — worse than not offering a photo at all.
    // The upload throws when Storage is unavailable and the catch adds nothing.
    expect(sheet).toContain('throw new Error("no-remote-storage")');
    const pick = /const pickPhoto = async[\s\S]*?\n  };/.exec(sheet)?.[0] ?? "";
    expect(pick).toBeTruthy();
    const catchBlock = /\} catch \{([\s\S]*?)\} finally/.exec(pick)?.[1] ?? "";
    expect(catchBlock).toBeTruthy();
    expect(catchBlock).not.toContain("setPhotoUrl");
    // NEGATIVE CONTROL: the fallback BehaviorsTab uses for a log photo —
    // correct there (a log photo is not durable child media in this store),
    // and exactly what must not appear here.
    const fallback = "} catch { setPhotoUrl(thumb); }";
    expect(sheet).not.toContain(fallback);
  });
});

describe("the share caption is declared, never inherited", () => {
  it("the mount passes the honest key", () => {
    const mount = /<ShareButton[\s\S]{0,800}?\/>/.exec(sheet)?.[0] ?? "";
    expect(mount).toBeTruthy();
    expect(mount).toContain('artifact="growth_card"');
    expect(mount).toContain("captionKey={FIRSTS_KEEPSAKE_CAPTION_KEY}");
    // NEGATIVE CONTROL: without a captionKey this exact mount publishes
    // "{name}'s progress this month" off one first — the ENG-16 defect, which
    // lib/shareCaption.test.ts also scans the whole component tree for.
    expect(/captionKey=/.test('<ShareButton artifact="growth_card" surface="firsts_keepsake" />')).toBe(false);
  });

  it("the shared card carries the milestone and the parent's words only", () => {
    const opts = /getCardOpts=\{\(\): ShareCardOpts => \(\{[^}]*\}\)\}/.exec(sheet)?.[0] ?? "";
    expect(opts).toBeTruthy();
    expect(opts).toContain("headline: milestoneTitle");
    expect(opts).toContain("sub: keepsake.note");
    // A photo of the child, the date maths, and anything Arbor derived stay
    // off a card that leaves the device.
    expect(opts).not.toMatch(/photo|noticedOn|domain|age|count/);
  });

  it("sharing requires an eligible saved note and forwards the shared freshness guard", () => {
    expect(sheet).toMatch(/\{keepsake && canShare && \(\s*<ShareButton/);
    expect(sheet).toContain('beforeShare={beforeShare}');
    expect(tab).toContain('canShare={Boolean(openKeepsake && keptNotes.rows.has(openKeepsake.id)) && !keptNotes.disabled}');
    expect(tab).toContain('beforeShare={keptNotes.beforeExport}');
  });
});

describe("no inline copy — every string is an i18n key", () => {
  it("the sheet renders through t() and carries no Hebrew literal", () => {
    expect(sheet).toContain('t("elev.waveR.keepsake.');
    expect(/[֐-׿]/.test(sheet)).toBe(false);
  });

  it("every keepsake key exists in BOTH dictionaries and the HE is not the EN", () => {
    const keys = [...sheetRaw.matchAll(/t\("(elev\.waveR\.keepsake\.[\w.]+)"/g)].map((m) => m[1]);
    expect(keys.length).toBeGreaterThan(8);
    for (const key of new Set(keys)) {
      expect(waveREn[key], `${key} missing from EN`).toBeTruthy();
      expect(waveRHe[key], `${key} missing from HE`).toBeTruthy();
      expect(waveRHe[key], `${key} was not translated`).not.toBe(waveREn[key]);
    }
  });
});

/* ── B-GROWTH-10 — keepsakes live in a registered child subcollection ────── */

const memStore = () => {
  const map = new Map<string, string>();
  const reads: string[] = [];
  const s = {
    get length() { return map.size; },
    clear: () => map.clear(),
    key: (i: number) => [...map.keys()][i] ?? null,
    getItem: (k: string) => { reads.push(k); return map.get(k) ?? null; },
    setItem: (k: string, v: string) => { map.set(k, String(v)); },
    removeItem: (k: string) => { map.delete(k); },
  } as Storage;
  return { s, map, reads };
};

const KID = "kid-1";
const DAY = "2026-09-20";
const keep = (milestoneId: string, note: string, updatedAt: string): KeepsakeMap =>
  upsertKeepsake({}, { milestoneId, note, noticedOn: DAY }, updatedAt);

describe("B-GROWTH-10 — one-time migration of the device-local map", () => {
  it("reads the local map once, writes every keepsake the subcollection lacks, then clears the key", async () => {
    const { s, map, reads } = memStore();
    writeKeepsakes(KID, { ...keep("ms-1", "three steps to me", "t1"), ...keep("ms-2", "first word: dog", "t1") }, s);
    const written: KeepsakeDoc[] = [];
    const n = await migrateLocalKeepsakes(KID, {}, async (d) => { written.push(d); }, s);
    expect(n).toBe(2);
    expect(written.map((d) => d.id).sort()).toEqual(["ms-1", "ms-2"]);
    expect(written.every((d) => d.id === d.milestoneId)).toBe(true);
    expect(map.has(firstsKeepsakeKey(KID))).toBe(false);
    expect(reads.filter((k) => k === firstsKeepsakeKey(KID))).toHaveLength(1);
    // a second load finds nothing to migrate and writes nothing
    const again: KeepsakeDoc[] = [];
    expect(await migrateLocalKeepsakes(KID, {}, async (d) => { again.push(d); }, s)).toBe(0);
    expect(again).toEqual([]);
  });

  it("a NEWER remote copy (written on another device) wins; an older one is replaced", () => {
    const local = { ...keep("ms-1", "local old", "2026-09-01T00:00:00Z"), ...keep("ms-2", "local new", "2026-09-10T00:00:00Z") };
    const remote = { ...keep("ms-1", "remote newer", "2026-09-05T00:00:00Z"), ...keep("ms-2", "remote older", "2026-09-02T00:00:00Z") };
    expect(localKeepsakesToMigrate(local, remote).map((k) => k.note)).toEqual(["local new"]);
  });

  it("a failed write keeps the local key so the next load retries — no note is dropped", async () => {
    const { s, map } = memStore();
    writeKeepsakes(KID, keep("ms-1", "kept", "t1"), s);
    await expect(migrateLocalKeepsakes(KID, {}, async () => { throw new Error("offline"); }, s)).rejects.toThrow("offline");
    expect(map.has(firstsKeepsakeKey(KID))).toBe(true);
  });

  it("the subcollection's docs read back as the map the UI renders; invalid docs drop", () => {
    const doc: KeepsakeDoc = { id: "ms-1", ...keep("ms-1", "note", "t1")["ms-1"] };
    const back = keepsakeMapFromDocs([doc, { id: "x", note: "" }, null]);
    expect(Object.keys(back)).toEqual(["ms-1"]);
    expect(back["ms-1"].note).toBe("note");
    expect("id" in back["ms-1"]).toBe(false);
  });

  it("the migration runs once per child, never in the stale commit right after a child switch", () => {
    const eff = /const keepsakeChildSeen = useRef[\s\S]*?\}, \[childProfile\.id, keepsakeCol\.loaded/.exec(tab)?.[0] ?? "";
    expect(eff).toContain("if (switched || !keepsakeCol.loaded || keepsakeMigratedFor.current === childProfile.id) return;");
    expect(eff).toContain("keepsakeMigratedFor.current = null;");
  });
});

describe("B-GROWTH-10 — registered, exported, erased, and on the timeline", () => {
  it("keepsakes is a registered CHILD_SUBCOLLECTION (export + both erase paths)", async () => {
    const { CHILD_SUBCOLLECTIONS } = await import("../../lib/childData");
    expect(CHILD_SUBCOLLECTIONS).toContain("keepsakes");
    // the timeline reader uses the same literal sink name the guard scans for
    expect(read("hooks/useTimeline.ts")).toContain('useChildCollection<KeepsakeDoc>(childId, "keepsakes")');
  });

  it("the timeline shows the noticed milestone with the parent's note", () => {
    const m = { id: "ms-1", domain: "language_communication", ageGroup: "12 months", title: "Says a first word", description: "catalogue text", checked: true, observationUpdatedAt: "2026-09-20T09:00:00Z" } as Milestone;
    const k = keep("ms-1", "She said dog at the window", "t1")["ms-1"];
    const withNote = buildTimeline({ milestones: [m], keepsakes: [{ ...k, photoUrl: "https://x/p.jpg" }] }).find((s) => s.id === "milestone-ms-1");
    expect(withNote?.kind).toBe("milestone");
    expect(withNote?.detail).toBe("She said dog at the window");
    expect(withNote?.photo).toBe("https://x/p.jpg");
    // NEGATIVE CONTROL: without the keepsake source the row carries the catalogue text
    expect(buildTimeline({ milestones: [m] }).find((s) => s.id === "milestone-ms-1")?.detail).toBe("catalogue text");
    // one row per first — the keepsake never adds a second
    expect(buildTimeline({ milestones: [m], keepsakes: [k] }).filter((s) => s.kind === "milestone")).toHaveLength(1);
  });
});
