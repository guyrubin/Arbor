/**
 * plan-plates — B-BOOK-76 follow-up: paint the Everyday-plan pattern plates.
 *
 * For each pattern in PLAN_PLATE_BRIEFS (or the --pattern ids given), for each
 * plate brief: ONE 3:2 master, child-free and text-free, one key light, the
 * hero slot EMPTY, in the game-tile look (kid-books-standard §4), through the
 * project's Vertex image model on the approved EU regions (the same provider
 * and regions the app uses: lib/ai/modelRouter, VERTEX_IMAGE_REGIONS), then a
 * vision QC pass on the same provider (childFree / textFree / heroSlotEmpty;
 * a plate that fails is NOT written). Each kept plate is written to
 *
 *   app/public/visuals/plans/<pattern>/<plate>.webp   (1536×1024, via cwebp)
 *   app/public/visuals/plans/<pattern>/<plate>.json   (provenance: model, prompt
 *        hash, light, brief, QC verdict, generated-at; never the prompt text)
 *
 * Idempotent: an existing .webp is skipped (--force repaints). --dry-run prints
 * the plan — prompts' hashes, paths — with NO model call. The parent-side
 * review (lane B §4.9) still views every plate full size before it is shown.
 *
 *   npx tsx scripts/plan-plates.mts [--pattern <id>]... [--dry-run] [--force]
 *
 * Run only through the manual arbor-plan-plates workflow (that dispatch is the
 * spend). A Vertex permission refusal names the IAM role the identity needs.
 */
import { createHash } from "node:crypto";
import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { PLAN_PLATE_BRIEFS } from "../src/lib/library/plans/planPlates";
import { TAIL } from "../src/server/heroPosePrompts";
import type { LightRig } from "../src/lib/library/bookPlates";
import type { PatternId } from "../src/lib/library/types";

export const PLATE_W = 1536;
export const PLATE_H = 1024;
export const PLATE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../public/visuals/plans");

export interface PlateSpecLike { light: LightRig; cx?: number; textZone?: string; brief: string }

const LIGHT: Record<LightRig, string> = {
  morning: "soft clear morning light from a low sun, cool-white with a gentle warm edge, long soft shadows",
  day: "even bright daylight, white key light from high on one side, soft short shadows",
  golden: "warm golden-hour light from low on one side, long warm shadows, amber highlights",
  dusk: "soft dusk light, lavender-blue sky light with a last warm glow at the horizon, gentle shadows",
  night: "calm night light: one warm low lamp or moonlight through a window, deep soft blue shadows, nothing scary",
};

/** The style every plate shares (standard §4: the game-tile look). */
export const PLATE_STYLE = "A painted picture-book BACKGROUND PLATE in the Arbor game-tile look: soft rounded shapes, clean edges, "
  + "calm saturated colours, gentle paper texture, a storybook watercolour-and-gouache finish; never photorealistic, never 3D render.";

/** The rules every plate obeys (child-free, text-free, hero slot empty, one key light). */
export const PLATE_RULES = "ABSOLUTELY NO PEOPLE and NO CHILD anywhere: no figure, no silhouette, no shadow of a person, no face, no hands, "
  + "no reflection of a person, no doll or toy figure with a face; the hero slot named in the scene stays EMPTY — the character is "
  + "composited later. ONE key light only, as the light description says, consistent across the scene. Landscape 3:2 picture, the "
  + "whole scene inside the frame, calm composition with an open area where the hero slot is.";

/** The one prompt of a plate (deterministic: its hash is the provenance key). */
export function platePrompt(patternId: string, plateId: string, spec: PlateSpecLike): string {
  const slot = spec.cx == null ? "centre" : spec.cx < 0.45 ? "left of centre" : spec.cx > 0.55 ? "right of centre" : "centre";
  const textZone = spec.textZone ? ` Keep the ${spec.textZone === "bottom" ? "bottom" : spec.textZone === "inline-start" ? "left" : "right"} part of the picture calm and plain, with no detail (a text panel sits there).` : "";
  return [
    PLATE_STYLE,
    `SCENE (${patternId} / ${plateId}): ${spec.brief}.`,
    `LIGHT: ${LIGHT[spec.light]}.`,
    `The hero slot is ${slot}, on the ground plane, empty.${textZone}`,
    PLATE_RULES,
    TAIL,
  ].join(" ").replace(/ {2,}/g, " ");
}

