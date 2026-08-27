/**
 * Self-host the MediaPipe Tasks Vision runtime + face-landmarker model.
 *
 * WHY THIS EXISTS
 * ---------------
 * The face-match game (MimicMatch/MimicStudio, inside Kid Mode) runs the
 * landmarker on-device — camera frames never leave the phone. But the SDK's
 * default loader pulls its WASM runtime from `cdn.jsdelivr.net` and its model
 * from `storage.googleapis.com`, so opening a KID-OPERATED surface fired two
 * requests to third-party hosts, handing them the device IP + user-agent. The
 * 2026-08-26 store SDK audit flagged that as the one remaining third-party
 * egress from a child's screen (finding 3); under the parent-operated store
 * posture it has to go. Self-hosting also removes an offline failure mode and
 * takes the assets under the app's own `'self'` CSP, which never allowed
 * jsDelivr in the first place (`src/server/createApp.ts` cspDirectives).
 *
 * TWO ASSET CLASSES, TWO POLICIES
 * -------------------------------
 * · WASM runtime — already on disk inside the pinned `@mediapipe/tasks-vision`
 *   dependency, so it is COPIED at install/dev/build time and git-ignored:
 *   ~22 MB of binaries that bump with every version would otherwise be
 *   committed twice over. The version pin in package.json is the provenance.
 * · The .task model — has no npm home and needs the network, so it is
 *   DOWNLOADED once and COMMITTED (same reasoning as the icon-font subset in
 *   public/fonts). `--model` re-fetches it and verifies the pinned digest.
 *
 * USAGE:
 *   node scripts/sync-mediapipe-assets.mjs            # copy WASM (no network)
 *   node scripts/sync-mediapipe-assets.mjs --model    # + re-download the model
 *
 * Wired into `postinstall`, `predev` and `prebuild`, and re-run by the guard
 * test (src/lib/faceLandmarker.test.ts) so a fresh checkout cannot ship a
 * kid surface whose runtime is missing.
 *
 * LICENSE: MediaPipe and the face-landmarker model bundle are Apache-2.0
 * (google-ai-edge/mediapipe). The notice ships next to the assets in
 * public/mediapipe/LICENSE.txt.
 */
import { copyFileSync, createHash as _unused, existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const APP = path.join(here, "..");

/** Where the assets are served from — absolute, same-origin, matches PUBLIC_BASE. */
export const ASSET_DIR = path.join(APP, "public", "mediapipe");
/** URL base handed to FilesetResolver.forVisionTasks(). Kept in sync with src/lib/faceLandmarker.ts. */
export const PUBLIC_BASE = "/mediapipe";

export const WASM_SOURCE_DIR = path.join(APP, "node_modules", "@mediapipe", "tasks-vision", "wasm");

/**
 * Exactly the files `FilesetResolver.forVisionTasks(base)` can ask for:
 * `${base}/vision_wasm${simd ? "" : "_nosimd"}_internal.{js,wasm}`. The
 * `_module_` variants are only reached via forVisionTasks(base, true), which
 * the app never calls, so ~11 MB of them stays out of the bundle. Both the
 * SIMD and the no-SIMD pair ship: the resolver picks at runtime and a missing
 * fallback would be a hard failure on an old WebView (minSdk 24).
 */
export const WASM_FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

export const MODEL_FILE = "face_landmarker.task";
export const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";
/** Digest of the committed model — a re-download that drifts from this is a supply-chain event, not a refresh. */
export const MODEL_SHA256 = "64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff";

export function sha256(file) {
  return createHash("sha256").update(readFileSync(file)).digest("hex");
}

/**
 * Copy the WASM runtime out of the pinned dependency into public/mediapipe.
 * Idempotent and size-checked, so it is cheap to run on every dev/build/test.
 * Returns the list of files that were actually (re)written.
 */
export function syncWasmAssets() {
  if (!existsSync(WASM_SOURCE_DIR)) {
    throw new Error(`@mediapipe/tasks-vision wasm assets not found at ${WASM_SOURCE_DIR} — run npm install`);
  }
  mkdirSync(ASSET_DIR, { recursive: true });
  const written = [];
  for (const file of WASM_FILES) {
    const from = path.join(WASM_SOURCE_DIR, file);
    const to = path.join(ASSET_DIR, file);
    if (!existsSync(from)) throw new Error(`missing ${file} in ${WASM_SOURCE_DIR}`);
    if (existsSync(to) && statSync(to).size === statSync(from).size) continue;
    copyFileSync(from, to);
    written.push(file);
  }
  return written;
}

async function downloadModel() {
  const res = await fetch(MODEL_URL);
  if (!res.ok) throw new Error(`model fetch failed: ${res.status}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const digest = createHash("sha256").update(bytes).digest("hex");
  if (digest !== MODEL_SHA256) {
    throw new Error(`model digest changed: expected ${MODEL_SHA256}, got ${digest} — verify before updating the pin`);
  }
  mkdirSync(ASSET_DIR, { recursive: true });
  writeFileSync(path.join(ASSET_DIR, MODEL_FILE), bytes);
  console.log(`[mediapipe] model downloaded: ${MODEL_FILE} (${bytes.length} bytes)`);
}

async function main() {
  const written = syncWasmAssets();
  console.log(
    written.length
      ? `[mediapipe] wasm synced: ${written.join(", ")}`
      : `[mediapipe] wasm already current (${WASM_FILES.length} files)`,
  );
  if (process.argv.includes("--model")) await downloadModel();
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  main().catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
