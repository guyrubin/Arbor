import { NEXT_GAME_COPY } from "../../../../lib/i18nGameNext";
import { useState } from "react";
import { Check, Flower2, LampFloor, LibraryBig, Moon, Panda, Plus, RectangleHorizontal, RectangleVertical, ShoppingBasket, Sprout, Sun, Sunset, Undo2 } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useArborOptional } from "../../../../context/ArborContext";
import { useKidTheme } from "../../../../hooks/useKidTheme";
import { kidArt } from "../../../../lib/kidThemeManifest";
import { GameFinish, GameShell } from "../../game/GameShell";
import { CORNER_OBJECTS, emptyCorner, placeCornerObject, type CornerLayout, type CornerObject } from "./gameRules";
import { GAME_COPY } from "./gameCopy";
import "./studioGames.css";
import { StudioPlayHero } from "../StudioPlayHero";
import { useStudioCreations } from "../studioCreations";

const OBJECT_GLYPHS = { cushion: RectangleHorizontal, plant: Sprout, books: LibraryBig, lamp: LampFloor, blanket: RectangleVertical, panda: Panda, flowers: Flower2, basket: ShoppingBasket };
function ObjectGlyph({ object }: { object: CornerObject }) {
  const Glyph = OBJECT_GLYPHS[object];
  return <Glyph aria-hidden="true" strokeWidth={1.8} />;
}

function BuilderPlay() {
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? "");
  const [scene, setScene] = useState<"treehouse" | "garden" | "sky">("treehouse");
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"];
  const copy = GAME_COPY[uiLang === "he" ? "he" : "en"];
  const theme = useKidTheme();
  // Both assets inspected: cozy room / empty treehouse, never another child.
  const candidate = kidArt(theme, scene === "garden" ? "studio.portal.feelings" : scene === "sky" ? "studio.sky" : theme === "film3d" ? "world.kid-quest.tile" : "world.memory.tile");
  const art = candidate && !candidate.hasHero ? candidate : null;
  const [layout, setLayout] = useState<CornerLayout>(emptyCorner);
  const [history, setHistory] = useState<CornerLayout[]>([]);
  const [selected, setSelected] = useState<CornerObject | null>(null);
  const [light, setLight] = useState<"day" | "evening" | "night">("day");
  const [status, setStatus] = useState("");
  const [finished, setFinished] = useState(false);
  const commit = (next: CornerLayout) => {
    if (next.every((item, index) => item === layout[index])) return;
    setHistory(previous => [...previous.slice(-19), layout]); setLayout(next);
  };
  const place = (index: number, object = selected) => {
    if (!object) {
      if (layout[index]) { setSelected(layout[index]); setStatus(`${copy.selected} ${copy[layout[index]!]}`); }
      else setStatus(copy.choose);
      return;
    }
    commit(placeCornerObject(layout, object, index)); setSelected(null); setStatus(copy.placed);
  };
  const reset = () => { setLayout(emptyCorner()); setHistory([]); setSelected(null); setStatus(""); setLight("day"); setFinished(false); };
  return <GameShell worldId="calm-builder" title={copy.builder} instruction={copy.builderInstruction}>
    <div className="studio-game studio-game-panel" dir={uiLang === "he" ? "rtl" : "ltr"}>
      {finished ? <GameFinish creation={{ kind: "corner", layout, light, scene }} title={copy.builderFinish} subtitle={copy.builderShare} onPlayAgain={reset} playAgainLabel={copy.again} homeLabel={copy.home} /> : <>
        <p className="studio-game-help">{copy.builderHint}</p>
        <div className="studio-game-actions" role="group" aria-label={nextWords.cornerPlace}>
          {(['treehouse','garden','sky'] as const).map((value, index) => <button type="button" className="studio-game-button" aria-pressed={scene === value} key={value} onClick={() => setScene(value)}>{[nextWords.treehouse, nextWords.garden, nextWords.sky][index]}</button>)}
          {saved.items.some(item => item.creation.kind === 'corner') && <button type="button" className="studio-game-button" onClick={() => {
            const kept = saved.items.find(item => item.creation.kind === 'corner')?.creation;
            if (kept?.kind !== 'corner' || !saved.isCurrent()) return;
            setLayout(kept.layout); setLight(kept.light); setScene(kept.scene); setHistory([]); setSelected(null); setStatus('');
          }}>{nextWords.openCorner}</button>}
        </div>
        <div className="studio-game-actions" role="group" aria-label={copy.light}>
          {(["day", "evening", "night"] as const).map(value => {
            const Glyph = value === "day" ? Sun : value === "evening" ? Sunset : Moon;
            return <button type="button" className="studio-game-button" key={value} aria-pressed={light === value} onClick={() => setLight(value)}><Glyph aria-hidden="true" size={20} />{copy[value]}</button>;
          })}
        </div>
        <div className="studio-corner" data-light={light} role="group" aria-label={copy.room} style={art ? { backgroundImage: `url("${art.src}")`, backgroundPosition: art.objectPosition } : undefined}>
          <div className="studio-corner-resident"><StudioPlayHero size={108} /></div>
          <div className="studio-corner-places">
            {layout.map((object, index) => <button type="button" className="studio-corner-place" key={index} data-filled={!!object} data-selected={!!object && selected === object}
              aria-label={`${copy.place} ${index + 1}${object ? `: ${copy[object]}` : ""}`} onClick={() => place(index)}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const value = event.dataTransfer.getData("text/plain"); if (CORNER_OBJECTS.includes(value as CornerObject)) place(index, value as CornerObject); }}>
              {object ? <ObjectGlyph object={object} /> : <Plus aria-hidden="true" size={24} />}
            </button>)}
          </div>
        </div>
        <p className="studio-game-status" role="status" aria-live="polite">{status || (selected ? `${copy.selected} ${copy[selected]}` : "\u00a0")}</p>
        <div className="studio-corner-tray" role="group" aria-label={copy.objects}>
          {CORNER_OBJECTS.map(object => <button type="button" className="studio-object" key={object} aria-pressed={selected === object} data-placed={layout.includes(object)} draggable
            onDragStart={event => { event.dataTransfer.setData("text/plain", object); setSelected(object); setStatus(""); }} onClick={() => { setSelected(selected === object ? null : object); setStatus(""); }}>
            <ObjectGlyph object={object} /><span>{copy[object]}</span>
          </button>)}
        </div>
        <div className="studio-game-actions">
          <button type="button" className="studio-game-button" disabled={!history.length} onClick={() => { setLayout(history[history.length - 1]); setHistory(previous => previous.slice(0, -1)); setSelected(null); setStatus(""); }}><Undo2 aria-hidden="true" size={20} />{copy.undo}</button>
          {selected && layout.includes(selected) && <button type="button" className="studio-game-button" onClick={() => { commit(layout.map(object => object === selected ? null : object)); setSelected(null); setStatus(""); }}>{copy.remove}</button>}
          <button type="button" className="studio-game-button studio-game-button--go" disabled={!layout.some(Boolean)} onClick={() => setFinished(true)}><Check aria-hidden="true" size={20} />{copy.done}</button>
        </div>
      </>}
    </div>
  </GameShell>;
}

export default function CalmBuilder() {
  const childId = useArborOptional()?.childProfile?.id ?? "";
  return <BuilderPlay key={childId} />;
}
