/** Synthetic preview boundary. No real account, profile, telemetry or cloud writes. */
import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { translate } from '../../src/lib/i18n';
const Language = createContext({ uiLang: 'en' as 'en' | 'he', setUiLang: (_: 'en' | 'he') => {} });
export function PreviewProvider({ children }: { children: React.ReactNode }) {
  const [uiLang, setUiLang] = useState<'en' | 'he'>(() => new URLSearchParams(location.search).get('lang') === 'he' ? 'he' : 'en');
  useEffect(() => { document.documentElement.lang = uiLang; document.documentElement.dir = uiLang === 'he' ? 'rtl' : 'ltr'; }, [uiLang]);
  return <Language.Provider value={{uiLang, setUiLang}}>{children}</Language.Provider>;
}
export function useLanguage() { const state = useContext(Language); return { ...state, t: (key: string, vars?: Record<string, unknown>) => translate(state.uiLang, key, vars as never) }; }
// B-KID-162 (200% text): `?name=` sets a synthetic name (the long-name cells of scripts/kids-performance-browser.mjs).
const previewName = typeof location === 'undefined' ? '' : (new URLSearchParams(location.search).get('name') ?? '').slice(0, 60);
const childProfile = { id: 'studio-v2-synthetic-review', name: previewName, age: 5, ageMonths: 62, ageMonthsAsOf: '2026-10-15', kidTheme: 'film3d', primaryLanguage: 'en', languages: ['en','he'] };
const arbor = { childProfile, childProfiles: [childProfile], settings: {}, activities: [], updateChildProfile: () => {} };
export const useArbor = () => arbor;
export const useArborOptional = useArbor;
export const useAuth = () => ({ user: { uid: 'local-sandbox' }, loading: false });
export const isKidModeActive = () => true;
export const subscribeKidMode = () => () => {};
export const noteKidActivity = () => {};
export const track = () => {};
const rows = new Map<string, any[]>(), listeners = new Set<() => void>();
export function useChildCollection<T extends {id: string}>(childId: string, name: string) {
  const key = `arbor.v2-design-preview.${childId}.${name}`;
  if (!rows.has(key)) { try { const value = JSON.parse(localStorage.getItem(key) || '[]'); rows.set(key, Array.isArray(value) ? value.slice(-100) : []); } catch { rows.set(key, []); } }
  const [, redraw] = useState(0); const active = useRef(true);
  useEffect(() => { active.current = true; const update = () => redraw(n => n + 1); listeners.add(update); return () => { active.current = false; listeners.delete(update); }; }, [key]);
  return useMemo(() => {
    const persist = async (next: T[]) => { const bounded = next.slice(-100); localStorage.setItem(key, JSON.stringify(bounded)); rows.set(key, bounded); listeners.forEach(fn => fn()); };
    return { items: rows.get(key) as T[], loaded: true, confirmed: true, remote: false, error: false, isCurrent: () => active.current,
      upsert: (item: T) => persist([...(rows.get(key) as T[]).filter(row => row.id !== item.id), item]),
      remove: (id: string) => persist((rows.get(key) as T[]).filter(row => row.id !== id)), replaceAll: persist };
  }, [key, rows.get(key)]);
}
export function usePracticeData(childId: string) { return { events: useChildCollection(childId, 'previewPracticeEvents') }; }
export const voiceSupported = () => typeof speechSynthesis !== 'undefined';
export const stopVoice = () => { if (voiceSupported()) speechSynthesis.cancel(); };
export const registerVoiceGate = () => () => {};
export const voiceState = () => ({ engine: 'browser', status: 'idle' });
let utteranceId = 0;
export function speakText(text: string, handlers: { onEnd?: () => void } = {}, lang: 'en' | 'he' = 'en') {
  if (!voiceSupported()) return 0;
  stopVoice(); const speech = new SpeechSynthesisUtterance(text);
  speech.lang = lang === 'he' ? 'he-IL' : 'en-US'; speech.rate = .88;
  speech.onend = () => handlers.onEnd?.(); speechSynthesis.speak(speech); return ++utteranceId;
}
export const setNaturalSynth = () => {};
export const setVoiceEngine = () => {};

export const useKidModeEntry = () => ({ request: () => {}, step: null });
export const isActive = (id: number) => voiceSupported() && speechSynthesis.speaking && id === utteranceId;
export const subscribeVoice = () => () => {};
