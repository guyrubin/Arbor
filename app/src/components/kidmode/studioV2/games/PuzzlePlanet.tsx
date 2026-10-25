import { NEXT_GAME_COPY } from "../../../../lib/i18nGameNext";
import { useState } from "react";
import { Check, Eye, Lightbulb, Puzzle } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useArborOptional } from "../../../../context/ArborContext";
import { useKidTheme } from "../../../../hooks/useKidTheme";
import { kidArt, type KidArt } from "../../../../lib/kidThemeManifest";
import { GameFinish, GameShell } from "../../game/GameShell";
import { kidSfx } from "../../audio/kidAudio";
import { placePuzzlePiece, shuffledPieces } from "./gameRules";
import { GAME_COPY } from "./gameCopy";
import "./studioGames.css";

/** Actual image fragments, all cropped from the same full-size image. Image
 * directions stay physical left/right in Hebrew; nothing is mirrored. */
export function PlanetPicture({ art, piece, size = 2 }: { art: KidArt; piece?: number; size?: 2 | 3 }) {
  return <span className="studio-puzzle-fragment" aria-hidden="true">
    <img src={art.src} alt="" draggable={false} style={piece === undefined ? { width: "100%", height: "100%", objectFit: "cover" } : {
      position: "absolute", width: `${size * 100}%`, height: `${size * 100}%`, maxWidth: "none",
      left: `${-(piece % size) * 100}%`, top: `${-Math.floor(piece / size) * 100}%`, objectFit: "cover",
    }} />
  </span>;
}

