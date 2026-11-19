/** The five default games, through the real Home → world → Studio session.
 * Synthetic child, sound off, reduced motion, and Playwright's controlled clock.
 * Inputs use visible cards/petals/sign hints; no React state or completion seam.
 * This is Chromium route evidence, not a physical-device or audible-audio claim. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';

const GAMES = [
  { id: 'memory', adventure: 'delivery', world: 'playbank' },
  { id: 'pattern', adventure: 'sun', world: 'playbank' },
  { id: 'puzzle', adventure: 'oops', world: 'playbank' },
  { id: 'river-rescue', adventure: 'rover', world: 'playbank' },
  { id: 'rhythm-garden', adventure: 'hero-band', world: 'studio' },
];

/** Installed before app code. Exempt only the sound bank's exact, inaudible
 * iOS unlock buffer; unfamiliar sources fail closed as potentially audible.
 * Exported so negative controls can verify this same browser instrumentation. */
export function installGameCycleAudioProbe() {
  window.gameCycleAudio = { sources: 0, silentUnlocks: 0, audibleSources: 0, media: 0, speech: 0, captures: 0 };
  window.gameCycleAudioDetails = [];
  // A browser method may delegate through its base prototype. A Web Audio
  // source can start only once; do not count that one start at both wrappers.
  const seen = new WeakSet();
  const observeSource = source => {
    if (seen.has(source)) return;
    seen.add(source);
    const bufferSource = typeof window.AudioBufferSourceNode === 'function' && source instanceof window.AudioBufferSourceNode;
    const buffer = bufferSource ? source.buffer : null;
    let sample = null;
    if (buffer?.length === 1 && buffer.numberOfChannels === 1) {
      try { sample = buffer.getChannelData(0)[0]; } catch { /* Unreadable is not proved silent. */ }
    }
    const silentUnlock = !!buffer && buffer.length === 1 && buffer.numberOfChannels === 1
      && Number.isFinite(buffer.sampleRate) && buffer.sampleRate > 0 && source.loop === false && sample === 0;
    window.gameCycleAudio.sources++;
    window.gameCycleAudio[silentUnlock ? 'silentUnlocks' : 'audibleSources']++;
    window.gameCycleAudioDetails.push({
      kind: bufferSource ? 'buffer' : typeof window.OscillatorNode === 'function' && source instanceof window.OscillatorNode ? 'oscillator' : 'scheduled',
      frames: buffer?.length ?? null, channels: buffer?.numberOfChannels ?? null,
      sampleRate: buffer?.sampleRate ?? null, loop: bufferSource ? source.loop : null,
      sample, silentUnlock,
      phase: document.querySelector('[data-adventure]')?.getAttribute('data-phase') ?? null,
    });
  };
  for (const prototype of [window.AudioScheduledSourceNode?.prototype, window.AudioBufferSourceNode?.prototype, window.OscillatorNode?.prototype]) {
    if (!prototype?.start) continue;
    const original = prototype.start;
    prototype.start = function(...args) { observeSource(this); return original.apply(this, args); };
  }
  const count = (prototype, method, field) => {
    if (!prototype?.[method]) return;
    const original = prototype[method];
    prototype[method] = function(...args) { window.gameCycleAudio[field]++; return original.apply(this, args); };
  };
  count(window.HTMLMediaElement?.prototype, 'play', 'media');
  count(window.SpeechSynthesis?.prototype, 'speak', 'speech');
  if (navigator.mediaDevices) navigator.mediaDevices.getUserMedia = async () => {
    window.gameCycleAudio.captures++; throw new Error('No capture in synthetic game fixture');
  };
}

