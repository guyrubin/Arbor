/** Retained Studio and Arcade routes, operated through their production controls.
 * No state injection, completion callback, microphone or generated story is used.
 * Reading and Speech are bounded exercises, not invented finite-game endings. */
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { RELEASE_VIEWPORTS } from './capture/release-config.mjs';
import { installGameCycleAudioProbe } from './kids-game-cycle-browser.mjs';

const STUDIO = [
  { id: 'feelings', world: 'feelings', ready: '[data-kid-mood-play]' },
  { id: 'mimic', world: 'feelings', ready: '[data-mimic-prompt]' },
  { id: 'beat', world: 'studio', ready: '[data-kid-beat-pick]' },
  { id: 'sound-explorer', world: 'studio', ready: '.studio-sound-choices' },
  { id: 'memory', world: 'playbank', ready: '[data-kid-memory-board]' },
  { id: 'pattern', world: 'playbank', ready: '[data-kid-track]' },
  { id: 'puzzle', world: 'playbank', ready: '.studio-puzzle-board' },
];
const ARCADE = [
  { id: 'pose', ready: '.studio-practice-stage--pose' },
  { id: 'adventures', ready: '[data-game-shell="adventures"]' },
  { id: 'reading', ready: '[data-game-shell="reading"] [role="tablist"]' },
  { id: 'speech', ready: '[data-game-shell="speech"] [role="group"]', language: 'en' },
];
const completeStudio = page => page.locator('[data-studio-phase="result"]');
const gameShell = (page, id) => page.locator(`[data-game-shell="${id}"]`).first();
const textOf = locator => locator.innerText().then(text => text.trim());

function rgba(value) {
  const hex = /^#([\da-f]{3}|[\da-f]{6})$/i.exec(value.trim());
  if (hex) {
    const digits = hex[1].length === 3 ? [...hex[1]].map(digit => digit + digit).join('') : hex[1];
    return [0, 2, 4].map(start => parseInt(digits.slice(start, start + 2), 16)).concat(1);
  }
  assert.match(value, /^rgba?\(/, `The measured color can be checked: ${value}`);
  const channels = value.match(/[\d.]+/g).map(Number);
  return [channels[0], channels[1], channels[2], channels[3] ?? 1];
}

function contrast(foreground, background) {
  const fg = rgba(foreground), bg = rgba(background);
  assert.equal(bg[3], 1, 'Reading contrast has an opaque measured background');
  const luminance = channels => channels.slice(0, 3).map(value => value / 255)
    .map(value => value <= 0.04045 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4)
    .reduce((total, value, index) => total + value * [0.2126, 0.7152, 0.0722][index], 0);
  const front = luminance(fg.slice(0, 3).map((value, index) => value * fg[3] + bg[index] * (1 - fg[3])));
  const back = luminance(bg);
  return (Math.max(front, back) + 0.05) / (Math.min(front, back) + 0.05);
}

async function inspectReviewHeader(page) {
  const header = await page.locator('[data-activity-review] > .review-bar').evaluate(element => {
    const style = getComputedStyle(element), box = element.getBoundingClientRect();
    const title = element.querySelector('[data-kid-bar-title]');
    const stage = element.parentElement.querySelector(':scope > .kid-stage');
    let paintsAboveScene = true;
    if (stage) {
      const stageBox = stage.getBoundingClientRect(), stageStyle = getComputedStyle(stage);
      const overlaps = box.left < stageBox.right && box.right > stageBox.left && box.top < stageBox.bottom && box.bottom > stageBox.top;
      const parentDisplay = getComputedStyle(element.parentElement).display;
      const hasLayer = style.position !== 'static' || style.transform !== 'none'
        || (/flex|grid/.test(parentDisplay) && style.zIndex !== 'auto');
      const headerZ = Number.parseInt(style.zIndex) || 0, stageZ = Number.parseInt(stageStyle.zIndex) || 0;
      // Pointer-events:none scenery can cover text while click checks still pass.
      // Check its actual sibling paint order as well as the controls' hit targets.
      paintsAboveScene = !overlaps || (hasLayer && (headerZ > stageZ
        || (headerZ === stageZ && !!(stage.compareDocumentPosition(element) & Node.DOCUMENT_POSITION_FOLLOWING))));
    }
    return {
      title: title?.textContent?.trim(),
      titleFits: !!title && title.scrollWidth <= title.clientWidth + 1,
      paintsAboveScene,
      controls: [...element.querySelectorAll('button')].map(button => {
        const rect = button.getBoundingClientRect(), hit = document.elementFromPoint(rect.x + rect.width / 2, rect.y + rect.height / 2);
        return { label: button.getAttribute('aria-label') || button.textContent?.trim(), width: rect.width, height: rect.height,
          inViewport: rect.left >= -1 && rect.right <= innerWidth + 1 && rect.top >= -1 && rect.bottom <= innerHeight + 1,
          unobstructed: !!hit && button.contains(hit) };
      }),
    };
  });
  assert.ok(header.title && header.titleFits && header.paintsAboveScene, 'The retained activity header is readable above its decorative scene');
  assert.ok(header.controls.length >= 3 && header.controls.every(control => control.inViewport && control.unobstructed && control.width >= 44 && control.height >= 44), 'Back, sound and exit are visible and unobstructed 44px controls');
  return header;
}

async function inspectRetainedFinish({ page, root, advance }) {
  const finish = root.locator('[data-game-finish]');
  await finish.waitFor({ state: 'visible' });
  await advance(400);
  await page.evaluate(() => document.fonts.ready);
  const reading = await finish.evaluate(element => {
    const box = element.getBoundingClientRect(), style = getComputedStyle(element);
    return { background: style.backgroundColor, backgroundImage: style.backgroundImage,
      text: [...element.querySelectorAll('h2, p')].filter(node => node.getClientRects().length).map(node => {
        const textStyle = getComputedStyle(node), range = document.createRange();
        range.selectNodeContents(node);
        const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
        let opacity = 1;
        for (let ancestor = node; ancestor; ancestor = ancestor.parentElement) opacity *= Number(getComputedStyle(ancestor).opacity);
        return { text: node.textContent?.trim(), color: textStyle.color, family: textStyle.fontFamily, fontSize: parseFloat(textStyle.fontSize), opacity,
          fits: rects.length > 0 && rects.every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1 && rect.top >= box.top - 1 && rect.bottom <= box.bottom + 1) };
      }) };
  });
  assert.equal(rgba(reading.background)[3], 1, 'The ending words sit on opaque paper rather than the scene image');
  assert.equal(reading.backgroundImage, 'none', 'The ending reading surface has no image behind its words');
  assert.ok(reading.text.length >= 2, 'The actual ending includes its title and supporting words');
  for (const text of reading.text) {
    text.contrast = contrast(text.color, reading.background);
    assert.ok(text.fits && text.fontSize >= 17 && text.opacity >= 0.99 && text.contrast >= 4.5, `Complete readable ending text: ${text.text}`);
    assert.ok(/Nunito|Heebo/.test(text.family), 'Retained ending text uses the child reading face');
  }
  const controls = [];
  for (const selector of ['[data-kid-finish-again]', '[data-kid-finish-home]']) {
    const action = finish.locator(selector);
    await action.scrollIntoViewIfNeeded();
    const bounds = await action.evaluate(button => {
      const box = button.getBoundingClientRect(), panel = button.closest('[data-game-finish]').getBoundingClientRect();
      const hit = document.elementFromPoint(box.x + box.width / 2, box.y + box.height / 2);
      return { label: button.textContent?.trim(), width: box.width, height: box.height,
        fitsPanel: box.left >= panel.left - 1 && box.right <= panel.right + 1 && box.top >= panel.top - 1 && box.bottom <= panel.bottom + 1,
        inViewport: box.left >= -1 && box.right <= innerWidth + 1 && box.top >= -1 && box.bottom <= innerHeight + 1,
        unobstructed: !!hit && button.contains(hit) };
    });
    assert.ok(bounds.fitsPanel && bounds.inViewport && bounds.unobstructed && bounds.width >= 44 && bounds.height >= 44, 'Each real ending action fits its panel and remains reachable');
    controls.push(bounds);
  }
  return { ...reading, controls };
}

