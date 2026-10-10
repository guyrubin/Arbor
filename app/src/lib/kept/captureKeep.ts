import type { BehaviorLog } from "../../types";

export type CaptureKeep = {
  text: string;
  parentWritten: boolean;
  typed: boolean;
  selected?: BehaviorLog["kept"];
  manual: boolean;
};

/** Prefills are not evidence of authorship: the composer can contain Arbor
 * seeds, and confirmation does not turn generated text into a child's words. */
export function freshCaptureKeep(text = "", parentWritten = false): CaptureKeep {
  return { text, parentWritten, typed: false, manual: false };
}

/** Only a complete quotation typed into this capture can select Said itself.
 * Apostrophes within words and quotes embedded in a description do not count. */
export function typedCaptureKeep(previous: CaptureKeep, before: string, text: string): CaptureKeep {
  const parentWritten = previous.text === before && (previous.parentWritten || !before.trim());
  const typed = previous.text === before && (previous.typed || !before.trim());
  if (!text.trim()) return freshCaptureKeep(text, true);
  const quotation = text.trim().match(/^(?:"(.+)"|'(.+)'|“(.+)”|‘(.+)’|״(.+)״)$/u);
  const quoted = !!quotation?.slice(1).some(words => words?.trim());
  return {
    text, parentWritten, typed, manual: previous.manual,
    selected: parentWritten ? (previous.manual ? previous.selected : typed && quoted ? "said" : undefined) : undefined,
  };
}

/** No stale selection can follow an extraction, sibling, replaced text or
 * hard-moment toggle into the existing Moment persistence seam. */
export function selectedCaptureKeep(draft: CaptureKeep, text: string, hardMoment: boolean): BehaviorLog["kept"] {
  return !hardMoment && draft.parentWritten && draft.text === text && !!text.trim() ? draft.selected : undefined;
}
