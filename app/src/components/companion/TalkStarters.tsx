import React from "react";
import { fmtDayV10 } from "../../lib/formatDate";
import type { TalkStarter } from "../../lib/talkStarters";
import { Icon } from "../ui/Icon";
import { talkCopy } from "./talkViewCopy";

const KIND_ICON = { hard: "favorite", kept: "bolt", note: "edit_note" } as const;

/**
 * V77 (N-Talk-D/M, empty state): "What's on your mind?" starts from the
 * parent's own records. Each card is the record's own words, its kind (the one
 * kind palette) and its day; the last card is "Something else". A card FILLS
 * the composer with the parent's words (the family-question chip's path) and
 * never sends: the parent reads, edits and sends. No prompt or model change.
 */
export default function TalkStarters({ starters, lang, disabled, onPick, onElse }: {
  starters: readonly TalkStarter[];
  lang: "en" | "he";
  disabled?: boolean;
  onPick: (from: HTMLElement, words: string) => void;
  onElse: (from: HTMLElement) => void;
}) {
  const copy = talkCopy(lang);
  const kindLabel = { hard: copy.starterHard, kept: copy.starterKept, note: copy.starterNote } as const;
  return (
    <div className="talk-starters" data-testid="talk-starters">
      <p className="talk-starters-lead">{copy.startersLabel}</p>
      <div className="talk-starters-grid" role="group" aria-label={copy.startersLabel}>
        {starters.map((s) => (
          <button
            key={s.id}
            type="button"
            className={`talk-starter touch-target k-${s.kind}`}
            data-testid="talk-starter"
            data-kind={s.kind}
            disabled={disabled}
            onClick={(event) => onPick(event.currentTarget, s.words)}
          >
            <span className="talk-starter-glyph" aria-hidden="true"><Icon name={KIND_ICON[s.kind]} size={18} /></span>
            <span className="talk-starter-text">
              <bdi dir="auto" className="talk-starter-words">{s.words}</bdi>
              <small>{kindLabel[s.kind]} · {fmtDayV10(s.at, lang)}</small>
            </span>
          </button>
        ))}
        <button type="button" className="talk-starter touch-target k-else" data-testid="talk-starter-else" disabled={disabled} onClick={(event) => onElse(event.currentTarget)}>
          <span className="talk-starter-glyph" aria-hidden="true"><Icon name="edit" size={18} /></span>
          <span className="talk-starter-text">
            <span className="talk-starter-words">{copy.starterElse}</span>
            <small>{copy.starterElseSub}</small>
          </span>
        </button>
      </div>
    </div>
  );
}