async function inspectAdventureWords(root) {
  const labels = await root.locator('[data-adventure-choices] .kid-piece-tag').evaluateAll(tags => tags.map(tag => {
    const box = tag.getBoundingClientRect(), text = tag.textContent ?? '', nodes = [];
    const walker = document.createTreeWalker(tag, NodeFilter.SHOW_TEXT);
    let offset = 0;
    while (walker.nextNode()) { const node = walker.currentNode; nodes.push({ node, start: offset, end: offset + node.textContent.length }); offset += node.textContent.length; }
    const words = [...text.matchAll(/\S+/gu)].map(match => {
      const start = match.index, end = start + match[0].length;
      const first = nodes.find(entry => entry.start <= start && entry.end > start);
      const last = nodes.find(entry => entry.start < end && entry.end >= end);
      const range = document.createRange();
      range.setStart(first.node, start - first.start); range.setEnd(last.node, end - last.start);
      const rects = [...range.getClientRects()].filter(rect => rect.width > 0 && rect.height > 0);
      return { word: match[0], lines: new Set(rects.map(rect => Math.round(rect.top))).size,
        fits: rects.every(rect => rect.left >= box.left - 1 && rect.right <= box.right + 1) };
    });
    return { label: text.trim(), fontSize: parseFloat(getComputedStyle(tag).fontSize),
      inViewport: box.left >= -1 && box.right <= innerWidth + 1, words };
  }));
  assert.ok(labels.length >= 2 && labels.every(label => label.fontSize >= 17 && label.inViewport && label.words.length > 0 && label.words.every(word => word.lines === 1 && word.fits)), 'Every Adventure answer wraps between whole readable words');
  const typography = await root.locator('[data-testid="adventure-scene-title"], [data-adventure-prompt]').evaluateAll(nodes => nodes.map(node => ({
    text: node.textContent?.trim(), family: getComputedStyle(node).fontFamily, color: getComputedStyle(node).color,
    graphite: getComputedStyle(node).getPropertyValue('--studio-graphite').trim(), fontSize: parseFloat(getComputedStyle(node).fontSize),
    fits: node.scrollWidth <= node.clientWidth + 1,
  })));
  assert.equal(typography.length, 2, 'The real scene title and prompt are present');
  for (const text of typography) {
    assert.ok(text.fits && text.fontSize >= 18 && /Nunito/.test(text.family) && /Heebo/.test(text.family), 'Child Adventure title and prompt use readable Studio type');
    assert.deepEqual(rgba(text.color), rgba(text.graphite), 'Child Adventure words use the approved graphite ink');
  }
  return { labels, typography };
}