export const promptHash = (prompt: string): string => createHash("sha256").update(prompt, "utf8").digest("hex").slice(0, 16);

export interface PlateJob { patternId: PatternId; plateId: string; spec: PlateSpecLike; webp: string; json: string; prompt: string; hash: string }

/** Every plate to paint (or --pattern's), with its paths and prompt. */
export function plateJobs(patterns: readonly string[] = [], root = PLATE_ROOT): PlateJob[] {
  const wanted = patterns.length ? new Set(patterns) : null;
  const out: PlateJob[] = [];
  for (const [patternId, specs] of Object.entries(PLAN_PLATE_BRIEFS) as [PatternId, Record<string, PlateSpecLike>][]) {
    if (wanted && !wanted.has(patternId)) continue;
    for (const [plateId, spec] of Object.entries(specs)) {
      const prompt = platePrompt(patternId, plateId, spec);
      out.push({ patternId, plateId, spec, webp: join(root, patternId, `${plateId}.webp`), json: join(root, patternId, `${plateId}.json`), prompt, hash: promptHash(prompt) });
    }
  }
  return out;
}

export interface Args { patterns: string[]; dryRun: boolean; force: boolean }
export function parseArgs(argv: readonly string[]): Args {
  const a: Args = { patterns: [], dryRun: false, force: false };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i];
    if (v === "--dry-run") a.dryRun = true;
    else if (v === "--force") a.force = true;
    else if (v === "--pattern") { const id = argv[++i]; if (id) a.patterns.push(id); }
    else if (v.startsWith("--pattern=")) a.patterns.push(v.slice("--pattern=".length));
    else throw new Error(`Unknown argument: ${v}`);
  }
  const known = new Set(Object.keys(PLAN_PLATE_BRIEFS));
  for (const p of a.patterns) if (!known.has(p)) throw new Error(`Unknown pattern: ${p} (known: ${[...known].join(", ")})`);
  return a;
}

/** A Vertex refusal for lack of permission, named for the operator (the IAM role to grant). */
export function iamMessage(err: unknown, projectId: string | undefined): string | null {
  const text = `${(err as { code?: unknown })?.code ?? ""} ${(err as { status?: unknown })?.status ?? ""} ${(err as Error)?.message ?? err}`;
  if (!/PERMISSION_DENIED|\b403\b|permission|IAM_PERMISSION|does not have .*permission|aiplatform\.endpoints\.predict/i.test(text)) return null;
  return [
    "Vertex AI refused the image call: the workflow identity lacks permission.",
    `Grant the service account the role roles/aiplatform.user (Vertex AI User) on project ${projectId ?? "<GCP_PROJECT_ID>"}`,
    "and make sure the Vertex AI API is enabled and the image model (VERTEX_MODEL_IMAGE) is available in the VERTEX_IMAGE_REGIONS listed.",
    `Underlying error: ${String((err as Error)?.message ?? err).slice(0, 300)}`,
  ].join("\n");
}

export interface QcVerdict { childFree: boolean; textFree: boolean; heroSlotEmpty: boolean; notes: string }
export const QC_SCHEMA = {
  type: "OBJECT",
  required: ["childFree", "textFree", "heroSlotEmpty", "notes"],
  properties: {
    childFree: { type: "BOOLEAN", description: "true only if there is NO person, child, figure, face, hand or human silhouette anywhere" },
    textFree: { type: "BOOLEAN", description: "true only if there are NO letters, words, numbers, signs with writing, logos or watermarks" },
    heroSlotEmpty: { type: "BOOLEAN", description: "true if the ground area where a character would stand is open and empty" },
    notes: { type: "STRING" },
  },
} as const;
export const QC_PROMPT = "You are checking a painted picture-book background plate before it is shown to children. Look carefully at the whole image. "
  + "Answer strictly: childFree (no person of any age, no figure, no face, no hands, no silhouette, no human shadow), textFree (no letters, "
  + "words, numbers, writing on signs, logos, watermarks, captions), heroSlotEmpty (an open ground area where a character could be placed). "
  + "Return JSON only.";

export const qcPassed = (v: QcVerdict): boolean => v.childFree === true && v.textFree === true && v.heroSlotEmpty === true;

