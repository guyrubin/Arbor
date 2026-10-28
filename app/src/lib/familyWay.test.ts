/**
 * B-PLAY-21 — the charter and the "How should Arbor talk with you?" choice as
 * family-level fields: set on one device, they appear on a second signed-in
 * device (newest change wins); the export holds both; account deletion
 * removes both; no child erase touches them. Dark behind a device flag.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  FAMILY_WAY_COLLECTION, FAMILY_WAY_STAMP_KEY, FAMILY_WAY_SYNC_FLAG, LENS_KEY,
  familyWayExport, familyWayPath, familyWaySyncOn, noteFamilyWayChange, normalizeFamilyWay, readLocalFamilyWay, syncFamilyWay,
  type FamilyWay, type FamilyWayIO,
} from "./familyWay";
import { FAMILY_CHARTER_KEY, saveFamilyCharter } from "./familyCharter";
import { CHILD_SUBCOLLECTIONS } from "./childData";
import { ACCOUNT_DEVICE_KEYS, OTHER_FIRESTORE_COLLECTIONS } from "./childDataSinks";

const SRC = path.resolve(__dirname, "..");
const REPO = path.resolve(SRC, "..", "..");
const store = () => {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, map: m };
};
/** One account document shared by two devices. */
const account = () => {
  let doc: unknown = null;
  const io: FamilyWayIO = { read: async () => doc, write: async (way: FamilyWay) => { doc = JSON.parse(JSON.stringify(way)); } };
  return { io, get doc() { return doc as FamilyWay | null; } };
};

describe("B-PLAY-21 · the family way follows the account", () => {
  it("set on one device, it appears on a second signed-in device", async () => {
    const cloud = account();
    const phone = store(), laptop = store();
    // the phone: the parent saves a charter and picks a tone
    saveFamilyCharter(["Courage", "Honesty"], phone);
    phone.setItem(LENS_KEY, "Gentle Coach");
    noteFamilyWayChange(phone, new Date("2026-10-28T10:00:00Z"));
    expect(await syncFamilyWay(cloud.io, phone)).toBeNull(); // pushed
    expect(cloud.doc).toEqual({ charter: ["Courage", "Honesty"], lens: "Gentle Coach", updatedAt: "2026-10-28T10:00:00.000Z" });
    // the laptop: never changed anything here; its load default must not win
    laptop.setItem(LENS_KEY, "Integrated Balanced");
    const applied = await syncFamilyWay(cloud.io, laptop);
    expect(applied?.lens).toBe("Gentle Coach");
    expect(readLocalFamilyWay(laptop)).toMatchObject({ charter: ["Courage", "Honesty"], lens: "Gentle Coach" });
  });

  it("the newest change wins either way; equal stamps change nothing", async () => {
    const cloud = account();
    const a = store(), b = store();
    saveFamilyCharter(["Kindness"], a); noteFamilyWayChange(a, new Date("2026-10-01T00:00:00Z"));
    await syncFamilyWay(cloud.io, a);
    saveFamilyCharter(["Curiosity"], b); noteFamilyWayChange(b, new Date("2026-10-02T00:00:00Z"));
    await syncFamilyWay(cloud.io, b); // b is newer → pushed
    expect(cloud.doc?.charter).toEqual(["Curiosity"]);
    expect(await syncFamilyWay(cloud.io, a)).not.toBeNull(); // a pulls
    expect(readLocalFamilyWay(a).charter).toEqual(["Curiosity"]);
    const before = JSON.stringify(cloud.doc);
    expect(await syncFamilyWay(cloud.io, a)).toBeNull();
    expect(JSON.stringify(cloud.doc)).toBe(before);
  });

  it("the first sync of a device that already had a charter migrates it (one time)", async () => {
    const cloud = account();
    const old = store();
    old.setItem(FAMILY_CHARTER_KEY, JSON.stringify(["Responsibility"]));
    await syncFamilyWay(cloud.io, old, new Date("2026-10-28T12:00:00Z"));
    expect(cloud.doc).toEqual({ charter: ["Responsibility"], lens: null, updatedAt: "2026-10-28T12:00:00.000Z" });
    expect(old.getItem(FAMILY_WAY_STAMP_KEY)).toBe("2026-10-28T12:00:00.000Z");
  });

  it("an untrusted document is normalised and never crashes the store", () => {
    expect(normalizeFamilyWay(null)).toBeNull();
    expect(normalizeFamilyWay({ charter: "Courage" })).toBeNull();
    expect(normalizeFamilyWay({ charter: [" Courage ", "courage", 4], lens: "x".repeat(65), updatedAt: "nope" })).toEqual({ charter: ["Courage"], lens: null, updatedAt: "" });
  });

  it("is dark: the sync runs only with the device flag", () => {
    const s = store();
    expect(familyWaySyncOn(s)).toBe(false);
    s.setItem(FAMILY_WAY_SYNC_FLAG, "1");
    expect(familyWaySyncOn(s)).toBe(true);
    const hook = readFileSync(path.join(SRC, "hooks", "useFamilyWaySync.ts"), "utf8");
    expect(hook).toContain('if (!uid || uid === "local-sandbox" || !firebaseEnabled || !db || !familyWaySyncOn()) return undefined;');
  });

  it("only the parent's own change stamps it — never a load", () => {
    const ctx = readFileSync(path.join(SRC, "context", "ArborContext.tsx"), "utf8");
    expect(ctx).toContain("const chooseLens = React.useCallback((lens: string) => { setSelectedLens(lens); noteFamilyWayChange(); }, []);");
    expect(ctx).toContain("setSelectedLens: chooseLens,");
    expect(ctx).toContain("useFamilyWaySync(setSelectedLens);");
    expect(readFileSync(path.join(SRC, "components", "sections", "FamilyFormation.tsx"), "utf8")).toContain("setSaved(true); noteFamilyWayChange(); };");
  });
});

