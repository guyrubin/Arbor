import type { FaceLandmarker } from "@mediapipe/tasks-vision";

/**
 * On-device face landmarker (MediaPipe Tasks Vision). Runs entirely in the browser
 * via WASM — camera frames are processed locally and NEVER leave the device. Loaded
 * lazily (dynamic import) so the ~heavy vision bundle stays out of the main chunk
 * until a parent opens the face-match game. WASM is pinned to the installed version.
 */

const VERSION = "0.10.35";
const WASM_CDN = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let landmarkerPromise: Promise<FaceLandmarker> | null = null;

export async function getFaceLandmarker(): Promise<FaceLandmarker> {
  if (!landmarkerPromise) {
    landmarkerPromise = (async () => {
      const vision = await import("@mediapipe/tasks-vision");
      const fileset = await vision.FilesetResolver.forVisionTasks(WASM_CDN);
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