/** Finish scenery is the selected world's empty plate, with one separate cast. */
export async function verifyStudioResultScene(page, world) {
  const header = page.locator('[data-studio-phase="result"] .studio-game-card__window');
  await header.locator(':scope > img[data-studio-plate]').evaluate(image => image.decode());
  const scene = await header.evaluate(element => {
    const plate = element.querySelector(':scope > img[data-studio-plate]');
    const label = element.querySelector('.studio-game-card__world');
    const crew = element.querySelector('[data-studio-cheer]');
    const bounds = element.getBoundingClientRect(), text = label.getBoundingClientRect();
    return {
      world: plate.dataset.studioPlate, src: plate.currentSrc, loaded: plate.complete && plate.naturalWidth > 0,
      plates: element.querySelectorAll(':scope > img[data-studio-plate]').length,
      populatedCovers: element.querySelectorAll(':scope > img:not([data-studio-plate]), [data-maker-cover], [data-adventure-scene]').length,
      heroes: element.querySelectorAll('.studio-game-card__hero [data-game-hero-source]').length,
      crew: [...element.querySelectorAll('[data-studio-cheer] > img')].map(image => image.dataset.crew),
      label: label.textContent.trim(),
      labelFits: text.width > 0 && text.height > 0 && text.left >= bounds.left && text.right <= bounds.right
        && text.top >= bounds.top && text.bottom <= bounds.bottom && label.scrollWidth <= label.clientWidth + 1,
      labelAboveCrew: Number(getComputedStyle(label).zIndex) > Number(getComputedStyle(crew).zIndex),
    };
  });
  assert.equal(scene.world, world, 'The finish stays in the selected world');
  assert.ok(scene.loaded, 'The empty world plate is decoded');
  assert.equal(scene.plates, 1); assert.equal(scene.populatedCovers, 0, 'No populated cover duplicates a host behind the cast');
  assert.equal(scene.heroes, 1, 'Exactly one canonical hero stands in the finish header');
  assert.deepEqual(scene.crew, ['chock', 'aya', 'pep'], 'Each approved companion appears once in the finish header');
  assert.ok(scene.label && scene.labelFits && scene.labelAboveCrew, 'The world label is complete, in bounds and above the crew');
  return scene;
}

