import { readFileSync } from "node:fs";
import path from "node:path";

/** B-ASKJB-23: demotion is legal only while every existing capability has a
 * live owner. Source contract only; rendered interaction evidence stays CI. */
export function hardMomentCapabilityFailures(appRoot) {
  const entries = JSON.parse(readFileSync(path.join(appRoot, "src/lib/hardMomentCapabilities.json"), "utf8"));
  return entries.flatMap(({ id, owner, markers }) => {
    const source = readFileSync(path.join(appRoot, "src", owner), "utf8")
      .replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    return markers.filter((marker) => !source.includes(marker)).map((marker) => `${id}: ${owner} is missing ${marker}`);
  });
}
