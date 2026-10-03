/**
 * GP-13 — memory review: no edit, no expiry date, danger-toned expiry chip.
 *
 * The surface contract for `memory` promises "Approve, EDIT, or forget", and
 * the server has accepted `{ fact, retention, source }` on the transition since
 * the ledger was written (memory/memoryService.transitionMemory, reachable via
 * PATCH /api/memory/:memoryId). The UI mounted approve / dismiss / forget and
 * nothing else — the flagship trust mechanic let a parent DELETE a fact but not
 * CORRECT one ("she is 3" → "she is 4"). Meanwhile the expiry rendered as
 * `<Chip tone="pink">Time-boxed · {retention}</Chip>`, pink being this row's
 * delete tone: the safest property the ledger has, painted as danger, with no
 * date attached.
 *
 * SOURCE scan (`environment: "node"`). \r\n normalised first; every extraction
 * asserted truthy before it is judged; each rule carries a negative control
 * built from the pre-change source.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { describe, expect, it } from "vitest";

const here = path.dirname(fileURLToPath(import.meta.url));
const read = (rel: string) =>
  readFileSync(path.join(here, "..", "..", rel), "utf8").replace(/\r\n/g, "\n");

const SRC = read("components/sections/ChildMemory.tsx");

/** The MemoryRow component body. */
function memoryRow(src: string): string {
  const start = src.indexOf("export function MemoryRow(");
  return start === -1 ? "" : src.slice(start);
}

/* ── Pre-change source, verbatim ───────────────────────────────────────────── */
const OLD_ROW = `export function MemoryRow({ m, busy, onApprove, onReject, onForget }: {
  m: MemoryReviewItem;
}) {
  const timeBoxed = m.retention && !/permanent|indefinite/i.test(m.retention);
  return (
    <div>
      <p>{m.fact}</p>
      {timeBoxed && <Chip tone="pink">{t("elev.childmem.timeBoxed", { retention: m.retention ?? "" })}</Chip>}
    </div>
  );
}`;

describe("GP-13 negative controls — the matchers reject the pre-change row", () => {
  it("the old row is extracted (so the scan is not vacuous) and fails every rule", () => {
    const row = memoryRow(OLD_ROW);
    expect(row).toBeTruthy();
    expect(row).toMatch(/<Chip tone="pink">/);
    expect(row).not.toMatch(/data-testid="memory-edit-open"/);
    expect(row).not.toMatch(/method: "PATCH"/);
    expect(row).not.toMatch(/forgetsOnIso/);
  });
});

