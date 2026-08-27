import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/**
 * On-device face landmarker (MediaPipe Tasks Vision). Runs entirely in the browser
 * via WASM — camera frames are processed locally and NEVER leave the device. Loaded
 * lazily (dynamic import) so the ~heavy vision bundle stays out of the main chunk
 * until a parent opens the face-match game.
 *
 * Runtime and model are served from our own origin, never a third-party CDN: this
 * game is reachable from the child-operated surface, so an outbound fetch would
 * hand a child's IP and user agent to another party — a store-declaration problem.
 * The runtime is copied out of node_modules at build time (scripts/copy-mediapipe-wasm.mjs,
 * so it can never drift from the installed version); the model is committed.
 */

const WASM_DIR = "/mediapipe/wasm";
const MODEL_URL = "/mediapipe/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_DIR);
      return vision.FaceLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate: "GPU" },
        outputFaceBlendshapes: true,
        runningMode: "VIDEO",
        numFaces: 1,
      });
    })().catch((err) => {
      landmarkerPromise = null; // allow a retry on next open
      throw err;
    });
  }
  return landmarkerPromise;
}