async function playMimic({ page, press, shot, trace }) {
  let passed = 0;
  while (await page.locator('[data-mimic-prompt]').count()) {
    assert.ok(passed < 12, 'The mimic pass sequence is bounded');
    const prompt = page.locator('[data-mimic-prompt]');
    trace.push({ action: 'pass', prompt: await prompt.getAttribute('data-mimic-prompt') });
    await press(prompt.locator('button').nth(1)); passed++;
  }
  await page.locator('[data-mimic-passed]').waitFor({ state: 'visible' });
  assert.equal(await completeStudio(page).count(), 0, 'Passing every prompt does not award a completed activity');
  assert.equal(await page.locator('[data-kid-sticker="world:mimic"]').count(), 0, 'Passing alone does not invent a keepsake');
  await shot('all-passed');
  await press(page.locator('[data-mimic-replay]'));
  let tried = 0;
  while (await page.locator('[data-mimic-prompt]').count()) {
    assert.ok(tried < 12, 'The mimic tried sequence is bounded');
    trace.push({ action: 'tried', prompt: await page.locator('[data-mimic-prompt]').getAttribute('data-mimic-prompt') });
    await press(page.locator('[data-mimic-prompt] button').first()); tried++;
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  assert.equal(tried, passed, 'Replay offers the full authored prompt set');
  return { passedPrompts: passed, triedPrompts: tried, passDoesNotAward: true };
}

async function playFeelings({ page, press, trace, lang }) {
  const root = page.locator('[data-kid-mood-play]');
  // The separate self-check changes the child's chosen feeling, not progress.
  const selfCheck = root.locator('.kid-plate').last().locator('button[aria-pressed]').first();
  await press(selfCheck);
  assert.equal(await selfCheck.getAttribute('aria-pressed'), 'true');
  assert.equal(await completeStudio(page).count(), 0);
  for (let step = 0; step < 5; step++) {
    const labels = await root.locator('.kid-piece-tag').evaluateAll((tags) => tags.map((tag) => {
      const range = document.createRange();
      range.selectNodeContents(tag);
      const lines = [...range.getClientRects()].filter((rect) => rect.width > 0 && rect.height > 0);
      const box = tag.getBoundingClientRect();
      return {
        label: tag.textContent?.trim(),
        lines: new Set(lines.map((rect) => Math.round(rect.top))).size,
        fontSize: Number.parseFloat(getComputedStyle(tag).fontSize),
        fits: lines.every((rect) => rect.left >= box.left - 1 && rect.right <= box.right + 1)
          && box.left >= -1 && box.right <= innerWidth + 1,
      };
    }));
    assert.ok(labels.length === 3 && labels.every((label) => label.lines === 1 && label.fits && label.fontSize >= 17), 'Every emotion name stays whole, readable and inside the phone or desktop viewport');
    const choice = root.locator('.kid-piece-grid button').first();
    trace.push({ step, choice: await textOf(choice), labels });
    await press(choice);
    await press(root.getByRole('button', { name: lang === 'he' ? 'לרגש הבא' : 'Next feeling', exact: true }));
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  return { answers: 5, selfCheckUngraded: true };
}

async function playSound({ page, press, trace }) {
  const root = gameShell(page, 'sound-explorer');
  for (let round = 0; round < 3; round++) {
    const clue = await textOf(root.locator('.studio-sound-clue'));
    const target = /tiptoe|קצות האצבעות/.test(clue) ? 0 : /metal bell|פעמון מתכת/.test(clue) ? 1 : /lands softly|נוחת ברכות/.test(clue) ? 2 : -1;
    assert.ok(target >= 0, 'The visible sound-off clue identifies a playable source');
    assert.equal(await root.locator('.studio-sound-scene .studio-game-button--go').isDisabled(), true, 'Sound off disables the listening control');
    const choices = root.locator('.studio-sound-choice');
    trace.push({ round, clue, choice: await textOf(choices.nth(target)) });
    await press(choices.nth((target + 1) % 3));
    assert.equal(await root.locator('.studio-sound-choice[aria-pressed="true"]').count(), 0, 'A different source leaves the sound open for retry');
    await press(choices.nth(target));
    assert.equal(await choices.nth(target).getAttribute('aria-pressed'), 'true');
    await press(root.locator('.studio-game-button--go:enabled'));
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  return { soundsMatched: 3, visibleClues: true, retryChecks: 3 };
}

async function playBeat({ page, press, advance, trace }) {
  await press(page.locator('[data-kid-beat-pick] .kid-piece').first());
  const rounds = [];
  for (let round = 0; round < 3; round++) {
    const pad = page.locator('[data-beat-phase]');
    assert.equal(await pad.getAttribute('data-beat-phase'), 'ready');
    await press(pad);
    const observed = [];
    for (let tick = 0; tick < 400; tick++) {
      const phase = await pad.getAttribute('data-beat-phase');
      if (phase === 'scored') break;
      assert.equal(phase, 'playing');
      const beat = Number(await pad.getAttribute('data-beat'));
      if (!observed.includes(beat)) { observed.push(beat); await press(pad); }
      await advance(40);
    }
    assert.equal(await pad.getAttribute('data-beat-phase'), 'scored', 'The real beat timer reaches the end of its round');
    assert.ok(observed.length >= 3, 'The drum was tapped on several observed visual beats');
    trace.push({ round, observedBeats: observed }); rounds.push(observed.length);
    const next = gameShell(page, 'beat').locator('button.kid-toy').last();
    await press(next);
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  return { rounds: rounds.length, tapsPerRound: rounds };
}

async function playMemory({ page, press, advance, trace }) {
  const board = page.locator('[data-kid-memory-board]');
  const cardCount = await board.locator('button').count();
  const known = new Map();
  let turns = 0;
  for (; turns < 60; turns++) {
    if (await completeStudio(page).count()) break;
    const cards = board.locator('button');
    const unmatched = await cards.evaluateAll(elements => elements.flatMap((element, index) => element.hasAttribute('data-matched') ? [] : [index]));
    if (!unmatched.length) { await advance(64); continue; }
    let first, second;
    for (const candidate of unmatched) {
      const mate = unmatched.find(index => index !== candidate && known.has(candidate) && known.get(index) === known.get(candidate));
      if (mate !== undefined) { first = candidate; second = mate; break; }
    }
    first ??= unmatched.find(index => !known.has(index)) ?? unmatched[0];
    await press(cards.nth(first));
    assert.notEqual(await cards.nth(first).getAttribute('data-face'), null, 'Only face-up cards are read');
    const firstFace = await cards.nth(first).getAttribute('aria-label');
    known.set(first, firstFace);
    second ??= unmatched.find(index => index !== first && known.get(index) === firstFace)
      ?? unmatched.find(index => index !== first && !known.has(index))
      ?? unmatched.find(index => index !== first);
    assert.notEqual(second, undefined, 'A second unpaired card is available');
    await press(cards.nth(second));
    assert.notEqual(await cards.nth(second).getAttribute('data-face'), null, 'The second card is read only after its visible flip');
    const secondFace = await cards.nth(second).getAttribute('aria-label');
    known.set(second, secondFace);
    trace.push({ turn: turns, first, firstFace, second, secondFace });
    await advance(800);
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  assert.equal(known.size, cardCount, 'Every card was observed during actual play');
  return { cards: cardCount, pairs: cardCount / 2, turns, learnedFromFaceUpCards: true };
}

async function playPattern({ page, press, trace }) {
  let rounds = 0, retryChecked = false;
  for (; rounds < 6; rounds++) {
    const shown = await page.locator('[data-kid-track] > .kid-coin .kid-coin-glyph').allTextContents();
    const period = Array.from({ length: shown.length - 1 }, (_, i) => i + 1).find(size => shown.every((glyph, index) => glyph === shown[index % size]));
    assert.ok(period && shown.length > period, 'The visible track contains a repeating run');
    const answer = shown[shown.length % period];
    const choices = gameShell(page, 'pattern').locator('.kid-piece-grid button');
    const labels = await choices.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    const correct = labels.indexOf(answer);
    assert.ok(correct >= 0, 'The next visible pattern glyph is offered as a choice');
    if (!retryChecked) {
      await press(choices.nth(labels.findIndex(label => label !== answer)));
      assert.equal(await page.locator('.kid-socket[data-filled]').count(), 0, 'A first different glyph leaves the pattern open');
      retryChecked = true;
    }
    await press(choices.nth(correct));
    assert.equal(await page.locator('.kid-socket[data-filled]').count(), 1);
    trace.push({ round: rounds, shown, answer });
    await press(gameShell(page, 'pattern').locator('.studio-game-button--go'));
  }
  await completeStudio(page).waitFor({ state: 'visible' });
  assert.equal(rounds, 6, 'All six authored pattern rounds were completed');
  return { rounds, retryChecked, answersFromVisibleRun: true };
}

async function playPuzzle({ page, press, shot, trace }) {
  const root = gameShell(page, 'puzzle');
  const count = await root.locator('.studio-puzzle-piece').count();
  for (let piece = 0; piece < count; piece++) {
    const choice = root.locator('.studio-puzzle-piece:enabled').first();
    const label = await choice.getAttribute('aria-label');
    const position = label.slice(label.indexOf(':') + 1).trim();
    const cells = root.locator('.studio-puzzle-cell');
    const labels = await cells.evaluateAll(elements => elements.map(element => element.getAttribute('aria-label')));
    const target = labels.findIndex(value => value.slice(value.indexOf(':') + 1).trim() === position);
    assert.ok(target >= 0, 'A puzzle space carries the same visible position as the selected piece');
    await press(choice);
    if (piece === 0) {
      await press(cells.nth((target + 1) % count));
      assert.equal(await root.locator('.studio-puzzle-cell[data-filled="true"]').count(), 0, 'A different space does not place the selected piece');
    }
    trace.push({ piece, position });
    await press(cells.nth(target));
  }
  await root.locator('[data-puzzle-finish]').waitFor({ state: 'visible' });
  await shot('assembled-picture');
  await press(root.locator('[data-puzzle-finish]'));
  await completeStudio(page).waitFor({ state: 'visible' });
  return { pieces: count, retryChecked: true, explicitPictureFinish: true };
}

async function playPose({ page, press, advance, shot, trace, lang }) {
  const root = gameShell(page, 'pose');
  let poses = 0;
  while (!(await root.locator('[data-game-finish]').count())) {
    assert.ok(poses < 8, 'The pose sitting is bounded');
    trace.push({ pose: await textOf(root.locator('.studio-practice-stage--pose h2')) });
    await press(root.getByRole('button', { name: lang === 'he' ? 'הצלחנו!' : 'We did it!', exact: true }));
    await advance(1100); poses++;
  }
  assert.ok(poses >= 5 && poses <= 6, 'The complete pose set reaches its real ending');
  const finish = await inspectRetainedFinish({ page, root, advance });
  await shot('result');
  await press(root.locator('[data-kid-finish-again]'));
  await root.locator('.studio-practice-stage--pose').waitFor({ state: 'visible' });
  await shot('replay-ready');
  return { poses, finish, replayed: true, confirmation: 'visible We did it control; no camera or pose grading' };
}

async function playAdventure({ page, press, advance, shot, trace }) {
  const root = gameShell(page, 'adventures');
  const waitForReadableScene = async previous => {
    const state = await page.waitForFunction(before => {
      const shell = document.querySelector('[data-game-shell="adventures"]');
      const readable = element => {
        if (!element || !element.getClientRects().length) return false;
        let opacity = 1;
        for (let node = element; node; node = node.parentElement) {
          const style = getComputedStyle(node);
          if (style.visibility === 'hidden' || style.display === 'none') return false;
          opacity *= Number(style.opacity);
        }
        return opacity >= 0.99;
      };
      const finish = shell?.querySelector('[data-game-finish]');
      if (readable(finish)) return { kind: 'ending' };
      const prompt = shell?.querySelector('[data-adventure-prompt]');
      const question = prompt?.innerText.trim();
      return question && question !== before && readable(prompt) ? { kind: 'scene', prompt: question } : false;
    }, previous, { polling: 'raf', timeout: 15_000 });
    try { return await state.jsonValue(); } finally { await state.dispose(); }
  };
  const card = root.locator('button.play-pressable').filter({ has: page.locator('p.text-lg') }).first();
  const selectedTitle = await textOf(card.locator('p.text-lg'));
  await press(card);
  const title = root.getByTestId('adventure-scene-title');
  await title.waitFor({ state: 'visible' });
  assert.equal(await textOf(title), selectedTitle, 'Opening the story preserves its localized catalogue title');
  const opening = await waitForReadableScene(null);
  assert.equal(opening.kind, 'scene', 'The chosen story opens a readable authored question');
  await shot('active-scene');
  const prompt = root.locator('[data-adventure-prompt]');
  const seenPrompts = new Set();
  let scenes = 0, retries = 0;
  while (!(await root.locator('[data-game-finish]').count())) {
    assert.ok(scenes < 10, 'The authored adventure is bounded');
    const question = await textOf(prompt);
    assert.ok(!seenPrompts.has(question), 'Next exposes a fresh authored scene, not the exiting transition panel');
    seenPrompts.add(question);
    const options = root.locator('button.kid-piece');
    await options.first().waitFor({ state: 'visible' });
    const words = await inspectAdventureWords(root);
    const offered = await options.allTextContents();
    let found = false;
    for (let choice = 0; choice < offered.length; choice++) {
      await press(options.nth(choice));
      if (await options.nth(choice).getAttribute('data-state') === 'correct') { found = true; break; }
      retries++;
    }
    assert.equal(found, true, 'The visible feedback allows the child to find a continuing story choice');
    trace.push({ scene: scenes, prompt: question, offered: offered.map(text => text.trim()), ...words });
    const next = root.locator('button.kid-toy').last();
    await press(next);
    // Motion's exit waits for native WAAPI completion. Keep Adventures on the
    // native clock and observe the next readable scene; virtual RAF ticks do
    // not advance the browser animation timeline or prove a new question.
    const destination = await waitForReadableScene(question);
    trace[trace.length - 1].next = destination;
    scenes++;
  }
  assert.equal(scenes, 4, 'The chosen four-scene adventure reaches its real ending');
  assert.equal(seenPrompts.size, 4, 'All four authored questions were distinct');
  const finish = await inspectRetainedFinish({ page, root, advance });
  await shot('result');
  await press(root.locator('[data-kid-finish-again]'));
  assert.deepEqual(await waitForReadableScene(null), opening, 'Replay restores the first readable question');
  await root.locator('button.kid-piece').first().waitFor({ state: 'visible' });
  await shot('replay-ready');
  return { authoredScenes: scenes, distinctPrompts: seenPrompts.size, localizedTitle: selectedTitle, visibleRetries: retries, finish, replayed: true, generated: false };
}

async function playReading({ page, press, advance, shot, trace, lang }) {
  const root = gameShell(page, 'reading');
  const drawing = root.locator('svg[role="img"][viewBox="0 0 280 280"]');
  const startMarker = await drawing.locator('[data-trace-start]').evaluate(circle => ({
    fill: getComputedStyle(circle).fill,
    semanticGreen: getComputedStyle(circle).getPropertyValue('--arbor-green-ink').trim(),
    background: getComputedStyle(circle.ownerSVGElement).backgroundColor,
  }));
  assert.deepEqual(rgba(startMarker.fill), rgba(startMarker.semanticGreen), 'Before any trace input, the start dot matches the green-dot instruction');
  const [red, green, blue] = rgba(startMarker.fill);
  assert.ok(green > red && green > blue, 'The initial trace marker is visibly green');
  startMarker.contrast = contrast(startMarker.fill, startMarker.background);
  assert.ok(startMarker.contrast >= 3, 'The starting marker is distinct against the visible drawing surface');
  await press(root.getByRole('tab', { name: lang === 'he' ? 'צלילי אותיות' : 'Letter sounds', exact: true }));
  const letter = root.locator('p.text-\\[64px\\]');
  const before = await textOf(letter);
  await press(root.getByRole('button', { name: /said the sound|אמר\/ה את הצליל/ }));
  const after = await textOf(letter);
  assert.notEqual(after, before, 'The actual phonics acknowledgement moves to another letter');
  await shot('phonics-kept');
  await drawing.scrollIntoViewIfNeeded();
  const firstLetter = await drawing.getAttribute('aria-label');
  const next = root.getByRole('button', { name: lang === 'he' ? 'האות הבאה' : 'Next letter', exact: true });
  let strokes = 0;
  for (; strokes < 8 && !(await next.count()); strokes++) {
    await drawing.scrollIntoViewIfNeeded();
    // Read the rendered dashed guide's geometry, then draw along it with real
    // pointer input. No trace evaluation or React state is invoked by the test.
    const points = await drawing.evaluate(svg => {
      const guide = svg.querySelector('path[stroke-dasharray]');
      const length = guide.getTotalLength(), matrix = svg.getScreenCTM();
      return Array.from({ length: 51 }, (_, index) => {
        const point = guide.getPointAtLength(length * index / 50);
        const screen = new DOMPoint(point.x, point.y).matrixTransform(matrix);
        return { x: screen.x, y: screen.y };
      });
    });
    await page.mouse.move(points[0].x, points[0].y); await page.mouse.down(); await advance(16);
    for (const point of points.slice(1)) { await page.mouse.move(point.x, point.y); await advance(16); }
    await page.mouse.up(); await advance(32);
  }
  await next.waitFor({ state: 'visible' });
  assert.ok(strokes > 0 && strokes < 8, 'Visible guide tracing finishes the letter');
  await shot('letter-traced');
  await press(next);
  const nextLetter = await drawing.getAttribute('aria-label');
  assert.notEqual(nextLetter, firstLetter, 'Next letter exposes a fresh trace');
  trace.push({ phonics: { before, after }, firstLetter, nextLetter, strokes, startMarker });
  return { boundary: 'bounded phonics and one complete trace; this practice route has no finite game ending', phonicsSteps: 1, tracedLetters: 1, strokes, traceInput: 'real mouse pointer over the visible guide, including emulated phone cells' };
}

async function playSpeech({ page, press, shot, trace }) {
  const root = gameShell(page, 'speech');
  const choices = root.locator('[role="group"] button');
  assert.ok(await choices.count() >= 2, 'Age-appropriate sound choices are visible');
  await press(choices.nth(1));
  assert.equal(await choices.nth(1).getAttribute('aria-pressed'), 'true');
  const visibleTarget = async () => root.locator('p').evaluateAll(elements => elements
    .filter(element => element.getBoundingClientRect().width > 0 && element.getBoundingClientRect().height > 0)
    .sort((a, b) => parseFloat(getComputedStyle(b).fontSize) - parseFloat(getComputedStyle(a).fontSize))[0]?.textContent?.trim());
  const before = await visibleTarget();
  assert.ok(before, 'The practice word is visible');
  await press(root.getByRole('button', { name: /^Next/ }));
  const after = await visibleTarget();
  assert.ok(after && before !== after, 'Next changes the word without a recording');
  await press(root.getByRole('button', { name: 'Back', exact: true }));
  assert.equal(await visibleTarget(), before, 'Back restores the preceding word');
  assert.ok(await root.getByText('This device is not listening right now', { exact: false }).isVisible(), 'The no-permission path explains how to practise without recording');
  assert.equal(await root.getByRole('button', { name: /record|microphone/i }).count(), 0, 'No recording action is offered without existing microphone permission');
  await shot('no-capture-practice');
  trace.push({ selectedSound: await choices.nth(1).getAttribute('aria-label'), before, after });
  return { boundary: 'sound picker and word navigation only; no capture, pronunciation assessment or completed speech attempt', wordsVisited: 2, recordingOffered: false };
}

const DRIVERS = { feelings: playFeelings, mimic: playMimic, beat: playBeat, 'sound-explorer': playSound, memory: playMemory, pattern: playPattern, puzzle: playPuzzle, pose: playPose, adventures: playAdventure, reading: playReading, speech: playSpeech };

export async function verifyAdditionalActivities({ browser, base, output }) {
  const folder = path.join(output, 'additional-activities');
  await mkdir(folder, { recursive: true });
  const rows = [], failures = [], origin = new URL(base).origin;
  const cells = RELEASE_VIEWPORTS.flatMap(viewport => [...STUDIO.map(activity => ({ ...activity, studio: true })), ...ARCADE].filter(activity => !activity.language || activity.language === viewport.lang).map(activity => ({ viewport, activity })));
  for (const { viewport, activity } of cells) {
    const phone = viewport.id.startsWith('mobile-');
    const nativeClock = activity.id === 'adventures';
    const context = await browser.newContext({ viewport: { width: viewport.w, height: viewport.h }, reducedMotion: 'reduce', hasTouch: phone, isMobile: phone });
    const errors = [], brokenResources = [], unexpectedRequests = [], fixtureRequests = [], trace = [], targets = [];
    await context.route('**/*', route => {
      const url = new URL(route.request().url());
      if (url.origin === origin && url.pathname === '/_proof/hero/sheet.json') {
        fixtureRequests.push({ path: url.pathname, fixture: 'absent hero sheet: null' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: 'null' });
      }
      if (activity.id === 'speech' && url.origin === origin && route.request().method() === 'GET' && url.pathname === '/api/consent/studio-v2-synthetic-review') {
        fixtureRequests.push({ path: url.pathname, fixture: 'synthetic child has no voice-processing consent grants' });
        return route.fulfill({ status: 200, contentType: 'application/json', body: '{"grants":[]}' });
      }
      if (url.origin === origin && !url.pathname.startsWith('/api/')) return route.continue();
      unexpectedRequests.push(url.href); return route.abort();
    });
    await context.addInitScript(() => localStorage.setItem('arbor.kid.readAloud.muted.studio-v2-synthetic-review', '1'));
    await context.addInitScript(installGameCycleAudioProbe);
    const page = await context.newPage(); page.setDefaultTimeout(15_000);
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') errors.push(message.text()); });
    page.on('response', response => { if (response.status() >= 400 && !new URL(response.url()).pathname.endsWith('/favicon.ico')) brokenResources.push({ url: response.url(), status: response.status() }); });
    const stem = `${activity.id}-${viewport.id}`;
    const record = { case: 'additional-activity', activity: activity.id, host: activity.studio ? 'StudioGame' : 'HeroArcade', viewport: viewport.id, lang: viewport.lang, sound: 'off', motion: 'reduce', input: phone ? 'emulated touch; tracing uses an explicit mouse pointer' : 'mouse', clock: nativeClock ? 'native browser clock; real scene transitions and waits' : 'controlled game clock', screenshots: [], fixtureRequests, trace, targets, errors, brokenResources, unexpectedRequests };
    const advance = ms => nativeClock ? page.waitForTimeout(ms) : page.clock.runFor(ms);
    const press = async locator => {
      await locator.waitFor({ state: 'visible' }); await locator.scrollIntoViewIfNeeded();
      const box = await locator.boundingBox();
      assert.ok(box && box.width >= 43.5 && box.height >= 43.5, `Operated target meets the 44px floor: ${await locator.innerText()}`);
      targets.push({ label: (await locator.getAttribute('aria-label') || await locator.innerText()).trim(), width: box.width, height: box.height });
      if (phone) await locator.tap(); else await locator.click();
      await advance(32);
    };
    const shot = async label => {
      const name = `${stem}-${label}.png`;
      await page.evaluate(() => document.fonts.ready);
      const images = page.locator('main img:visible');
      for (let index = 0; index < await images.count(); index++) await images.nth(index).scrollIntoViewIfNeeded();
      await images.evaluateAll(elements => Promise.all(elements.map(image => image.decode())));
      await page.evaluate(() => window.scrollTo(0, 0));
      await advance(32);
      await page.screenshot({ path: path.join(folder, name), fullPage: true, animations: 'disabled' });
      record.screenshots.push(`additional-activities/${name}`);
    };
    try {
      if (!nativeClock) await page.clock.install({ time: new Date('2026-11-19T12:00:00Z') });
      const url = new URL(base); url.searchParams.set('activityReview', activity.id); url.searchParams.set('lang', viewport.lang); url.searchParams.set('studioNext', '0');
      await page.goto(url.href);
      await page.locator(`[data-activity-review="${activity.id}"]`).waitFor({ state: 'visible' });
      await page.evaluate(() => document.fonts.ready);
      if (activity.studio) {
        await page.locator('[data-studio-start]').waitFor({ state: 'visible' });
        await press(page.locator('[data-studio-start]'));
      }
      await page.locator(activity.ready).first().waitFor({ state: 'visible' });
      // Let actual lazy imports mount before freezing gameplay time. React's
      // Suspense fallback minimum must not be frozen while code is loading.
      if (!nativeClock) await page.clock.pauseAt(new Date(await page.evaluate(() => Date.now()) + 1_000));
      assert.equal(await page.locator('[data-activity-review]').getAttribute('dir'), viewport.lang === 'he' ? 'rtl' : 'ltr');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal overflow on entry');
      record.header = await inspectReviewHeader(page);
      await shot('ready');
      record.play = await DRIVERS[activity.id]({ page, press, advance, shot, trace, lang: viewport.lang });
      if (activity.studio) {
        const result = completeStudio(page); await result.waitFor({ state: 'visible' });
        await result.locator(`[data-kid-sticker="world:${activity.id}"]`).waitFor({ state: 'visible' });
        await shot('result');
        await press(result.locator('[data-studio-replay]'));
        await page.locator(activity.ready).first().waitFor({ state: 'visible' });
        assert.equal(await completeStudio(page).count(), 0, 'Replay returns to the actual mechanic');
        if (activity.id === 'memory') assert.equal(await page.locator('[data-kid-memory-board] [data-matched]').count(), 0);
        if (activity.id === 'pattern') assert.equal(await page.locator('.kid-socket[data-filled]').count(), 0);
        if (activity.id === 'puzzle') assert.equal(await page.locator('.studio-puzzle-cell[data-filled="true"]').count(), 0);
        await shot('replay-ready'); record.replayed = true;
      }
      await press(page.locator('[data-review-back]'));
      await page.locator('.studio-v2--world').waitFor({ state: 'visible' });
      await advance(20_000);
      assert.equal(await page.locator('[data-game-shell]').count(), 0, 'No retained activity remains mounted after return');
      assert.equal(await completeStudio(page).count(), 0, 'No stale timer publishes a result after return');
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false, 'No horizontal overflow after return');
      record.audio = await page.evaluate(() => window.gameCycleAudio);
      record.audioDetails = await page.evaluate(() => window.gameCycleAudioDetails);
      const { audibleSources, media, speech, captures } = record.audio;
      assert.deepEqual({ audibleSources, media, speech, captures }, { audibleSources: 0, media: 0, speech: 0, captures: 0 }, 'Sound off and no-capture play emit no audible sources or microphone requests');
      assert.deepEqual(errors, [], 'No browser or React errors during the operated flow');
      assert.deepEqual(brokenResources, [], 'All requested activity resources were served');
      assert.deepEqual(unexpectedRequests, [], 'No API or external request escapes the explicit synthetic fixtures');
      await shot('returned-world'); record.returned = true; record.passed = true;
    } catch (error) {
      // A failed decode is itself evidence; capture it without the readiness
      // helper so a missing image cannot erase the failure screenshot.
      const failedShot = `${stem}-failed.png`;
      await page.screenshot({ path: path.join(folder, failedShot), fullPage: true, animations: 'disabled' })
        .then(() => record.screenshots.push(`additional-activities/${failedShot}`)).catch(() => {});
      record.audio = await page.evaluate(() => window.gameCycleAudio).catch(() => null);
      record.failureState = await page.evaluate(() => ({ body: document.body.innerText.slice(0, 6000), studioPhase: document.querySelector('[data-studio-phase]')?.getAttribute('data-studio-phase'), gameShell: document.querySelector('[data-game-shell]')?.getAttribute('data-game-shell'), loadingFallback: !!document.querySelector('[data-testid="kid-stage-fallback"]') })).catch(() => null);
      Object.assign(record, { passed: false, error: String(error), errors, brokenResources, unexpectedRequests });
      failures.push(new Error(`${stem}: ${error instanceof Error ? error.message : String(error)}`, { cause: error }));
    } finally { await context.close(); }
    rows.push(record);
    await writeFile(path.join(folder, `${stem}.json`), JSON.stringify(record, null, 2));
    await writeFile(path.join(folder, 'summary.json'), JSON.stringify({ expectedCells: cells.length, completedCells: rows.length, passedCells: rows.filter(row => row.passed).length, failedCells: failures.length, results: rows }, null, 2));
  }
  if (failures.length) throw new AggregateError(failures, `${failures.length} of ${rows.length} additional activity cells failed; see additional-activities/summary.json`);
  return rows;
}
