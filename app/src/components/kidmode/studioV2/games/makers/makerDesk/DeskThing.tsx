import type { StudioCreation } from '../../../studioCreations';
import { StudioMakerPreview, isMakerCreation } from '../../../StudioMakerArt';

/** One saved creation at shelf size. The three makers draw their own preview
 * (whatever those components give us, at this size); the older kinds become
 * small authored keepsakes drawn from their saved choices: the cosy world as a
 * paper diorama, a tune as a music box, a dance as a little stage. */
const v = (name: string) => ({ fill: `var(--mk-${name})` });
const NOTE_INK = ['amber', 'sea', 'lilac'] as const;
const MOVE_INK = ['sun', 'sky', 'rose', 'lilac', 'sage', 'orange'] as const;
const OBJECT_INK: Readonly<Record<string, string>> = { cushion: 'rose', plant: 'leaf', books: 'bluebell', lamp: 'amber', blanket: 'lilac', panda: 'white', flowers: 'blossom', basket: 'wood-light' };

export function DeskThing({ creation, label }: { creation: StudioCreation; label: string }) {
  if (isMakerCreation(creation)) return <span className="md-thing md-thing--maker" data-thing={creation.kind}><StudioMakerPreview creation={creation} /></span>;
  return <span className="md-thing" data-thing={creation.kind} role="img" aria-label={label}>
    <svg viewBox="0 0 60 60" aria-hidden="true" focusable="false">
      <ellipse cx="30" cy="55" rx="22" ry="3" style={v('shadow')} opacity=".18" />
      {creation.kind === 'corner' ? <Corner creation={creation} /> : creation.kind === 'melody' ? <MusicBox notes={creation.notes} /> : creation.kind === 'dance' ? <Stage moves={creation.moves} /> : null}
    </svg>
  </span>;
}

function Corner({ creation }: { creation: Extract<StudioCreation, { kind: 'corner' }> }) {
  const wall = creation.light === 'night' ? 'indigo' : creation.light === 'evening' ? 'rose' : 'sky-pale';
  const floor = creation.scene === 'garden' ? 'sage' : creation.scene === 'sky' ? 'lilac' : 'wood-light';
  return <g>
    <path d="M8 18l22-8 22 8v32H8z" style={v('paper-shade')} />
    <path d="M11 20l19-7 19 7v18H11z" style={v(wall)} />
    <path d="M11 38h38v10H11z" style={v(floor)} />
    <path d="M8 18l22-8 22 8" fill="none" strokeWidth="2" strokeLinejoin="round" style={{ stroke: 'var(--mk-wood)' }} />
    {creation.layout.map((object, index) => object ? <rect key={index} x={14 + (index % 3) * 11} y={index < 3 ? 27 : 38} width="8" height={index < 3 ? 8 : 7} rx="2.5" style={v(OBJECT_INK[object] ?? 'cream')} /> : null)}
  </g>;
}
function MusicBox({ notes }: { notes: readonly number[] }) {
  return <g>
    <path d="M10 26h40v24a3 3 0 0 1-3 3H13a3 3 0 0 1-3-3z" style={v('wood')} />
    <path d="M8 20h44v8H8z" style={v('wood-light')} />
    <path d="M10 34h40v3H10z" style={v('gold')} />
    <circle cx="51" cy="42" r="3" style={v('brass')} /><path d="M54 42h4v-5" fill="none" strokeWidth="2" strokeLinecap="round" style={{ stroke: 'var(--mk-brass)' }} />
    {notes.slice(0, 6).map((note, index) => <circle key={index} cx={14 + index * 6.5} cy={12 - (index % 2) * 3} r="2.8" style={v(NOTE_INK[note] ?? 'amber')} />)}
  </g>;
}
function Stage({ moves }: { moves: readonly (number | null)[] }) {
  return <g>
    <path d="M18 6l-8 40h40L42 6z" style={v('butter')} opacity=".45" />
    <ellipse cx="30" cy="46" rx="22" ry="6" style={v('plum')} />
    <ellipse cx="30" cy="44" rx="22" ry="6" style={v('violet')} />
    <ellipse cx="30" cy="43" rx="16" ry="3.5" style={v('lilac')} opacity=".6" />
    {moves.map((move, index) => move === null ? null : <circle key={index} cx={30 + Math.cos(index * Math.PI / 4) * 14} cy={43 + Math.sin(index * Math.PI / 4) * 3.4} r="2.2" style={v(MOVE_INK[move] ?? 'sun')} />)}
    <path d="M30 18c6 4 6 12 0 16-6-4-6-12 0-16z" style={v('gold-light')} />
  </g>;
}
