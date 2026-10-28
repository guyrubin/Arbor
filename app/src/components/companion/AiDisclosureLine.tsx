/**
 * B-GA-11 — the EU AI Act Art. 50 first-interaction line, exactly as Talk's
 * composer foot renders it (CompanionComposer: the same `companion.input.foot`
 * key, the same `companion-composer-foot` class: one calm muted line, parent
 * register, never a modal). It goes where a parent's words, voice or photo
 * go to Arbor's AI outside Talk, at the foot of that input.
 *
 * A component because the composer's foot is inline in the composer and
 * cannot be mounted alone; the composer keeps its own line (its source pins
 * in coachCaptureHonesty.test.ts / coachHonesty.test.ts), and
 * aiEntrySurfaces.guard.test.ts keeps the two identical. The approved
 * wordings live in lib/aiEntrySurfaces.ts — never a second disclosure.
 */
import { translate } from "../../lib/i18n";
import "./companionComposer.css";

export default function AiDisclosureLine({ language }: { language: "en" | "he" }) {
  return <p className="companion-composer-foot" data-ai-disclosure="">{translate(language, "companion.input.foot")}</p>;
}
