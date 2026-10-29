/**
 * B-KID-153 — the asset provenance register's build check: every final asset
 * under public/visuals and public/audio/kid resolves to a register row whose
 * hash matches the file, or sits on the FROZEN baseline of assets with no
 * recorded provenance (shrink-only); every row carries the AI-authorship
 * record and names no model; the rows still match the records they are joined
 * from (a changed prompt is a changed row). Negative controls prove each rule.
 */
import { describe, expect, it } from "vitest";
import { fileHash, sourceRows, walkAssets } from "../../scripts/asset-provenance.mjs";
import { readFileSync } from "node:fs";
import { MODEL_NAME, provenanceFindings, rowFindings, type AssetProvenanceRegister, type AssetProvenanceRow } from "./assetProvenance";

// read, not imported: a JSON import makes tsc type the whole register (fix round 2, lint at the default heap)
const RAW = readFileSync(new URL("../content/assetProvenance.json", import.meta.url), "utf8");
const REG = JSON.parse(RAW) as AssetProvenanceRegister;
/** The baseline at creation (29 Oct 2026): it may only shrink. */
const BASELINE_CEILING = 198;

describe("B-KID-153 · every final asset resolves to its provenance row", () => {
  const files = walkAssets() as string[];

  it("the scan is real: it reads visuals and kid audio, and the register has rows from every source", () => {
    expect(files.some((f) => f.startsWith("visuals/books/five-smooth-stones/"))).toBe(true);
    expect(files.some((f) => f.startsWith("audio/kid/"))).toBe(true);
    expect(files.some((f) => /\.md$/.test(f))).toBe(false);
    for (const folder of ["visuals/parent/v1/", "visuals/worlds/v2/", "visuals/stories/v1/", "visuals/characters/v1/", "visuals/books/five-smooth-stones/"]) {
      expect(REG.rows.some((r) => r.asset.startsWith(folder)), folder).toBe(true);
    }
  });

  it("no finding: hashes match, nothing unregistered beyond the frozen baseline, the baseline is exact", () => {
    expect(provenanceFindings(files, (f) => fileHash(f), REG)).toEqual([]);
  });

  it("the frozen baseline only shrinks", () => {
    expect(REG.unregistered.length).toBeLessThanOrEqual(BASELINE_CEILING);
  });

  it("every row is complete and carries the AI-authorship record; no model identifier anywhere in the register", () => {
    for (const row of REG.rows) expect(rowFindings(row), row.asset).toEqual([]);
    expect(MODEL_NAME.test(RAW)).toBe(false);
  });

  it("the rows still match their records (a changed prompt, reference or source is a changed row)", () => {
    const current = new Map((sourceRows() as AssetProvenanceRow[]).map((r) => [r.asset, r]));
    for (const row of REG.rows) {
      const src = current.get(row.asset);
      expect(src, `${row.asset}: no longer recorded in ${row.source}`).toBeTruthy();
      expect({ source: row.source, promptHash: row.promptHash, reference: row.reference, master: row.master, model: row.model })
        .toEqual({ source: src!.source, promptHash: src!.promptHash, reference: src!.reference, master: src!.master, model: src!.model });
    }
  });

  it("every library plate the B-BOOK-27 contract reviews is a register row", () => {
    const plates = files.filter((f) => /^visuals\/books\/[^/]+\/[^/]+\.webp$/.test(f));
    expect(plates.length).toBeGreaterThanOrEqual(19);
    for (const p of plates) expect(REG.rows.some((r) => r.asset === p), p).toBe(true);
  });
});

describe("B-KID-153 · negative controls", () => {
  const row: AssetProvenanceRow = {
    asset: "visuals/x/a.webp", sha256: "a".repeat(64), kind: "shot", source: "docs/design/x.json#a", model: { recordedIn: "docs/design/x.json#a" },
    promptHash: "b".repeat(64), reference: "none", master: null, human: "selection by eye", licence: null, approvals: [],
    aiAuthorship: { aiGenerated: true, humanAuthorship: "selection by eye", claimExcludes: "the AI-generated image" },
  };
  const hash = (f: string) => (f === "visuals/x/a.webp" ? "a".repeat(64) : "c".repeat(64));

  it("a new asset with no row and not on the baseline fails", () => {
    expect(provenanceFindings(["visuals/x/a.webp", "visuals/x/new.webp"], hash, { rows: [row], unregistered: [] }))
      .toEqual(["visuals/x/new.webp: an unregistered asset (record its provenance, then run scripts/asset-provenance.mjs --write)"]);
  });
  it("a swapped file fails until re-registered", () => {
    expect(provenanceFindings(["visuals/x/a.webp"], () => "d".repeat(64), { rows: [row], unregistered: [] }))
      .toEqual(["visuals/x/a.webp: the file is not the registered one (hash changed): re-register it"]);
  });
  it("the baseline is exact: a registered or deleted asset must leave it", () => {
    expect(provenanceFindings(["visuals/x/a.webp"], hash, { rows: [row], unregistered: ["visuals/x/a.webp", "visuals/x/gone.webp"] })).toEqual([
      "visuals/x/a.webp: registered now: remove it from the frozen baseline",
      "visuals/x/gone.webp: gone: remove it from the frozen baseline",
    ]);
  });
  it("a row without the AI-authorship record, without a human contribution, or naming a model fails", () => {
    expect(rowFindings({ ...row, aiAuthorship: undefined as never })).toEqual(["visuals/x/a.webp: no AI-authorship record"]);
    expect(rowFindings({ ...row, human: " " })).toEqual(["visuals/x/a.webp: no human contribution recorded"]);
    expect(rowFindings({ ...row, model: { recordedIn: "imagen run 3" } })).toEqual(["visuals/x/a.webp: a model identifier is copied into the row"]);
    expect(rowFindings({ ...row, kind: "video" as never })).toEqual(["visuals/x/a.webp: kind is not shot, song or sound"]);
  });
});
