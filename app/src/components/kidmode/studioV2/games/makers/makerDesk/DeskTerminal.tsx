import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CornerDownLeft } from 'lucide-react';
import { selectionHaptic } from '../../../../../../lib/native';
import type { DeskAudio } from './deskAudio';
import { PixelArt, WIGGLE_A, WIGGLE_B } from './DeskPixels';
import type { MakerDeskWords } from './makerDeskCopy';
import { INPUT_MAX, QUICK_COMMANDS, appendScreen, complete, run, suggest, type TermEffect, type TerminalContext, type TermLine, type TermShow } from './makerDeskRules';

/** "Ask the computer": a friendly machine with a blinking cursor, answers that
 * type themselves out, and big word keys. It is a toy with a fixed
 * vocabulary: everything it can answer comes from `run` in the rules (a fixed
 * table and a fixed virtual file map). What the child types lives only in this
 * component's state: it is never stored, sent or evaluated, and it is gone
 * when the program closes. A word key types its word into the prompt, letter
 * by letter, then enters it, so a child who cannot type sees how it is done. */
const KEY_MS = 55;
export function DeskTerminal({ w, lang, things, hello, riddle: firstRiddle = 0, audio, onCommand }: { w: MakerDeskWords; lang: 'en' | 'he'; things: TerminalContext['things']; hello: TerminalContext['hello']; riddle?: number; audio: DeskAudio | null; onCommand: (command: string | null, effect?: TermEffect) => void }) {
  const [screen, setScreen] = useState<TermLine[]>(() => [{ kind: 'out', text: w.welcome, tone: 'title' }, { kind: 'out', text: w.terminalCue, tone: 'soft' }]);
  const [typed, setTyped] = useState('');
  const [riddle, setRiddle] = useState(firstRiddle);
  /** Lines before this one were already on the screen; the rest arrive one after another. */
  const [fresh, setFresh] = useState(0);
  const [turn, setTurn] = useState(0);
  const [pressed, setPressed] = useState<string | null>(null);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  const keying = useRef<ReturnType<typeof setTimeout>[]>([]);
  // A new answer is read from its top: the echoed word sits at the top of the glass when the answer is longer than the glass, and the newest line shows otherwise.
  useEffect(() => {
    const node = log.current; if (!node) return;
    const first = node.querySelector?.<HTMLElement>('[data-first="true"]');
    const end = node.scrollHeight - node.clientHeight;
    node.scrollTop = first ? Math.min(Math.max(0, first.offsetTop - 10), end) : end;
  }, [screen]);
  useEffect(() => { const node = log.current; if (node && typed) node.scrollTop = node.scrollHeight; }, [typed]);
  useEffect(() => () => { for (const id of keying.current) clearTimeout(id); keying.current = []; }, []);

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
  /** A word key: the machine types the word, then enters it. Plain timers; a second key waits its turn by replacing the first. */
  const press = (word: string) => {
    void selectionHaptic();
    for (const id of keying.current) clearTimeout(id); keying.current = [];
    setPressed(word);
    if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) { setPressed(null); enter(word); return; }
    [...word].forEach((_letter, at) => keying.current.push(setTimeout(() => { setTyped(word.slice(0, at + 1)); audio?.key(); }, at * KEY_MS)));
    keying.current.push(setTimeout(() => { keying.current = []; setPressed(null); enter(word); }, word.length * KEY_MS + 140));
  };
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
      {screen.map((line, index) => <TermRow key={index < fresh ? index : `${turn}-${index}`} line={line} delay={index < fresh ? -1 : index - fresh} first={index === fresh && turn > 0} />)}
      <div className="md-term__prompt" dir="ltr">
        <span className="md-term__caret" aria-hidden="true">&gt;</span>
        <span className="md-term__typing">
          <span className="md-term__echo" aria-hidden="true">{typed}<i className="md-term__cursor" /></span>
          <input ref={field} className="md-term__input field-bare" type="text" dir="ltr" value={typed} maxLength={INPUT_MAX} aria-label={w.input}
            autoComplete="off" autoCorrect="off" autoCapitalize="off" spellCheck={false} enterKeyHint="send"
            onChange={e => { setTyped(e.target.value.slice(0, INPUT_MAX)); audio?.key(); }} onKeyDown={keys} />
        </span>
        <button type="button" className="md-term__enter" aria-label={w.enter} disabled={!typed.trim()} onClick={submit}><CornerDownLeft size={22} aria-hidden="true" /></button>
      </div>
    </div>
    {ideas.length > 0 && <div className="md-term__ideas" role="group" aria-label={w.complete} dir="ltr">
      {ideas.map(idea => <button type="button" key={idea} className="md-chip" onClick={() => { setTyped(idea); audio?.key(); field.current?.focus(); }}>{idea}</button>)}
    </div>}
    <div className="md-term__keys" role="group" aria-label={w.tryWords} dir="ltr">
      {QUICK_COMMANDS.map(word => <button type="button" key={word} className="md-keycap" data-command={word} data-down={pressed === word} onClick={() => press(word)}><span>{word}</span></button>)}
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

