/**
 * B-BOOK-69 — current-family integration: the parent's book line against the
 * REAL device builder (buildBookSheet.startBookSheet and its one-build-per-
 * child registry), not a mocked "running" flag. A family whose book shows an
 * earlier hero changes the hero:
 *   previous → (a build starts) replacing → (the build stops, nothing commits)
 *   previous again, the earlier book untouched → (a build commits) the review
 *   row of the new hero.
 * A second synthetic family on the same device is never told about the first
 * family's build. Synthetic data only; react-dom/server.
 */
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { BookAssetsDoc } from "../../lib/library/bookAssetPaths";
import type { BookBuilderDeps, CommitProbe } from "../kidmode/hero/buildBookSheet";

const env = vi.hoisted(() => ({ items: {} as Record<string, unknown[]> }));
vi.mock("../../context/LanguageContext", () => ({ useLanguage: () => ({ t: (key: string) => key }) }));
vi.mock("../../hooks/useChildCollection", () => ({
  useChildCollection: (childId: string) => ({ items: env.items[childId] ?? [], loaded: true, remote: true, confirmed: true, error: false }),
}));
vi.mock("../../lib/bookAssetStore", () => ({ fetchBookAsset: vi.fn(async () => null) }));
import BookSheetStrip from "./BookSheetStrip";
import { bookSheetRunning, startBookSheet, DEFAULT_SHEET_BOOK } from "../kidmode/hero/buildBookSheet";
import { bookSheetId } from "../../lib/library/bookSheet";

const OLD = "1111111111111111", NEW = "2222222222222222";
const family = { id: "synthetic-current-child", name: "Noa", gender: "girl" as const };
const otherFamily = { id: "synthetic-second-child", name: "Ari", gender: "boy" as const };
const bookDoc = (hash: string): BookAssetsDoc => ({
  id: DEFAULT_SHEET_BOOK, bookId: DEFAULT_SHEET_BOOK, sheetId: bookSheetId(hash), setId: "none", sets: ["none"],
  sheetManifest: { poses: {} }, files: [], bytes: 0, createdAt: `2026-10-2${hash === OLD ? 0 : 8}T00:00:00Z`,
}) as unknown as BookAssetsDoc;
const lineOf = (child: { id: string; name: string; gender: "boy" | "girl" }) => {
  const m = renderToStaticMarkup(<BookSheetStrip child={child} avatarHash={NEW} />).match(/data-book-sheet="([a-z]+)"/);
  return m ? m[1] : null;
};

/** Deps whose probe waits for the test, then answers `answer`. */
function gatedDeps(answer: () => CommitProbe, commit?: BookAssetsDoc) {
  let release!: () => void;
  const gate = new Promise<void>((r) => { release = r; });
  const deps = {
    probe: async () => { await gate; return answer(); },
    commitSheet: async () => (commit ? { ok: true as const, doc: commit, local: false } : { ok: false as const, status: 500, code: "x" }),
    requestPose: vi.fn(), upload: vi.fn(), decode: vi.fn(), encodeSprite: vi.fn(),
    keepLocalDoc: vi.fn(async () => undefined), sleep: async () => undefined,
  } as unknown as BookBuilderDeps;
  return { deps, release };
}

beforeEach(() => { env.items = {}; });

describe("B-BOOK-69 integration: the old book stays until the new approved sheet commits", () => {
  it("previous → replacing → a stopped build leaves the earlier book and the line says so → the commit shows the new hero", async () => {
    const earlier = bookDoc(OLD);
    env.items[family.id] = [earlier];
    expect(lineOf(family)).toBe("previous");

    // A build that is refused (terminal) after it has started.
    const refused = gatedDeps(() => ({ ok: false, status: 400, code: "hero_pose_bad_request" }));
    const job = startBookSheet({ childId: family.id, avatarHash: NEW }, () => refused.deps);
    expect(bookSheetRunning(family.id, DEFAULT_SHEET_BOOK)).toBe(true);
    expect(lineOf(family)).toBe("replacing");
    // The other family on this device is never told about it.
    expect(lineOf(otherFamily)).toBe(null);
    refused.release();
    expect((await job).status).toBe("not-started");
    await Promise.resolve();
    expect(bookSheetRunning(family.id, DEFAULT_SHEET_BOOK)).toBe(false);
    expect(lineOf(family)).toBe("previous");
    expect(env.items[family.id]).toEqual([earlier]);

    // A build that commits: the record now holds the new hero's sheet.
    const committed = bookDoc(NEW);
    const ok = gatedDeps(() => ({ ok: true, complete: true, missing: [], have: [], committed: false, admin: false }), committed);
    const second = startBookSheet({ childId: family.id, avatarHash: NEW, poses: [] }, () => ok.deps);
    expect(lineOf(family)).toBe("replacing");
    ok.release();
    const result = await second;
    expect(result.status).toBe("complete");
    env.items[family.id] = [result.doc];
    expect(lineOf(family)).toBe("review");
  });

  it("an admin-uploaded (approved) book is never replaced: the build ends without a commit and the line keeps the earlier book", async () => {
    env.items[family.id] = [{ ...bookDoc(OLD), sheetId: "uploaded-approved-sheet" }];
    const commit = vi.fn();
    const admin = gatedDeps(() => ({ ok: true, complete: false, missing: [], have: [], committed: false, admin: true }));
    (admin.deps as unknown as { commitSheet: unknown }).commitSheet = commit;
    const job = startBookSheet({ childId: family.id, avatarHash: NEW }, () => admin.deps);
    admin.release();
    expect(await job).toMatchObject({ status: "not-started", stoppedBy: "book_sheet_admin" });
    expect(commit).not.toHaveBeenCalled();
    await Promise.resolve();
    expect(lineOf(family)).toBe("previous");
  });
});
