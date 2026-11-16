import { useEffect, useRef, useState, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import { CornerDownLeft } from 'lucide-react';
import type { DeskAudio } from './deskAudio';
import type { MakerDeskWords } from './makerDeskCopy';
import { INPUT_MAX, QUICK_COMMANDS, appendScreen, complete, run, suggest, type TerminalContext, type TermLine } from './makerDeskRules';

/** "Ask the computer": a toy terminal with a fixed vocabulary. Everything it
 * can answer comes from `run` in the rules (a fixed table and a fixed virtual
 * file map). What the child types lives only in this component's state: it is
 * never stored, sent or evaluated, and it is gone when the program closes. */
export function DeskTerminal({ w, lang, things, hello, audio, onCommand }: { w: MakerDeskWords; lang: 'en' | 'he'; things: TerminalContext['things']; hello: TerminalContext['hello']; audio: DeskAudio | null; onCommand: (command: string | null) => void }) {
  const [screen, setScreen] = useState<TermLine[]>(() => [{ kind: 'out', text: w.welcome, tone: 'title' }, { kind: 'out', text: w.terminalCue, tone: 'soft' }]);
  const [typed, setTyped] = useState('');
  const [riddle, setRiddle] = useState(0);
  const log = useRef<HTMLDivElement>(null);
  const field = useRef<HTMLInputElement>(null);
  useEffect(() => { const node = log.current; if (node) node.scrollTop = node.scrollHeight; }, [screen]);

  const enter = (text: string) => {
    const result = run(text, { lang, things, hello, riddle });
    const echo = text.replace(/\s+/g, ' ').trim().slice(0, INPUT_MAX);
    setScreen(current => appendScreen(current, result.clear ? result.lines : [{ kind: 'cmd', text: echo }, ...result.lines], result.clear));
    if (result.command === 'cat secret.txt') setRiddle(value => value + 1);
    if (result.sound === 'beep') audio?.beep(); else if (result.sound === 'unknown') audio?.hm(); else audio?.key();
    setTyped('');
    onCommand(result.command);
  };
  const submit = () => { if (typed.trim()) enter(typed); };
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
      {screen.map((line, index) => <TermRow key={index} line={line} />)}
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
      {QUICK_COMMANDS.map(word => <button type="button" key={word} className="md-key md-key--word" data-command={word} onClick={() => enter(word)}>{word}</button>)}
    </div>
  </div>;
}

function TermRow({ line }: { line: TermLine }) {
  if (line.kind === 'cmd') return <p className="md-term__line md-term__line--cmd" dir="ltr"><span aria-hidden="true">&gt; </span>{line.text}</p>;
  if (line.kind === 'listing') return <p className="md-term__line md-term__line--files" dir="ltr">{line.names.map(name => <span key={name} data-folder={name.endsWith('/')}>{name}</span>)}</p>;
  if (line.kind === 'hello') return <p className="md-term__line" dir="auto">{line.before}{line.name && <> <bdi>{line.name}</bdi></>}{line.after}</p>;
  const code = line.code ? <bdi className="md-term__code" dir="ltr">{line.code}</bdi> : null;
  return <p className="md-term__line" data-tone={line.tone ?? 'plain'}>{line.codeLast ? <>{line.text} {code}</> : <>{code}{code && ' '}{line.text}</>}</p>;
}
