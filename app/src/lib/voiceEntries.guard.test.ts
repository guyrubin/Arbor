/**
 * B-VOICE-04 — the guard walks every voice entry: every microphone opening in
 * the source is registered with the review it folds into (lib/voiceEntries),
 * that review still shows in source, and no voice path writes before the
 * parent's Confirm. Old code fails the registry clause (no registry existed)
 * and the next-step clause (the closing review offered no step to keep).
 */
import { describe, expect, it } from "vitest";
import { readFileSync, readdirSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { VOICE_ENTRIES, VOICE_IMPLEMENTATIONS } from "./voiceEntries";

const SRC = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const walk = (dir: string, acc: string[] = []): string[] => {
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) walk(full, acc);
    else if (/\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name)) acc.push(full);
  }
  return acc;
};
const rel = (f: string) => path.relative(SRC, f).split(path.sep).join("/");
const read = (r: string) => readFileSync(path.join(SRC, r), "utf8").replace(/\r\n/g, "\n");
const code = (t: string) => t.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");

/** A microphone opening: dictation, the hands-free loop, Live, or a raw stream with audio. */
const opensMic = (src: string): boolean =>
  /\b(?:startDictation|createDictationLoop|startGeminiLive)\(/.test(src)
  || [...src.matchAll(/getUserMedia\(([^)]*)\)/g)].some((m) => !/audio:\s*false/.test(m[1]));

const FILES = walk(SRC).map((f) => ({ file: rel(f), code: code(readFileSync(f, "utf8").replace(/\r\n/g, "\n")) }));

describe("B-VOICE-04 · every voice entry is registered with its review", () => {
  const openers = FILES.filter((f) => opensMic(f.code) && !VOICE_IMPLEMENTATIONS.includes(f.file)).map((f) => f.file).sort();

  it("the scan is not vacuous", () => {
    expect(openers).toContain("components/tabs/CoachTab.tsx");
    expect(openers).toContain("components/overview/QuickLogModal.tsx");
    expect(openers.length).toBeGreaterThanOrEqual(5);
  });

  it("the files that open the microphone are exactly the registered entries (no unreviewed entry, no stale row)", () => {
    expect(openers).toEqual(Object.keys(VOICE_ENTRIES).sort());
  });

  it("negative control: a new dictation door is caught; a camera-only stream is not a voice entry", () => {
    expect(opensMic("const stop = startDictation({ onResult: t => save(t) });")).toBe(true);
    expect(opensMic("navigator.mediaDevices.getUserMedia({ audio: true })")).toBe(true);
    expect(opensMic("navigator.mediaDevices.getUserMedia({ video: { facingMode: \"user\" }, audio: false })")).toBe(false);
  });

  for (const [file, entry] of Object.entries(VOICE_ENTRIES)) {
    it(`${file} → ${entry.review}: the review still shows in source`, () => {
      for (const [evFile, needles] of Object.entries(entry.evidence)) {
        const src = read(evFile);
        for (const needle of needles) expect(src, `${evFile} lost "${needle}"`).toContain(needle);
      }
    });
  }
});

describe("B-VOICE-04 · no voice-originated write before the parent's Confirm", () => {
  it("Talk: a draft is committed ONLY inside the tray's onConfirm, the next step ONLY on the parent's tap", () => {
    const src = code(read("components/tabs/CoachTab.tsx"));
    expect(src.split("commitConversationProposal(").length - 1).toBe(1);
    const confirm = src.indexOf("onConfirm={async (proposal)");
    expect(confirm).toBeGreaterThan(-1);
    expect(src.indexOf("commitConversationProposal(")).toBeGreaterThan(confirm);
    // The next step reaches today's list through ONE function, called from ONE prop.
    expect(src.split("keepVoiceNextStep()").length - 1).toBe(1);
    const keep = src.slice(src.indexOf("const keepVoiceNextStep"), src.indexOf("const keepVoiceNextStep") + 600);
    expect(keep).toContain("acceptTodayAction(step, \"standard\", \"coach\")");
    // Derivation never writes: the extraction path sets drafts only.
    const deriveAt = src.indexOf("const deriveConversationProposals");
    const derive = src.slice(deriveAt, src.indexOf("api.liveAvailability()", deriveAt));
    expect(derive).toContain("normalizeConversationProposals(");
    expect(derive).not.toMatch(/commitConversationProposal|acceptTodayAction|\.upsert\(|addMoment\(/);
  });

  it("the capture sheet: a dictation result fills the field and drafts, it never saves", () => {
    const src = code(read("components/overview/QuickLogModal.tsx"));
    const start = src.indexOf("const startVoice = () =>");
    const onResult = src.slice(start, src.indexOf("onInterim:", start));
    expect(onResult).toContain("setNewLogTrigger(said)");
    expect(onResult).not.toMatch(/addMoment\(|addLog\(|\.upsert\(|saveMoment\(|confirm\(/);
  });

  it("the composer: dictation only changes the draft", () => {
    const src = code(read("components/companion/CompanionComposer.tsx"));
    const dictate = src.slice(src.indexOf("const dictate = () =>"), src.indexOf("const send = async"));
    expect(dictate).not.toMatch(/keep\(|send\(|onSend\(|\.upsert\(/);
  });

  it("Tell Arbor: the mic button writes nothing", () => {
    expect(code(read("components/describe/DescribeChild.tsx"))).not.toMatch(/updateChild\(|\.upsert\(|setMilestoneObservation\(|addMoment\(/);
  });
});
