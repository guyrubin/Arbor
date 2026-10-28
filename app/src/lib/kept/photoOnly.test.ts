/**
 * B-ASKJB-43 — "Text source not verified" stops mislabelling the parent's own
 * capture: a photo-only moment and words the parent typed into Ask carry no
 * such label; Arbor-drafted text still says so.
 */
import { describe, expect, it } from "vitest";
import { translate } from "../i18n";
import type { BehaviorLog } from "../../types";
import { isPhotoOnlyMoment, shownContentSource } from "./photoOnly";
import { composerCaptureKeep, freshCaptureKeep } from "./captureKeep";
import { buildTimeline, signalContentSource } from "../signalTimeline";
import { toObservations } from "../observations";
import { parentWords } from "../recordCounts";

const photoMoment = (caption: string, contentSource?: BehaviorLog["contentSource"]): BehaviorLog => ({
  id: "log-photo", timestamp: "2026-10-20T09:00:00Z", behaviorType: "Moment", trigger: caption, durationMinutes: 0, resolved: true,
  photoAttachment: "data:image/jpeg;base64,AAAA", ...(contentSource ? { contentSource } : {}),
});

describe("B-ASKJB-43 · a photo-only moment has no text-source label", () => {
  for (const lang of ["en", "he"] as const) {
    it(`${lang}: the stored caption is recognised; the label is gone from the timeline, the entry and Moments`, () => {
      const t = (key: string) => translate(lang, key);
      const log = photoMoment(t("elev.capture.photo.caption"), "unverified");
      expect(isPhotoOnlyMoment(log)).toBe(true);
      expect(shownContentSource(log)).toBeUndefined();
      const signal = buildTimeline({ behaviorLogs: [log] })[0];
      expect(signal.contentSource).toBeUndefined();
      expect(signalContentSource(signal, t)).toBe("");
      expect(toObservations({ behaviorLogs: [log] }, { id: "child-a" })[0].source).toBe("parent_typed");
      // The stored lineage is untouched: Arbor's caption is never quoted as the parent's words.
      expect(log.contentSource).toBe("unverified");
      expect(parentWords(log)).toBe("");
    });
  }

  it("NEGATIVE CONTROL: words, notes, no photo or an incident keep the stored label", () => {
    const t = (key: string) => translate("en", key);
    const caption = t("elev.capture.photo.caption");
    for (const log of [
      { ...photoMoment("Built a tower", "unverified") },
      { ...photoMoment(caption, "unverified"), notes: "Pasted from somewhere" },
      { ...photoMoment(caption, "unverified"), photoAttachment: undefined },
      { ...photoMoment(caption, "unverified"), behaviorType: "Sleep Meltdown" },
    ]) {
      expect(isPhotoOnlyMoment(log)).toBe(false);
      const signal = buildTimeline({ behaviorLogs: [log] })[0];
      expect(signalContentSource(signal, t)).toBe(t("kept.capture.source.unverified"));
      expect(toObservations({ behaviorLogs: [log] }, { id: "child-a" })[0].source).toBe("unverified");
    }
  });

  it("Arbor-drafted text still says so, photo or not", () => {
    const t = (key: string) => translate("en", key);
    const drafted = { ...photoMoment("Shoes on after two choices", "ai_draft") };
    expect(signalContentSource(buildTimeline({ behaviorLogs: [drafted] })[0], t)).toBe(t("kept.capture.source.ai_draft"));
    expect(toObservations({ behaviorLogs: [drafted] }, { id: "child-a" })[0].source).toBe("ai_proposed_parent_confirmed");
  });
});

describe("B-ASKJB-43 · Ask's composer: whose words are kept", () => {
  const typeInto = (start: { keep: ReturnType<typeof freshCaptureKeep>; text: string }, ...values: string[]) =>
    values.reduce((s, value) => ({ keep: composerCaptureKeep(s.keep, s.text, value), text: value }), start);
  const empty = { keep: freshCaptureKeep(""), text: "" };

  it("typed or dictated from an empty field: the parent's own words", () => {
    const s = typeInto(empty, "N", "Noa", "Noa said ball");
    expect(s.keep).toMatchObject({ parentWritten: true, text: "Noa said ball" });
  });

  it("a seeded prompt (an outside change) is not the parent's, even after more typing", () => {
    const seeded = { keep: empty.keep, text: "How can I help Noa with bedtime?" }; // set from outside
    const s = typeInto(seeded, "How can I help Noa with bedtime? She cried");
    expect(s.keep.parentWritten).toBe(false);
  });

  it("clearing the field hands it back to the parent; so does the cleared field after Send", () => {
    const seeded = { keep: empty.keep, text: "Arbor's seed" };
    expect(typeInto(seeded, "", "My own words").keep).toMatchObject({ parentWritten: true, text: "My own words" });
    const typed = typeInto(empty, "First message");
    const afterSend = { keep: typed.keep, text: "" }; // Send cleared it from outside
    expect(typeInto(afterSend, "Second message").keep).toMatchObject({ parentWritten: true, text: "Second message" });
  });
});
