import { describe, expect, it } from 'vitest';
import { MAKER_DESK_COPY } from './makerDeskCopy';
import {
  BALL, BALL_SPEED, CHAPTERS, CREW, FIELD_H, FIELD_H_MAX, FIELD_W, FILES, FLOAT_S, HIDDEN_FILE, LANTERN_COLS, LANTERN_COUNT, LAYOUTS, MAGIC_WORD, MAX_ANGLE, NEW_QUEST, PADDLE_W, PADDLE_Y, PLANT_FULL, POWER_UP, POWER_UP_REDUCED, PROGRAMS, QUICK_COMMANDS, ROOM,
  ROOM_LIGHTS, STEP_S, TERM_SHOWS, THING_FILES, THING_KINDS, TOOLS, TOOLS_TO_WAKE, TOOL_ORDERS, WORDS_TO_ASK,
  advance, appendScreen, backTarget, benchAwake, benchPower, bounceStep, chainAfter, chainHarmony, chapterDone, chapterNow, chimeStep, complete, crewAround, deskRound, fieldHeight, fromHebrewKeys, growPlant, lanternRow, layoutLanterns, litCount, movePaddle,
  newBounce, nextTool, normalizeInput, noteCommand, noteLanterns, openProgram, paddleBounce, paddleTop, pickLayout, questDone, rowLit, run, screenGlow, shelfNews, shelfPlaces, skyPicture, stepBack, stepsToRoom, suggest,
  switchOn, thingKinds, toolAt, toolOrder, vocabulary, wakeTool, type BounceEvent, type BounceState, type Level, type Quest, type TerminalContext, type TermLine,
} from './makerDeskRules';

/** A seeded random source, so every layout and run repeats exactly. */
function seeded(seed: number) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 2 ** 32; }; }
const ctx = (over: Partial<TerminalContext> = {}): TerminalContext => ({ lang: 'en', things: [], hello: { word: 'Hi', noName: 'Hi there!', name: null }, riddle: 0, ...over });
const en = MAKER_DESK_COPY.en, he = MAKER_DESK_COPY.he;

/** Every piece of text a result could show, flattened. */
function texts(lines: readonly TermLine[]): string[] {
  return lines.flatMap(line => {
    // A picture carries no words at all: it names one of the authored shows.
    if (line.kind === 'show') { expect(TERM_SHOWS).toContain(line.show); expect(Object.keys(line).sort()).toEqual(['kind', 'show']); return []; }
    return line.kind === 'listing' ? [...line.names] : line.kind === 'hello' ? [line.before, line.name ?? '', line.after] : line.kind === 'cmd' ? [line.text] : [line.text, line.code ?? ''];
  });
}
/** Every answer the toy could ever give, for any child, in both languages. */
function fixedTexts(): Set<string> {
  const out = new Set<string>([...FILES, HIDDEN_FILE, MAGIC_WORD, ...Object.values(THING_FILES), ...vocabulary([...THING_KINDS])]);
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
    expect(openProgram({ at: 'program', program: 'ask' }, 'bounce')).toEqual({ at: 'program', program: 'ask' });
    // The child's things are on the shelf in the room now, not a program inside the screen.
    expect(PROGRAMS).toEqual(['bounce', 'ask']); expect(openProgram({ at: 'desktop' }, 'things')).toEqual({ at: 'desktop' });
  });
  it('every level reaches the room in at most two steps, and the tab names where it leads', () => {
    for (const level of every) {
      expect(stepsToRoom(level)).toBeLessThanOrEqual(2);
      let at = level; for (let i = 0; i < 2; i++) at = stepBack(at); expect(at).toEqual(ROOM);
    }
    expect(stepBack({ at: 'program', program: 'bounce' })).toEqual({ at: 'desktop' });
    expect(stepBack({ at: 'desktop' })).toEqual(ROOM);
    expect(stepBack(ROOM)).toEqual(ROOM);
    expect(backTarget({ at: 'program', program: 'ask' })).toBe('desktop');
    expect(backTarget({ at: 'desktop' })).toBe('study');
    expect(backTarget(ROOM)).toBeNull();
  });
});