/** An answer types itself out. The whole line is in the page from the start
 * (so it is read once, whole, and the layout never jumps); the letters not
 * yet typed are simply unseen. A timer, never an animation event. */
function Typed({ text, wait }: { text: string; wait: number }) {
  const still = typeof window !== 'undefined' && !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
  const [shown, setShown] = useState(still ? text.length : 0);
  useEffect(() => {
    if (shown >= text.length) return;
    const timer = setTimeout(() => setShown(value => Math.min(text.length, value + 2)), shown === 0 ? wait : 18);
    return () => clearTimeout(timer);
  }, [shown, text, wait]);
  if (shown >= text.length) return <>{text}</>;
  return <>{text.slice(0, shown)}<i className="md-term__cursor md-term__cursor--ink" aria-hidden="true" /><span className="md-term__unseen">{text.slice(shown)}</span></>;
}

function TermRow({ line, delay, first = false }: { line: TermLine; delay: number; first?: boolean }) {
  // Lines of one answer follow each other quickly; only the first few type themselves out, so a long list is never a long wait.
  const wait = Math.min(Math.max(delay, 0), 14) * 110;
  const arrive = delay < 0 ? undefined : { animationDelay: `${wait}ms` } as CSSProperties;
  const born = delay >= 0;
  const text = (value: string) => (born && delay <= 3 ? <Typed text={value} wait={wait + 60} /> : value);
  if (line.kind === 'cmd') return <p className="md-term__line md-term__line--cmd" dir="ltr" data-born={born} data-first={first} style={arrive}><span aria-hidden="true">&gt; </span>{line.text}</p>;
  if (line.kind === 'listing') return <p className="md-term__line md-term__line--files" dir="ltr" data-born={born} style={arrive}>{line.names.map(name => <span key={name} data-folder={name.endsWith('/')} data-hidden={name.startsWith('.')}>{name}</span>)}</p>;
  if (line.kind === 'hello') return <p className="md-term__line" dir="auto" data-born={born} style={arrive}>{line.before}{line.name && <> <bdi>{line.name}</bdi></>}{line.after}</p>;
  if (line.kind === 'show') return <p className="md-term__line md-term__line--show" dir="ltr" data-born={born} data-show={line.show} style={arrive} aria-hidden="true"><TermPicture show={line.show} /></p>;
  const code = line.code ? <bdi className="md-term__code" dir="ltr">{line.code}</bdi> : null;
  return <p className="md-term__line" data-tone={line.tone ?? 'plain'} data-born={born} style={arrive}>{line.codeLast ? <>{text(line.text)} {code}</> : <>{code}{code && ' '}{text(line.text)}</>}</p>;
}