/** Watch the same information a child sees; each driver has a finite budget. */
async function playCycle(page, game, press, trace) {
  const root = page.locator(`[data-adventure="${game.adventure}"]`);
  let previous = '', request = [], order = [], dance = [];
  let repairs = 0, deliveries = 0, arrivals = 0, matches = 0, madeRoom = false;
  let wrongPadTried = false, wrongDeliveryTried = false, wrongDanceTried = false;
  const advance = async ms => { await page.clock.runFor(ms); };
  for (let attempt = 0; attempt < 260; attempt++) {
    // GameFinish briefly renders null while its effect reports to Studio.
    // Read both states together; never auto-wait for a mechanic that is being
    // deliberately unmounted by the real completion wrapper.
    const state = await page.evaluate(adventure => ({
      result: !!document.querySelector('[data-studio-phase="result"]'),
      phase: document.querySelector(`[data-adventure="${adventure}"]`)?.getAttribute('data-phase'),
    }), game.adventure);
    if (state.result) {
      assert.ok(deliveries >= 7 || game.adventure !== 'delivery', 'All three requests were delivered');
      assert.ok(madeRoom || game.adventure !== 'sun', 'Chock was brought into the circle');
      assert.ok(repairs >= 1 || game.adventure !== 'oops', 'The toy jam was paused, undone and restarted');
      assert.ok(arrivals === 3 || game.adventure !== 'rover', 'The rover arrived at all three rugs');
      assert.ok(matches === 2 || game.adventure !== 'hero-band', 'Both dances were copied before creating a dance');
      return { deliveries, repairs, arrivals, matches, madeRoom, wrongPadTried, wrongDeliveryTried, wrongDanceTried };
    }
    const phase = state.phase;
    if (!phase) { await advance(32); continue; }
    if (phase !== previous) trace.push({ phase });
    const entered = phase !== previous;
    previous = phase;
    if (game.adventure === 'delivery') {
      if (phase === 'ready') await press(root.locator('.adventure-go'));
      else if (phase === 'ask') {
        if (entered) request = [];
        const cards = await root.locator('.delivery-card').evaluateAll(elements => elements.map(element => element.querySelector('[data-bop-sprite]')?.getAttribute('data-bop-sprite') ?? null));
        cards.forEach((item, index) => { if (item) request[index] = item; });
        await advance(500);
      } else if (phase === 'fetch') {
        const delivered = await root.locator('.delivery-landed [data-slot]').count();
        const item = request[delivered];
        assert.ok(item, 'The next delivery item was observed on a face-up request card');
        if (!wrongDeliveryTried) {
          const other = root.locator(`.delivery-item:not([data-item="${item}"])`).first();
          await press(other);
          assert.equal(await root.locator('.delivery-landed [data-slot]').count(), delivered, 'A different toy preserves the request');
          wrongDeliveryTried = true;
        }
        await press(root.locator(`.delivery-item[data-item="${item}"]`));
        deliveries++;
      } else await advance(500);
    } else if (game.adventure === 'sun') {
      if (phase === 'ready') await press(root.locator('.adventure-go'));
      else if (phase === 'spin') {
        assert.equal(await root.locator('.sun-spinner__hub').count(), 1, 'One spinner hub is rendered');
        await press(root.locator('.sun-spinner'));
      } else if (phase === 'count') {
        const from = Number(await root.locator('.sun-path').getAttribute('data-position'));
        const face = Number(await root.locator('.sun-spinner').getAttribute('data-face'));
        assert.ok(face > 0, 'The stopped spinner shows a positive hop count');
        if (!wrongPadTried) {
          await press(root.locator(`.sun-pad:not([data-pad="${from + face}"])`).first());
          assert.equal(Number(await root.locator('.sun-path').getAttribute('data-position')), from, 'A different pad preserves the current place');
          wrongPadTried = true;
        }
        await press(root.locator(`.sun-pad[data-pad="${from + face}"]`));
      } else if (phase === 'make-room') {
        await press(root.locator('.sun-far__pad')); madeRoom = true;
      } else await advance(500);
    } else if (game.adventure === 'oops') {
      if (phase === 'ready') await press(root.locator('.adventure-go'));
      else if (phase === 'watch') {
        if (entered) order = [];
        const shown = await root.locator('.oops-petal__chip').evaluateAll(elements => elements.map(element => ({
          position: Number(element.textContent) - 1, petal: element.closest('[data-petal]').getAttribute('data-petal'),
        })));
        shown.forEach(item => { order[item.position] = item.petal; });
        await advance(250);
      } else if (phase === 'copy') {
        const opened = await root.locator('.oops-petal[data-open="true"]').count();
        assert.ok(order[opened] !== undefined, 'The next petal was observed while the toy showed its order');
        await press(root.locator(`.oops-petal[data-petal="${order[opened]}"]`));
      } else if (phase === 'jam') await press(root.locator('[data-control="oops-pause"]'));
      else if (phase === 'undo') {
        const newest = await root.locator('[data-undo-number]').evaluateAll(elements => elements.map(element => ({
          number: Number(element.getAttribute('data-undo-number')), petal: element.closest('[data-petal]').getAttribute('data-petal'),
        })).sort((a, b) => b.number - a.number)[0]);
        assert.ok(newest, 'Undo exposes the newest open petal');
        await press(root.locator(`.oops-petal[data-petal="${newest.petal}"]`));
      } else if (phase === 'reset') {
        await press(root.locator('[data-control="oops-restart"]')); repairs++;
      } else await advance(500);
    } else if (game.adventure === 'rover') {
      if (['ready', 'plan', 'parked'].includes(phase)) {
        // The game's idle cue points to one visible sign or flower at a time.
        // Let that authored hint appear, then turn/fold it using its own button.
        await advance(7_050);
        const hint = root.locator('.rover-sign[data-hint="true"], .rover-bloom[data-hint="true"]');
        if (await hint.count()) await press(hint.first());
        else await press(root.locator('.adventure-go'));
      } else {
        if (phase === 'arrived' && entered) arrivals++;
        await advance(400);
      }
    } else if (game.adventure === 'hero-band') {
      if (phase === 'ready') await press(root.locator('.adventure-go'));
      else if (phase === 'show') {
        dance = await root.locator('.band-step').evaluateAll(elements => elements.map(element => element.getAttribute('data-move')));
        assert.ok(dance.length > 0 && dance.every(move => move !== 'none'), 'The demonstrated dance is visible');
        await advance(500);
      } else if (phase === 'copy') {
        const at = await root.locator('.band-step').evaluateAll(elements => elements.findIndex(element => element.getAttribute('data-next') === 'true'));
        assert.ok(at >= 0 && dance[at] !== undefined, 'The next dance step was observed in the demonstration');
        if (!wrongDanceTried) {
          await press(root.locator(`.band-pad:not([data-move="${dance[at]}"])`).first());
          const after = await root.locator('.band-step').evaluateAll(elements => elements.findIndex(element => element.getAttribute('data-next') === 'true'));
          assert.equal(after, at, 'A different dance move preserves the already copied steps');
          wrongDanceTried = true;
        }
        await press(root.locator(`.band-pad[data-move="${dance[at]}"]`));
      } else if (phase === 'matched') { matches++; await press(root.locator('.adventure-go')); }
      else if (phase === 'jam') {
        const pads = root.locator('.band-pad'), padCount = await pads.count();
        const steps = await root.locator('.band-step').count();
        for (let step = 0; step < steps; step++) await press(pads.nth(step % padCount));
        assert.equal(await root.locator('.band-step[data-move="none"]').count(), 0, 'A complete own dance can be built with the beat paused');
        // With moves present, Show time is the sole primary action.
        await press(root.locator('.adventure-actions .studio-game-button-v2--primary'));
      } else await advance(500);
    }
  }
  throw new Error(`${game.id}: no real Studio result within the bounded play budget; last phase ${previous}`);
}

