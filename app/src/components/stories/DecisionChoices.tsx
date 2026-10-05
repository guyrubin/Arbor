/**
 * DecisionChoices — B-KID-53 (F-2): the Decision page's choice list.
 *
 * Fable's rendered pass (375 px): a choice's marker printed the model's id
 * (uppercase) in a 28 px badge; a model id can be a whole sentence, so it ran
 * across the label, and two choices with the same text logged duplicate React
 * keys. Now the marker is the choice's POSITION (A/B/C, א/ב/ג), the label
 * column takes the rest of the row and wraps, each row is at least 44 px tall,
 * and the key is the position — never the text or the model's id. Logical
 * layout only (flex + text-start), so RTL mirrors without a branch.
 */
import type { HeroChoiceRender } from "../../types";

const MARKS: Record<"en" | "he", readonly string[]> = {
  en: ["A", "B", "C", "D"],
  he: ["א", "ב", "ג", "ד"],
};

export function DecisionChoices({
  choices,
  lang,
  onChoose,
}: {
  choices: readonly HeroChoiceRender[];
  lang: "en" | "he";
  onChoose: (id: string) => void;
}) {
  return (
    <>
      {choices.map((c, i) => (
        <button
          key={`choice-${i}`}
          type="button"
          data-testid="decision-choice"
          onClick={() => onChoose(c.id)}
          className="w-full min-h-[44px] text-start p-3.5 rounded-2xl transition flex items-start gap-3 group hover:-translate-y-0.5"
          style={{ background: "var(--arbor-paper-deep)", border: "1px solid var(--arbor-rule)" }}
        >
          <span
            aria-hidden="true"
            className="w-7 h-7 rounded-full font-extrabold flex items-center justify-center flex-shrink-0"
            style={{ background: "var(--arbor-green-soft)", color: "var(--arbor-green-ink)" }}
          >
            {MARKS[lang][i] ?? String(i + 1)}
          </span>
          <span
            dir="auto"
            className="min-w-0 flex-1 text-sm font-medium break-words"
            style={{ color: "var(--arbor-ink)", overflowWrap: "anywhere" }}
          >
            {c.label}
          </span>
        </button>
      ))}
    </>
  );
}
