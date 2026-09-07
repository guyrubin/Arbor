import { isolate } from "../../lib/i18n";

/**
 * OBJ-BEH-04 / TJB-22 — where the moment happened, in the reader's language.
 *
 * `BehaviorLog.context` is stored as one of four English enum values
 * ("Home" · "School" · "Transit" · "Public"). Every surface printed the stored
 * value: the Behaviors row meta, the expanded context chip, and the patterns
 * card's "Toughest place" tile — so a Hebrew screen read "רגעים קשים מתרכזים
 * ב-home". The enum stays the stored vocabulary (it is the filter key and it
 * reaches the consult packet); only the DISPLAY is localized.
 *
 * A value that is not one of the four is a legacy or free-text context: it is
 * the parent's own word, so it renders verbatim, bidi-isolated so a Hebrew
 * word cannot reorder the sentence it lands in.
 */
const CONTEXT_KEY: Record<string, string> = {
  home: "elev.closeloop.ctx.home",
  school: "elev.closeloop.ctx.school",
  transit: "elev.closeloop.ctx.transit",
  public: "elev.closeloop.ctx.public",
};

export function contextLabel(raw: string | null | undefined, t: (key: string) => string): string {
  const value = String(raw ?? "").trim();
  if (!value) return "";
  const key = CONTEXT_KEY[value.toLowerCase()];
  return key ? t(key) : isolate(value);
}
