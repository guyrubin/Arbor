import React from "react";
import { Modal } from "../ui/Modal";
import { Icon } from "../ui/Icon";

/**
 * B-ASKJB-12 — "How should Arbor talk with you?" The #/scholar library and
 * Ask's "Perspective: … · change" radiogroup retire into ONE sheet. Each
 * choice writes a lens id — the same `selectedLens` value (localStorage
 * `arbor.lens` → `scholarLens` → prompt) the radiogroup wrote, so the lens
 * capability is unchanged; only the vocabulary is the parent's.
 *
 * Every one of the 8 lens ids stays selectable: four plain-language tones,
 * then "More approaches" with the other four, each with one keyed sentence
 * (derived from the roster's `useWhen`). Scholar names render through keys,
 * so the Hebrew sheet carries no Latin body copy.
 *
 * ONE component, ONE store: B-PLAY-21 (Family + Settings) renders this same
 * sheet and writes the same `selectedLens`.
 */

/** The four plain-language tones → lens ids (the definition of record). */
export const TONE_CHOICES = [
  { id: "warm", lens: "Integrated Balanced", labelKey: "coach.tone.warm", subKey: "coach.tone.warm.sub" },
  { id: "steps", lens: "Lev Vygotsky", labelKey: "coach.tone.steps", subKey: "coach.tone.steps.sub" },
  { id: "connection", lens: "John Bowlby", labelKey: "coach.tone.connection", subKey: "coach.tone.connection.sub" },
  { id: "why", lens: "Jean Piaget", labelKey: "coach.tone.why", subKey: "coach.tone.why.sub" },
] as const;

/** "More approaches": the remaining lens ids, each with one keyed sentence. */
export const MORE_APPROACHES = [
  { slug: "winnicott", lens: "Donald Winnicott" },
  { slug: "montessori", lens: "Maria Montessori" },
  { slug: "bronfenbrenner", lens: "Urie Bronfenbrenner" },
  { slug: "erikson", lens: "Erik Erikson" },
] as const;

/** Every lens id the sheet can write (8). */
export const TONE_LENS_IDS: readonly string[] = [...TONE_CHOICES.map((c) => c.lens), ...MORE_APPROACHES.map((m) => m.lens)];

type T = (key: string, vars?: Record<string, string | number>) => string;

/** What the "Tone: {choice}" control in the identity strip reads for a lens id. */
export function toneLabel(lens: string, t: T): string {
  const tone = TONE_CHOICES.find((c) => c.lens === lens);
  if (tone) return t(tone.labelKey);
  const more = MORE_APPROACHES.find((m) => m.lens === lens);
  if (more) return t(`coach.tone.name.${more.slug}`);
  return t("coach.tone.warm");
}

export default function ToneSheet({ open, onClose, selectedLens, onSelect, t }: {
  open: boolean;
  onClose: () => void;
  selectedLens: string;
  onSelect: (lens: string) => void;
  t: T;
}) {
  const pick = (lens: string) => { onSelect(lens); onClose(); };
  // One radiogroup over all 8 lens ids; arrow keys move the selection (the
  // radiogroup a11y the retired Perspective row carried), Enter/tap closes.
  const current = TONE_LENS_IDS.indexOf(selectedLens);
  const onKeyDown = (e: React.KeyboardEvent) => {
    const dir = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!dir) return;
    e.preventDefault();
    const next = ((current < 0 ? 0 : current) + dir + TONE_LENS_IDS.length) % TONE_LENS_IDS.length;
    onSelect(TONE_LENS_IDS[next]);
  };
  const row = (key: string, lens: string, title: string, sub: string) => {
    const on = selectedLens === lens;
    return (
      <button
        key={key}
        type="button"
        role="radio"
        aria-checked={on}
        tabIndex={on || (current < 0 && lens === TONE_LENS_IDS[0]) ? 0 : -1}
        data-tone-lens={lens}
        onClick={() => pick(lens)}
        className="w-full min-h-11 rounded-xl px-3.5 py-2.5 text-start flex items-start gap-2.5 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
        style={on
          ? { background: "var(--arbor-green-soft)", border: "1px solid var(--arbor-green-ink)", color: "var(--arbor-ink)" }
          : { background: "var(--arbor-paper-elevated)", border: "1px solid var(--arbor-rule)", color: "var(--arbor-ink)" }}
      >
        <span className="mt-0.5 flex-shrink-0" style={{ color: on ? "var(--arbor-green-ink)" : "var(--arbor-muted)" }} aria-hidden>
          {on ? <Icon name="check_circle" size={16} /> : <span className="inline-block w-4 h-4 rounded-full" style={{ border: "1.5px solid var(--arbor-rule-strong)" }} />}
        </span>
        <span className="min-w-0">
          <span className="block text-[13px] font-extrabold">{title}</span>
          <span className="block text-[12px] leading-snug mt-0.5" style={{ color: "var(--arbor-muted)" }}>{sub}</span>
        </span>
      </button>
    );
  };
  return (
    <Modal open={open} onClose={onClose} title={t("coach.tone.title")} maxWidth="max-w-md">
      <div data-testid="tone-sheet" className="space-y-2" role="radiogroup" aria-label={t("coach.tone.title")} onKeyDown={onKeyDown}>
        {TONE_CHOICES.map((c) => row(c.id, c.lens, t(c.labelKey), t(c.subKey)))}
        <p className="pt-2 text-[11px] font-extrabold uppercase tracking-wider" style={{ color: "var(--arbor-muted)" }}>{t("coach.tone.more")}</p>
        {MORE_APPROACHES.map((m) => row(m.slug, m.lens, t(`coach.tone.name.${m.slug}`), t(`coach.tone.more.${m.slug}`)))}
      </div>
    </Modal>
  );
}
