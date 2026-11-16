import { describe, expect, it } from 'vitest';
import { MAKER_DESK_COPY } from './makerDeskCopy';
import {
  BALL, BALL_SPEED, FIELD_H, FIELD_W, FLOAT_S, LANTERN_COUNT, LAYOUTS, MAX_ANGLE, PADDLE_W, PADDLE_Y, PROGRAMS, QUICK_COMMANDS, ROOM, STEP_S, THING_FILES, THING_KINDS,
  advance, allStickers, appendScreen, backTarget, bounceStep, chimeStep, complete, fromHebrewKeys, layoutLanterns, litCount, movePaddle, newBounce, normalizeInput,
  noteCommand, noteLanterns, noteThings, NO_DISCOVERY, openProgram, paddleBounce, run, shelfPlaces, skyPicture, stepBack, stepsToRoom, stickerLit, suggest,
  switchOn, thingKinds, vocabulary, type BounceState, type Level, type TerminalContext, type TermLine,
} from './makerDeskRules';

/** A seeded random source, so every layout and run repeats exactly. */
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const ctx = (over: Partial<TerminalContext> = {}): TerminalContext => ({ lang: 'en', things: [], hello: { word: 'Hi', noName: 'Hi there!', name: null }, riddle: 0, ...over });
const en = MAKER_DESK_COPY.en, he = MAKER_DESK_COPY.he;

/** Every piece of text a result could show, flattened. */
function texts(lines: readonly TermLine[]): string[] {
  return lines.flatMap(line => line.kind === 'listing' ? [...line.names] : line.kind === 'hello' ? [line.before, line.name ?? '', line.after] : line.kind === 'cmd' ? [line.text] : [line.text, line.code ?? '']);
}
/** Every answer the toy could ever give, for any child, in both languages. */
function fixedTexts(): Set<string> {
  const out = new Set<string>(['about.txt', 'secret.txt', 'things/', ...Object.values(THING_FILES), ...vocabulary([...THING_KINDS])]);
  const walk = (value: unknown) => { if (typeof value === 'string') out.add(value); else if (value && typeof value === 'object') Object.values(value).forEach(walk); };
  walk(MAKER_DESK_COPY);
  return out;
}

describe('levels: room → desktop → program, one step back at a time', () => {
  const every: Level[] = [ROOM, { at: 'desktop' }, ...PROGRAMS.map(program => ({ at: 'program', program }) as Level)];
  it('switches on only from the room and opens programs only from the desktop', () => {
    expect(switchOn(ROOM)).toEqual({ at: 'desktop' });
    expect(switchOn({ at: 'desktop' })).toEqual({ at: 'desktop' });
    expect(openProgram(ROOM, 'bounce')).toEqual(ROOM);
    expect(openProgram({ at: 'desktop' }, 'ask')).toEqual({ at: 'program', program: 'ask' });
    expect(openProgram({ at: 'desktop' }, 'shell')).toEqual({ at: 'desktop' });
    expect(openProgram({ at: 'program', program: 'things' }, 'bounce')).toEqual({ at: 'program', program: 'things' });
  });
  it('every level reaches the room in at most two steps, and the tab names where it leads', () => {
    for (const level of every) {
      expect(stepsToRoom(level)).toBeLessThanOrEqual(2);
      let at = level; for (let i = 0; i < 2; i++) at = stepBack(at); expect(at).toEqual(ROOM);
    }
    expect(stepBack({ at: 'program', program: 'bounce' })).toEqual({ at: 'desktop' });
    expect(stepBack({ at: 'desktop' })).toEqual(ROOM);
    expect(stepBack(ROOM)).toEqual(ROOM);
    expect(backTarget({ at: 'program', program: 'things' })).toBe('desktop');
    expect(backTarget({ at: 'desktop' })).toBe('study');
    expect(backTarget(ROOM)).toBeNull();
  });
});

describe('the shelf and the clock', () => {
  it('fills six places with the kinds the child has, once each, in shelf order', () => {
    expect(shelfPlaces([])).toEqual([null, null, null, null, null, null]);
    expect(shelfPlaces(['dance', 'bowl', 'bowl', 'nonsense'])).toEqual(['bowl', 'dance', null, null, null, null]);
    expect(thingKinds(['bottle', 'textile', 'corner', 'melody', 'bowl', 'dance'])).toEqual([...THING_KINDS]);
  });
  it('the clock is a picture: sun by day, moon by night', () => {
    expect(skyPicture(6)).toBe('day'); expect(skyPicture(17)).toBe('day');
    expect(skyPicture(18)).toBe('night'); expect(skyPicture(2)).toBe('night'); expect(skyPicture(Number.NaN)).toBe('day');
  });
});

