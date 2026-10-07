import { describe, expect, it } from "vitest";
import {
  DEMO_HEADER_KEY,
  INTAKE_AUDIENCE,
  INTAKE_PROFESSIONS,
  buildIntakePacket,
  intakeDomains,
  isConsultPacketEmpty,
  serializeForExport,
  type IntakePacketInput,
} from "./packet";
import { ALL_MILESTONES } from "../lib/milestoneData";
import { milestoneAgeLine } from "../lib/milestoneAgeLine";
import { milestoneShelf } from "../lib/shelves/registry";
import { translate } from "../lib/i18n";
import { loopFirewallHits } from "../lib/loop/firewall";
import type { BehaviorLog, Milestone } from "../types";
import type { ActionLoopEntry } from "../actionLoop/model";

/* B-LOOP-12 — buildIntakePacket(profession): only the domains the profession
   owns in the registry; "not seen yet" rows carry the sourced age line and no
   count; the redaction step removes a line before egress; the demo header
   and the standing non-diagnostic line lead the egress text; no firewall
   word, no %. EN + HE. */

const NOW = Date.parse("2026-10-06T12:00:00Z");
const shelfIs = (shelf: string) => (m: Milestone) => {
  try {
    return milestoneShelf(m) === shelf;
  } catch {
    return false;
  }
};
const words24 = ALL_MILESTONES.filter((m) => shelfIs("words")(m) && m.ageMonths === 24 && milestoneAgeLine(m, (k, v) => translate("en", k, v)));
const seenTalk = { ...words24[0], checked: true, observationStatus: "yes", observedAt: "2026-09-14T09:00:00Z", observationUpdatedAt: "2026-09-14T09:00:00Z" } as Milestone;
const notYetTalk = { ...words24[1], checked: false, observationStatus: "not_yet", observationUpdatedAt: "2026-10-01T09:00:00Z" } as Milestone;
const moving = ALL_MILESTONES.find(shelfIs("moving"))!;
const seenMove = { ...moving, checked: true, observationStatus: "yes", observedAt: "2026-09-20T09:00:00Z", observationUpdatedAt: "2026-09-20T09:00:00Z" } as Milestone;
const log = (id: string, trigger: string, at: string, extra: Partial<BehaviorLog> = {}): BehaviorLog =>
  ({ id, behaviorType: "A moment", trigger, timestamp: at, context: "home", ...extra }) as BehaviorLog;
const dose = (id: string, shelf: "words" | "moving", at: string): ActionLoopEntry =>
  ({ id, recommendation: "x", source: "practice", capacity: "tiny", status: "completed", acceptedAt: at, practiceId: `p-${id}`, shelf }) as ActionLoopEntry;

const input = (over: Partial<IntakePacketInput> = {}): IntakePacketInput => ({
  child: { id: "c1", name: "Dylan Demo", age: 3, demo: true, gender: "boy" },
  milestones: [seenTalk, notYetTalk, seenMove],
  behaviorLogs: [
    log("w1", "Said big ball at the park", "2026-09-29T08:00:00Z", { shelf: "words" }),
    log("m1", "Climbed the slide ladder alone", "2026-10-02T08:00:00Z", { shelf: "moving" }),
    log("f1", "Cried at drop-off", "2026-10-03T08:00:00Z"),
  ],
  actionLoops: [dose("d1", "words", "2026-10-01T08:00:00Z"), dose("d2", "words", "2026-10-03T08:00:00Z"), dose("d3", "moving", "2026-10-03T08:00:00Z")],
  questions: ["Should we worry about the lisp?", "  "],
  comparisonMonths: 30,
  nowMs: NOW,
  ...over,
});
const allText = (p: ReturnType<typeof buildIntakePacket>) => p.sections.flatMap((s) => [s.title, s.note ?? "", ...s.items.map((i) => i.text)]).join("\n");

