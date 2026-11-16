import '../makerPalette.css';
import { readPalette } from './clayPaint';
import { paintScene, clayTone, type Scene } from './clayScene';
import { STORY_IDS, STORIES, showLook, startPose, lumpPose, newShow, GROUND, type Show } from './clayTheatreRules';
import { FULL_PULLS, NO_PULLS } from './clayBody';
const canvas = document.getElementById('c') as HTMLCanvasElement;
const q = new URLSearchParams(location.search), U = Number(q.get('u') ?? 1.2), D = Number(q.get('d') ?? 3);
const W = 4 * 430 * U, H = 3 * 330 * U; canvas.width = W; canvas.height = H; canvas.style.width = W + 'px';
const ctx = canvas.getContext('2d')!; const pal = readPalette(document.documentElement);
STORY_IDS.forEach((id, col) => {
  const story = STORIES[id];
  const show: Show = { ...newShow(7 + col), story: id, chapter: 'shape' };
  const look = showLook(7 + col * 3);
  const rows = [
    { pulls: NO_PULLS, body: null, trim: null },
    { pulls: { front: 1, back: 0.5, top: 0 }, body: story.clay[0], trim: null },
    { pulls: FULL_PULLS, body: story.clay[0], trim: story.clay[1] },
  ] as const;
  rows.forEach((r, row) => {
    const ox = col * 430 * U + 15 * U, oy = row * 330 * U + 40 * U;
    const s2 = { ...show, pulls: r.pulls };
    const pose = row === 2 ? { ...startPose(s2), y: startPose(s2).y - (col === 0 ? 60 : col === 1 ? 50 : 0), rot: col === 0 ? -25 : 0 } : lumpPose(s2);
    const scene: Scene = { story: id, look: { ...look, hour: row }, drawing: D + row, gel: row === 1 ? 'roseGel' : 'clearGel',
      hero: { id: story.hero, body: clayTone(r.body, pal), trim: clayTone(r.trim, pal), pulls: r.pulls, pose, prints: row === 2 ? [{ x: -20, y: 4, rot: 20 }] : [], look: [200, 100], marble: row === 1 ? { tone: pal.amber, amount: 0.7 } : null },
      ghosts: row === 2 ? [{ ...pose, x: pose.x - 60, y: pose.y + 30 }, { ...pose, x: pose.x - 30, y: pose.y + 10 }] : [],
      buddy: row === 2 ? { id: story.buddy, at: story.buddyHome, act: 'hopAct', tone: clayTone(story.clay[1], pal), drawing: D } : null };
    paintScene(ctx, { unit: U, ox, oy, cloth: { x: 0, y: -20, w: 400, h: GROUND - 16 + 20 }, detail: 1 }, scene, pal);
  });
});
(window as any).done = true;
