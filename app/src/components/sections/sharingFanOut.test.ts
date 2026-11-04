/**
 * B-INF-16 — the Sharing page's fan-out. "Shared with you" (GET /shared-with-me)
 * changes only when someone else grants, but every grant, home-program link,
 * revoke, undo and co-parent invite re-read it beside the parent's own grants.
 * The first load and Retry read both lists; every change the parent makes
 * re-reads only their own grants: one request after each change, not two.
 *
 * Scan discipline (careTrackWiring.test.ts): \r\n normalised, every extraction
 * asserted, and each rule carries a negative control against the pre-change
 * source so a scan that matches nothing cannot pass.
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const sharing = readFileSync(path.join(here, "TrustedSharing.tsx"), "utf8").replace(/\r\n/g, "\n");

/** The pre-change call sites, verbatim from main 400424bb. */
const BEFORE = `
      const [mine, toMe] = await Promise.all([
        api.listShares(childProfile.id, { history: true }).catch(() => { aFailed = true; return { shares: [] }; }),
        api.sharedWithMe().catch(() => { bFailed = true; return { shares: [] }; }),
      ]);
      void api.revokeShare(created.id).then(() => load(), () => toast(t("sec.sharing.audit.revokeError"), "error"));
      onDone();
      await load();
      await api.revokeShare(g.id);
      await load();
      <CoParentInvite key={childProfile.id} childId={childProfile.id} childName={childProfile.name} grants={shares} onChanged={load} />
`;

/** Every full roster read (`load()` with no options) in a source. */
const fullLoads = (src: string) => [...src.matchAll(/\bload\(\)/g)].map((m) => src.slice(src.lastIndexOf("\n", m.index!) + 1, src.indexOf("\n", m.index!)).trim());
/** The reload that follows each of the parent's own changes. */
const afterChanges = (src: string) => [
  ...[...src.matchAll(/api\.(?:createShare|revokeShare)\(/g)].map((m) => /(?:await |\.then\(\(\) => )(reloadOwn|load)\(/.exec(src.slice(m.index!, m.index! + 700))?.[1]),
  ...[...src.matchAll(/<CoParentInvite[^>]*onChanged=\{(\w+)\}/g)].map((m) => m[1]),
];

describe("B-INF-16 · the Sharing page re-reads only what a change can move", () => {
  it("the inbound list is read only when the load asks for it", () => {
    const load = /const load = useCallback\(async \(opts: \{ inbound\?: boolean \} = \{\}\) => \{([\s\S]*?)\n  \}, \[childProfile\.id\]\);/.exec(sharing);
    expect(load).toBeTruthy();
    expect(load![1]).toContain("const withInbound = opts.inbound !== false;");
    expect(load![1]).toMatch(/withInbound \? api\.sharedWithMe\(\)/);
    expect(sharing).toContain("const reloadOwn = useCallback(() => load({ inbound: false }), [load]);");
    // Negative control: the pre-change load read both lists every time.
    expect(BEFORE).toMatch(/\n\s+api\.sharedWithMe\(\)\.catch/);
  });

  it("only the first load and Retry read both lists", () => {
    expect(fullLoads(sharing)).toEqual([
      "useEffect(() => { void load(); }, [load]);",
      "onRetry={() => void load()}",
    ]);
    // Negative control: the pre-change source re-read everything after its changes.
    expect(fullLoads(BEFORE)).toHaveLength(3);
  });

  it("every grant, link, revoke, undo and co-parent invite re-reads only the parent's own grants", () => {
    const reloads = afterChanges(sharing);
    // createShare ×2 (grant, home-program link), revokeShare ×2 (undo, revoke), the co-parent invite.
    expect(reloads).toHaveLength(5);
    expect(new Set(reloads)).toEqual(new Set(["reloadOwn"]));
    // Negative control: the pre-change shapes reloaded everything.
    expect(afterChanges(BEFORE)).toEqual(["load", "load", "load"]);
  });
});
