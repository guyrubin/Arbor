import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import type { DeskAudio } from './deskAudio';
import { PixelArt, WIGGLE_A, WIGGLE_B } from './DeskPixels';
import type { MakerDeskWords } from './makerDeskCopy';
import { INPUT_MAX, QUICK_COMMANDS, appendScreen, complete, run, suggest, type TermEffect, type TerminalContext, type TermLine, type TermShow } from './makerDeskRules';

/** "Ask the computer": a toy terminal with a fixed vocabulary. Everything it
 * can answer comes from `run` in the rules (a fixed table and a fixed virtual
 * file map). What the child types lives only in this component's state: it is
 * never stored, sent or evaluated, and it is gone when the program closes. */
export function DeskTerminal({ w, lang, things, hello, audio, onCommand }: { w: MakerDeskWords; lang: 'en' | 'he'; things: TerminalContext['things']; hello: TerminalContext['hello']; audio: DeskAudio | null; onCommand: (command: string | null, effect?: TermEffect) => void }) {
  const [screen, setScreen] = useState<TermLine[]>(() => [{ kind: 'out', text: w.welcome, tone: 'title' }, { kind: 'out', text: w.terminalCue, tone: 'soft' }]);
  const [typed, setTyped] = useState('');
  const [riddle, setRiddle] = useState(0);
  /** Lines before this one were already on the screen; the rest arrive one after another. */
  const [fresh, setFresh] = useState(0);
  const [turn, setTurn] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { const node = log.current; if (node) node.scrollTop = node.scrollHeight; }, [screen]);

  const enter = (text: string) => {
    const result = run(text, { lang, things, hello, riddle });
    const echo = text.replace(/\s+/g, ' ').trim().slice(0, INPUT_MAX);
    setScreen(current => { const next = appendScreen(current, result.clear ? result.lines : [{ kind: 'cmd', text: echo }, ...result.lines], result.clear); setFresh(Math.max(0, next.length - result.lines.length - (result.clear ? 0 : 1))); return next; });
    setTurn(value => value + 1);
    if (result.command === 'cat secret.txt') setRiddle(value => value + 1);
    if (result.sound === 'beep') audio?.beep(); else if (result.sound === 'unknown') audio?.hm(); else if (result.sound === 'singSong') audio?.song(); else if (result.sound === 'magicChime') audio?.magic(); else if (result.sound === 'answer') audio?.note(7 + (result.lines.length % 3), true); else audio?.key();
    setTyped('');
    onCommand(result.command, result.effect);
  };
  const submit = () => { if (typed.trim()) { void selectionHaptic(); enter(typed); } };
  const keys = (e: ReactKeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') { e.preventDefault(); submit(); return; }
    // Tab finishes a word when there is one to finish; otherwise it moves on as usual.
    if (e.key === 'Tab' && !e.shiftKey && typed.trim()) {
      const filled = complete(typed, things);
      if (filled !== typed && filled.trim() !== typed.trim()) { e.preventDefault(); setTyped(filled); audio?.key(); }
    }
  };
  const ideas = suggest(typed, things);

  return <div className="md-term" dir={lang === 'he' ? 'rtl' : 'ltr'}>
    <div className="md-term__screen" ref={log} role="log" aria-live="polite" aria-label={w.screen}>
      {screen.map((line, index) => <TermRow key={index < fresh ? index : `${turn}-${index}`} line={line} delay={index < fresh ? -1 : index - fresh} />)}
      <div className="md-term__prompt" dir="ltr">
        <span className="md-term__caret" aria-hidden="true">&gt;</span>
        <input ref={field} className="md-term__input field-bare" type="text" dir="ltr" value={typed} maxLength={INPUT_MAX} aria-label={w.input}
          autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send"
          onChange={e => { setTyped(e.target.value.slice(0, INPUT_MAX)); audio?.key(); }} onKeyDown={keys} />
        <button type="button" className="md-term__enter" aria-label={w.enter} disabled={!typed.trim()} onClick={submit}><CornerDownLeft size={20} aria-hidden="true" /></button>
      </div>
    </div>
    {ideas.length > 0 && <div className="md-term__ideas" role="group" aria-label={w.complete} dir="ltr">
      {ideas.map(idea => <button type="button" key={idea} className="md-chip" onClick={() => { setTyped(idea); audio?.key(); field.current?.focus(); }}>{idea}</button>)}
    </div>}
    <div className="md-term__quick" role="group" aria-label={w.tryWords} dir="ltr">
      {QUICK_COMMANDS.map(word => <button type="button" key={word} className="md-key md-key--word" data-command={word} onClick={() => { void selectionHaptic(); enter(word); }}>{word}</button>)}
    </div>
  </div>;
}

/** The small pictures the screen can play. Authored here; never built from input. */
const RAINBOW = ['poppy', 'orange', 'sun', 'spring', 'sea', 'bluebell', 'lilac'] as const;
const STARFALL: readonly (readonly [number, number])[] = [[6, 0], [18, 3], [31, 1], [44, 4], [57, 0], [70, 2], [83, 5], [94, 1], [12, 6], [38, 7], [64, 6], [88, 8]];
function TermPicture({ show }: { show: TermShow }) {
  if (show === 'wiggle') return <span className="md-term__wiggle"><PixelArt rows={WIGGLE_A} className="md-term__frame md-term__frame--a" /><PixelArt rows={WIGGLE_B} className="md-term__frame md-term__frame--b" /></span>;
  if (show === 'rainbow') return <span className="md-term__rainbow">{RAINBOW.map((ink, at) => <i key={ink} style={{ background: `var(--mk-${ink})`, animationDelay: `${at * 70}ms` }} />)}</span>;
  return <span className="md-term__starfall">{STARFALL.map(([x, y], at) => <i key={at} style={{ insetInlineStart: `${x}%`, animationDelay: `${y * 60}ms` }} />)}</span>;
}

function TermRow({ line, delay }: { line: TermLine; delay: number }) {
  const arrive = delay < 0 ? undefined : { animationDelay: `${Math.min(delay, 12) * 55}ms` } as CSSProperties;
  const born = delay >= 0;
  if (line.kind === 'cmd') return <p className="md-term__line md-term__line--cmd" dir="ltr" data-born={born} style={arrive}><span aria-hidden="true">&gt; </span>{line.text}</p>;
  if (line.kind === 'listing') return <p className="md-term__line md-term__line--files" dir="ltr" data-born={born} style={arrive}>{line.names.map(name => <span key={name} data-folder={name.endsWith('/')} data-hidden={name.startsWith('.')}>{name}</span>)}</p>;
  if (line.kind === 'hello') return <p className="md-term__line" dir="auto" data-born={born} style={arrive}>{line.before}{line.name && <> <bdi>{line.name}</bdi></>}{line.after}</p>;
  if (line.kind === 'show') return <p className="md-term__line md-term__line--show" dir="ltr" data-born={born} data-show={line.show} style={arrive} aria-hidden="true"><TermPicture show={line.show} /></p>;
  const code = line.code ? <bdi className="md-term__code" dir="ltr">{line.code}</bdi> : null;
  return <p className="md-term__line" data-tone={line.tone ?? 'plain'} data-born={born} style={arrive}>{line.codeLast ? <>{line.text} {code}</> : <>{code}{code && ' '}{line.text}</>}</p>;
}
