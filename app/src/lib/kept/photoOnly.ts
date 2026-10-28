/**
 * B-ASKJB-43 — a photo-only moment has no text whose source is in question.
 *
 * The capture sheet saves a moment with a photo and no words under Arbor's own
 * fixed caption (`elev.capture.photo.caption`, "A photo moment" / "רגע
 * בתמונה"). A photo kept from Ask could carry `contentSource: "unverified"`,
 * so the parent's own photo read "Text source not verified" on the Journal
 * row, the entry sheet, its share card and the Moments evidence line. The
 * stored lineage is left as it is (readers of the parent's own WORDS still
 * fail closed on it); only the text-source LABEL a parent reads is decided
 * here, so old and new photo moments read the same.
 */
import type { BehaviorLog } from "../../types";
import { en as todayEn, he as todayHe } from "../i18nElevation/today";

const PHOTO_CAPTIONS = [todayEn["elev.capture.photo.caption"], todayHe["elev.capture.photo.caption"]]
  .filter(Boolean)
  .map((caption) => caption.trim());

type MomentShape = Pick<BehaviorLog, "behaviorType" | "trigger" | "notes" | "photoAttachment" | "contentSource">;

/** A Moment with a photo whose only text is the app's own photo caption. */
export function isPhotoOnlyMoment(log: Partial<MomentShape> | null | undefined): boolean {
  if (!log || !log.photoAttachment || log.behaviorType !== "Moment") return false;
  if (String(log.notes ?? "").trim()) return false;
  return PHOTO_CAPTIONS.includes(String(log.trigger ?? "").trim());
}

/** The text-source a parent is shown for a log: none for a photo-only moment. */
export function shownContentSource(log: Partial<MomentShape> | null | undefined): BehaviorLog["contentSource"] | undefined {
  if (!log) return undefined;
  return isPhotoOnlyMoment(log) ? undefined : log.contentSource;
}
