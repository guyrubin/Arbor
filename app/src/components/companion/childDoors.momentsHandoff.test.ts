import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

/* v3 F-CHILD-4 (MOB-02) hand-off: Moments closes with My child's doors.

   The mock closes EVERY My child pill with the 2 x 2 doors on a phone (the
   Phone frame: the grid sits inside the pill's home, after its body). This
   lane mounts them on Milestones (#/development, ChildPortrait) and About
   (#/profile, ChildProfile). Moments (#/timeline) is built in the v3-moments
   lane (F-CHILD-2: MomentsBody, mounted by TimelineTab), whose files this
   lane may not edit, so the Moments mount is handed off, and this pin keeps
   the hand-off from being lost:
   - while #/timeline is still the pre-v3 timeline leaf (no MomentsBody), it
     records only that;
   - once MomentsBody is the #/timeline body (the lanes merge), it requires
     the doors after it on a phone, without the journal door: Moments carries
     its own door to the journal.
   ChildDoors stamps no data-module and no primary move (ChildDoors.test), so
   the mount keeps Moments' two modules and its one capture-moment move. */

const source = (path: string): string | null => {
  const url = new URL(path, import.meta.url);
  return existsSync(url) ? readFileSync(url, "utf8") : null;
};
// Comments may name the doors; only code counts.
const code = (src: string) => src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`])\/\/.*$/gm, "$1");

const MOUNT = 'const phone = useChildPhoneLayout(); … {phone && <ChildDoors omit="journal" />} after <MomentsBody … /> in TimelineTab (or at the end of MomentsBody)';

describe("v3 F-CHILD-4 hand-off: Moments on a phone closes with My child's doors", () => {
  it("once MomentsBody is the #/timeline body, the doors follow it on a phone, minus the journal door", () => {
    const timelineSrc = source("../tabs/TimelineTab.tsx");
    expect(timelineSrc, "TimelineTab renders #/timeline").not.toBeNull();
    const timeline = code(timelineSrc!);
    const momentsSrc = source("../moments/MomentsBody.tsx");
    if (momentsSrc === null || !timeline.includes("<MomentsBody")) {
      // Before the v3-moments merge: #/timeline is the pre-v3 leaf, which gets no doors.
      expect(timeline).not.toContain("<ChildDoors");
      return;
    }
    const moments = code(momentsSrc);
    const inTimeline = timeline.includes("<ChildDoors");
    const host = inTimeline ? timeline : moments;
    const tags = host.match(/<ChildDoors\b[^>]*\/>/g) ?? [];
    expect(tags, `F-CHILD-4 hand-off: mount ${MOUNT}`).toHaveLength(1);
    // Moments has its own journal door, so the grid leaves that one out.
    expect(tags[0], "Moments carries its own journal door").toMatch(/omit="journal"/);
    // Phone only, read through the one width seam the other pills use.
    const gate = host.match(/(useChildPhoneLayout\(\)|[A-Za-z_$][\w$]*)\s*&&\s*<ChildDoors\b/);
    expect(gate, "the doors render on a phone only").not.toBeNull();
    if (gate![1] !== "useChildPhoneLayout()") {
      expect(host).toMatch(new RegExp(`const\\s+${gate![1].replace(/\$/g, "\\$")}\\s*=\\s*useChildPhoneLayout\\(\\)`));
    }
    // After the Moments body: below the view, never between the toolbar and the view.
    const at = host.indexOf("<ChildDoors");
    if (inTimeline) expect(at).toBeGreaterThan(timeline.indexOf("<MomentsBody"));
    else expect(at).toBeGreaterThan(moments.lastIndexOf("{...viewModule}"));
  });
});
