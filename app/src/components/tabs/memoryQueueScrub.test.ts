/**
 * OBJ-JOURNAL-05 (render half) — the memory queue in a clinical register.
 *
 * The queue proposed «Dylan experiences severe transition anxiety, which
 * manifest as refusal» — a severity adjective and a clinical noun, printed to
 * a parent as a fact to approve, on the Story reading of their child's own
 * timeline. The prompt now asks for plain words and the egress enforces them
 * (server/parentWordsScrub, Builder G); this guard covers the OTHER end: the
 * same rule applied where the queue renders, so a proposal that predates the
 * prompt change — or arrives from anywhere else — still cannot reach the
 * parent in an assessment register.
 *
 * A fact that does not survive is DROPPED, never softened. The count beside
 * the queue is the count of what survives, so the parent is never told there
 * are three facts and shown two.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { scrubMemoryProposals, toParentWords } from "../../server/parentWordsScrub";

const here = path.dirname(fileURLToPath(import.meta.url));
const SRC = path.resolve(here, "..", "..");
const read = (rel: string) => readFileSync(path.join(SRC, rel), "utf8");
const stripComments = (code: string) =>
  code.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
const STORY = stripComments(read("components/tabs/StoryTimelineTab.tsx"));

/** The captured string, verbatim from the audit. */
const CAPTURED = "Dylan experiences severe transition anxiety, which manifest as refusal";

const item = (fact: string) => ({ memoryId: `m-${fact.length}`, fact, status: "pending" as const });

describe("OBJ-JOURNAL-05 · the captured proposal never renders as written", () => {
  it("the severity adjective is gone from what a parent would read", () => {
    const [survivor] = scrubMemoryProposals([item(CAPTURED)]);
    const rendered = survivor?.fact ?? "";
    expect(rendered).not.toMatch(/severe/i);
    expect(rendered).not.toBe(CAPTURED);
  });

  it("NEGATIVE CONTROL: the raw string passes through the pre-fix path untouched", () => {
    // What the queue did before: hand `m.fact` straight to MemoryRow.
    const prefix = (i: { fact: string }) => i.fact;
    expect(prefix(item(CAPTURED))).toBe(CAPTURED);
    expect(prefix(item(CAPTURED))).toMatch(/severe/i);
  });

  it("a plain parent fact survives unchanged — the scrub is not a paraphraser", () => {
    const plain = "Dylan finds it hard to stop playing when it is time to leave";
    expect(toParentWords(plain)).toBe(plain);
    expect(scrubMemoryProposals([item(plain)])).toHaveLength(1);
  });

  it("a fact that cannot be stated in parent words is dropped, not softened", () => {
    const before = [item(plainFact()), item("Dylan presents with autism spectrum disorder")];
    const after = scrubMemoryProposals(before);
    expect(after.length).toBeLessThan(before.length);
    for (const p of after) expect(p.fact).not.toMatch(/autism|disorder/i);
  });

  it("ids survive the scrub, so approve/reject still write the right row", () => {
    const [survivor] = scrubMemoryProposals([item(CAPTURED)]);
    expect(survivor?.memoryId).toBe(item(CAPTURED).memoryId);
    expect(survivor?.status).toBe("pending");
  });
});

describe("OBJ-JOURNAL-05 · the queue renders the scrubbed list, and counts it", () => {
  it("the density scrubs before rendering", () => {
    expect(STORY).toContain('import { scrubMemoryProposals } from "../../server/parentWordsScrub";');
    expect(STORY).toMatch(/const memoryQueue = useMemo\(\(\) => scrubMemoryProposals\(pendingMemoryItems\), \[pendingMemoryItems\]\)/);
  });

  it("every render site reads the scrubbed list — including the two counts", () => {
    // The raw list appears exactly three times and nowhere else: the context
    // destructure, the scrub call, and that useMemo's dependency array.
    expect(STORY.match(/pendingMemoryItems/g)).toHaveLength(3);
    for (const site of [
      "{memoryQueue.length > 0 && (",
      "memoryQueue.slice(0, 3).map",
      "{memoryQueue.length > 3 && (",
      'count: memoryQueue.length }',
    ]) {
      expect(STORY, `render site not on the scrubbed list: ${site}`).toContain(site);
    }
  });

  it("the scrub module is client-safe: pure, and free of node builtins", () => {
    const module = read("server/parentWordsScrub.ts");
    expect(module).not.toMatch(/from "node:/);
    expect(module).not.toMatch(/require\(/);
    // Its only import is the shared scanner, which carries the same promise.
    const imports = Array.from(module.matchAll(/^import .* from "(.+)";$/gm)).map((m) => m[1]);
    expect(imports).toEqual(["../lib/clinicalScan.js"]);
  });
});

function plainFact() {
  return "Dylan asks for the same book at bedtime";
}