async function roverFloor(page) {
  return page.locator('.rover-stage').evaluate(element => ({
    size: Number(element.getAttribute('data-size')),
    start: Number(element.querySelector('.rover-start').getAttribute('data-cell')),
    goal: Number(element.querySelector('.rover-goal').getAttribute('data-cell')),
    car: Number(element.querySelector('.rover-car').getAttribute('data-at')),
    heading: element.querySelector('.rover-car').getAttribute('data-heading'),
    signs: [...element.querySelectorAll('.rover-sign')].map(sign => ({
      cell: Number(sign.getAttribute('data-cell')), heading: sign.getAttribute('data-heading'),
    })),
  }));
}

export async function verifyDefaultGameCycles({ browser, base, output }) {
  const folder = path.join(output, 'game-cycles');
  await mkdir(folder, { recursive: true });
  const rows = [], failures = [], origin = new URL(base).origin;
  for (const viewport of RELEASE_VIEWPORTS) for (const game of GAMES) {
    const phone = viewport.id.startsWith('mobile-');
    const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h },
      reducedMotion: 'reduce', hasTouch: phone, isMobile: phone });
    const errors = [], brokenResources = [], unexpectedRequests = [], fixtureRequests = [], trace = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      // The no-Firebase preview probes the optional sandbox proof sheet even
      // though this synthetic child has no approved avatar. Supply an explicit
      // absent sheet, keeping the real hero resolver's Sprout fallback. Never
      // serve the private proof assets or exempt other failed game resources.
      if (url.origin === origin && url.pathname === '/_proof/hero/sheet.json') {
        fixtureRequests.push({ path: url.pathname, fixture: 'absent hero sheet: null' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      }
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      unexpectedRequests.push(url.href); return route.abort();
    });
    await context.addInitScript(() => {
      localStorage.setItem('arbor.kid.readAloud.muted.studio-v2-synthetic-review', '1');
      Math.random = () => 0;
    });
    await context.addInitScript(installGameCycleAudioProbe);
    const page = await context.newPage();
    page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    page.on('response', response => {
      if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) brokenResources.push({ url: response.url(), status: response.status() });
    });
    const stem = `${game.id}-${viewport.id}`;
    const record = { case: 'default-game-cycle', game: game.id, adventure: game.adventure, viewport: viewport.id,
      lang: viewport.lang, input: phone ? 'emulated touch' : 'mouse', sound: 'off', motion: 'reduce',
      clock: 'normal loading, then controlled gameplay timers; visible controls only',
      sessions: [], screenshots: [], fixtureRequests, trace };
    const shot = async label => {
      const name = `${stem}-${label}.png`;
      await page.screenshot({ path: path.join(folder, name), fullPage: true, animations: 'disabled' });
      record.screenshots.push(`game-cycles/${name}`);
    };
    const press = async locator => {
      if (phone) await locator.tap(); else await locator.click();
      await page.clock.runFor(32);
    };
    try {
      await page.clock.install({ time: new Date('2026-11-18T12:00:00Z') });
      const url = new URL(base); url.searchParams.set('lang', viewport.lang); url.searchParams.set('studioNext', '1');
      await page.goto(url.href);
      await page.locator('[data-studio-home]').waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      assert.equal(await page.evaluate(() => matchMedia('(prefers-reduced-motion: reduce)').matches), true);
      await press(page.locator(`button.studio-v2__door[data-world="${game.world}"]`));
      await press(page.locator(`[data-studio-activity="${game.id}"]`));
      await page.locator('[data-studio-phase="intro"]').waitFor({ state: 'visible' });
      await press(page.locator('[data-studio-start]'));
      await page.locator(`[data-adventure="${game.adventure}"]`).waitFor({ state: 'visible' });
      // React may delay a fulfilled lazy boundary for its 300ms Suspense
      // fallback minimum. Keep its clock running through real code loading;
      // pause only after the mechanic is mounted and before the child starts.
      await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1_000));
      assert.equal(await page.locator(`[data-adventure="${game.adventure}"]`).getAttribute('data-phase'), 'ready');
      assert.equal(await page.locator(`[data-adventure="${game.adventure}"]`).getAttribute('dir'), viewport.lang === 'he' ? 'rtl' : 'ltr');
      assert.equal(await page.locator('[data-game-hero-source]:not([data-game-hero-source="mascot"])').count(), 0, 'The synthetic child keeps the neutral mascot fallback');
      await page.locator(`[data-adventure="${game.adventure}"] img`).evaluateAll(images => Promise.all(images.map(image => image.decode())));
      if (game.adventure === 'rover') record.firstFloor = await roverFloor(page);
      await shot('ready');
      for (let session = 0; session < 2; session++) {
        trace.push({ session });
        record.sessions.push(await playCycle(page, game, press, trace));
        const result = page.locator('[data-studio-phase="result"]');
        await result.waitFor({ state: 'visible' });
        assert.ok((await result.innerText()).trim().length > 0, 'The Studio completion card has readable content');
        (record.resultScenes ??= []).push(await verifyStudioResultScene(page, game.world));
        if (game.adventure === 'hero-band') {
          const creation = result.locator('[data-creation="dance"]');
          await creation.waitFor({ state: 'visible' });
          assert.equal(await creation.locator('.studio-creation-dance > span').count(), 8, 'The result keeps the actual eight-step dance');
          assert.equal(await creation.locator('[data-move="none"]').count(), 0);
          // A kept dance also plays to its end silently in the result preview.
          await press(creation.locator('button'));
          await page.clock.runFor(6_000);
          assert.equal(await creation.locator('[data-lit="true"]').count(), 0, 'The result dance preview stops at its own end');
        }
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal overflow at completion');
        await shot(`result-${session + 1}`);
        if (session === 0) {
          await press(result.locator('[data-studio-replay]'));
          await page.locator(`[data-adventure="${game.adventure}"]`).waitFor({ state: 'visible' });
          assert.equal(await page.locator(`[data-adventure="${game.adventure}"]`).getAttribute('data-phase'), 'ready', 'Studio Play again remounts a fresh playable game');
          if (game.adventure === 'rover') {
            record.replayFloor = await roverFloor(page);
            const first = record.firstFloor, next = record.replayFloor;
            const turn = cell => (cell % first.size) * first.size + first.size - 1 - Math.floor(cell / first.size);
            assert.equal(next.start, turn(first.start), 'Studio replay rotates the rover start');
            assert.equal(next.goal, turn(first.goal), 'Studio replay rotates the goal');
            assert.equal(next.car, next.start, 'The replay rover starts on its rotated mat');
            assert.notDeepEqual(next, first, 'The Studio replay does not repeat the first floor');
          }
          await shot('replay-ready');
        }
      }
      await press(page.locator('[data-studio-phase="result"] .studio-game-card__actions .studio-game-button-v2--primary'));
      await page.locator(`.studio-v2--world[data-world="${game.world}"]`).waitFor({ state: 'visible' });
      await press(page.locator('.review-bar > button').first());
      await page.locator('[data-studio-home]').waitFor({ state: 'visible' });
      await page.clock.runFor(20_000);
      assert.equal(await page.locator('[data-adventure]').count(), 0, 'No game remounts after returning Home');
      assert.equal(await page.locator('[data-studio-phase="result"]').count(), 0, 'No stale timer publishes a result after exit');
      record.audio = await page.evaluate(() => window.gameCycleAudio);
      record.audioDetails = await page.evaluate(() => window.gameCycleAudioDetails);
      const { audibleSources, media, speech, captures } = record.audio;
      assert.deepEqual({ audibleSources, media, speech, captures }, { audibleSources: 0, media: 0, speech: 0, captures: 0 }, 'Sound off and camera-free play emit no audible sources throughout both sessions and exit');
      assert.ok(record.audio.silentUnlocks <= (game.adventure === 'delivery' ? 2 : 0), 'Only Delivery begins each session with its known silent iOS unlock');
      assert.ok(record.audioDetails.every(source => !source.silentUnlock || source.phase === 'ready'), 'Silent unlocks belong to the visible Begin gestures');
      assert.deepEqual(errors, [], 'No browser or React errors during complete cycles');
      assert.deepEqual(brokenResources, [], 'All requested game resources were served');
      assert.deepEqual(unexpectedRequests, [], 'Synthetic cycles make no API or external requests');
      await shot('home');
      record.passed = true;
    } catch (error) {
      await shot('failed').catch(() => {});
      const failureState = await page.evaluate(() => ({
        studioPhase: document.querySelector('[data-studio-phase]')?.getAttribute('data-studio-phase') ?? null,
        adventurePhase: document.querySelector('[data-adventure]')?.getAttribute('data-phase') ?? null,
        loadingFallback: !!document.querySelector('[data-testid="kid-stage-fallback"]'),
      })).catch(() => null);
      record.audio ??= await page.evaluate(() => window.gameCycleAudio).catch(() => null);
      record.audioDetails ??= await page.evaluate(() => window.gameCycleAudioDetails).catch(() => null);
      Object.assign(record, { passed: false, error: String(error), failureState, errors, brokenResources, unexpectedRequests });
      failures.push(new Error(`${stem}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }));
    } finally { await context.close(); }
    rows.push(record);
    await writeFile(path.join(folder, `${stem}.json`), JSON.stringify(record, null, 2));
    // Keep a usable partial suite record even if a later browser/process fails.
    await writeFile(path.join(folder, 'summary.json'), JSON.stringify({
      expectedCells: RELEASE_VIEWPORTS.length * GAMES.length, completedCells: rows.length,
      passedCells: rows.filter(row => row.passed).length, failedCells: failures.length, results: rows,
    }, null, 2));
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} of ${rows.length} default game cycle cells failed; see game-cycles/summary.json`);
  return rows;
}
