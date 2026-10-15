import { useCallback, useEffect, useRef, useState } from 'react';
import { isActive, stopVoice, subscribeVoice, voiceState } from '../../../../../lib/voice';
import { kidSay, onKidHush, useKidReadAloudMuted } from '../../../audio/kidAudio';
import { ArborMascot, type MascotMood } from '../../../../ui/ArborMascot';

/** One contextual voice, never a second engine. Navigation, mute and hidden-tab
 * hush cancel pending lines as well as playback. No idle reminders or loops. */
export function useAdventureVoice({ childId, lang, text, cueKey, enabled = true }: { childId: string; lang: 'en' | 'he'; text: string; cueKey: string; enabled?: boolean }) {
  const muted = useKidReadAloudMuted(childId);
  const mutedRef = useRef(muted); mutedRef.current = muted;
  const utterance = useRef(0);
  const pending = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [speaking, setSpeaking] = useState(false);
  const cancel = useCallback(() => {
    if (pending.current) clearTimeout(pending.current);
    pending.current = null;
    if (isActive(utterance.current)) stopVoice();
    utterance.current = 0;
    setSpeaking(false);
  }, []);
  const replay = useCallback(() => {
    cancel();
    if (!enabled || mutedRef.current) return;
    utterance.current = kidSay(childId, text, lang);
    setSpeaking(isActive(utterance.current) && voiceState().speaking);
  }, [cancel, childId, enabled, lang, text]);
  useEffect(() => subscribeVoice(state => setSpeaking(state.speaking && isActive(utterance.current))), []);
  useEffect(() => onKidHush(cancel), [cancel]);
  useEffect(() => {
    if (enabled && text && !mutedRef.current) pending.current = setTimeout(replay, 180);
    return cancel;
  }, [cueKey, replay, cancel, enabled, text]);
  // Turning sound back on does not unexpectedly replay an old story.
  useEffect(() => { if (muted) cancel(); }, [muted, cancel]);
  return { speaking, replay, cancel, muted };
}

export type SproutAction = 'welcome' | 'think' | 'listen' | 'show' | 'celebrate' | 'comfort';
const MOOD: Record<SproutAction, MascotMood> = { welcome: 'wave', think: 'think', listen: 'calm', show: 'wave', celebrate: 'proud', comfort: 'calm' };
/** Keep the approved Sprout drawing. His body language follows actual play;
 * the voice rings only animate while this guide's utterance is speaking. */
export function AdventureSprout({ action = 'welcome', speaking = false, size = 132, beat = 0, className = '' }: { action?: SproutAction; speaking?: boolean; size?: number; beat?: number; className?: string }) {
  return <span className={`adventure-sprout ${className}`} data-action={action} data-speaking={speaking} aria-hidden="true" style={{ width: size, height: size }}>
    <span className="adventure-sprout__ground" />
    <span className="adventure-sprout__actor" key={`${action}:${beat}`}><ArborMascot detailed size={size} mood={speaking ? 'cheer' : MOOD[action]} animate={false} /></span>
    <span className="adventure-sprout__voice"><i /><i /><i /></span>
  </span>;
}
