#!/usr/bin/env node
/**
 * Copies the MediaPipe Tasks-Vision WASM runtime out of node_modules into
 * public/mediapipe/wasm so the face-match game loads it from our own origin.
 *
 * Why this exists: the runtime used to be fetched from cdn.jsdelivr.net at
 * play time. That surface is child-operated, so a third party saw the child's
 * IP and user agent — a store-declaration problem, not just a preference.
 *
 * The files are ~21MB, so they are gitignored and regenerated here on every
 * build. Copying from node_modules also means the runtime can never drift from
 * the installed package version (the old CDN URL pinned its own version string).
 * The model file next to them (face_landmarker.task) is NOT from npm and is
 * committed.
 */
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(appRoot, "node_modules", "@mediapipe", "tasks-vision", "wasm");
const dest = join(appRoot, "public", "mediapipe", "wasm");

const FILES = [
  "vision_wasm_internal.js",
  "vision_wasm_internal.wasm",
  "vision_wasm_nosimd_internal.js",
  "vision_wasm_nosimd_internal.wasm",
];

if (!existsSync(src)) {
  console.error(`[mediapipe] ${src} is missing — run npm install first.`);
  process.exit(1);
}

mkdirSync(dest, { recursive: true });
for (const file of FILES) {
  const from = join(src, file);
  if (!existsSync(from)) {
    console.error(`[mediapipe] expected ${file} in the installed package.`);
    process.exit(1);
  }
  copyFileSync(from, join(dest, file));
}
console.log(`[mediapipe] copied ${FILES.length} runtime files to public/mediapipe/wasm`);
