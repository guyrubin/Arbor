import type { Observation, ObservationSources } from "../../lib/observations";
import { AGE_BANDS } from "../../lib/screening";
import { translate } from "../../lib/i18n";
import { PORTRAIT_COPY } from "./portraitCopy";

export type EvidenceLine = { label: string; text: string };

const activities: Record<string, [string, string]> = {
  "emotion-id": ["Naming feelings", "לתת שם לרגשות"], "emotion-why": ["Exploring feelings", "להכיר רגשות"],
  calm: ["Calm breathing", "נשימה מרגיעה"], memory: ["Memory game", "משחק זיכרון"],
  "vocab-naming": ["Naming words", "לקרוא לדברים בשם"], "vocab-category": ["Sorting words", "למיין מילים"],
  expressive: ["Sharing a story", "לספר סיפור"], phonics: ["Letters and sounds", "אותיות וצלילים"],
  "sight-word": ["Recognising a word", "לזהות מילה"], "letter-trace": ["Tracing letters", "לעקוב אחרי אותיות"],
  rhythm: ["Keeping a beat", "לשמור על הקצב"], pattern: ["Finding a pattern", "למצוא דפוס"],
  pose: ["Copying a pose", "לחקות תנוחה"], "lang-strategy": ["Language together", "זמן שפה יחד"],
  "mood-checkin": ["A feeling the child chose", "רגש שהילד בחר"], "stop-signal": ["Sneak & Freeze", "להתגנב ולקפוא"],
};

/** Original descriptive fields only. Legacy practice scores, ratings and
 * clinical bands deliberately never enter this parent-facing projection. */
export function portraitEvidenceLines(observation: Observation, sources: ObservationSources, he: boolean): EvidenceLine[] {
  const c = PORTRAIT_COPY[he ? "he" : "en"];
  const id = observation.id.slice(observation.origin.length + 1);
  const lines: EvidenceLine[] = [];
  const add = (label: string, value: string | number | undefined) => { if (value !== undefined && String(value).trim()) lines.push({ label, text: String(value) }); };
  if (observation.origin === "behaviorLogs") {
    const row = sources.behaviorLogs?.find(item => item.id === id);
    add(c.response, row?.response); add(c.notes, row?.notes); add(c.resolution, row?.resolutionNotes);
    if (row?.behaviorType !== "Moment") { add(c.intensity, row?.intensity); add(c.duration, row?.durationMinutes); }
  }
  const value = observation.value;
  if (value.type === "measurement") { add(c.height, value.heightCm); add(c.weight, value.weightKg); add(c.head, value.headCircumferenceCm); }
  if (value.type === "word") add(c.language, value.language);
  if (observation.origin === "actionLoops") add(c.activity, sources.actionLoops?.find(item => item.id === id)?.recommendation);
  if (observation.origin === "speechAttempts") {
    const row = sources.speechAttempts?.find(item => item.id === id);
    add(c.target, row?.target);
  }
  if (observation.origin === "practiceEvents") {
    const row = sources.practiceEvents?.find(item => item.id === id);
    const label = row && activities[row.kind];
    if (label) add(c.activity, label[he ? 1 : 0]);
    add(c.observation, row?.emotion);
  }
  if (observation.origin === "screenings") {
    const row = sources.screenings?.find(item => item.id === id);
    if (row?.answers && Object.keys(row.answers).length) {
      const items = AGE_BANDS.find(band => band.id === row.bandId)?.items ?? [];
      for (const [answerId, answer] of Object.entries(row.answers)) {
        const item = items.find(value => value.id === answerId);
        add(item ? translate(he ? "he" : "en", `screen.item.${item.id}`) : answerId, answer === "yes" ? c.answerYes : answer === "sometimes" ? c.answerSometimes : c.answerNotYet);
      }
    } else add(c.savedAnswer, c.noSavedAnswers);
  }
  return lines;
}

export interface ReviewedPortraitSource { childId: string; id: string; at: string; source: string; text: string }
/** Only individually selected records become a visible, editable draft.
 * No send, model call, saved memory or persistent family question occurs here. */
export function reviewedPortraitDraft(prompt: string, childId: string, sources: readonly ReviewedPortraitSource[], he: boolean): string {
  const c = PORTRAIT_COPY[he ? "he" : "en"];
  const chosen = sources.filter(source => source.childId === childId).slice(0, 5);
  if (!chosen.length) return prompt;
  const excerpts = chosen.map(source => {
    const text = source.text.length > 500 ? `${source.text.slice(0, 500)}… (${c.excerpt})` : source.text;
    return `${c.source}: ${source.source.slice(0, 80)} · ${c.date}: ${source.at.slice(0, 30)}\n${c.recordId}: ${source.id.slice(0, 100)}\n${JSON.stringify(text)}`;
  });
  return `${prompt.slice(0, 350)}\n\n${c.draftHeading}\n\n${excerpts.join("\n\n")}\n\n${c.draftEnd}`.slice(0, 4000);
}
