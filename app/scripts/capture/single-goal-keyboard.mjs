/** Real sequential keyboard traversal; never invokes a component callback. */
export async function probeSingleGoalKeyboard({ page, dialog }) {
  const controls = dialog.locator('button:not([disabled]):visible, summary:visible');
  const count = await controls.count();
  const first = controls.first();
  const ids = await controls.evaluateAll(nodes => nodes.map((node, index) => ({ index, id: node.getAttribute('data-testid') ?? node.tagName })));
  const index = () => controls.evaluateAll(nodes => nodes.indexOf(document.activeElement));
  await first.focus();
  const forward = [await index()];
  for (let n = 0; n < count; n++) { await page.keyboard.press('Tab'); forward.push(await index()); if (forward.at(-1) === 0) break; }
  // Begin reverse traversal from the real wrapped focus. No direct focus of
  // Earlier can hide an unreachable native summary in the app's Tab sequence.
  const reverse = [await index()];
  for (let n = 0; n < count; n++) { await page.keyboard.press('Shift+Tab'); reverse.push(await index()); if (reverse.at(-1) === 0) break; }
  return { ids, forward, reverse, passed: count > 1 && forward.length === count + 1 && reverse.length === count + 1
    && forward.every((value, n) => value === n % count) && reverse.every((value, n) => value === (count - n) % count) };
}