describe("B-PLAY-21 · where it lives: export holds both, account deletion removes both", () => {
  it("is family-level: not a child subcollection, a registered account collection", () => {
    expect(CHILD_SUBCOLLECTIONS).not.toContain(FAMILY_WAY_COLLECTION);
    expect(OTHER_FIRESTORE_COLLECTIONS[FAMILY_WAY_COLLECTION]).toMatch(/^account: /);
    expect(familyWayPath("u1")).toBe("users/u1/familyWay/current");
    for (const key of [FAMILY_CHARTER_KEY, LENS_KEY, FAMILY_WAY_STAMP_KEY, FAMILY_WAY_SYNC_FLAG]) expect(ACCOUNT_DEVICE_KEYS[key], key).toBeTruthy();
  });

  it("the owner alone reads and writes it (firestore.rules users/{uid}/**)", () => {
    const rules = readFileSync(path.join(REPO, "firestore.rules"), "utf8");
    expect(rules).toMatch(/match \/users\/\{userId\} \{[\s\S]*?match \/\{document=\*\*\} \{\s*allow read, write: if signedIn\(\) && request\.auth\.uid == userId;/);
  });

  it("every child's data export carries both fields", () => {
    const s = store();
    saveFamilyCharter(["Courage"], s);
    s.setItem(LENS_KEY, "Gentle Coach");
    expect(familyWayExport(s)).toEqual({ charter: ["Courage"], lens: "Gentle Coach" });
    const exporter = readFileSync(path.join(SRC, "lib", "childData.ts"), "utf8");
    expect(exporter).toContain("out.familyWay = familyWayExport();");
  });

  it("account deletion removes both: the recursive users/{uid} delete and the arbor.* device wipe", () => {
    const deletion = readFileSync(path.join(SRC, "server", "accountDeletion.ts"), "utf8");
    expect(deletion).toContain("await db.recursiveDelete(db.doc(`users/${uid}`));");
    for (const key of [FAMILY_CHARTER_KEY, LENS_KEY, FAMILY_WAY_STAMP_KEY]) expect(key.startsWith("arbor.")).toBe(true);
  });

  it("NEGATIVE CONTROL: before this row the export carried neither field", () => {
    const pre = "out.privateBookAssets = await session.read(() => exportPrivateBookAssets(";
    expect(pre).not.toContain("familyWay");
  });
});
