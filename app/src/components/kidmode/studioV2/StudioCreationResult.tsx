import { useEffect, useRef, useState } from 'react';
import { Check, Droplet, Leaf, Star, Flower2, LampFloor, LibraryBig, Moon, Music2, Panda, Pause, Play, RectangleHorizontal, RectangleVertical, ShoppingBasket, Sprout, Sun } from 'lucide-react';
import { useLanguage } from '../../../context/LanguageContext';
import { onKidHush, useKidReadAloudMuted } from '../audio/kidAudio';
import { createGardenAudio } from './games/adventures/gardenAudio';
import { useStudioCreations, type StudioCreation } from './studioCreations';
import type { StudioActivityId } from './studioCatalog';
import './studioCreations.css';

export const CORNER_GLYPHS = { cushion: RectangleHorizontal, plant: Sprout, books: LibraryBig, lamp: LampFloor, blanket: RectangleVertical, panda: Panda, flowers: Flower2, basket: ShoppingBasket };
const NOTE_GLYPHS = [Star, Droplet, Leaf];
const COPY = {
  en: { corner: 'Your little world', melody: 'Your own tune', keeping: 'Keeping your creation…', kept: 'In your collection', error: 'Your creation is still here. Saving did not finish.', retry: 'Try saving again', play: 'Play my tune', pause: 'Pause', quiet: 'Follow the shapes with sound off.', show: 'Show someone what you made. Can they play it with you?', remix: 'Open and remix', title: 'Things I made', unavailable: 'The sound could not play. You can follow the shapes.' },
  he: { corner: 'העולם הקטן שלך', melody: 'המנגינה שלך', keeping: 'שומרים את היצירה…', kept: 'באוסף שלך', error: 'היצירה עדיין כאן. השמירה לא הושלמה.', retry: 'לנסות לשמור שוב', play: 'לנגן את המנגינה שלי', pause: 'לעצור', quiet: 'אפשר לעקוב אחרי הצורות כשהצליל כבוי.', show: 'אפשר להראות למישהו מה יצרת. אולי תנסו יחד?', remix: 'לפתוח וליצור גרסה חדשה', title: 'דברים שיצרתי', unavailable: 'לא הצלחנו להשמיע צליל. אפשר לעקוב אחרי הצורות.' },
};
export function CreationPreview({ creation, childId }: { creation: StudioCreation; childId: string }) {
  const { uiLang } = useLanguage(); const lang = uiLang === 'he' ? 'he' : 'en'; const w = COPY[lang];
  const muted = useKidReadAloudMuted(childId);
  const [lit, setLit] = useState(-1), [playing, setPlaying] = useState(false), [unavailable, setUnavailable] = useState(false);
  const audio = useRef<ReturnType<typeof createGardenAudio> | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);
  const stop = () => { timers.current.forEach(clearTimeout); timers.current = []; audio.current?.stop(); setLit(-1); setPlaying(false); };
  const stopRef = useRef(stop); stopRef.current = stop;
  useEffect(() => {
    const instance = createGardenAudio(); audio.current = instance;
    const unsubscribe = onKidHush(() => stopRef.current());
    const hidden = () => { if (document.visibilityState === 'hidden') stopRef.current(); };
    document.addEventListener('visibilitychange', hidden);
    return () => { timers.current.forEach(clearTimeout); instance.dispose(); unsubscribe(); document.removeEventListener('visibilitychange', hidden); };
  }, []);
  useEffect(() => { if (muted) stopRef.current(); }, [muted]);
  const play = () => {
    stop(); if (creation.kind !== 'melody') return; setPlaying(true); setUnavailable(false);
    creation.notes.forEach((note, index) => {
      const strike = () => { setLit(index); const ok = audio.current?.play(note); if (!muted && !ok) setUnavailable(true); };
      if (index === 0) strike(); else timers.current.push(setTimeout(strike, index * creation.tempo));
    });
    timers.current.push(setTimeout(stop, creation.notes.length * creation.tempo));
  };
  return <div className="studio-creation" data-creation={creation.kind}>
    <h3>{w[creation.kind]}</h3>
    {creation.kind === 'corner' ? <div className="studio-creation-room" data-light={creation.light} data-scene={creation.scene} role="img" aria-label={w.corner}>
      {creation.layout.map((object, index) => { const Glyph = object ? CORNER_GLYPHS[object] : null; return <span key={index} data-object={object ?? 'empty'}>{Glyph && <Glyph aria-hidden="true" strokeWidth={1.5} />}</span>; })}
    </div> : <>
      <div className="studio-creation-notes" aria-label={w.melody}>{creation.notes.map((note, index) => { const Glyph = NOTE_GLYPHS[note]; return <span key={index} data-note={note} data-lit={index === lit}><Glyph aria-hidden="true" /><span className="sr-only">{note + 1}</span></span>; })}</div>
      <button type="button" className="studio-game-button-v2" onClick={playing ? stop : play}>{playing ? <Pause size={20} /> : <Play size={20} />}{playing ? w.pause : w.play}</button>
      {(muted || unavailable) && <p role="status">{muted ? w.quiet : w.unavailable}</p>}
    </>}
  </div>;
}

export function StudioCreationResult({ creation, childId }: { creation: StudioCreation; childId: string }) {
  const { uiLang } = useLanguage(); const w = COPY[uiLang === 'he' ? 'he' : 'en'];
  const store = useStudioCreations(childId);
  const [status, setStatus] = useState<'saving' | 'saved' | 'error'>('saving');
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!store.loaded) return;
    let active = true; setStatus('saving');
    // The write itself advances the collection receipt. Checking the old read
    // receipt here would leave a successful local save stuck at "keeping".
    void store.save(creation).then(() => { if (active) setStatus('saved'); }, () => { if (active) setStatus('error'); });
    return () => { active = false; };
  }, [store.loaded, store.error, childId, creation, retry]);
  return <div className="studio-creation-result">
    <CreationPreview creation={creation} childId={childId} />
    <p className="studio-creation-receipt" role="status">{status === 'saved' && <Check size={18} aria-hidden="true" />}{status === 'saved' ? w.kept : status === 'saving' ? w.keeping : w.error}</p>
    {status === 'error' && <button type="button" className="studio-game-button-v2" onClick={() => setRetry(value => value + 1)}>{w.retry}</button>}
    <p>{w.show}</p>
  </div>;
}
export function StudioCreationGallery({ childId, onActivity }: { childId: string; onActivity: (id: StudioActivityId) => void }) {
  const { uiLang } = useLanguage(); const w = COPY[uiLang === 'he' ? 'he' : 'en'];
  const store = useStudioCreations(childId);
  if (!store.items.length) return null;
  return <section className="studio-creation-gallery"><h2><Music2 size={24} aria-hidden="true" />{w.title}</h2>{store.items.map(item => <article key={item.id}>
    <CreationPreview childId={childId} creation={item.creation} />
    <button type="button" className="studio-v2__glass-button" onClick={() => { if (store.isCurrent()) onActivity(item.creation.kind === 'corner' ? 'calm-builder' : 'rhythm-garden'); }}>{w.remix}</button>
  </article>)}</section>;
}