describe('the pretend terminal is a closed toy', () => {
  it('answers each known word from the fixed table', () => {
    expect(run('help', ctx()).lines[0]).toEqual({ kind: 'out', text: en.helpTitle, tone: 'title' });
    expect(run('ls', ctx()).lines).toEqual([{ kind: 'listing', names: ['about.txt', 'secret.txt', 'things/'] }]);
    expect(texts(run('cat about.txt', ctx()).lines)).toEqual(expect.arrayContaining([...en.about]));
    expect(texts(run('cat secret.txt', ctx({ riddle: 1 })).lines)).toEqual(expect.arrayContaining([...en.riddles[1]]));
    expect(run('beep', ctx()).sound).toBe('beep');
    expect(run('clear', ctx())).toMatchObject({ clear: true, lines: [], command: 'clear' });
  });
  it('lists one file per saved kind and describes it in plain words', () => {
    expect(texts(run('ls things', ctx()).lines)).toEqual([en.thingsEmptyTerm, '']);
    const mine = ctx({ things: ['dance', 'bowl'] });
    expect(run('ls things', mine).lines).toEqual([{ kind: 'listing', names: ['bowl', 'dance'] }]);
    expect(texts(run('cat things/bowl', mine).lines)).toContain(en.things_.bowl);
    expect(run('cat things/bowl', mine).command).toBe('cat things/bowl');
    // A kind the child has not made is not in the folder.
    expect(texts(run('cat things/bottle', mine).lines)).toEqual([en.noFile, '']);
  });
  it('greets with the first name by the Studio convention, or without one', () => {
    expect(run('hello', ctx({ hello: { word: 'Hi', noName: 'Hi there!', name: 'Noa' } })).lines).toEqual([{ kind: 'hello', before: 'Hi', name: 'Noa', after: `! ${en.helloMore}` }]);
    expect(run('hi', ctx()).lines).toEqual([{ kind: 'hello', before: 'Hi there!', name: null, after: ` ${en.helloMore}` }]);
  });
  it('answers in the UI language while the commands stay in English letters', () => {
    const h = ctx({ lang: 'he' });
    expect(texts(run('cat about.txt', h).lines)).toEqual(expect.arrayContaining([...he.about]));
    expect(run('help', h).lines.slice(1).every(line => line.kind === 'out' && /^[a-z .]+$/.test(line.code ?? ''))).toBe(true);
    expect(texts(run('nope', h).lines)).toEqual([he.unknown, '']);
  });
  it('reads a Hebrew-layout keyboard as the Latin keys it pressed', () => {
    expect(fromHebrewKeys('ךד')).toBe('ls');
    expect(fromHebrewKeys('יקךפ')).toBe('help');
    expect(fromHebrewKeys('בשא שנםוא.אסא')).toBe('cat about/txt');
    const read = run('ךד', ctx({ lang: 'he' }));
    expect(read.readAs).toBe('ls'); expect(read.command).toBe('ls'); expect(read.lines[0]).toMatchObject({ code: 'ls', codeLast: true, text: he.keyboard });
    expect(run('שלום', ctx({ lang: 'he' })).command).toBeNull();
  });
  it('normalises spacing, case and invisible marks, and refuses very long input', () => {
    expect(run('  LS   things ', ctx({ things: ['bowl'] })).command).toBe('ls things');
    expect(run('he​llo', ctx()).command).toBe('hello');
    expect(normalizeInput('x'.repeat(41))).toBe('');
    expect(normalizeInput(42)).toBe('');
    expect(run(`help${' '.repeat(10)}${'a'.repeat(40)}`, ctx()).command).toBeNull();
  });

  const HOSTILE = [
    'cat ../secret.txt', 'cat things/../secret.txt', 'cat ./about.txt', 'cat /etc/passwd', 'cat ~/.ssh/id_rsa', 'ls ..', 'ls /', 'cd ..', 'ls -la',
    'cat about.txt; rm -rf /', 'help && ls', 'help | cat', '$(ls)', '`ls`', 'echo hi', 'eval("1+1")', 'alert(1)', '<script>alert(1)</script>',
    'javascript:alert(1)', 'fetch("https://example.com")', 'curl https://example.com', 'wget example.com', 'import("x")', 'require("fs")',
    'window.location="x"', 'localStorage.clear()', 'document.cookie', '{{7*7}}', '${7*7}', '__proto__', 'constructor', 'toString', 'hasOwnProperty',
    'cat __proto__', 'cat constructor', 'cat things/__proto__', 'cat things/constructor', 'cat things/', 'ls things/..', 'sudo help', 'HELP;', 'help\nls',
    'כתובת', '😀', '', '   ', 'a'.repeat(500), '‮help', 'cat\tabout.txt\u0000',
  ];
  it('arbitrary strings, .. paths and script-like input only ever give fixed text', () => {
    const fixed = fixedTexts();
    const random = seeded(7), alphabet = 'abcdefghijklmnopqrstuvwxyz ./-_$`;|&<>(){}"\'\\~*?!#%=+0123456789אבגדהוזחטיכלמנסעפצקרשת';
    const fuzz = Array.from({ length: 400 }, () => Array.from({ length: 1 + Math.floor(random() * 30) }, () => alphabet[Math.floor(random() * alphabet.length)]).join(''));
    for (const input of [...HOSTILE, ...fuzz]) for (const lang of ['en', 'he'] as const) {
      const out = run(input, ctx({ lang, things: ['bowl', 'dance'], hello: { word: 'Hi', noName: 'Hi there!', name: 'Noa' } }));
      for (const text of texts(out.lines)) expect(text === '' || text === 'Noa' || fixed.has(text) || fixed.has(text.replace(/^! /, '').replace(/^ /, '')), `${JSON.stringify(input)} → ${text}`).toBe(true);
      // No answer ever repeats what was typed (unless it is itself a fixed word).
      const typed = normalizeInput(input);
      if (typed.length > 2 && !fixed.has(typed)) for (const text of texts(out.lines)) expect(text.includes(typed) && !fixed.has(text), `${input} echoed`).toBe(false);
    }
    for (const input of HOSTILE) {
      const out = run(input, ctx({ things: ['bowl'] }));
      const known = ['ls things', 'help', 'clear'].includes(out.command ?? '');
      expect(out.command === null || known, input).toBe(true);
    }
  });
  it('a path with .. never reaches another file', () => {
    for (const input of ['cat ../secret.txt', 'cat things/../secret.txt', 'cat things/../about.txt', 'cat ./things/bowl', 'cat things//bowl', 'cat things/bowl/..']) {
      expect(texts(run(input, ctx({ things: ['bowl'] })).lines), input).toEqual([en.noFile, '']);
    }
  });
  it('nearly-right input gets a fixed nudge that does not count as a command', () => {
    expect(run('cat', ctx())).toMatchObject({ command: null, lines: [{ text: en.catNeeds }] });
    expect(run('cat things', ctx())).toMatchObject({ command: null, lines: [{ text: en.isFolder }] });
  });
  it('autocompletes only from the command table and the child’s file names', () => {
    expect(suggest('c', [])).toEqual(['cat about.txt', 'cat secret.txt', 'clear']);
    expect(suggest('cat t', ['bowl', 'textile'])).toEqual(['cat things/bowl', 'cat things/cloth']);
    expect(suggest('', [])).toEqual([]); expect(suggest('zz', [])).toEqual([]);
    expect(complete('he', [])).toBe('hel'); expect(complete('hell', [])).toBe('hello');
    expect(complete('ca', [])).toBe('cat ');
    expect(complete('cat things/c', ['textile'])).toBe('cat things/cloth');
    expect(complete('zzz', [])).toBe('zzz');
    expect(QUICK_COMMANDS.every(word => run(word, ctx()).command === word)).toBe(true);
  });
  it('keeps the screen to its newest lines', () => {
    const many = Array.from({ length: 80 }, (_, i) => ({ kind: 'cmd', text: `line ${i}` }) as TermLine);
    const screen = appendScreen([], many);
    expect(screen).toHaveLength(60); expect(screen[59]).toEqual({ kind: 'cmd', text: 'line 79' });
    expect(appendScreen(screen, [], true)).toEqual([]);
  });
});

