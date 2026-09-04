import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { en as waveREn, he as waveRHe } from "../../lib/i18nElevation/waveR";

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
    expect(tab).toContain('data-testid="ms-keepsake"');
  });

  it("the offer appears on a MARKED milestone — a keepsake belongs to a first that happened", () => {
    expect(tab).toMatch(/\{item\.checked && \(\s*<div className="pt-2">/);
  });

  it("save and remove go through the pure helpers and this child's own store", () => {
    expect(tab).toContain("upsertKeepsake(keepsakes, draft");
    expect(tab).toContain("removeKeepsake(keepsakes, milestoneId)");
    expect(tab).toContain("writeKeepsakes(childProfile.id, next)");
    expect(tab).toContain("readKeepsakes(childProfile.id)");
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

  it("sharing is offered only once a keepsake exists", () => {
    expect(sheet).toMatch(/\{keepsake && \(\s*<ShareButton/);
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
