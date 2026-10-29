/**
 * B-BOOK-35 / B-BOOK-73 (CI half) — the kid shelf's narration file manifests:
 * every page file of every shelf book, per voice folder (EN, HE-m, HE-f), is
 * shipped with its hash or on the frozen missing list (shrink-only), and the
 * per-child (name-bearing) lists match the books. The read half — a full read
 * with the real files never calls /api/tts and finds every file it asks for —
 * is in components/library/allBooks.fullRead.zeroCall.test.tsx.
 */
import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import manifestJson from "../../content/narrationManifests.json";
import { KID_SHELF_STORIES } from "../heroJourneys";
import { LIBRARY_BOOKS } from "./books";
import { VOICE_FOLDERS, type VoiceFolder } from "./narrationFiles";
import { legacyStoryUnits, manifestFindings, missingCounts, shelfNarrationNeeds, type NarrationManifests } from "./narrationManifest";

const MANIFEST = manifestJson as unknown as NarrationManifests;
const AUDIO = path.resolve(__dirname, "..", "..", "..", "public", "audio", "books");
const hashOf = (bookId: string, set: string, folder: VoiceFolder, file: string) => {
  const p = path.join(AUDIO, bookId, set, folder, file);
  return existsSync(p) ? createHash("sha256").update(readFileSync(p)).digest("hex") : null;
};

/** Shared page files not rendered yet, per book (every folder), 29 Oct 2026: may only shrink. */
const MISSING_CEILING: Readonly<Record<string, number>> = {
  "five-smooth-stones": 0,
  "david-and-goliath": 6,
  "moses-and-pharaoh": 7,
  "noahs-ark": 6,
  "jonah-and-the-great-fish": 5,
  "joseph-and-his-brothers": 6,
  "jacob-wrestling-the-angel": 5,
};

describe("B-BOOK-35 / B-BOOK-73 · every shelf page has its file, or is on the frozen missing list", () => {
  const needs = shelfNarrationNeeds();

  it("the shelf is real: every released library book and every legacy shelf story, three voice folders each", () => {
    expect(needs.map((n) => n.bookId).sort()).toEqual([...Object.keys(LIBRARY_BOOKS), ...KID_SHELF_STORIES.map((s) => s.id)].sort());
    for (const n of needs) expect(Object.keys(n.folders).sort()).toEqual([...VOICE_FOLDERS].sort());
    for (const s of KID_SHELF_STORIES) expect(legacyStoryUnits(s)).toEqual(expect.arrayContaining(["title", "question", "the-end"]));
  });

  it("no finding: shipped files carry the manifest's hash; nothing unlisted; the per-child lists match", () => {
    expect(manifestFindings(MANIFEST, needs, hashOf)).toEqual([]);
  });

  it("the missing lists only shrink (per book, every folder)", () => {
    const counts = missingCounts(MANIFEST);
    for (const [id, folders] of Object.entries(counts)) {
      for (const folder of VOICE_FOLDERS) expect(folders[folder].missing, `${id}/${folder}`).toBeLessThanOrEqual(MISSING_CEILING[id] ?? 0);
    }
  });

  it("a name-bearing file is never a shared file (the child's name stays in the child's own files)", () => {
    for (const n of needs) for (const folder of VOICE_FOLDERS) {
      const per = new Set(n.folders[folder].perChild);
      expect(n.folders[folder].shared.filter((f) => per.has(f)), `${n.bookId}/${folder}`).toEqual([]);
    }
    for (const s of KID_SHELF_STORIES) for (const folder of VOICE_FOLDERS) {
      expect(needs.find((n) => n.bookId === s.id)!.folders[folder].perChild).toContain("question.mp3");
    }
  });

  it("the proof book's shared set is complete in EN and HE-m; HE-f reads HE-m's name-free files", () => {
    const m = MANIFEST.books["five-smooth-stones"];
    expect(Object.keys(m.folders.en.files).length).toBeGreaterThan(20);
    expect(Object.keys(m.folders["he-m"].files).length).toBeGreaterThan(20);
    for (const folder of VOICE_FOLDERS) expect(m.folders[folder].missing).toEqual([]);
  });
});

describe("B-BOOK-35 / B-BOOK-73 · negative controls", () => {
  const needs = shelfNarrationNeeds().filter((n) => n.bookId === "five-smooth-stones");
  const clone = () => structuredClone(MANIFEST);
  const someFile = Object.keys(MANIFEST.books["five-smooth-stones"].folders.en.files)[0];

  it("a page file neither shipped nor listed missing fails", () => {
    const m = clone();
    delete m.books["five-smooth-stones"].folders.en.files[someFile];
    expect(manifestFindings(m, needs, hashOf).filter((f) => f.startsWith("five-smooth-stones"))).toEqual([`five-smooth-stones/en/${someFile}: a page file neither shipped nor listed missing`]);
  });
  it("a changed file (hash) and a file gone from disk fail", () => {
    expect(manifestFindings(MANIFEST, needs, (b, s, f, file) => (file === someFile && f === "en" ? "0".repeat(64) : hashOf(b, s, f, file))).filter((x) => x.startsWith("five"))).toEqual([`five-smooth-stones/en/${someFile}: the file's hash is not the manifest's`]);
    expect(manifestFindings(MANIFEST, needs, (b, s, f, file) => (file === someFile && f === "en" ? null : hashOf(b, s, f, file))).filter((x) => x.startsWith("five"))).toEqual([`five-smooth-stones/en/${someFile}: listed with a hash but missing on disk`]);
  });
  it("a listed-missing file that is shipped must move to the hashed list", () => {
    const m = clone();
    const fm = m.books["five-smooth-stones"].folders.en;
    delete fm.files[someFile];
    fm.missing.push(someFile);
    expect(manifestFindings(m, needs, hashOf).filter((x) => x.startsWith("five"))).toEqual([`five-smooth-stones/en/${someFile}: shipped now: move it from missing to the hashed files`]);
  });
  it("a per-child list that drifts from the book fails", () => {
    const m = clone();
    m.books["five-smooth-stones"].folders["he-f"].perChild = [];
    expect(manifestFindings(m, needs, hashOf).filter((x) => x.startsWith("five"))).toEqual(["five-smooth-stones/he-f: the per-child list is not the book's (5 name-bearing files)"]);
  });
});
