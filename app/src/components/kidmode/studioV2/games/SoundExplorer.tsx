import { useEffect, useRef, useState } from "react";
import { Bell, Check, Feather, Footprints, Lightbulb, Volume2, Waves } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useArborOptional } from "../../../../context/ArborContext";
import { GameFinish, GameShell } from "../../game/GameShell";
import { useKidReadAloudMuted } from "../../audio/kidAudio";
import { createExplorerAudio, type ExplorerAudio } from "./explorerAudio";
import { EXPLORER_SOUNDS, type ExplorerSound } from "./gameRules";
import { GAME_COPY } from "./gameCopy";
import "./studioGames.css";

const SOUND_GLYPHS = { steps: Footprints, bell: Bell, landing: Feather };

function ExplorerPlay({ childId }: { childId: string }) {
  const { uiLang } = useLanguage();
  const copy = GAME_COPY[uiLang === "he" ? "he" : "en"];
  const muted = useKidReadAloudMuted(childId);
  const audio = useRef<ExplorerAudio | null>(null);
  const [round, setRound] = useState(0);
  const [clue, setClue] = useState(false);
  const [matched, setMatched] = useState(false);
  const [heard, setHeard] = useState(false);
  const [unavailable, setUnavailable] = useState(false);
  const [retry, setRetry] = useState(false);
  useEffect(() => {
    const current = createExplorerAudio(); audio.current = current;
    let active = true;
    void current.load().then(ready => { if (active && !ready) setUnavailable(true); });
    return () => { active = false; current.dispose(); if (audio.current === current) audio.current = null; };
  }, []);
  useEffect(() => { if (muted) audio.current?.stop(); }, [muted]);
  const sound = EXPLORER_SOUNDS[Math.min(round, EXPLORER_SOUNDS.length - 1)];
  const clueText = sound === "steps" ? copy.stepClue : sound === "bell" ? copy.bellClue : copy.landingClue;
  const showClue = clue || muted || unavailable;
  const Glyph = matched ? SOUND_GLYPHS[sound] : Waves;
  const reset = () => { audio.current?.stop(); setRound(0); setMatched(false); setHeard(false); setClue(false); setRetry(false); };
  const choose = (choice: ExplorerSound) => {
    if (matched) return;
    if (choice === sound) { audio.current?.stop(); setMatched(true); setRetry(false); }
    else setRetry(true);
  };
  const next = () => { audio.current?.stop(); setRound(value => value + 1); setMatched(false); setHeard(false); setClue(false); setRetry(false); };
  return <GameShell worldId="sound-explorer" title={copy.sound} instruction={copy.soundInstruction} progress={{ index: round, total: EXPLORER_SOUNDS.length }}>
    <div className="studio-game studio-game-panel" dir={uiLang === "he" ? "rtl" : "ltr"}>
      {round === EXPLORER_SOUNDS.length ? <GameFinish title={copy.soundFinish} subtitle={copy.soundSubtitle} onPlayAgain={reset} playAgainLabel={copy.again} homeLabel={copy.home} /> : <>
        <p className="studio-game-help">{copy.soundHelp}</p>
        <div className="studio-sound-scene">
          <div className="studio-sound-emblem" aria-hidden="true"><Glyph /></div>
          <div className="studio-game-actions">
            <button type="button" className="studio-game-button studio-game-button--go" disabled={muted || matched} onClick={() => {
              const played = audio.current?.play(sound) ?? false; setHeard(played); setUnavailable(!played);
            }}><Volume2 aria-hidden="true" size={22} />{heard ? copy.replay : copy.listen}</button>
            {!muted && !unavailable && <button type="button" className="studio-game-button" aria-expanded={showClue} onClick={() => setClue(value => !value)}><Lightbulb aria-hidden="true" size={22} />{showClue ? copy.hideClue : copy.clue}</button>}
          </div>
          {muted ? <p className="studio-game-help">{copy.muted}</p> : unavailable ? <p className="studio-game-help" role="status">{copy.unavailable}</p> : null}
          {showClue && <p className="studio-sound-clue">{clueText}</p>}
        </div>
        <div className="studio-sound-choices" role="group" aria-label={copy.sources}>
          {EXPLORER_SOUNDS.map(choice => {
            const ChoiceGlyph = SOUND_GLYPHS[choice];
            return <button type="button" className="studio-sound-choice" key={choice} aria-pressed={matched && choice === sound} disabled={matched} onClick={() => choose(choice)}><ChoiceGlyph aria-hidden="true" /><span>{copy[choice]}</span></button>;
          })}
        </div>
        <p className="studio-game-status" role="status" aria-live="polite">{matched ? `${copy.soundMatch} ${copy[sound]}` : retry ? copy.soundRetry : "\u00a0"}</p>
        {matched && <div className="studio-game-actions"><button type="button" className="studio-game-button studio-game-button--go" onClick={next}><Check aria-hidden="true" size={22} />{round === EXPLORER_SOUNDS.length - 1 ? copy.finish : copy.next}</button></div>}
      </>}
    </div>
  </GameShell>;
}

export default function SoundExplorer() {
  const childId = useArborOptional()?.childProfile?.id ?? "";
  return <ExplorerPlay key={childId} childId={childId} />;
}
