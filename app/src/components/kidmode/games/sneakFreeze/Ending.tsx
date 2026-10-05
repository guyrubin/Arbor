/**
 * Ending — B-GAME-09 (first cut; ruling G12): after the third tag, the
 * statue picture.
 *
 * The picture is composed on the device (statuePicture.ts: the courtyard,
 * the cat turned round squinting, the hero in the freeze pose held longest,
 * where it froze), captioned "The cat looked… and {name} didn't move!" with
 * the name isolated for bidi (EN + HE boy / girl / unspecified), the three
 * prizes the cat handed over, and two toys: Play again (a new seed) and Home.
 * No stars, no counts, no auto-advance, no model or network call. The last
 * 12 pictures are kept on the device (statueStore.ts).
 */
import React, { useEffect, useState } from "react";
import { KidToy } from "../../KidToy";
import { kidIsolate } from "../../kidText";
import type { HeroSheet } from "../../hero/heroSheet";
import type { PrizeId, SneakState } from "./rules";
import { PICTURE, composeStatuePicture, statueShot } from "./statuePicture";
import { keepStatuePicture } from "./statueStore";
import type { SneakArt } from "./sneakArt";

export interface EndingProps {
  state: SneakState;
  art: SneakArt;
  sheet: HeroSheet;
  childId: string;
  rtl: boolean;
  /** The caption, already translated (the name isolated by t()). */
  caption: string;
  pictureAlt: string;
  playAgainLabel: string;
  homeLabel: string;
  onPlayAgain: () => void;
  onHome: (() => void) | null;
}

/** The caption key for this child: the named forms, or the nameless line. */
export function captionKey(firstName: string, gender: string | undefined): string {
  if (!firstName.trim()) return "kid.game.sneak-freeze.caption.noName";
  return gender === "boy" || gender === "girl" ? `kid.game.sneak-freeze.caption.${gender}` : "kid.game.sneak-freeze.caption";
}

export function Ending({ state, art, sheet, childId, rtl, caption, pictureAlt, playAgainLabel, homeLabel, onPlayAgain, onHome }: EndingProps) {
  const [picture, setPicture] = useState<string | null>(null);

  // Compose once per sitting (the seed names it); keep it on the device.
  useEffect(() => {
    let alive = true;
    const shot = statueShot(state);
    if (!shot) return;
    composeStatuePicture({ shot, art, sheet, rtl })
      .then((url) => {
        if (!alive || !url) return;
        setPicture(url);
        keepStatuePicture(childId, { id: state.seed, at: new Date().toISOString(), url, pose: shot.pose });
      })
      .catch(() => { /* the ending still stands without its picture */ });
    return () => { alive = false; };
  }, [state.seed]); // eslint-disable-line react-hooks/exhaustive-deps

  const prizes: readonly PrizeId[] = state.prizes;
  return (
    <div
      data-sneak-ending=""
      style={{ blockSize: "100%", overflowY: "auto", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 16, paddingInline: 16, paddingBlock: 20 }}
    >
      <figure style={{ margin: 0, inlineSize: "min(92vw, 960px, calc((100dvh - 380px) * 1.3333))", minInlineSize: "min(92vw, 280px)" }}>
        <div
          style={{
            position: "relative",
            aspectRatio: `${PICTURE.w} / ${PICTURE.h}`,
            borderRadius: "var(--kid-r-l)",
            overflow: "hidden",
            background: "var(--arbor-paper-elevated)",
            boxShadow: "var(--shadow-md, var(--shadow-xs))",
            border: "6px solid var(--arbor-paper-elevated)",
          }}
        >
          {picture && <img data-statue-picture="" src={picture} alt={pictureAlt} style={{ display: "block", inlineSize: "100%", blockSize: "100%", objectFit: "cover" }} />}
        </div>
        <figcaption dir="auto" className="kid-type-title" style={{ marginBlockStart: 12, marginInline: "auto", inlineSize: "fit-content", maxInlineSize: "100%", textAlign: "center", color: "var(--arbor-ink)", background: "var(--arbor-paper-elevated)", borderRadius: "var(--kid-r-m)", paddingInline: 18, paddingBlock: 10, fontWeight: 800 }}>
          {kidIsolate(caption)}
        </figcaption>
      </figure>
      {prizes.length > 0 && (
        <div aria-hidden="true" data-sneak-prizes="" style={{ display: "flex", gap: 12, justifyContent: "center" }}>
          {prizes.map((p) => (
            <span key={p} style={{ display: "grid", placeItems: "center", inlineSize: 72, blockSize: 72, borderRadius: "50%", background: "var(--arbor-paper-elevated)", boxShadow: "var(--shadow-xs)" }}>
              <img src={art.prizes[p].url} alt="" style={{ inlineSize: 52, blockSize: 52 }} />
            </span>
          ))}
        </div>
      )}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 16, justifyContent: "center" }}>
        <KidToy tone="go" size="l" glyph="replay" onClick={onPlayAgain} data-kid-finish-again="">{kidIsolate(playAgainLabel)}</KidToy>
        {onHome && <KidToy tone="paper" glyph="home" onClick={onHome} data-kid-finish-home="">{kidIsolate(homeLabel)}</KidToy>}
      </div>
    </div>
  );
}

export default Ending;