describe('the room toys', () => {
  it('the flower grows with each watering and opens on the third, then stays open', () => {
    expect(PLANT_FULL).toBe(3);
    expect([0, 1, 2, 3, 9].map(growPlant)).toEqual([1, 2, 3, 3, 3]); expect(growPlant(Number.NaN)).toBe(1); expect(growPlant(-4)).toBe(1);
  });
  it('a tap on the trays takes the tool under the finger; a keyboard press takes the next along', () => {
    expect(TOOLS).toEqual(['proofLens', 'viewCheck', 'pulsePod', 'leafLab', 'clearPatch']);
    expect([0, 0.19, 0.2, 0.5, 0.79, 0.8, 1, 7, -3, Number.NaN].map(toolAt)).toEqual(['proofLens', 'proofLens', 'viewCheck', 'pulsePod', 'leafLab', 'clearPatch', 'clearPatch', 'clearPatch', 'proofLens', 'proofLens']);
    let tool = nextTool(null); const seen = [tool];
    for (let i = 0; i < 5; i++) { tool = nextTool(tool); seen.push(tool); }
    expect(seen).toEqual([...TOOLS, 'proofLens']);
  });
  it('CrewLink: Chock is always at the desk, Aya while she visits, and one friend drops by each sitting', () => {
    for (let guest = 0; guest < 6; guest++) for (const aya of [true, false]) {
      const around = crewAround(guest, aya);
      expect(Object.keys(around)).toEqual([...CREW]); expect(around.chock).toBe(true); expect(around.aya).toBe(aya);
      expect([around.bebe, around.gobgob, around.pep].filter(Boolean)).toHaveLength(1);
    }
    expect(new Set([0, 1, 2].map(guest => JSON.stringify(crewAround(guest, false)))).size).toBe(3);
    expect(crewAround(Number.NaN, false).chock).toBe(true);
  });
  it('notices what is new on the show steps since last time, and nothing on a first visit', () => {
    expect(shelfNews(null, { bowl: 'a', dance: 'b' })).toEqual([]);
    expect(shelfNews({ bowl: 'a' }, { bowl: 'a' })).toEqual([]);
    expect(shelfNews({ bowl: 'a' }, { bowl: 'a2', dance: 'b' })).toEqual(['bowl', 'dance']);
    expect(shelfNews({ bowl: 'a', dance: 'b' }, { dance: 'b' })).toEqual([]);
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
    expect(run('ls', ctx()).lines).toEqual([{ kind: 'listing', names: ['about.txt', 'secret.txt', 'valley.txt', 'things/'] }]);
    expect(texts(run('cat about.txt', ctx()).lines)).toEqual(expect.arrayContaining([...en.about]));
    expect(texts(run('cat secret.txt', ctx({ riddle: 1 })).lines)).toEqual(expect.arrayContaining([...en.riddles[1]]));
    expect(run('beep', ctx()).sound).toBe('beep');
    expect(run('clear', ctx())).toMatchObject({ clear: true, lines: [], command: 'clear' });
  });
  it('knows the kit: the crew, the tools in the trays and the six places, as fixed lines', () => {
    const crew = run('crew', ctx());
    expect(crew.command).toBe('crew'); expect(texts(crew.lines).filter(Boolean)).toEqual([en.crewTitle, ...CREW.map(id => en.crewLines[id])]);
    const tools = run('tools', ctx({ lang: 'he' }));
    expect(tools.lines.slice(1)).toEqual(TOOLS.map(id => ({ kind: 'out', code: he.toolNames[id], text: he.toolLines[id] })));
    expect(Object.keys(en.toolDo).length).toBeGreaterThanOrEqual(TOOLS.length);
    expect(run('valley', ctx()).command).toBe('cat valley.txt'); expect(texts(run('cat valley.txt', ctx()).lines)).toEqual(expect.arrayContaining([...en.valley]));
    for (const place of ['Wonderworks', 'Glass Grove', 'Mirror Quarter', 'Sky Gardens', 'Reflection Basin', 'Horizon Dome']) expect(en.valley.join(' ')).toContain(place);
  });
  it('the delightful words are fixed too: a wiggle, a song, a rainbow, and the lamp as the one effect outside the screen', () => {
    expect(run('dance', ctx()).lines).toEqual([{ kind: 'out', text: en.dance }, { kind: 'show', show: 'wiggle' }]);
    expect(run('sing', ctx())).toMatchObject({ sound: 'singSong', effect: null, command: 'sing' });
    expect(run('rainbow', ctx()).lines[0]).toEqual({ kind: 'show', show: 'rainbow' });
    expect(run('lamp', ctx())).toMatchObject({ effect: 'lamp', command: 'lamp' });
    expect(run('whoami', ctx()).lines).toEqual([{ kind: 'out', text: en.whoami, tone: 'title' }]);
    // Nothing else has an effect: not unknown words, and not words that only look like the lamp.
    for (const input of ['lamp on', 'lamps', 'cat lamp', 'help', 'ls', 'nope', '']) expect(run(input, ctx()).effect, input).toBeNull();
  });
  it('hides one trail for a curious child: a riddle, a dot file, a magic word', () => {
    expect(en.riddles.at(-1)![1]).toContain('ls -a'); expect(he.riddles.at(-1)![1]).toContain('ls -a');
    expect(texts(run('cat secret.txt', ctx({ riddle: en.riddles.length - 1 })).lines)).toContain(en.riddles.at(-1)![1]);
    expect(run('ls', ctx()).lines).not.toEqual(run('ls -a', ctx()).lines);
    expect(run('ls -a', ctx()).lines).toEqual([{ kind: 'listing', names: [HIDDEN_FILE, ...FILES] }]);
    expect(run(`cat ${HIDDEN_FILE}`, ctx()).lines).toEqual([{ kind: 'out', text: en.magicFile, code: MAGIC_WORD, codeLast: true, tone: 'joke' }]);
    expect(run(MAGIC_WORD, ctx())).toMatchObject({ sound: 'magicChime', command: MAGIC_WORD, lines: [{ kind: 'show', show: 'starfall' }, { kind: 'out', text: en.magic }] });
    // The hidden words are answered but never offered.
    expect(vocabulary([...THING_KINDS]).some(word => word.includes(HIDDEN_FILE) || word === MAGIC_WORD || word === 'ls -a')).toBe(false);
    expect(suggest('ab', [])).toEqual([]); expect(suggest('ls ', [])).toEqual(['ls things']); expect(complete('abra', [])).toBe('abra');
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
    expect(suggest('c', [])).toEqual(['cat about.txt', 'cat secret.txt', 'cat valley.txt', 'clear']);
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
  it('a new round is never the arrangement just played, and all six come up', () => {
    expect(LAYOUTS).toHaveLength(6);
    const random = seeded(21); let last = pickLayout(random); const seen = new Set([last]);
    for (let i = 0; i < 80; i++) { const next = pickLayout(random, last); expect(next).not.toBe(last); expect(LAYOUTS).toContain(next); seen.add(next); last = next; }
    expect(seen.size).toBe(LAYOUTS.length);
    expect(new Set(LAYOUTS.map(layout => JSON.stringify(layoutLanterns(seeded(1), layout).map(l => [l.x, l.y])))).size).toBe(LAYOUTS.length);
  });
  it('the lantern that completes its row says so, once, right after its own event', () => {
    const base = newBounce(seeded(3), 'grid'); const l = base.lanterns[7];
    expect(lanternRow(7)).toBe(1); expect(lanternRow(14)).toBe(2);
    const lit = base.lit.map((_, i) => lanternRow(i) === 1 && i !== 7);
    expect(rowLit(lit, 1)).toBe(false); expect(rowLit(lit, 0)).toBe(false); expect(rowLit(lit, 9)).toBe(false);
    const out = bounceStep({ ...base, lit, floating: 0, ball: { x: l.x + l.w / 2, y: l.y + l.h + BALL / 2 + 0.1, vx: 0, vy: -BALL_SPEED } }, still);
    expect(out.events).toEqual([{ type: 'lantern', index: 7 }, { type: 'row', row: 1 }]);
    expect(rowLit(out.state.lit, 1)).toBe(true); expect(LANTERN_COLS).toBe(5);
    // A lantern that does not finish its row rings alone.
    const alone = bounceStep({ ...base, floating: 0, ball: { x: l.x + l.w / 2, y: l.y + l.h + BALL / 2 + 0.1, vx: 0, vy: -BALL_SPEED } }, still);
    expect(alone.events).toEqual([{ type: 'lantern', index: 7 }]);
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
    // No lives, no score, no clock: only the field's own height was added to what the game keeps.
    expect(Object.keys(state).sort()).toEqual(['ball', 'done', 'floating', 'h', 'lanterns', 'launches', 'lit', 'paddle']);
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

describe('Bounce on a tall screen, and chains of light', () => {
  it('the field grows downward on a phone and stays 120 on a wide screen, and the paddle keeps its place above the cloud', () => {
    expect(fieldHeight(4 / 3)).toBe(FIELD_H); expect(fieldHeight(2)).toBe(FIELD_H); expect(fieldHeight(NaN)).toBe(FIELD_H); expect(fieldHeight(0)).toBe(FIELD_H);
    expect(fieldHeight(390 / 572)).toBe(FIELD_H_MAX); expect(fieldHeight(1)).toBe(FIELD_W);
    expect(paddleTop()).toBe(PADDLE_Y); expect(paddleTop(180)).toBe(180 - (FIELD_H - PADDLE_Y));
    expect(newBounce(seeded(1), 'grid', 999).h).toBe(FIELD_H_MAX); expect(newBounce(seeded(1), 'grid', 10).h).toBe(FIELD_H); expect(newBounce(seeded(1)).h).toBe(FIELD_H);
  });
  it('a tall field is just as unlosable: the ball bounces on the lower paddle, sinks into the lower cloud and comes back', () => {
    const tall = newBounce(seeded(4), 'grid', 190);
    expect(tall.ball.y).toBe(190 - BALL);
    const onPaddle: BounceState = { ...tall, floating: 0, paddle: 80, ball: { x: 80, y: paddleTop(190) - BALL / 2 - 0.2, vx: 0, vy: BALL_SPEED } };
    const hit = bounceStep(onPaddle, { dir: 0, target: null });
    expect(hit.events).toContainEqual({ type: 'paddle' }); expect(hit.state.ball.vy).toBeLessThan(0);
    // The same ball at the short field's paddle height is still falling here: no paddle there.
    const falling = bounceStep({ ...onPaddle, ball: { ...onPaddle.ball, y: PADDLE_Y - BALL / 2 - 0.2 } }, { dir: 0, target: null });
    expect(falling.events).toEqual([]);
    const missed = bounceStep({ ...tall, floating: 0, paddle: 20, ball: { x: 140, y: 190 + BALL, vx: 0, vy: BALL_SPEED } }, { dir: 0, target: null });
    expect(missed.events).toContainEqual({ type: 'cloud' }); expect(missed.state.floating).toBe(FLOAT_S); expect(missed.state.done).toBe(false);
    let state = missed.state, lifted = false;
    for (let i = 0; i < 400 && !lifted; i++) { const out = bounceStep(state, { dir: 0, target: null }); state = out.state; lifted = out.events.some(e => e.type === 'lift'); }
    expect(lifted).toBe(true); expect(state.ball.y).toBeLessThan(paddleTop(190));
  });
  it('a long untouched run in the tall field lights lanterns and never ends the game', () => {
    let state = newBounce(seeded(9), 'stagger', FIELD_H_MAX), clouds = 0;
    for (let i = 0; i < 120 * 90; i++) {
      const out = bounceStep(state, { dir: 0, target: state.ball.x }); state = out.state; clouds += out.events.filter(e => e.type === 'cloud').length;
      expect(state.ball.x).toBeGreaterThanOrEqual(0); expect(state.ball.x).toBeLessThanOrEqual(FIELD_W); expect(state.ball.y).toBeLessThanOrEqual(FIELD_H_MAX + BALL * 2);
      if (state.done) break;
    }
    expect(litCount(state.lit)).toBeGreaterThan(0);
  });
  it('lanterns lit one after another make a chain; the paddle, the cloud and a new launch end it', () => {
    const lantern: BounceEvent = { type: 'lantern', index: 0 };
    expect(chainAfter(0, lantern)).toBe(1); expect(chainAfter(2, lantern)).toBe(3);
    expect(chainAfter(3, { type: 'wall' })).toBe(3); expect(chainAfter(3, { type: 'row', row: 0 })).toBe(3); expect(chainAfter(3, { type: 'allLit' })).toBe(3);
    expect(chainAfter(3, { type: 'paddle' })).toBe(0); expect(chainAfter(3, { type: 'cloud' })).toBe(0); expect(chainAfter(3, { type: 'lift' })).toBe(0);
    expect(chainAfter(NaN, lantern)).toBe(1);
  });
  it('the screen glows with the lanterns lit and brighter with a chain, from 0 to 1; the harmony climbs with the chain and stays in the scale', () => {
    expect(screenGlow(0, 0)).toBe(0); expect(screenGlow(LANTERN_COUNT, 0)).toBe(0.5); expect(screenGlow(LANTERN_COUNT, 5)).toBe(1); expect(screenGlow(999, 999)).toBe(1); expect(screenGlow(NaN, NaN)).toBe(0);
    expect(screenGlow(5, 3)).toBeGreaterThan(screenGlow(5, 1)); expect(screenGlow(5, 1)).toBe(screenGlow(5, 0));
    expect([0, 1, 2, 3, 4, 9].map(chainHarmony)).toEqual([0, 0, 2, 3, 5, 5]);
  });
});

describe('the quest: three chapters, things done, never a measure', () => {
  it('chapter one: three different tools wake the bench; the same tool twice is play, not progress', () => {
    let q: Quest = NEW_QUEST;
    expect(benchAwake(q)).toBe(false); expect(benchPower(q)).toBe(0); expect(chapterNow(q)).toBe(0);
    q = wakeTool(q, 'proofLens'); expect(wakeTool(q, 'proofLens')).toBe(q); expect(wakeTool(q, 'hammer')).toBe(q); expect(wakeTool(q, null)).toBe(q);
    q = wakeTool(q, 'leafLab'); expect(benchAwake(q)).toBe(false); expect(benchPower(q)).toBeCloseTo(2 / 3);
    q = wakeTool(q, 'clearPatch'); expect(benchAwake(q)).toBe(true); expect(benchPower(q)).toBe(1); expect(chapterDone(q, 'wake')).toBe(true); expect(chapterNow(q)).toBe(1);
    q = wakeTool(wakeTool(q, 'viewCheck'), 'pulsePod'); expect(q.woken).toHaveLength(TOOLS.length); expect(benchPower(q)).toBe(1);
    expect(TOOLS_TO_WAKE).toBeLessThanOrEqual(TOOLS.length);
  });
  it('chapters two and three: every lantern once, then two different known words; unknown words never count', () => {
    let q: Quest = wakeTool(wakeTool(wakeTool(NEW_QUEST, TOOLS[0]), TOOLS[1]), TOOLS[2]);
    q = noteCommand(q, 'help'); q = noteCommand(q, 'help'); q = noteCommand(q, null);
    expect(chapterDone(q, 'ask')).toBe(false); expect(chapterNow(q)).toBe(1);
    q = noteLanterns(q); expect(noteLanterns(q)).toBe(q); expect(chapterDone(q, 'play')).toBe(true); expect(chapterNow(q)).toBe(2); expect(questDone(q)).toBe(false);
    q = noteCommand(q, 'ls'); expect(chapterDone(q, 'ask')).toBe(true); expect(questDone(q)).toBe(true); expect(chapterNow(q)).toBe(CHAPTERS.length);
    q = noteCommand(q, 'clear'); expect(q.commands).toEqual(['help', 'ls']); expect(q.commands).toHaveLength(WORDS_TO_ASK);
  });
  it('the chapters may be done in any order, and the quest keeps only fixed names', () => {
    let q: Quest = noteCommand(noteCommand(NEW_QUEST, 'hello'), 'dance');
    expect(chapterDone(q, 'ask')).toBe(true); expect(chapterNow(q)).toBe(0); expect(questDone(q)).toBe(false);
    q = noteLanterns(q); expect(chapterNow(q)).toBe(0);
    expect(Object.keys(q).sort()).toEqual(['commands', 'lanterns', 'woken']);
  });
});

describe('the round: a seed changes the sitting', () => {
  it('one seed always gives the same round, and every choice is a real one', () => {
    expect(deskRound(seeded(5))).toEqual(deskRound(seeded(5)));
    const rounds = Array.from({ length: 60 }, (_, seed) => deskRound(seeded(seed * 7919 + 1)));
    for (const round of rounds) {
      expect(LAYOUTS).toContain(round.layout); expect(TOOLS).toContain(round.hint); expect(TOOL_ORDERS).toContain(round.order); expect(ROOM_LIGHTS).toContain(round.light);
      expect(round.guest).toBeGreaterThanOrEqual(0); expect(round.guest).toBeLessThan(3); expect(round.riddle).toBeGreaterThanOrEqual(0); expect(round.riddle).toBeLessThan(en.riddles.length);
    }
    expect(new Set(rounds.map(round => round.layout)).size).toBe(LAYOUTS.length); expect(new Set(rounds.map(round => round.order)).size).toBe(TOOL_ORDERS.length);
    expect(new Set(rounds.map(round => round.light)).size).toBe(ROOM_LIGHTS.length); expect(new Set(rounds.map(round => round.hint)).size).toBe(TOOLS.length);
    expect(deskRound(() => NaN).layout).toBe(LAYOUTS[0]); expect(deskRound(() => 1).hint).toBe(TOOLS[TOOLS.length - 1]);
  });
  it('the power-up lights all five tools once, in one of three orders, inside ten seconds', () => {
    for (const order of TOOL_ORDERS) expect([...toolOrder(order)].sort()).toEqual([...TOOLS].sort());
    expect(toolOrder('leftToRight')).toEqual([...TOOLS]); expect(toolOrder('rightToLeft')[0]).toBe(TOOLS[TOOLS.length - 1]); expect(toolOrder('middleOut')[0]).toBe(TOOLS[2]);
    for (const plan of [POWER_UP, POWER_UP_REDUCED]) {
      const lastTool = plan.tools + (TOOLS.length - 1) * plan.toolGap;
      expect(lastTool).toBeLessThan(plan.screen); expect(plan.screen).toBeLessThan(plan.room); expect(plan.room).toBeLessThan(plan.picture); expect(plan.picture).toBeLessThan(plan.end);
      expect(plan.end).toBeLessThanOrEqual(10000);
    }
    expect(POWER_UP.end).toBeGreaterThanOrEqual(7000); expect(POWER_UP_REDUCED.end).toBeLessThan(POWER_UP.end);
  });
});
