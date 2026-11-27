import { NEXT_GAME_COPY } from "../../../../lib/i18nGameNext";
import { useState } from "react";
import { Check, Moon, Panda, ShoppingBasket, Sun, Sunset, Undo2 } from "lucide-react";
import { useLanguage } from "../../../../context/LanguageContext";
import { useArborOptional } from "../../../../context/ArborContext";
import { useKidTheme } from "../../../../hooks/useKidTheme";
import { kidArt, kidArtSrcSet, studioMakerArt } from "../../../../lib/kidThemeManifest";
import { GameFinish, GameShell } from "../../game/GameShell";
import { CORNER_OBJECTS, emptyCorner, placeCornerObject, type CornerLayout, type CornerObject } from "./gameRules";
import { GAME_COPY } from "./gameCopy";
import { BopSprite } from "./adventures/BopArt";
import "./adventures/adventures.css";
import "./studioGames.css";
import { StudioPlayHero } from "../StudioPlayHero";
import { useStudioCreations } from "../studioCreations";

/** B-KID-173: the corner's things are the Season 01 kit's own props (the Bop
 * toy world and the makers' kit library), never line drawings. The kit has no
 * panda toy or basket, so those two keep a glyph on a pearl token until it does. */
const OBJECT_PROPS: Readonly<Partial<Record<CornerObject, string>>> = {
  cushion: "item-cushion", books: "item-journal", lamp: "item-lamp", blanket: "rest-rug", flowers: "flower-open",
};
const OBJECT_KIT: Readonly<Partial<Record<CornerObject, string>>> = { plant: studioMakerArt("kit-prop-planter-bud") };
const OBJECT_GLYPHS: Readonly<Partial<Record<CornerObject, typeof Panda>>> = { panda: Panda, basket: ShoppingBasket };
export function cornerObjectArt(object: CornerObject): { kind: "bop" | "kit"; src: string } | { kind: "glyph" } {
  const bop = OBJECT_PROPS[object];
  if (bop) return { kind: "bop", src: bop };
  const kit = OBJECT_KIT[object];
  return kit ? { kind: "kit", src: kit } : { kind: "glyph" };
}
function ObjectArt({ object }: { object: CornerObject }) {
  const art = cornerObjectArt(object);
  if (art.kind === "bop") return <BopSprite name={art.src} className="studio-corner-prop" />;
  if (art.kind === "kit") return <img className="bop-sprite studio-corner-prop" data-kit-prop={object} src={art.src} alt="" draggable={false} decoding="async" />;
  const Glyph = OBJECT_GLYPHS[object]!;
  return <span className="studio-corner-token" aria-hidden="true"><Glyph aria-hidden="true" strokeWidth={2.2} /></span>;
}

function BuilderPlay() {
  const child = useArborOptional()?.childProfile;
  const saved = useStudioCreations(child?.id ?? "");
  const [scene, setScene] = useState<"treehouse" | "garden" | "sky">("treehouse");
  const { uiLang } = useLanguage();
  const nextWords = NEXT_GAME_COPY[uiLang === "he" ? "he" : "en"];
  const copy = GAME_COPY[uiLang === "he" ? "he" : "en"];
  const theme = useKidTheme();
  // Every room is empty of children: the film's glass room, the garden door, the valley sky.
  const candidate = kidArt(theme, scene === "garden" ? "studio.portal.feelings" : scene === "sky" ? "studio.sky" : theme === "film3d" ? "studio.room.calm" : "world.memory.tile");
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
    <section className="studio-game adventure adventure--bop" data-kit-shell="" dir={uiLang === "he" ? "rtl" : "ltr"}>
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
        {/* B-KID-173: the Bop games' pearl stage. The room is the film plate
            under the stage; the light is a wash over it (night is dimmed
            pearl, never navy); the props stand on it with their own shadow. */}
        <div className="studio-corner bop-stage" data-light={light} data-armed={selected !== null} role="group" aria-label={copy.room}>
          {art && <img className="bop-scene studio-corner-room" src={art.src480} srcSet={kidArtSrcSet(art)} sizes="(min-width: 700px) 900px, 100vw" alt="" draggable={false} decoding="async" style={{ objectPosition: art.objectPosition }} />}
          <span className="studio-corner-light" aria-hidden="true" />
          <div className="studio-corner-resident"><StudioPlayHero size={108} /></div>
          <div className="studio-corner-places">
            {layout.map((object, index) => <button type="button" className="studio-corner-place" key={index} data-filled={!!object} data-selected={!!object && selected === object}
              aria-label={`${copy.place} ${index + 1}${object ? `: ${copy[object]}` : ""}`} onClick={() => place(index)}
              onDragOver={event => event.preventDefault()} onDrop={event => { event.preventDefault(); const value = event.dataTransfer.getData("text/plain"); if (CORNER_OBJECTS.includes(value as CornerObject)) place(index, value as CornerObject); }}>
              {object && <ObjectArt object={object} />}
            </button>)}
          </div>
        </div>
        <p className="studio-game-status" role="status" aria-live="polite">{status || (selected ? `${copy.selected} ${copy[selected]}` : "\u00a0")}</p>
        <div className="studio-corner-tray" role="group" aria-label={copy.objects}>
          {CORNER_OBJECTS.map(object => <button type="button" className="studio-object" key={object} aria-pressed={selected === object} data-placed={layout.includes(object)} draggable
            onDragStart={event => { event.dataTransfer.setData("text/plain", object); setSelected(object); setStatus(""); }} onClick={() => { setSelected(selected === object ? null : object); setStatus(""); }}>
            <span className="studio-object-art"><ObjectArt object={object} /></span><span>{copy[object]}</span>
          </button>)}
        </div>
        <div className="studio-game-actions">
          <button type="button" className="studio-game-button" disabled={!history.length} onClick={() => { setLayout(history[history.length - 1]); setHistory(previous => previous.slice(0, -1)); setSelected(null); setStatus(""); }}><Undo2 aria-hidden="true" size={20} />{copy.undo}</button>
          {selected && layout.includes(selected) && <button type="button" className="studio-game-button" onClick={() => { commit(layout.map(object => object === selected ? null : object)); setSelected(null); setStatus(""); }}>{copy.remove}</button>}
          <button type="button" className="studio-game-button studio-game-button--go" disabled={!layout.some(Boolean)} onClick={() => setFinished(true)}><Check aria-hidden="true" size={20} />{copy.done}</button>
        </div>
      </>}
    </section>
  </GameShell>;
}

export default function CalmBuilder() {
  const childId = useArborOptional()?.childProfile?.id ?? "";
  return <BuilderPlay key={childId} />;
}
