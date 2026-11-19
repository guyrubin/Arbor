/** Real-input acceptance for the twelve makers and three remaining curated
 * activities. The five replacement adventures have their own two-session gate.
 * One full completion, fresh replay, active exit per EN/HE phone/desktop cell.
 * Keyboard alternatives are deliberately exercised on canvas toys, alongside
 * touch/mouse on their visible docks. No engine/React state or completion seam. */
import assert from 'node:assert/strict';
import { mkdir, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { installGameCycleAudioProbe, verifyStudioResultScene } from './kids-game-cycle-browser.mjs';

const GAMES = [
  { id: 'mend-bowl', world: 'studio', creation: 'bowl' },
  { id: 'stitch-garden', world: 'studio', creation: 'textile' },
  { id: 'bottle-lab', world: 'studio', creation: 'bottle' },
  { id: 'paper-boat', world: 'stories' },
  { id: 'clay-theatre', world: 'stories' },
  { id: 'crank-works', world: 'playbank' },
  { id: 'windup-race', world: 'playbank' },
  { id: 'season-dial', world: 'playbank' },
  { id: 'ice-age-friend', world: 'playbank' },
  { id: 'tiny-builders', world: 'playbank' },
  { id: 'fox-trail', world: 'playbank' },
  { id: 'maker-desk', world: 'studio' },
  { id: 'feelings-forest', world: 'feelings' },
  { id: 'calm-builder', world: 'feelings', selector: '.studio-corner', creation: 'corner' },
  { id: 'sneak', world: 'playbank', selector: '[data-sneak-stage]' },
];

/** Only an explicit diagnostic call may narrow the complete release matrix. */
export function makerCycleGames(gameIds) {
  assert.equal(GAMES.length, 15, 'The full maker/activity gate contains fifteen games');
  assert.equal(RELEASE_VIEWPORTS.length, 4, 'The release gate covers EN/HE phone and desktop');
  if (gameIds === undefined) return [...GAMES];
  assert.ok(Array.isArray(gameIds) && gameIds.length > 0, 'An explicit game filter must be a non-empty array');
  assert.equal(new Set(gameIds).size, gameIds.length, 'An explicit game filter must not repeat a game');
  for (const id of gameIds) assert.ok(typeof id === 'string' && GAMES.some(game => game.id === id), `Unknown maker-cycle game: ${String(id)}`);
  return GAMES.filter(game => gameIds.includes(game.id));
}

const SEASONS = {
  springShower: { season: 0, taps: 2, rain: 5000, blows: 0, wait: 3000 },
  summerSun: { season: 1, taps: 3, rain: 3000, blows: 3, wait: 15000 },
  mildDay: { season: 2, taps: 0, rain: 0, blows: 0, wait: 3000 },
  winterRest: { season: 3, taps: 0, rain: 0, blows: 0, wait: 3000 },
  warmDrink: { season: 1, taps: 3, rain: 4000, blows: 0, wait: 3000 },
  dryBask: { season: 1, taps: 0, rain: 0, blows: 0, wait: 3000 },
};

async function play(h, game) {
  const { page, press, key, advance, until, exists, attrs, snapshot, hold } = h;
  const root = h.root;
  const done = () => exists('[data-studio-phase="result"]');
  const opening = page.locator('[data-play-skip]');
  h.metrics.openingPressed = await opening.count() > 0;
  if (h.metrics.openingPressed) await press(opening);
  await advance(300);
  const currentLabels = await page.locator('.play-quest__step[data-state="now"] .play-quest__label').evaluateAll(nodes => nodes.map(node => { const box = node.getBoundingClientRect(); return { text: node.textContent?.trim(), width: box.width, height: box.height, display: getComputedStyle(node).display }; }));
  for (const label of currentLabels) assert.ok(label.text && label.width > 0 && label.height > 0 && label.display !== 'none', 'The current maker chapter stays readable on this viewport');
  h.metrics.currentChapterLabels = currentLabels;

  if (game.id === 'mend-bowl') {
    await until(() => exists('[data-mend-ready]'), 6000, 'Choose glaze');
    await press(page.locator('[data-glaze]').last());
    await press(page.locator('[data-mend-ready]'));
    await until(async () => (await attrs()).phase === 'fit', 8000, 'Bowl pieces land');
    const pieces = await page.locator('[data-piece]').evaluateAll(nodes => nodes.map(n => n.dataset.piece));
    assert.ok(pieces.length >= 3, 'The broken bowl has real pieces');
    for (const id of pieces) {
      await key(page.locator(`[data-piece="${id}"]`), 'Enter');
      await key(page.locator(`[data-place="${id}"]`), 'Enter');
      for (let turn = 0; turn < 12; turn++) {
        if (await page.locator(`[data-piece="${id}"]`).getAttribute('data-placed') === 'true') break;
        await press(page.locator('[data-turn][data-cue]')); await advance(450);
      }
      assert.equal(await page.locator(`[data-piece="${id}"]`).getAttribute('data-placed'), 'true', `Piece ${id} fits its bowl`);
    }
    await until(async () => (await attrs()).phase === 'gold', 8000, 'Gold repair');
    await snapshot('mended');
    const seams = await page.locator('[data-seam]').count();
    for (let i = 0; i < seams; i++) { await key(page.locator('[data-seam]').nth(i), 'Enter'); await advance(1200); }
    await until(done, 30000, 'Mended bowl finish');
    return { pieces: pieces.length, sealedSeams: seams };
  }

  if (game.id === 'stitch-garden') {
    let planted = 0, pulls = 0;
    for (let i = 0; i < 100 && !await done(); i++) {
      if (await exists('[data-sg-sew]')) { await key(page.locator('[data-sg-sew]'), 'Enter'); pulls++; await advance(1100); }
      else if (await exists('[data-sg-finish]')) { await snapshot('created'); await press(page.locator('[data-sg-finish]')); await until(done, 30000, 'Held-up embroidery'); }
      else if (await exists('[data-sg-spot]')) { await press(page.locator('[data-sg-spot]').first()); planted++; await advance(400); }
      else await advance(500);
    }
    assert.ok(planted >= 4 && pulls >= 4, 'The first flower and the three-flower row were actually sewn');
    assert.ok(await done(), 'Embroidery reaches Studio result');
    return { planted, pulls };
  }

  if (game.id === 'bottle-lab') {
    const chapters = [], decisions = {};
    for (let i = 0; i < 70 && !await done(); i++) {
      const state = await attrs(), act = state.act;
      if (['shape', 'colour', 'dress'].includes(act) && !chapters.includes(act)) {
        chapters.push(act);
        if (act === 'shape') {
          await key(page.locator('[data-bl-glass]'), 'Enter');
          assert.notEqual((await attrs()).shape, state.shape, 'The glass gesture changes the actual bottle shape');
        }
        if (act === 'colour') {
          const disc = page.locator(`[data-bl-disc]:not([data-bl-disc="${state.tint}"])`).last();
          const tint = await disc.getAttribute('data-bl-disc');
          await key(disc, 'Enter');
          assert.equal((await attrs()).tint, tint, 'The chosen tint reaches the actual bottle');
          await key(page.locator('[data-bl-aya]'), 'Enter');
          assert.notEqual((await attrs()).finish, state.finish, 'Polishing changes the actual finish');
        }
        if (act === 'dress') {
          await key(page.locator('[data-bl-art]').first(), 'Enter');
          await press(page.locator('[data-bl-turn="right"]'));
          await key(page.locator('[data-bl-art]').last(), 'Enter');
          assert.ok(Number((await attrs()).stickers) >= 2, 'Both chosen stickers reach the actual bottle');
        }
        await advance(1600);
        // The product intentionally also offers Next after a patient nine
        // seconds. This gate must prove successful making, before that escape.
        assert.ok(await exists(`[data-bl-next="${act}"]`), 'Actual making unlocks the chapter action before the patient-wait fallback');
      } else if (await exists('[data-bl-next]')) {
        Object.assign(decisions, await attrs()); await snapshot(act); await press(page.locator('[data-bl-next]'));
      } else if (await exists('[data-bl-keep]')) { await press(page.locator('[data-bl-keep]')); }
      else await advance(750);
    }
    assert.deepEqual(chapters, ['shape', 'colour', 'dress']);
    assert.ok(await done(), 'Designed bottle reaches Studio result');
    return { chapters, shape: decisions.shape, tint: decisions.tint, stickers: decisions.stickers };
  }

  if (game.id === 'paper-boat') {
    const wheel = page.locator('[data-pb-wheel]');
    const steer = async lane => {
      await key(wheel, 'Home');
      const sign = (lane - 1) * (h.lang === 'he' ? -1 : 1);
      for (let i = 0; i < Math.abs(sign) * 2; i++) await key(wheel, sign > 0 ? 'ArrowRight' : 'ArrowLeft');
    };
    await until(() => exists('[data-pb-boat-button]'), 10000, 'Open river book');
    await key(page.locator('[data-pb-boat-button]'), 'Enter');
    await until(() => exists('[data-pb-turn="next"]'), 50000, 'Boat crosses the rock stream');
    await press(page.locator('[data-pb-turn="next"]'));
    await until(async () => (await attrs()).settled === 'true' && (await attrs()).spread === '1', 8000, 'Lantern spread settles');
    const course = (await root.getAttribute('data-pb-course')).split(',').map(Number);
    assert.equal(course.length, 3, 'Three visible lantern gates');
    for (let i = 0; i < course.length; i++) {
      await steer(course[i]);
      await until(async () => Number((await attrs()).pbLanterns) >= i + 1, 22000, `Lantern gate ${i + 1}`);
    }
    await until(() => exists('[data-pb-turn="next"]'), 15000, 'Lantern river complete');
    await snapshot('lanterns'); await press(page.locator('[data-pb-turn="next"]'));
    await until(async () => (await attrs()).settled === 'true' && (await attrs()).spread === '2', 8000, 'Storm spread settles');
    await steer(1);
    await hold(page.locator('[data-pb-wheel-disc]'), 9000);
    assert.equal((await attrs()).pbCalm, 'true', 'Holding the wheel steadies the storm');
    await until(() => exists('[data-pb-turn="next"]'), 15000, 'Calm storm complete');
    await press(page.locator('[data-pb-turn="next"]'));
    await until(async () => (await attrs()).settled === 'true' && (await attrs()).spread === '3', 8000, 'Harbour spread settles');
    await steer(0);
    await until(() => exists('[data-pb-turn="end"]'), 30000, 'Boat docks and returns Home');
    await snapshot('harbour'); await press(page.locator('[data-pb-turn="end"]'));
    await until(done, 12000, 'River book closes');
    return { spreads: 4, lanternGates: course.length, stormSteadied: true, docked: true };
  }

  if (game.id === 'clay-theatre') {
    await until(() => exists('[data-can]'), 6000, 'Film cans');
    await press(page.locator('[data-can]').first()); await advance(700);
    await press(page.locator('[data-lump]').first()); await advance(700);
    await press(page.locator('[data-lump][data-used="false"]').first()); await advance(700);
    for (let i = 0; i < 12 && !await exists('[data-next="animate"]'); i++) {
      const pulls = page.locator('[data-pull][data-cue="true"]');
      if (await pulls.count()) await key(pulls.first(), 'Enter'); else await key(page.locator('[data-pull]').nth(i % await page.locator('[data-pull]').count()), 'Enter');
      await advance(800);
    }
    await until(() => exists('[data-next="animate"]'), 10000, 'Clay character wakes');
    await snapshot('shaped'); await press(page.locator('[data-next="animate"]'));
    let shots = 0;
    for (; shots < 16 && !await exists('[data-next="direct"]'); shots++) {
      await key(page.locator('[data-hero]'), shots % 2 ? 'Shift+ArrowRight' : 'Shift+ArrowLeft');
      await press(page.locator('[data-lens]')); await advance(500);
    }
    assert.ok(shots >= 4, 'The film contains multiple child-positioned frames');
    await press(page.locator('[data-next="direct"]')); await advance(500);
    await press(page.locator('button[data-gel]').last()); await press(page.locator('button[data-tune]').last()); await press(page.locator('[data-friend]'));
    await snapshot('directed'); await press(page.locator('[data-next="premiere"]'));
    await advance(3000); await snapshot('premiere');
    await until(done, 60000, 'Unskipped clay premiere');
    return { shots, lightChosen: true, tuneChosen: true, friendPlaced: true, premiereSkipped: false };
  }

  if (game.id === 'crank-works') {
    const steps = new Set(); let turns = 0, looks = 0, joints = 0;
    for (let i = 0; i < 200 && !await done(); i++) {
      const step = await page.evaluate(() => document.querySelector('.ck-world')?.getAttribute('data-crank-step')); steps.add(step);
      if (step === 'turnIt') { await press(page.locator('[data-crank-turn]')); turns++; await advance(600); }
      else if (step === 'lookIn') { await press(page.locator('[data-crank-look]')); looks++; await advance(3400); }
      else if (step === 'pickUp') { await press(page.locator('[data-crank-place]')); await advance(1600); }
      else if (step === 'testJoint') { await press(page.locator('[data-crank-test]')); joints++; await advance(2500); }
      else await advance(1000);
      if (i === 14) await snapshot('mechanism');
    }
    assert.ok(await done(), 'Crank mechanism reaches its big show and result');
    for (const step of ['turnIt', 'lookIn', 'pickUp', 'testJoint']) assert.ok(steps.has(step), `Played ${step}`);
    return { steps: [...steps], turns, looks, joints };
  }

  if (game.id === 'feelings-forest') {
    const actions = [];
    for (let round = 0; round < 3; round++) {
      const choices = page.locator('[data-feeling]');
      // The authored face and its named choices are visible. A different
      // interpretation offers gentle feedback; try each named face until heard.
      for (let i = 0; i < await choices.count(); i++) {
        await press(choices.nth(i));
        if (await exists('.forest-choices--support')) break;
      }
      await press(page.locator('.forest-choices--support button').nth(round));
      actions.push(await page.locator('.forest-stage').getAttribute('data-action'));
      await snapshot(`support-${round + 1}`);
      await press(page.locator('.adventure-go'));
    }
    await until(done, 5000, 'Three forest stories complete');
    assert.deepEqual(actions, ['together', 'space', 'help']);
    return { stories: 3, actions };
  }

  if (game.id === 'calm-builder') {
    await press(page.locator('.studio-game-actions').nth(0).locator('button').nth(1));
    await press(page.locator('.studio-game-actions').nth(1).locator('button').nth(1));
    for (let i = 0; i < 3; i++) { await press(page.locator('.studio-object').nth(i)); await press(page.locator('.studio-corner-place').nth(i)); }
    assert.equal(await page.locator('.studio-corner-place[data-filled="true"]').count(), 3);
    await snapshot('created'); await press(page.locator('.studio-game-button--go'));
    await until(done, 5000, 'Actual calm corner result');
    return { placed: 3, light: 'evening', scene: 'garden' };
  }

  if (game.id === 'sneak') {
    let held = false, goWindows = 0, stops = 0;
    await root.focus();
    for (let i = 0; i < 4000 && !await exists('[data-sneak-ending]'); i++) {
      const { signal, phase } = await page.evaluate(() => ({ signal: document.querySelector('[data-sneak-signal]')?.getAttribute('data-sneak-signal'), phase: document.querySelector('[data-sneak-stage]')?.getAttribute('data-sneak-phase') }));
      const want = signal === 'go' && phase !== 'intro';
      if (want !== held) { if (want) { await page.keyboard.down('Space'); goWindows++; } else { await page.keyboard.up('Space'); stops++; } held = want; }
      await advance(80);
      if (i === 100) await snapshot('sneaking');
    }
    if (held) await page.keyboard.up('Space');
    assert.ok(await exists('[data-sneak-ending]'), 'Sneak reaches its own real ending');
    assert.ok(goWindows >= 1 && stops >= 1, 'The child sneaks and freezes in response to the pictured signal');
    return { goWindows, stops, ending: 'Sneak ending' };
  }

  return playOtherMaker(h, game);
}

async function playOtherMaker(h, game) {
  const { page, press, key, advance, until, exists, attrs, snapshot } = h;
  const done = () => exists('[data-studio-phase="result"]');

  if (game.id === 'windup-race') {
    const chapters = new Set(); let launches = 0, windTurns = 0, leaned = false;
    for (let i = 0; i < 1800 && !await done(); i++) {
      const state = await attrs(); if (state.chapter) chapters.add(state.chapter);
      if (await exists('[data-wr-wind]')) {
        if (Number(state.clicks) < 10) { await press(page.locator('[data-wr-wind]')); windTurns++; }
        else if (await exists('[data-wr-go]')) { await press(page.locator('[data-wr-go]')); launches++; }
      } else if (state.gust === 'head' && await exists('[data-wr-lean]')) {
        const lean = page.locator('[data-wr-lean]'); await lean.focus(); await page.keyboard.down('Space'); await advance(250); await page.keyboard.up('Space'); leaned = true;
      } else await advance(250);
      if (launches === 2 && i % 30 === 0) await snapshot('race');
    }
    assert.ok(await done(), 'Windup race finishes all courses');
    assert.equal(chapters.size, 4); assert.ok(launches >= 4 && windTurns >= 40);
    return { chapters: [...chapters], launches, windTurns, leaned };
  }

  if (game.id === 'season-dial') {
    const dial = page.locator('[data-sd-dial]');
    const season = async index => { await key(dial, 'Home'); await advance(700); for (let i = 0; i < index; i++) { await key(dial, 'PageUp'); await advance(700); } };
    const castSeen = new Set(), castChecks = [];
    const inspectCast = async gesture => {
      const pictures = await page.locator('[data-sd-friend] img').evaluateAll(nodes => nodes.map(node => {
        const transform = getComputedStyle(node).transform, m = transform === 'none' ? new DOMMatrix() : new DOMMatrix(transform);
        return { id: node.closest('[data-sd-friend]').getAttribute('data-sd-friend'), determinant: m.a * m.d - m.b * m.c, src: node.currentSrc };
      }));
      for (const picture of pictures) { assert.ok(picture.determinant > 0, `${picture.id} keeps its native kit anatomy after ${gesture}`); castSeen.add(picture.id); }
      castChecks.push({ gesture, pictures });
    };
    const touchBothSides = async () => {
      const scene = page.locator('[data-sd-scene]'), box = await scene.boundingBox(); assert.ok(box);
      await inspectCast('arrival');
      for (const x of [0.04, 0.96]) { await press(scene, { position: { x: box.width * x, y: box.height * 0.45 } }); await inspectCast(x < 0.5 ? 'left scene touch' : 'right scene touch'); }
    };
    await until(async () => (await attrs()).phase === 'meet', 6000, 'Meet the seasons');
    for (let i = 0; i < 4; i++) {
      await season(i); await advance(3000); await touchBothSides();
      if (i === 0) {
        // Two normal dial nudges take spring into the pictured rain, where
        // GobGob visits. Verify his attachment sides under the same touches.
        await key(dial, 'ArrowRight'); await key(dial, 'ArrowRight'); await advance(250);
        await touchBothSides(); await key(dial, 'Home');
      }
    }
    for (const id of ['chockSummer', 'pepAutumn', 'gobgobRain']) assert.ok(castSeen.has(id), `Native orientation was exercised for ${id}`);
    h.metrics.castOrientation = castChecks;
    await until(async () => (await attrs()).phase === 'grow', 10000, 'Four seasons met');
    await snapshot('seasons');
    const asks = [];
    for (let round = 0; round < 9 && (await attrs()).phase === 'grow'; round++) {
      const ask = await page.locator('[data-sd-lab]').getAttribute('data-ask'), recipe = SEASONS[ask];
      assert.ok(recipe, `The named visible seedling request ${ask} has a real-input recipe`);
      if (!asks.includes(ask)) asks.push(ask);
      await season(recipe.season);
      for (let i = 0; i < recipe.taps; i++) await key(page.locator('.sd-key').nth(0), 'Enter');
      await advance(recipe.rain);
      for (let i = 0; i < recipe.blows; i++) await key(page.locator('.sd-key').nth(3), 'Enter');
      await advance(recipe.wait);
    }
    await until(async () => (await attrs()).phase === 'conduct', 12000, 'Seedling grew through three requests');
    assert.equal(asks.length, 3);
    // Each PageUp moves to the next pictured season; the last wrap completes
    // an actual full turn. No angle or progress state is assigned by the test.
    for (let i = 0; i < 6 && (await attrs()).phase === 'conduct'; i++) { await key(dial, 'PageUp'); await advance(1200); }
    await until(() => exists('[data-sd-film]'), 8000, 'Conducted year');
    await press(page.locator('[data-sd-film]')); await advance(1500); await snapshot('film');
    await until(done, 35000, 'Season film finishes');
    return { seasonsMet: 4, asks, conductedFullYear: true };
  }

  if (game.id === 'ice-age-friend') {
    const steps = new Set(); let prints = 0, gestures = 0;
    for (let i = 0; i < 200 && !await done(); i++) {
      const state = await attrs(); if (state.iafStep) steps.add(state.iafStep);
      if (await exists('[data-iaf-keep]')) { await press(page.locator('[data-iaf-keep]')); prints++; }
      else if (await exists('[data-iaf-through]')) await press(page.locator('[data-iaf-through]'));
      else if (await exists('[data-iaf-snap]')) await press(page.locator('[data-iaf-snap]'));
      else if (await exists('[data-iaf-night]')) { await snapshot('night'); await press(page.locator('[data-iaf-night]')); }
      else { await key(page.locator('.iaf-world'), 'Enter'); gestures++; }
      await advance(1000);
      if (i === 20) await snapshot('field');
    }
    assert.ok(await done(), 'Mammoth field trip reaches its kept night scene');
    for (const step of ['frost', 'hello', 'trace', 'brush', 'feed', 'part', 'scout', 'walk', 'low']) assert.ok(steps.has(step), `Played mammoth ${step}`);
    assert.ok(prints >= 3, 'Field observations were actually kept');
    return { steps: [...steps], prints, gestures };
  }

  if (game.id === 'tiny-builders') {
    const phases = new Set(); let pieces = 0, observations = 0, squeezes = 0;
    for (let i = 0; i < 350 && !await done(); i++) {
      const phase = (await attrs()).phase; phases.add(phase);
      if (phase === 'build') {
        const piece = page.locator('[data-tiny-piece]').first();
        await key(piece, 'Enter'); await key(piece, 'Enter'); pieces++; await advance(900);
      } else if (phase === 'spin') { await key(page.locator('[data-tiny-model]'), 'ArrowRight'); await advance(400); }
      else if (await exists('[data-tiny-find]')) await press(page.locator('[data-tiny-find]'));
      else if (await exists('[data-tiny-record]')) { await press(page.locator('[data-tiny-record]')); observations++; }
      else if (await exists('[data-tiny-dive]')) { await press(page.locator('[data-tiny-dive]')); await advance(1200); }
      else if (await exists('[data-tiny-land]')) { await snapshot('observed'); await press(page.locator('[data-tiny-land]')); }
      else if (await exists('[data-tiny-squeeze]')) { await press(page.locator('[data-tiny-squeeze]')); squeezes++; await advance(800); }
      else if (await exists('[data-tiny-lower]')) { await press(page.locator('[data-tiny-lower]')); await advance(1400); }
      else await advance(700);
    }
    assert.ok(await done(), 'Built model, observations, landing and squeeze reach the ending');
    assert.ok(pieces >= 3 && observations >= 3 && squeezes >= 1);
    return { phases: [...phases], pieces, observations, squeezes };
  }

  if (game.id === 'fox-trail') {
    const stretches = new Set(); let rolls = 0, jumps = 0, held = false;
    for (let i = 0; i < 2300 && !await done(); i++) {
      const state = await page.evaluate(() => ({ ...document.querySelector('.ft-world')?.dataset }));
      if (state.stretch) stretches.add(state.stretch);
      if (await exists('[data-ft-go]')) { if (held) { await page.keyboard.up('ArrowUp'); held = false; } await press(page.locator('[data-ft-go]')); }
      else if (state.cue === 'rollNow') { if (held) { await page.keyboard.up('ArrowUp'); held = false; } await key(page.locator('[data-ft-key="roll"]'), 'ArrowDown'); rolls++; }
      else if (state.cue === 'jumpNow' || state.cue === 'holdNow') {
        if (!held) { await page.locator('[data-ft-key="jump"]').focus(); await page.keyboard.down('ArrowUp'); held = true; jumps++; }
      } else if (held) { await page.keyboard.up('ArrowUp'); held = false; }
      await advance(150);
      if (i === 90) await snapshot('trail');
    }
    if (held) await page.keyboard.up('ArrowUp');
    assert.ok(await done(), 'Fox traverses the authored trail and its finale');
    assert.ok(stretches.size >= 3 && rolls >= 1 && jumps >= 1);
    return { stretches: [...stretches], rolls, jumps };
  }

  if (game.id === 'maker-desk') {
    for (const tool of ['proofLens', 'leafLab', 'clearPatch']) { await press(page.locator(`[data-tool="${tool}"]`)); await advance(300); }
    assert.equal(await page.locator('[data-spot="pc"]').getAttribute('data-awake'), 'true', 'Three distinct tools woke the desk');
    const reflections = await page.locator('.md-chock__pose').evaluateAll(nodes => nodes.map(node => { const m = new DOMMatrix(getComputedStyle(node).transform); return m.a * m.d - m.b * m.c; }));
    assert.ok(reflections.length > 0 && reflections.every(value => value > 0), 'Chock retains approved anatomy and equipment attachment sides');
    await snapshot('awake'); await press(page.locator('[data-spot="pc"]')); await advance(1000);
    await press(page.locator('.md-icon[data-program="bounce"]')); await advance(100);
    // Sweep the actual paddle with its real key controls. Physics is the
    // shipped fixed-timestep loop; no ball coordinates or engine state read.
    // Bounded input schedule was checked against both authored field heights.
    let sweeps = 0;
    for (; sweeps < 420 && !await exists('[data-control="again"]'); sweeps++) {
      const direction = sweeps % 2 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(direction); await advance(730); await page.keyboard.up(direction);
      if (sweeps === 40) await snapshot('lanterns');
    }
    assert.ok(await exists('[data-control="again"]'), 'All fifteen lanterns lit through real paddle play');
    await snapshot('all-lanterns'); await press(page.locator('[data-back-to]'));
    await until(() => exists('.md-icon[data-program="ask"]'), 6000, 'Return to the desktop');
    await press(page.locator('.md-icon[data-program="ask"]'));
    await press(page.locator('[data-command="help"]')); await advance(600);
    await press(page.locator('[data-command="ls"]')); await advance(600);
    assert.ok(await exists('[data-maker-desk-power]'), 'All three desk chapters done');
    await snapshot('terminal'); await press(page.locator('[data-maker-desk-power]'));
    await until(done, 22000, 'Desk powers up');
    return { tools: 3, lanterns: 15, sweeps, commands: ['help', 'ls'] };
  }
  throw new Error(`Missing real-input driver for ${game.id}`);
}

export async function verifyMakerGameCycles({ browser, base, output, gameIds }) {
  const games = makerCycleGames(gameIds), expectedCells = games.length * RELEASE_VIEWPORTS.length;
  if (gameIds === undefined) assert.equal(expectedCells, 60, 'The default release gate must operate all sixty cells');
  const folder = path.join(output, 'maker-cycles'); await mkdir(folder, { recursive: true });
  const rows = [], failures = [], origin = new URL(base).origin;
  const cells = RELEASE_VIEWPORTS.flatMap(viewport => games.map(game => ({ viewport, game })));
  let summaryWrites = Promise.resolve();
  const persist = async (index, record) => {
    await writeFile(path.join(folder, `${record.game}-${record.viewport}.json`), JSON.stringify(record, null, 2));
    rows[index] = record;
    const completed = rows.filter(Boolean);
    const summary = JSON.stringify({ scope: gameIds === undefined ? 'full-release-matrix' : 'explicit-game-filter', gameIds: games.map(game => game.id), complete: completed.length === expectedCells, expected: expectedCells, passed: completed.filter(row => row.passed).length, failed: completed.filter(row => !row.passed).length, rows: completed }, null, 2);
    // Every cell has its own artifacts. Only this small manifest is shared;
    // serialize and atomically replace it so partial evidence stays readable.
    summaryWrites = summaryWrites.then(async () => {
      await writeFile(path.join(folder, 'summary.json.tmp'), summary);
      await rename(path.join(folder, 'summary.json.tmp'), path.join(folder, 'summary.json'));
    });
    await summaryWrites;
    console.log(`${record.passed ? 'PASS' : 'FAIL'} maker-cycle ${record.game}-${record.viewport} ${record.wallElapsedMs}ms (${completed.length}/${expectedCells})`);
  };
  const runCell = async ({ viewport, game }, index) => {
    const started = Date.now();
    const phone = viewport.id.startsWith('mobile-');
    const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, reducedMotion: 'reduce', hasTouch: phone, isMobile: phone });
    const errors = [], brokenResources = [], unexpectedRequests = [], fixtureRequests = [];
    const stem = `${game.id}-${viewport.id}`;
    const record = { case: 'curated-maker-cycle', game: game.id, viewport: viewport.id, lang: viewport.lang,
      input: `${phone ? 'emulated touch' : 'mouse'} plus authored keyboard alternatives`, sound: 'off', motion: 'reduce',
      clock: 'normal lazy loading, controlled game clock; real input only', screenshots: [], trace: [], fixtureRequests, inputs: { pointer: 0, keyboard: 0, held: 0 }, completionCount: 0 };
    try {
      await context.route('**/*', route => {
        const url = new URL(route.request().url());
        if (url.origin === origin && url.pathname === '/_proof/hero/sheet.json') { fixtureRequests.push('absent hero sheet: null'); return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); }
        // Synthetic review deliberately has no private proof scene. loadProofArt
        // treats JSON null as absent and keeps the synthetic fallback scene; the server
        // continues to refuse every other private proof path.
        if (url.origin === origin && url.pathname === '/_proof/scene/art.json') { fixtureRequests.push('absent scene art: null'); return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' }); }
        if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
        unexpectedRequests.push(url.href); return route.abort();
      });
      await context.addInitScript(() => { localStorage.setItem('arbor.kid.readAloud.muted.studio-v2-synthetic-review', '1'); Math.random = () => 0; });
      await context.addInitScript(installGameCycleAudioProbe);
      const page = await context.newPage(); page.setDefaultTimeout(12000);
      page.on('pageerror', e => errors.push(e.message));
      page.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errors.push(m.text()); });
      page.on('response', response => { if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) brokenResources.push({ url: response.url(), status: response.status() }); });
      const selector = game.selector ?? `[data-adventure="${game.id}"]`, root = page.locator(selector);
      const shots = new Set();
      const snapshot = async label => {
        if (shots.has(label)) return; shots.add(label);
        const name = `${stem}-${label}.png`; await page.screenshot({ path: path.join(folder, name), fullPage: true, animations: 'disabled' });
        record.screenshots.push(`maker-cycles/${name}`);
      };
      let controlledMs = 0, lastState = '';
      const attrs = () => page.evaluate(sel => ({ ...document.querySelector(sel)?.dataset }), selector);
      const advance = async ms => {
        await page.clock.runFor(ms); controlledMs += ms;
        const state = await attrs(), text = JSON.stringify(state);
        if (text !== lastState && record.trace.length < 160) { lastState = text; record.trace.push({ at: controlledMs, ...state }); }
      };
      const exists = async sel => { const loc = page.locator(sel); return await loc.count() > 0 && await loc.first().isVisible(); };
      const press = async (loc, options = {}) => { if (phone) await loc.tap(options); else await loc.click(options); record.inputs.pointer++; await advance(32); };
      const key = async (loc, name) => { await loc.focus(); await loc.press(name); record.inputs.keyboard++; await advance(32); };
      const until = async (condition, budget, label) => {
        for (let elapsed = 0; elapsed <= budget; elapsed += 250) { if (await condition()) return; await advance(250); }
        assert.fail(`${label} did not complete within ${budget}ms of controlled game time`);
      };
      const sneakLayout = () => page.evaluate(() => {
        const box = selector => {
          const element = document.querySelector(selector);
          if (!element) return null;
          const { left, right, top, bottom, width, height } = element.getBoundingClientRect();
          return { left, right, top, bottom, width, height };
        };
        const plate = document.querySelector('[data-sneak-plate]');
        return { field: box('[data-sneak-stage]'), plate: box('[data-sneak-plate]'), pad: box('[data-sneak-pad]'),
          imageLoaded: !!plate?.complete && plate.naturalWidth > 0,
          transform: document.querySelector('[data-sneak-stage] [data-play-art]')?.getAttribute('style') };
      });
      const renderedSneakField = async label => {
        let layout;
        await until(async () => {
          layout = await sneakLayout();
          const { field, plate, pad, imageLoaded } = layout;
          return field && plate && pad && imageLoaded && field.width >= viewport.w / 2 && field.height >= viewport.h / 2
            && plate.left <= field.left + 1 && plate.right >= field.right - 1 && plate.top <= field.top + 1 && plate.bottom >= field.bottom - 1
            && pad.width >= 44 && pad.height >= 44 && pad.left >= field.left - 1 && pad.right <= field.right + 1
            && pad.top >= field.top - 1 && pad.bottom <= field.bottom + 1;
        }, 2000, label);
        return layout;
      };
      const hold = async (loc, ms) => {
        await loc.scrollIntoViewIfNeeded(); const box = await loc.boundingBox(); assert.ok(box && box.width > 0 && box.height > 0, 'Held object is rendered');
        const point = { x: box.x + box.width / 2, y: box.y + box.height / 2 }; record.inputs.held++;
        if (phone) {
          const cdp = await context.newCDPSession(page);
          try { await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ ...point, radiusX: 4, radiusY: 4 }] }); await advance(ms); await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); }
          finally { await cdp.detach(); }
        } else { await page.mouse.move(point.x, point.y); await page.mouse.down(); try { await advance(ms); } finally { await page.mouse.up(); } }
      };
      try {
        await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
        const url = new URL(base); url.searchParams.set('lang', viewport.lang); url.searchParams.set('studioNext', '1');
        await page.goto(url.href); await page.locator('[data-studio-home]').waitFor({ state: 'visible' }); await page.evaluate(() => document.fonts.ready);
        await press(page.locator(`button.studio-v2__door[data-world="${game.world}"]`));
        const activityTile = page.locator(`[data-studio-activity="${game.id}"]`);
        if (game.id === 'fox-trail' || game.id === 'windup-race') {
          const nativePose = game.id === 'fox-trail' ? 'kit-pep-mission-sniffing.webp' : 'pep-idle.webp';
          const pose = activityTile.locator(`image[href$="${nativePose}"]`);
          await pose.waitFor({ state: 'attached' });
          const orientation = await pose.evaluate(async element => {
            const image = new Image(); image.src = element.getAttribute('href'); await image.decode();
            const matrix = element.getCTM();
            return { src: image.src, determinant: matrix.a * matrix.d - matrix.b * matrix.c };
          });
          assert.ok(orientation.determinant > 0, 'The static cover retains its approved native pose without an ancestor reflection');
          record.coverPose = orientation;
        }
        await press(activityTile);
        const session = page.locator('[data-studio-phase]');
        await session.waitFor({ state: 'visible' });
        record.entryPhase = await session.getAttribute('data-studio-phase');
        // Makers use their own PlayOpening immediately. The other curated
        // activities have the shared Studio introduction and Start control.
        if (record.entryPhase === 'intro') { await snapshot('intro'); await press(page.locator('[data-studio-start]')); }
        else assert.equal(record.entryPhase, 'play', 'The actual maker session opens directly into its authored opening');
        await root.waitFor({ state: 'visible' });
        // Keep React's Suspense minimum running until the real mechanic mounts.
        await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 100));
        assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
        const box = await root.boundingBox(); assert.ok(box && box.width > 0 && box.height > 0, 'Actual game is laid out');
        if (game.id === 'sneak') record.initialLayout = await renderedSneakField('Initial Sneak scene covers the field with its control in reach');
        await snapshot('ready');
        record.metrics = {};
        const h = { page, root, lang: viewport.lang, press, key, advance, until, exists, attrs, snapshot, hold, metrics: record.metrics };
        record.play = await play(h, game); record.completionCount = 1;
        const resultSelector = game.id === 'sneak' ? '[data-sneak-ending]' : '[data-studio-phase="result"]';
        await page.locator(resultSelector).waitFor({ state: 'visible' });
        if (game.creation) {
          const created = page.locator(`[data-creation="${game.creation}"]`); await created.waitFor({ state: 'visible' });
          assert.equal(await page.locator('[data-studio-created]').getAttribute('data-studio-created'), game.creation, 'Finish displays the actual created object');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal overflow at completion');
        if (game.id !== 'sneak') record.resultScene = await verifyStudioResultScene(page, game.world);
        await snapshot('result');
        if (game.id === 'sneak') { await until(() => exists('[data-kid-finish-again]'), 12000, 'Sneak replay action'); await press(page.locator('[data-kid-finish-again]')); }
        else await press(page.locator('[data-studio-replay]'));
        await root.waitFor({ state: 'visible' });
        assert.equal(await page.locator(resultSelector).count(), 0, 'Replay clears the prior completion');
        const replayOpening = page.locator('[data-play-skip]');
        const openingPressed = await replayOpening.count() > 0;
        if (openingPressed) { await press(replayOpening); await advance(300); assert.equal(await replayOpening.count(), 0, 'The fresh maker opening begins once through its real button'); }
        if (game.id === 'sneak') {
          record.replayLayout = await renderedSneakField('Replayed Sneak scene covers the field with its control in reach');
          await until(() => exists('[data-sneak-stage][data-sneak-phase="counting"]'), 6000, 'Replayed Sneak begins its next count');
          const before = Number(await page.locator('[data-hero-at]').getAttribute('data-hero-at'));
          await root.focus(); await page.keyboard.down('Space'); record.inputs.keyboard++;
          try { await advance(320); } finally { await page.keyboard.up('Space'); record.inputs.keyboard++; }
          await advance(32);
          const after = Number(await page.locator('[data-hero-at]').getAttribute('data-hero-at'));
          assert.ok(after > before, 'The replayed hero moves in response to a real hold and release');
          record.metrics.replayMovement = { before, after };
        }
        await snapshot('replay'); record.replay = { fresh: true, openingPressed, state: await attrs() };
        // Exit while a new session is active; future callbacks must not finish it.
        await press(page.locator('.review-bar > button').first());
        await page.locator(`.studio-v2--world[data-world="${game.world}"]`).waitFor({ state: 'visible' });
        await press(page.locator('.review-bar > button').first()); await page.locator('[data-studio-home]').waitFor({ state: 'visible' });
        await advance(20000);
        assert.equal(await page.locator(selector).count(), 0, 'Exited game stays unmounted');
        assert.equal(await page.locator('[data-studio-phase="result"], [data-sneak-ending]').count(), 0, 'No late completion after active exit');
        record.audio = await page.evaluate(() => window.gameCycleAudio); record.audioDetails = await page.evaluate(() => window.gameCycleAudioDetails);
        const { audibleSources, media, speech, captures } = record.audio;
        assert.deepEqual({ audibleSources, media, speech, captures }, { audibleSources: 0, media: 0, speech: 0, captures: 0 }, 'Muted play emits no audible sources, media, speech or capture');
        assert.deepEqual(errors, [], 'No browser or React errors'); assert.deepEqual(brokenResources, [], 'All requested game resources served'); assert.deepEqual(unexpectedRequests, [], 'No API/external requests from synthetic play');
        await snapshot('home'); record.passed = true;
      } catch (error) {
        await snapshot('failed').catch(() => {});
        record.audio ??= await page.evaluate(() => window.gameCycleAudio).catch(() => null); record.audioDetails ??= await page.evaluate(() => window.gameCycleAudioDetails).catch(() => null);
        if (game.id === 'sneak') record.failureLayout = await sneakLayout().catch(() => null);
        record.failureState = await page.evaluate(sel => ({ root: document.querySelector(sel)?.outerHTML.slice(0, 12000) ?? null, studio: document.querySelector('[data-studio-phase]')?.getAttribute('data-studio-phase'), loading: !!document.querySelector('[data-testid="kid-stage-fallback"]') }), selector).catch(() => null);
        Object.assign(record, { passed: false, error: String(error), errors, brokenResources, unexpectedRequests }); failures[index] = new Error(`${stem}: ${error instanceof Error ? error.message : error}`, { cause: error });
      }
      record.controlledMs = controlledMs;
    } catch (error) {
      Object.assign(record, { passed: false, error: String(error), errors, brokenResources, unexpectedRequests, failureStage: 'cell-setup' });
      failures[index] = new Error(`${stem}: setup failed`, { cause: error });
    } finally {
      try { await context.close(); }
      catch (error) {
        record.passed = false; record.teardownError = String(error);
        failures[index] = new AggregateError([...(failures[index] ? [failures[index]] : []), error], `${stem}: context teardown failed`);
      }
      record.wallElapsedMs = Date.now() - started;
      await persist(index, record);
    }
  };
  let nextCell = 0;
  const workers = await Promise.allSettled(Array.from({ length: Math.min(3, cells.length) }, async () => {
    while (nextCell < cells.length) {
      const index = nextCell++, cell = cells[index], started = Date.now();
      try { await runCell(cell, index); }
      catch (error) {
        // A context/setup failure must not prevent the other cells exporting
        // their evidence. It is still a hard failed cell, never a skipped pass.
        failures[index] = error;
        await persist(index, { case: 'curated-maker-cycle', game: cell.game.id, viewport: cell.viewport.id, lang: cell.viewport.lang, passed: false, error: String(error), failureStage: 'cell-setup-or-artifact', wallElapsedMs: Date.now() - started });
      }
    }
  }));
  await summaryWrites;
  const allFailures = [...failures.filter(Boolean), ...workers.filter(worker => worker.status === 'rejected').map(worker => worker.reason)];
  assert.equal(rows.filter(Boolean).length, expectedCells, 'Every requested game and viewport cell was operated');
  if (allFailures.length) throw new AggregateError(allFailures, `${failures.filter(Boolean).length}/${rows.length} curated maker cells failed; see maker-cycles/summary.json`);
  return rows;
}