describe("buildIntakePacket — one profession's domains only", () => {
  it('"slp" carries the talking domain only (the registry owner)', () => {
    expect(intakeDomains("slp")).toEqual(["talking"]);
    const p = buildIntakePacket("slp", input());
    const ids = p.sections.flatMap((s) => s.items.map((i) => i.id));
    expect(ids).toContain(`intake-seen-${seenTalk.id}`);
    expect(ids).toContain(`intake-notyet-${notYetTalk.id}`);
    expect(ids).toContain("intake-moment-w1");
    expect(ids).toContain("intake-practice-words");
    expect(ids).not.toContain(`intake-seen-${seenMove.id}`);
    expect(ids).not.toContain("intake-moment-m1");
    expect(ids).not.toContain("intake-moment-f1");
    expect(ids).not.toContain("intake-practice-moving");
    expect(p.sections.map((s) => s.id)).toEqual(["intake-seen", "intake-not-yet", "intake-moments", "intake-practice", "intake-questions"]);
  });

  it("every chip resolves to registry domains and an existing consult audience", () => {
    expect(intakeDomains("pt")).toEqual(["moving"]);
    expect(intakeDomains("ot")).toEqual(["hands"]);
    expect(intakeDomains("pediatrician")).toEqual(["moving", "body"]);
    expect(intakeDomains("psychology")).toEqual(["thinking", "playing", "feelings"]);
    for (const p of INTAKE_PROFESSIONS) expect(["slp", "therapist", "pediatrician", "behavioral_health"]).toContain(INTAKE_AUDIENCE[p]);
    const pt = buildIntakePacket("pt", input());
    expect(pt.sections.flatMap((s) => s.items.map((i) => i.id))).toEqual([`intake-seen-${seenMove.id}`, "intake-moment-m1", "intake-practice-moving", "intake-question-0"]);
  });

  it('"not seen yet" rows carry the sourced age line and no count (EN + HE)', () => {
    for (const lang of ["en", "he"] as const) {
      const p = buildIntakePacket("slp", input({ lang }));
      const nyt = p.sections.find((s) => s.id === "intake-not-yet")!;
      const age = milestoneAgeLine(notYetTalk, (k, v) => translate(lang, k, v))!;
      expect(nyt.items).toHaveLength(1);
      expect(nyt.items[0].text).toContain(age);
      expect(translate(lang, nyt.noteKey!)).not.toMatch(/\d/);
      expect(translate(lang, nyt.titleKey!)).not.toMatch(/\d/);
    }
  });

  it("dates, words and practice days read as written; practice is a count of DAYS", () => {
    const p = buildIntakePacket("slp", input());
    const day = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "short", year: "numeric" }).format(Date.parse("2026-09-29T08:00:00Z"));
    expect(p.sections.find((s) => s.id === "intake-moments")!.items[0].text).toBe(`“Said big ball at the park” · ${day}`);
    expect(p.sections.find((s) => s.id === "intake-practice")!.items[0].text).toBe(translate("en", "elev.packet.intake.practiceLine", { shelf: "Words", n: 2, days: 30 }));
    expect(p.sections.find((s) => s.id === "intake-questions")!.items.map((i) => i.text)).toEqual(["Should we worry about the lisp?"]);
  });

  it("egress: the demo header and the standing non-diagnostic line lead; the redaction step removes a line; no firewall word, no %", () => {
    for (const lang of ["en", "he"] as const) {
      const p = buildIntakePacket("slp", input({ lang }));
      expect(p.demo).toBe(true);
      const text = serializeForExport("self", p, new Set(), "", "Parent note", lang);
      expect(text).toContain(translate(lang, DEMO_HEADER_KEY));
      expect(text).toContain(translate(lang, "elev.packet.prepared", { date: "2026-10-06" }));
      expect(text).toContain("Said big ball at the park");
      const redacted = serializeForExport("self", p, new Set(["intake-moment-w1"]), "", "Parent note", lang);
      expect(redacted).not.toContain("Said big ball at the park");
      expect(loopFirewallHits(allText(p))).toEqual([]);
      expect(text).not.toMatch(/%/);
    }
    const real = buildIntakePacket("slp", input({ child: { id: "c2", name: "Noa", age: 3 } }));
    expect(real.demo).toBeUndefined();
    expect(serializeForExport("self", real)).not.toContain(translate("en", DEMO_HEADER_KEY));
  });

  it("an empty record builds an empty packet (the consult empty state, never a blank export)", () => {
    const p = buildIntakePacket("ot", input({ milestones: [], behaviorLogs: [], actionLoops: [], questions: [] }));
    expect(p.sections).toEqual([]);
    expect(isConsultPacketEmpty(p)).toBe(true);
  });
});

/* P5-LOOP c2 r2 (journal product P1 G1-3, B-LOOP-NEW-2c/2d): the SLP packet
   opens with the child's own kept words; the OT packet never carries them;
   the prepared line names the home languages. */
describe("buildIntakePacket — the child's kept quotes lead the SLP Moments (c2 r2)", () => {
  const quotes = [
    { id: "quote-2026-10-04-a", note: "big ball!", noticedOn: "2026-10-04" },
    { id: "quote-2026-08-01-b", note: "too old for the window", noticedOn: "2026-08-01" },
  ];
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: a Words-shelf quote keepsake is the FIRST SLP moment, quoted and dated in the locale; the OT packet does not include it`, () => {
      const slp = buildIntakePacket("slp", input({ quotes, lang, child: { id: "c1", name: "Dylan Demo", age: 3, gender: "boy", languages: ["English (Native)", "Hebrew"] } }));
      const moments = slp.sections.find((s) => s.id === "intake-moments")!.items.map((i) => i.text.replace(/[⁨⁩]/g, ""));
      const day = new Intl.DateTimeFormat(lang === "he" ? "he-IL" : "en-GB", { day: "numeric", month: "short", year: "numeric" }).format(Date.parse("2026-10-04T12:00:00"));
      expect(moments[0]).toContain("big ball!");
      expect(moments[0]).toContain(day);
      expect(moments[0]).toContain(lang === "he" ? "Dylan אמר:" : "Dylan said:");
      expect(moments[0]).not.toContain("/");
      // the parent's note still follows; the out-of-window quote is not there
      expect(moments.some((m) => m.includes("Said big ball at the park"))).toBe(true);
      expect(moments.join("\n")).not.toContain("too old for the window");
      // the OT packet: no Words shelf, no quote
      const ot = buildIntakePacket("ot", input({ quotes, lang }));
      expect(allText(ot)).not.toContain("big ball!");
      // home languages, localized, on the packet (ProView's prepared line)
      expect(slp.languages).toHaveLength(2);
      expect(slp.languages!.join(" ")).not.toMatch(/elev\.|ob\.lang\./);
      expect(loopFirewallHits(allText(slp))).toEqual([]);
    });
  }
  it("no languages on the profile → no languages field (never an empty 'Home languages:')", () => {
    expect(buildIntakePacket("slp", input()).languages).toBeUndefined();
  });
});
