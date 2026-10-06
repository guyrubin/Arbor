/**
 * B-LOOP-14 — the content-hash seam of the static-content eval suites
 * (evals/milestone-loop-v1.eval.json). A static suite judges TEXT that lives
 * in a source file (the milestone catalogue, the practice library), so its
 * staleness is a property of those files, not of a prompt version: the
 * generator (app/scripts/build-loop-eval.mts) stamps the sha256 of each
 * file's SOURCE TEXT into the suite (`contentHashes`), the judge runner
 * stamps the same hashes into every results row and refuses to judge a suite
 * whose hashes no longer match the files, and `check:acceptance` WARNS when a
 * file changed after the last generation or the last judged run (EVAL-6's
 * prompt-staleness mechanism, for content).
 *
 * The hash is sha256 over the file text with CRLF normalised to LF, so a
 * Windows checkout and the Linux CI box agree on the same commit.
 */
import { createHash } from "node:crypto";
import * as fs from "node:fs";
import * as path from "node:path";

/** Content key → repo-relative source file. One map for the generator, the runner and check:acceptance. */
export const CONTENT_HASH_FILES: Readonly<Record<string, string>> = {
  milestoneData: "app/src/lib/milestoneData.ts",
  practices: "app/src/content/practices.ts",
};

/** sha256 (hex) of a source text, CRLF → LF first. */
export const sourceTextHash = (text: string): string =>
  createHash("sha256").update(text.replace(/\r\n/g, "\n"), "utf8").digest("hex");

export type ReadText = (absolutePath: string) => string;
const readUtf8: ReadText = (absolutePath) => fs.readFileSync(absolutePath, "utf8");

/** The live hash of every named content key (default: all of CONTENT_HASH_FILES). */
export const liveContentHashes = (
  repoRoot: string,
  keys: readonly string[] = Object.keys(CONTENT_HASH_FILES),
  readText: ReadText = readUtf8,
): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const key of keys) {
    const rel = CONTENT_HASH_FILES[key];
    if (!rel) throw new Error(`unknown content key "${key}" (known: ${Object.keys(CONTENT_HASH_FILES).join(", ")})`);
    out[key] = sourceTextHash(readText(path.join(repoRoot, rel)));
  }
  return out;
};

/** Keys whose declared hash differs from the live file ([] = fresh). An unknown key or an unreadable file counts as changed. */
export const changedContentKeys = (
  declared: Readonly<Record<string, string>>,
  repoRoot: string,
  readText: ReadText = readUtf8,
): string[] =>
  Object.entries(declared)
    .filter(([key, hash]) => {
      const rel = CONTENT_HASH_FILES[key];
      if (!rel) return true;
      try {
        return sourceTextHash(readText(path.join(repoRoot, rel))) !== hash;
      } catch {
        return true;
      }
    })
    .map(([key]) => key);