describe('Bounce: gentle, skilful and impossible to lose', () => {
  const still = { dir: 0, target: null } as const;
  /** Runs until the cloud has launched the ball. */
  const launched = (state: BounceState) => { let s = state; for (let i = 0; i < 400 && s.floating > 0; i++) s = bounceStep(s, still).state; return s; };
  it('lays out fifteen lanterns inside the field, never overlapping, in every layout', () => {
    for (const layout of LAYOUTS) for (let seed = 0; seed < 5; seed++) {
      const lanterns = layoutLanterns(seeded(seed), layout);
      expect(lanterns).toHaveLength(LANTERN_COUNT);
      for (const [i, a] of lanterns.entries()) {
        expect(a.x).toBeGreaterThanOrEqual(0); expect(a.x + a.w).toBeLessThanOrEqual(FIELD_W); expect(a.y).toBeGreaterThan(BALL); expect(a.y + a.h).toBeLessThan(PADDLE_Y - 30);
        for (const b of lanterns.slice(i + 1)) expect(a.x + a.w <= b.x || b.x + b.w <= a.x || a.y + a.h <= b.y || b.y + b.h <= a.y).toBe(true);
      }
    }
    expect(layoutLanterns(seeded(1), 'grid').map(l => l.hue)).not.toEqual(layoutLanterns(seeded(9), 'grid').map(l => l.hue));
  });
  it('re-seeding gives a new arrangement', () => {
    const seen = new Set(Array.from({ length: 12 }, (_, seed) => JSON.stringify(newBounce(seeded(seed)).lanterns)));
    expect(seen.size).toBeGreaterThan(3);
  });
  it('starts on the cloud and floats up, then launches at a steady speed', () => {
    const start = newBounce(seeded(1));
    expect(start.floating).toBe(FLOAT_S); expect(start.lit.every(on => !on)).toBe(true);
    const half = bounceStep(start, still, FLOAT_S / 2).state;
    expect(half.ball.y).toBeLessThan(start.ball.y);
    const out = launched(start);
    expect(Math.hypot(out.ball.vx, out.ball.vy)).toBeCloseTo(BALL_SPEED, 5); expect(out.ball.vy).toBeLessThan(0);
  });
  it('the hit point on the paddle sets the angle: middle goes straight up, ends lean out', () => {
    const middle = paddleBounce(80, 80), right = paddleBounce(80 + PADDLE_W / 2, 80), left = paddleBounce(80 - PADDLE_W / 2, 80);
    expect(middle.vx).toBeCloseTo(0); expect(middle.vy).toBeCloseTo(-BALL_SPEED);
    expect(right.vx).toBeGreaterThan(30); expect(left.vx).toBeLessThan(-30); expect(right.vy).toBeLessThan(0);
    const state: BounceState = { ...newBounce(seeded(2)), floating: 0, paddle: 80, ball: { x: 92, y: PADDLE_Y - BALL / 2 - 0.2, vx: 0, vy: BALL_SPEED } };
    const out = bounceStep(state, still);
    expect(out.events).toContainEqual({ type: 'paddle' }); expect(out.state.ball.vy).toBeLessThan(0); expect(out.state.ball.vx).toBeGreaterThan(0);
  });
  it('a dark lantern lights when touched and turns the ball; a glowing one lets it through', () => {
    const base = newBounce(seeded(3), 'grid'); const l = base.lanterns[7];
    const state: BounceState = { ...base, floating: 0, ball: { x: l.x + l.w / 2, y: l.y + l.h + BALL / 2 + 0.1, vx: 0, vy: -BALL_SPEED } };
    const out = bounceStep(state, still);
    expect(out.events).toContainEqual({ type: 'lantern', index: 7 });
    expect(out.state.lit[7]).toBe(true); expect(out.state.lanterns).toHaveLength(LANTERN_COUNT); expect(out.state.ball.vy).toBeGreaterThan(0);
    const again = bounceStep({ ...out.state, ball: state.ball }, still);
    expect(again.events).toEqual([]); expect(again.state.ball.vy).toBeLessThan(0); expect(litCount(again.state.lit)).toBe(1);
  });
  it('a missed ball sinks into the cloud and comes back: no lives, no ending', () => {
    let state: BounceState = { ...newBounce(seeded(4)), floating: 0, paddle: 20, ball: { x: 140, y: FIELD_H - 2, vx: 0, vy: BALL_SPEED } };
    for (let miss = 0; miss < 5; miss++) {
      let cloud = false;
      for (let i = 0; i < 2000 && !cloud; i++) { const out = bounceStep(state, { dir: 0, target: 20 }); state = out.state; cloud = out.events.some(e => e.type === 'cloud'); }
      expect(cloud).toBe(true); expect(state.done).toBe(false); expect(state.floating).toBe(FLOAT_S);
      state = launched(state); expect(state.ball.vy).toBeLessThan(0);
    }
    expect(Object.keys(state).sort()).toEqual(['ball', 'done', 'floating', 'lanterns', 'launches', 'lit', 'paddle']);
  });
  it('the ball stays inside the field and keeps its speed over a long, untouched run', () => {
    let state = launched(newBounce(seeded(5)));
    for (let i = 0; i < 120 * 90; i++) {
      state = bounceStep(state, still).state;
      expect(state.ball.x).toBeGreaterThanOrEqual(0); expect(state.ball.x).toBeLessThanOrEqual(FIELD_W); expect(state.ball.y).toBeGreaterThanOrEqual(0); expect(state.ball.y).toBeLessThanOrEqual(FIELD_H + BALL + 2);
      if (state.floating === 0) expect(Math.hypot(state.ball.vx, state.ball.vy)).toBeCloseTo(BALL_SPEED, 3);
    }
  });
  /** Where a falling ball will meet the paddle line, walls included. */
  const landing = (b: { x: number; y: number; vx: number; vy: number }) => {
    const r = BALL / 2, lo = r, span = FIELD_W - 2 * r, x = b.x + b.vx * ((PADDLE_Y - r - b.y) / b.vy);
    const u = (((x - lo) % (2 * span)) + 2 * span) % (2 * span); return lo + (u > span ? 2 * span - u : u);
  };
  it.each([3, 11, 29])('a child who aims with the paddle lights every lantern, once, then the round is done (layout %i)', seed => {
    let state = newBounce(seeded(seed)); let all = 0; let carry = 0;
    for (let frame = 0; frame < 60 * 300 && !state.done; frame++) {
      // Skill, by rule: meet the ball off-centre so it leans toward a dark lantern.
      let goal = state.paddle;
      if (state.ball.vy > 0) {
        const at = landing(state.ball), dark = state.lanterns.find((_, i) => !state.lit[i])!;
        const lean = Math.max(-MAX_ANGLE, Math.min(MAX_ANGLE, Math.atan2(dark.x + dark.w / 2 - at, PADDLE_Y - dark.y - dark.h) * 180 / Math.PI));
        goal = at - lean / MAX_ANGLE * (PADDLE_W / 2 + BALL / 2);
      }
      const out = advance(state, { dir: 0, target: goal }, carry, 1 / 60);
      state = out.state; carry = out.carry; all += out.events.filter(e => e.type === 'allLit').length;
    }
    expect(state.done).toBe(true); expect(all).toBe(1); expect(litCount(state.lit)).toBe(LANTERN_COUNT);
    expect(bounceStep(state, still).events).toEqual([]);
  });
  it('moves the paddle by arrows and by drag, never out of the field', () => {
    expect(movePaddle(80, { dir: 1, target: null }, 1)).toBe(FIELD_W - PADDLE_W / 2);
    expect(movePaddle(80, { dir: -1, target: null }, 0.1)).toBeCloseTo(69);
    expect(movePaddle(80, { dir: 0, target: 82 })).toBe(82);
    expect(movePaddle(80, { dir: 0, target: -50 }, 1)).toBe(PADDLE_W / 2);
    expect(movePaddle(80, { dir: 0, target: Number.NaN })).toBe(80);
  });
  it('a stalled frame runs a capped number of fixed steps', () => {
    const out = advance(launched(newBounce(seeded(8))), still, 0, 5);
    expect(out.carry).toBeLessThan(STEP_S);
    expect(chimeStep(1)).toBe(0); expect(chimeStep(99)).toBe(LANTERN_COUNT - 1);
  });
});

describe('desk stickers', () => {
  it('lights each sticker by its discovery; two different known commands light the third', () => {
    let d = NO_DISCOVERY;
    d = noteCommand(d, 'help'); d = noteCommand(d, 'help'); d = noteCommand(d, null);
    expect(stickerLit(d, 'commands')).toBe(false);
    d = noteCommand(d, 'ls'); expect(stickerLit(d, 'commands')).toBe(true);
    d = noteCommand(d, 'clear'); expect(d.commands).toEqual(['help', 'ls']);
    expect(allStickers(d)).toBe(false);
    d = noteThings(noteLanterns(d)); expect(allStickers(d)).toBe(true);
    expect(noteThings(d)).toBe(d);
  });
});
