import { describe, expect, it } from "vitest";
import * as fs from "fs";
import * as path from "path";

/**
 * K3 guard — no third-party asset origins in shipped client code.
 *
 * The face-match game (reachable from the child-operated surface) used to pull
 * its MediaPipe WASM runtime from cdn.jsdelivr.net and its model from
 * storage.googleapis.com. Camera frames never left the device, but the fetches
 * themselves handed a child's IP and user agent to two other parties — which is
 * a store-declaration problem, not a preference. Both now come from our own
 * origin (see lib/faceLandmarker.ts + scripts/copy-mediapipe-wasm.mjs).
 *
 * This source scan keeps the class from returning: any new runtime asset must be
 * self-hosted, so a reviewer never has to re-derive what a kid surface talks to.
 * Google Fonts is the one documented exception — it is stylesheet-only, loaded
 * from index.html (outside this scan), and tracked separately in the store SDK
 * audit as an accept-or-self-host decision.
 */

const SRC = path.join(__dirname, "..");

// Asset-delivery hosts. First-party API endpoints (our Cloud Run service,
// Firebase, the model providers we call server-side) are a different thing and
// are not covered here.
const FORBIDDEN_HOSTS = [
  "cdn.jsdelivr.net",
  "unpkg.com",
  "cdnjs.cloudflare.com",
  "storage.googleapis.com",
  "cdn.skypack.dev",
  "esm.sh",
];

const walk = (dir: string, out: string[] = []): string[] => {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules") continue;
      walk(full, out);
    } else if (/\.(ts|tsx)$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
};

describe("third-party asset origins", () => {
  const files = walk(SRC);

  it("scans a meaningful number of source files", () => {
    expect(files.length).toBeGreaterThan(100);
  });

  it.each(FORBIDDEN_HOSTS)("no client source fetches assets from %s", (host) => {
    const offenders = files.filter((file) => fs.readFileSync(file, "utf8").includes(host));
    expect(
      offenders.map((f) => path.relative(SRC, f)),
      `Serve this asset from our own origin instead (see lib/faceLandmarker.ts for the pattern).`
    ).toEqual([]);
  });

  it("the face landmarker loads runtime and model from our origin", () => {
    const source = fs.readFileSync(path.join(SRC, "lib", "faceLandmarker.ts"), "utf8");
    expect(source).toContain('"/mediapipe/wasm"');
    expect(source).toContain('"/mediapipe/face_landmarker.task"');
  });

  it("the WASM runtime is copied from the installed package at build time", () => {
    const pkg = JSON.parse(fs.readFileSync(path.join(SRC, "..", "package.json"), "utf8"));
    expect(pkg.scripts.build).toContain("copy-mediapipe-wasm.mjs");
    expect(pkg.scripts.predev).toContain("copy-mediapipe-wasm.mjs");
  });
});