function PuzzlePlay() {
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"];
  const copy = GAME_COPY[uiLang === "he" ? "he" : "en"];
  const theme = useKidTheme();
  const [scene, setScene] = useState<'garden' | 'treehouse' | 'music'>('garden');
  const [finished, setFinished] = useState(false);
  const [hint, setHint] = useState<number | null>(null);
  // Inspected approved garden / treehouse scenes. A hero-bearing manifest
  // change cannot silently substitute a different child for this puzzle.
  const candidate = kidArt(theme, scene === 'music' ? 'studio.portal.studio' : scene === 'treehouse' ? 'studio.portal.playbank' : theme === "film3d" ? "home.stage" : "world.memory.tile");
  const art = candidate && !candidate.hasHero ? candidate : null;
  const pictureRatio = theme === "film3d" ? "16 / 9" : "3 / 2";
  const [size, setSize] = useState<2 | 3>(2);
  const [pieces, setPieces] = useState(() => shuffledPieces(2));
  const [placed, setPlaced] = useState<readonly number[]>([]);
  const [selected, setSelected] = useState<number | null>(null);
  const [preview, setPreview] = useState(false);
  const [status, setStatus] = useState("");
  const [miss, setMiss] = useState<number | null>(null);
  const reset = (next: 2 | 3 = size) => { setSize(next); setPieces(shuffledPieces(next)); setPlaced([]); setSelected(null); setStatus(""); setPreview(false); setFinished(false); setHint(null); setMiss(null); };
  const position = (piece: number) => copy.position[size === 3 ? piece : [0, 2, 6, 8][piece]];
  const place = (target: number, piece = selected) => {
    if (piece === null) { setStatus(copy.puzzleChoose); return; }
    const next = placePuzzlePiece(placed, piece, target, size);
    if (next === placed) { setStatus(copy.puzzleRetry); setMiss(target); kidSfx("tryAgain"); return; }
    setPlaced(next); setSelected(null); setHint(null); setMiss(null); setStatus(copy.puzzlePlaced); kidSfx("correct");
  };
  const complete = placed.length === size * size;
  if (!art) return <GameShell worldId="puzzle" title={copy.puzzle}><p className="studio-game-panel" role="status">{copy.pictureUnavailable}</p></GameShell>;
  return <GameShell worldId="puzzle" title={copy.puzzle} instruction={copy.puzzleInstruction} progress={{ index: placed.length, total: size * size }}>
    <div className="studio-game studio-game-panel" dir={uiLang === "he" ? "rtl" : "ltr"}>
      {finished ? <GameFinish title={copy.puzzleFinish} subtitle={copy.puzzleSubtitle} onPlayAgain={() => reset()} playAgainLabel={copy.again} homeLabel={copy.home} /> : complete ? <div className="studio-puzzle-reveal">
        <div className="studio-puzzle-preview" style={{ aspectRatio: pictureRatio }}><PlanetPicture art={art} /></div>
        <h2>{copy.puzzleFinish}</h2><p>{nextWords.pictureDiscover}</p>
        <button type="button" className="studio-game-button studio-game-button--go" data-puzzle-finish="" onClick={() => setFinished(true)}><Check size={20} aria-hidden="true" />{nextWords.pictureReady}</button>
      </div> : <>
        {/* 25 Oct input ("we didn't understand Puzzle Planet"): the board and
            the pieces come first, so a phone shows both on one screen. The
            whole picture shows faintly under the empty spaces, a chosen piece
            lifts and the empty spaces glow, and a wrong space shakes. Picture
            and size choices follow the play. */}
        <div className="studio-puzzle-layout">
          <div className="studio-puzzle-board" role="group" aria-label={copy.puzzleBoard} data-armed={selected !== null} data-preview={preview} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {preview && <span className="studio-puzzle-ghost" role="img" aria-label={copy.picture}><PlanetPicture art={art} /></span>}
            {Array.from({ length: size * size }, (_, target) => <button type="button" className="studio-puzzle-cell" style={{ aspectRatio: pictureRatio }} key={target} data-filled={placed.includes(target)} data-hint={hint === target} data-miss={miss === target} disabled={placed.includes(target)}
              aria-label={`${copy.space}: ${position(target)}`} onClick={() => place(target)} onDragOver={event => event.preventDefault()}
              onDrop={event => { event.preventDefault(); const value = event.dataTransfer.getData("text/plain"); if (/^\d$/.test(value)) place(target, Number(value)); }}>
              {placed.includes(target) ? <PlanetPicture art={art} piece={target} size={size} /> : <Puzzle aria-hidden="true" size={26} />}
            </button>)}
          </div>
          <div className="studio-puzzle-tray" role="group" aria-label={copy.pieces} style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}>
            {pieces.map(piece => <button type="button" className="studio-puzzle-piece" style={{ aspectRatio: pictureRatio }} key={piece} aria-label={`${copy.piece}: ${position(piece)}`} aria-pressed={selected === piece} data-placed={placed.includes(piece)} disabled={placed.includes(piece)} draggable={!placed.includes(piece)}
              onClick={() => { setSelected(piece); setMiss(null); setStatus(""); }} onDragStart={event => { event.dataTransfer.setData("text/plain", String(piece)); setSelected(piece); setMiss(null); setStatus(""); }}><PlanetPicture art={art} piece={piece} size={size} /></button>)}
          </div>
        </div>
        <p className="studio-game-status" role="status" aria-live="polite">{status || (selected === null ? "\u00a0" : `${copy.piece}: ${position(selected)}`)}</p>
        <div className="studio-game-actions">
          <button type="button" className="studio-game-button" disabled={selected === null} onClick={() => setHint(selected)}><Lightbulb size={20} aria-hidden="true" />{nextWords.pieceHint}</button>
          <button type="button" className="studio-game-button" aria-expanded={preview} onClick={() => setPreview(value => !value)}><Eye aria-hidden="true" size={20} />{preview ? copy.hidePicture : copy.picture}</button>
        </div>
        <div className="studio-puzzle-settings">
          <p className="studio-game-help">{copy.puzzleHelp}</p>
          <div className="studio-game-actions" role="group" aria-label={nextWords.choosePicture}>
            {(['garden','treehouse','music'] as const).map((value, index) => <button type="button" className="studio-game-button" aria-pressed={scene === value} key={value} onClick={() => { setScene(value); reset(); }}>{[nextWords.pictureGarden, nextWords.pictureTreehouse, nextWords.pictureMusic][index]}</button>)}
          </div>
          <div className="studio-game-actions" role="group" aria-label={copy.puzzleSize}>
            <button type="button" className="studio-game-button" aria-pressed={size === 2} onClick={() => reset(2)}>{copy.small}</button>
            <button type="button" className="studio-game-button" aria-pressed={size === 3} onClick={() => reset(3)}>{copy.big}</button>
          </div>
        </div>
      </>}
    </div>
  </GameShell>;
}

export default function PuzzlePlanet() {
  const childId = useArborOptional()?.childProfile?.id ?? "";
  return <PuzzlePlay key={childId} />;
}