/** PNG/JPEG bytes → a 1536×1024 WebP via cwebp (installed by the workflow). */
export function encodeWebp(imageBytes: Buffer, mimeType: string, out: string): void {
  const dir = mkdtempSync(join(tmpdir(), "arbor-plate-"));
  try {
    const ext = /jpe?g/i.test(mimeType) ? "jpg" : "png";
    const src = join(dir, `plate.${ext}`);
    writeFileSync(src, imageBytes);
    mkdirSync(dirname(out), { recursive: true });
    execFileSync("cwebp", ["-quiet", "-q", "84", "-resize", String(PLATE_W), String(PLATE_H), src, "-o", out], { stdio: "inherit" });
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

async function main(): Promise<number> {
  const args = parseArgs(process.argv.slice(2));
  const jobs = plateJobs(args.patterns);
  const todo = jobs.filter((j) => args.force || !existsSync(j.webp));
  console.log(`[plan-plates] ${jobs.length} plates in scope, ${todo.length} to paint${args.dryRun ? " (dry run: no model call)" : ""}.`);
  for (const j of todo) console.log(`  ${j.patternId}/${j.plateId}  light=${j.spec.light}  prompt=${j.hash}  → ${j.webp.replace(PLATE_ROOT, "public/visuals/plans")}`);
  if (args.dryRun || !todo.length) return 0;

  try { execFileSync("cwebp", ["-version"], { stdio: "ignore" }); } catch { console.error("[plan-plates] cwebp is not installed (apt-get install webp)."); return 2; }
  const { loadConfig } = await import("../src/config/env.js");
  const { createModelProvider } = await import("../src/ai/modelRouter.js");
  const config = loadConfig();
  if (config.modelProvider !== "vertex") { console.error(`[plan-plates] MODEL_PROVIDER must be vertex (is ${config.modelProvider}): plates are painted on the approved EU routes only.`); return 2; }
  const provider = createModelProvider(config);
  let painted = 0, failedQc = 0;
  for (const j of todo) {
    let image: { data: string; mimeType: string };
    try {
      image = await provider.generateImage({ prompt: j.prompt });
    } catch (err) {
      const iam = iamMessage(err, config.gcpProjectId);
      if (iam) { console.error(`[plan-plates] ${iam}`); return 2; }
      console.error(`[plan-plates] ${j.patternId}/${j.plateId}: image call failed: ${String((err as Error)?.message ?? err).slice(0, 300)}`);
      continue;
    }
    const verdict = (await provider.generateJson({
      route: "analysis_structured", temperature: 0, prompt: QC_PROMPT,
      images: [{ data: image.data, mimeType: image.mimeType }],
      schema: QC_SCHEMA as unknown as Record<string, unknown>,
    })) as QcVerdict;
    if (!qcPassed(verdict)) {
      failedQc++;
      console.warn(`[plan-plates] ${j.patternId}/${j.plateId}: QC FAILED (childFree=${verdict.childFree} textFree=${verdict.textFree} heroSlotEmpty=${verdict.heroSlotEmpty}) — not written. ${verdict.notes ?? ""}`);
      continue;
    }
    encodeWebp(Buffer.from(image.data, "base64"), image.mimeType, j.webp);
    writeFileSync(j.json, JSON.stringify({
      pattern: j.patternId, plate: j.plateId, file: `${j.plateId}.webp`, width: PLATE_W, height: PLATE_H,
      light: j.spec.light, brief: j.spec.brief, model: config.vertexModelImage, promptHash: j.hash, promptVersion: "plan-plate-2026-10-28",
      qc: { childFree: verdict.childFree, textFree: verdict.textFree, heroSlotEmpty: verdict.heroSlotEmpty, notes: String(verdict.notes ?? "").slice(0, 300), model: "analysis_structured route" },
      generatedAt: new Date().toISOString(), reviewedBy: null,
    }, null, 2) + "\n");
    painted++;
    console.log(`[plan-plates] ${j.patternId}/${j.plateId}: painted (${readFileSync(j.webp).length} bytes).`);
  }
  console.log(`[plan-plates] done: ${painted} painted, ${failedQc} failed QC, ${todo.length - painted - failedQc} errored.`);
  return 0;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().then((code) => process.exit(code)).catch((err) => { console.error("[plan-plates]", err); process.exit(1); });
}