describe("GP-13 — the parent can CORRECT a fact, not only delete it", () => {
  const row = memoryRow(SRC);

  it("the row is found", () => {
    expect(row, "MemoryRow not found in ChildMemory.tsx").toBeTruthy();
    expect(row.length).toBeGreaterThan(800);
  });

  it("mounts an edit control with a fact field and a retention choice", () => {
    expect(row).toContain('data-testid="memory-edit-open"');
    expect(row).toContain('data-testid="memory-edit-fact"');
    expect(row).toContain('data-testid="memory-edit-retention"');
    expect(row).toContain("RETENTION_CHOICES.map");
  });

  it("posts the edit through the EXISTING server transition, keeping the row's status", () => {
    expect(row).toMatch(/fetch\(`\/api\/memory\/\$\{encodeURIComponent\(m\.memoryId\)\}`/);
    expect(row).toMatch(/method: "PATCH"/);
    // status: m.status — correcting an approved fact must not re-queue it.
    expect(row).toMatch(/body: JSON\.stringify\(\{ status: m\.status, fact, retention: retentionDraft \}\)/);
    expect(row).toContain("await authHeaders()");
  });

  it("re-reads the ledger after a successful edit, and says so honestly when it fails", () => {
    expect(row).toMatch(/onEdited\?\.\(\)/);
    expect(row).toContain('t("elev.waveR.mem.saveFailed")');
  });

  it("only the surface that owns the ledger read gets the edit control", () => {
    // MemoryRow is reused by the Story timeline overlay, which passes no
    // onEdited — that surface keeps exactly the controls it had.
    expect(row).toMatch(/\{onEdited && !busy && !editing && \(/);
    expect(SRC).toMatch(/onEdited=\{retryMemoryReview\}/);
  });

  it("keeps 44px targets on the edit form controls", () => {
    expect(row).toMatch(/data-testid="memory-edit-retention"[\s\S]{0,400}?minHeight: 44/);
    expect(row).toMatch(/data-testid="memory-edit-save"[\s\S]{0,800}?minHeight: 44/);
  });
});

describe("GP-13 — the expiry is a DATE in a neutral tone", () => {
  const row = memoryRow(SRC);

  it("no pink chip remains on the row", () => {
    expect(row).toBeTruthy();
    expect(row).not.toMatch(/<Chip tone="pink">/);
    // …and the danger tone is still reserved for the destructive control.
    expect(row).toMatch(/onForget[\s\S]{0,300}?var\(--arbor-pink-ink\)/);
  });

  it("renders the day the fact forgets itself, from the shared helper", () => {
    expect(row).toContain('data-testid="memory-expiry-chip"');
    expect(row).toContain("forgetsOnIso(");
    expect(row).toContain('t("elev.waveR.mem.forgetsOn"');
    expect(row).toMatch(/fmtDay\(forgetsOn, uiLang\)/);
    expect(SRC).toContain('from "../../lib/memoryExpiry"');
  });

  it("a permanent fact says so instead of inventing a date", () => {
    expect(row).toContain("isPermanentRetention(");
    expect(row).toContain('t("elev.waveR.mem.keptUntilForget")');
    expect(row).toMatch(/permanent \|\| !forgetsOn/);
  });

  it("the dead time-boxed string is no longer rendered anywhere on this surface", () => {
    expect(SRC).not.toContain("elev.childmem.timeBoxed");
  });
});

describe("GP-13 — every new control is translated (AI-11 rule holds)", () => {
  const row = memoryRow(SRC);
  it("uses i18n keys, never English literals, for the edit affordances", () => {
    for (const key of [
      "elev.waveR.mem.edit",
      "elev.waveR.mem.edit.aria",
      "elev.waveR.mem.edit.factLabel",
      "elev.waveR.mem.edit.retentionLabel",
      "elev.waveR.mem.save",
      "elev.waveR.mem.cancel",
    ]) {
      expect(row).toContain(`"${key}"`);
    }
  });

  it("the keys exist in BOTH dictionaries", async () => {
    const waveR = await import("../../lib/i18nElevation/waveR");
    expect(Object.keys(waveR.en).length).toBeGreaterThan(0);
    for (const key of Object.keys(waveR.en)) {
      expect(waveR.he[key], `missing HE for ${key}`).toBeTruthy();
    }
    expect(Object.keys(waveR.he).length).toBe(Object.keys(waveR.en).length);
  });
});

/* ── B-CAREPRO-25 — memory review: one group per topic, pending first ─────── */
import { groupPendingMemory, dismissGroup, memoryTopicOf } from "../../lib/memoryGroups";
import { translate } from "../../lib/i18n";
import type { MemoryReviewItem } from "../../types";

/** Prod-shaped queue: 103 pending proposals, no `domains` stamp (they predate
 *  B-GROWTH-29), the repetitive EN + HE wording a chat-fed proposer produces.
 *  SYNTHETIC — the live queue is read by Fable's prod probe, not here. */
const STEMS = [
  "Dylan has a meltdown when it is time to leave the park",
  "Dylan cries at bedtime unless the light stays on",
  "Dylan says new words every week, mostly animal names",
  "Dylan likes playing with friends but grabs toys from his sibling",
  "Dylan is a picky eater and refuses vegetables",
  "Dylan finds loud noise in the dining hall overwhelming",
  "Dylan's teacher says he settles quickly in kindergarten",
  "Dylan asks for the tablet after dinner",
  "Dylan loves dinosaurs and knows all their names",
  "Dylan needs help to focus on homework",
  "דילן בוכה לפני השינה",
  "דילן מדבר במשפטים של שלוש מילים",
  "דילן משחק עם חברים בגן",
];
const PROD_SHAPED: MemoryReviewItem[] = Array.from({ length: 103 }, (_, i) => ({
  memoryId: `m${i}`,
  childId: "c1",
  status: "pending",
  fact: `${STEMS[i % STEMS.length]}${i >= STEMS.length ? ` (${["again", "most days", "this week", "lately"][i % 4]})` : ""}`,
  source: "chat",
  retention: "90 days",
  createdAt: new Date(Date.UTC(2026, 5, 17) + i * 3_600_000).toISOString(),
  latestEventId: `e${i}`,
}));

describe("B-CAREPRO-25 — the pending queue is grouped by topic", () => {
  it("a prod-shaped queue of 103 becomes at most 12 groups; every fact lands in exactly one", () => {
    const groups = groupPendingMemory(PROD_SHAPED);
    expect(groups.length).toBeGreaterThan(1);
    expect(groups.length).toBeLessThanOrEqual(12);
    const ids = groups.flatMap((g) => g.items.map((m) => m.memoryId));
    expect(ids).toHaveLength(103);
    expect(new Set(ids).size).toBe(103);
    // newest first inside a group, and groups ordered by their newest fact
    for (const g of groups) for (let i = 1; i < g.items.length; i++) expect(g.items[i - 1].createdAt >= g.items[i].createdAt).toBe(true);
    for (let i = 1; i < groups.length; i++) expect(groups[i - 1].items[0].createdAt >= groups[i].items[0].createdAt).toBe(true);
  });

  it("topic: the fact's own domains first, else the bilingual keyword table, else other", () => {
    expect(memoryTopicOf({ fact: "anything", domains: ["talking"] })).toBe("talking");
    expect(memoryTopicOf({ fact: "Dylan cries at bedtime" })).toBe("feelings");
    expect(memoryTopicOf({ fact: "דילן מדבר במשפטים" })).toBe("talking");
    expect(memoryTopicOf({ fact: "Dylan loves dinosaurs" })).toBe("other");
    expect(memoryTopicOf({ fact: "x", domains: ["not-a-domain"] })).toBe("other");
  });

  it("Dismiss all writes ONE reject per fact (ledger: one event per fact); no bulk approve exists", async () => {
    const [g] = groupPendingMemory(PROD_SHAPED).filter((x) => x.items.length > 1);
    const calls: string[] = [];
    const n = await dismissGroup(g, (id, status) => { calls.push(`${id}:${status}`); });
    expect(n).toBe(g.items.length);
    expect(calls).toEqual(g.items.map((m) => `${m.memoryId}:rejected`));
    // a failing transition does not skip the rest
    const seen: string[] = [];
    await dismissGroup(g, (id) => { seen.push(id); if (seen.length === 1) throw new Error("x"); });
    expect(seen).toHaveLength(g.items.length);
    // G6: the group card has no approve-all path
    expect(SRC).not.toMatch(/approveAll|approve-all|dismissGroup\([^)]*"approved"/);
  });

  it("the page renders groups: heading counts groups, lav tone, the newest row + See all + Dismiss all (confirmed)", () => {
    expect(SRC).toContain("groupPendingMemory(pendingQueue)");
    expect(SRC).toMatch(/"elev\.childmem\.pending\.groups"/);
    expect(SRC).not.toMatch(/elev\.childmem\.pending\.title", \{ count: pendingQueue\.length \}/);
    const pendingCard = /data-module="memory-pending"[\s\S]*?<\/SectionCard>/.exec(SRC)?.[0] ?? "";
    expect(pendingCard, "pending card extracted").not.toBe("");
    expect(pendingCard).toContain('tone="lav"');
    expect(pendingCard).not.toContain('tone="yellow"');
    const card = SRC.slice(SRC.indexOf("export function PendingGroupCard("), SRC.indexOf("export function MemoryRow("));
    expect(card).toContain("group.items.slice(0, 1)");
    expect(card).toContain('data-testid="memory-group-see-all"');
    expect(card).toContain('data-testid="memory-group-dismiss-confirm"');
    expect(card).toContain("dismissGroup(group");
    expect((card.match(/className="touch-target/g) ?? []).length).toBe(4);
  });

  it("every group string exists in EN and HE", () => {
    const keys = ["pending.groups", "pending.groups.one", "group.other", "group.similar", "group.seeAll", "group.seeLess", "group.dismissAll", "group.dismissConfirm", "group.dismissYes", "group.cancel"];
    for (const k of keys) {
      const key = `elev.childmem.${k}`;
      expect(translate("en", key), key).not.toBe(key);
      expect(translate("he", key), key).not.toBe(key);
      expect(translate("he", key)).not.toBe(translate("en", key));
    }
    expect(translate("en", "elev.childmem.group.similar", { n: 4 })).toBe("4 similar notes");
    expect(translate("he", "elev.childmem.group.similar", { n: 4 })).toBe("4 הערות דומות");
  });
});
