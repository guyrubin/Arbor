import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";

const source = readFileSync(path.resolve(__dirname, "MilestonesTab.tsx"), "utf8");

describe("B-ASKJB-36: Milestones uses the guarded shared saved-note row", () => {
  it("pairs the existing writer with one read-only history owner", () => {
    expect(source).toContain('useChildCollection<KeepsakeDoc>(childProfile.id, "keepsakes")');
    expect(source).toContain('useMilestoneKeptNotes(childProfile.id, milestones, keepsakeCol)');
    expect(source.match(/useMilestoneKeptNotes\(childProfile/g)).toHaveLength(1);
    expect(source).toContain('<MilestoneKeptStatus history={keptNotes} />');
  });

  it("uses the shared row for custom, catalogue and current Notice paths", () => {
    expect(source).toContain('<MilestoneKeptNote');
    expect(source).toContain('item={keptNotes.rows.get(item.id)}');
    expect(source).toContain('beforeExport={keptNotes.beforeExport}');
    expect(source).toContain('{renderKeepsake(item)}');
    expect(source).toContain('{renderKeepsake(m)}');
    expect(source).toContain('{renderKeepsake(card)}');
    expect(source).not.toContain('{keepsakes[item.id].note}');
  });

  it("keeps the existing save, remove, photo editor and route without a new write sink", () => {
    expect(source).toContain('<FirstKeepsakeSheet');
    expect(source).toContain('onSave={saveKeepsake}');
    expect(source).toContain('onRemove={() => { if (openKeepsake) dropKeepsake(openKeepsake.id); }}');
    expect(source).toContain('keepsakeCol.upsert(keepsakeDoc(next[draft.milestoneId]))');
    expect(source).toContain('keepsakeCol.remove(milestoneId)');
    expect(source).toContain('onKeepPhoto={() => setKeepsakeFor(m.id)}');
    expect(source).toContain('onKeepPhoto={() => setKeepsakeFor(card.id)}');
  });
});
