#!/usr/bin/env node
/**
 * B-KID-153 — the asset provenance register (extends the B-BOOK-27 plate
 * metadata): ONE row per final rendered shot and per song or sound under
 * public/visuals and public/audio/kid, joined from the provenance the tree
 * already records (the design art logs in docs/design/*.json and the plate
 * provenance of each library book's geometry), written to
 * src/content/assetProvenance.json. The build check is
 * src/lib/assetProvenance.test.ts: every final asset resolves to a row whose
 * hash matches the file, or sits on the FROZEN baseline of assets with no
 * recorded provenance, which may only shrink.
 *
 * No model identifier is copied into the register: a row says WHERE the model
 * is recorded (`model.recordedIn`). Prompts are hashed, never copied. Nothing
 * is rendered and nothing is spent.
 *
 *   node scripts/asset-provenance.mjs            # dry run: prints what would change
 *   node scripts/asset-provenance.mjs --write    # rewrites the register (rows + a baseline that only shrinks)
 *
 * A file with no recorded provenance that is NOT on the baseline is refused
 * (exit 1): record its provenance in a source first. The baseline is created
 * once (--init) and never grows.
 */
import { createHash } from "node:crypto";
import { existsSync, readdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const APP = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const REPO = path.resolve(APP, "..");
const PUBLIC = path.join(APP, "public");
export const REGISTER_FILE = path.join(APP, "src", "content", "assetProvenance.json");
/** The roots the register covers, relative to public/. */
export const ASSET_ROOTS = ["visuals", "audio/kid"];
/** Not assets: notes and data files beside them. */
export const isAsset = (rel) => !/\.(md|json|txt)$/i.test(rel);

const sha256 = (buf) => createHash("sha256").update(buf).digest("hex");

export function walkAssets(publicDir = PUBLIC) {
  const out = [];
  const walk = (dir) => {
    if (!existsSync(dir)) return;
    for (const e of readdirSync(dir).sort()) {
      const p = path.join(dir, e);
      if (statSync(p).isDirectory()) walk(p);
      else {
        const rel = path.relative(publicDir, p).split(path.sep).join("/");
        if (isAsset(rel)) out.push(rel);
      }
    }
  };
  for (const root of ASSET_ROOTS) walk(path.join(publicDir, root));
  return out;
}

export const fileHash = (rel, publicDir = PUBLIC) => sha256(readFileSync(path.join(publicDir, rel)));
export const textHash = (text) => sha256(Buffer.from(String(text), "utf8"));

/** Rows from one design art log (docs/design/<name>.json). */
function designRows(name, folder) {
  const docRel = `docs/design/${name}.json`;
  const doc = JSON.parse(readFileSync(path.join(REPO, docRel), "utf8"));
  const rows = [];
  for (const a of doc.assets ?? []) {
    const id = a.id ?? a.file;
    const files = [...(a.exports ?? []).map((e) => e.file), ...(a.outputs ?? [])];
    const twoCandidates = /two candidates/i.test(doc.method ?? "");
    const human = twoCandidates
      ? "Prompt authorship; selection between two generated candidates by eye; centre crop; WebP export"
      : "Prompt authorship; selection of the original; mechanical WebP export from the preserved original";
    const approvals = [];
    if (/approved by Guy/i.test(doc.method ?? "")) approvals.push({ by: "Guy", what: (/Direction approved by Guy[^.]*/i.exec(doc.method) ?? ["direction approved"])[0] });
    if (a.status) approvals.push({ by: "recorded status", what: a.status });
    else if (typeof doc.review === "string") approvals.push({ by: "recorded review", what: doc.review });
    for (const file of files) {
      rows.push({
        asset: `${folder}/${file}`,
        kind: "shot",
        source: `${docRel}#${id}`,
        model: (a.model ?? doc.model ?? a.mode ?? doc.mode) ? { recordedIn: `${docRel}#${id}` } : null,
        promptHash: a.prompt ? textHash(a.prompt) : null,
        reference: Array.isArray(a.references) && a.references.length ? { hash: textHash(JSON.stringify(a.references)) } : /new original/i.test(a.mode ?? "") ? "none" : null,
        master: a.originalSha256 ?? null,
        human,
        licence: null,
        approvals,
        aiAuthorship: { aiGenerated: true, humanAuthorship: human, claimExcludes: "the AI-generated image" },
      });
    }
  }
  return rows;
}

/** Rows from a library book's plate geometry (the B-BOOK-27 plate provenance). */
function plateRows(bookId, geometryRel) {
  const g = JSON.parse(readFileSync(path.join(APP, geometryRel), "utf8"));
  const rows = [];
  const human = "Art direction and plate QC by the art agent against the manuscript brief; slot geometry authored by hand";
  for (const [plateId, plate] of Object.entries(g.plates ?? {})) {
    const p = plate.provenance ?? {};
    rows.push({
      asset: `visuals/books/${bookId}/${plateId}.webp`,
      kind: "shot",
      source: `app/${geometryRel}#plates.${plateId}`,
      model: null,
      promptHash: null,
      reference: null,
      master: null,
      human,
      licence: null,
      approvals: typeof p.reviewedBy === "string" && p.reviewedBy.trim() ? [{ by: "plate review", what: `${p.reviewedBy}${p.childFree ? "; child-free" : ""}${p.textFree ? "; text-free" : ""}` }] : [],
      aiAuthorship: { aiGenerated: true, humanAuthorship: human, claimExcludes: "the AI-generated image" },
    });
  }
  const overlays = new Set();
  for (const page of Object.values(g.pages ?? {})) for (const [id, o] of Object.entries(page.overlays ?? {})) overlays.add(o.file ?? id);
  for (const id of [...overlays].sort()) {
    rows.push({
      asset: `visuals/books/${bookId}/overlays/${id}.webp`,
      kind: "shot",
      source: `app/${geometryRel}#overlays.${id}`,
      model: null,
      promptHash: null,
      reference: null,
      master: null,
      human: "Cut from the book's plates by the art agent for an art state",
      licence: null,
      approvals: [],
      aiAuthorship: { aiGenerated: true, humanAuthorship: "Cut from the book's plates by the art agent for an art state", claimExcludes: "the AI-generated image" },
    });
  }
  return rows;
}

export function sourceRows() {
  return [
    ...designRows("parent-art-v1", "visuals/parent/v1"),
    ...designRows("character-art-v1", "visuals/characters/v1"),
    ...designRows("story-art-v1", "visuals/stories/v1"),
    ...designRows("world-art-v2", "visuals/worlds/v2"),
    ...plateRows("five-smooth-stones", "src/lib/library/books/fiveSmoothStones.geometry.json"),
  ];
}

function main() {
  const write = process.argv.includes("--write");
  const init = process.argv.includes("--init");
  const files = walkAssets();
  const onDisk = new Set(files);
  const previous = existsSync(REGISTER_FILE) ? JSON.parse(readFileSync(REGISTER_FILE, "utf8")) : null;
  if (!previous && !init) { console.error("No register yet: run once with --init --write."); process.exit(1); }
  if (previous && init) { console.error("The register exists: --init would reset the baseline, refused."); process.exit(1); }
  const keep = new Map((previous?.rows ?? []).map((r) => [r.asset, r]));
  const rows = [];
  for (const r of sourceRows()) {
    if (!onDisk.has(r.asset)) continue; // a recorded output that is not shipped
    const old = keep.get(r.asset);
    // Hand-recorded fields (licence, approvals added later) survive a regeneration.
    rows.push({ ...r, sha256: fileHash(r.asset), ...(old?.licence ? { licence: old.licence } : {}), ...(old?.approvals?.length > r.approvals.length ? { approvals: old.approvals } : {}) });
  }
  for (const old of keep.values()) if (!rows.some((r) => r.asset === old.asset) && onDisk.has(old.asset)) rows.push({ ...old, sha256: fileHash(old.asset) });
  rows.sort((a, b) => a.asset.localeCompare(b.asset));
  const registered = new Set(rows.map((r) => r.asset));
  const unregistered = files.filter((f) => !registered.has(f));
  const baselineBefore = new Set(previous?.unregistered ?? unregistered);
  const fresh = unregistered.filter((f) => !baselineBefore.has(f));
  if (fresh.length) {
    console.error(`Refused: ${fresh.length} asset(s) with no recorded provenance and not on the frozen baseline:\n  ${fresh.join("\n  ")}`);
    process.exit(1);
  }
  const register = {
    _note: "GENERATED by app/scripts/asset-provenance.mjs (B-KID-153) from docs/design/*.json and the library books' plate provenance. Checked by src/lib/assetProvenance.test.ts. `unregistered` is the FROZEN baseline of shipped assets with no recorded provenance: it may only shrink. No model identifier is copied here (model.recordedIn points at the record); prompts are hashed, never copied.",
    schema: 1,
    rows,
    unregistered: unregistered.sort(),
  };
  console.log(`${rows.length} rows, ${unregistered.length} on the baseline (was ${previous ? previous.unregistered.length : "-"})`);
  if (write) writeFileSync(REGISTER_FILE, `${JSON.stringify(register, null, 1)}\n`);
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) main();
