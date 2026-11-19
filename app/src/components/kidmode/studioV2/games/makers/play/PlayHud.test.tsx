/** The makers' one HUD, rendered: the same pieces in English and in Hebrew,
 * with real buttons, polite announcements, kit heads for the coach and no
 * numerals in the quest. Layout, glass and motion are a rendered check. */
import { renderToStaticMarkup } from 'react-dom/server';
import { describe, expect, it, vi } from 'vitest';
const h = vi.hoisted(() => ({ lang: 'en' }));
vi.mock('../../../../../../context/LanguageContext', () => ({ useLanguage: () => ({ uiLang: h.lang }) }));
import { HudButton, HudChip, HudCoach, HudDock, HudQuest, HudToast, PlayFx, PlayOpening, PlaySetPiece, PlayStage, coachHead } from './index';

const WORDS = {
  en: { line: 'Every piece has its place.', quest: 'Three jobs', steps: ['Glaze', 'Fit', 'Gold'], go: 'Lift it up', turn: 'Turn left', toast: 'Whole again', title: 'Mend the Bowl', place: 'Wonderworks · Chock’s table', caption: 'The seams are meant to show.', chip: 'ClearPatch', skip: 'Tap to begin' },
  he: { line: 'לכל שבר יש מקום משלו.', quest: 'שלוש משימות', steps: ['זיגוג', 'חיבור', 'זהב'], go: 'מרימים', turn: 'לסובב שמאלה', toast: 'שוב שלמה', title: 'מתקנים את הקערה', place: 'וונדרוורקס · השולחן של צ׳וק', caption: 'התפרים נועדו להיראות.', chip: 'גלגלת התיקון', skip: 'נוגעים ומתחילים' },
} as const;
const stage = (lang: 'en' | 'he', opening = false, finale = false) => {
  h.lang = lang; const w = WORDS[lang];
  return renderToStaticMarkup(<div dir={lang === 'he' ? 'rtl' : 'ltr'}>
    <PlayStage id="mend-bowl" grade="warm" camera={{ x: 0.5, y: 0.4, zoom: 1.3 }} parallax world={<><div className="scene" /><PlayFx layer={7} /></>}>
      {opening && <PlayOpening title={w.title} place={w.place} onDone={() => {}} />}
      <HudCoach who="chock" mood="happy" line={w.line} onPoke={() => {}} pokeLabel="Chock" />
      <HudQuest label={w.quest} current={1} steps={w.steps.map((label, i) => ({ key: `job-${i}`, label, done: i < 1 }))} />
      <HudToast show>{w.toast}</HudToast>
      <HudDock><HudButton label={w.go} tone="go" size="l" onClick={() => {}} cue data={{ 'data-go': '' }} /><HudButton label={w.turn} iconOnly icon={<svg />} onClick={() => {}} /><HudChip tone="chosen">{w.chip}</HudChip></HudDock>
      <PlaySetPiece active={finale} caption={w.caption} />
    </PlayStage>
  </div>);
};

describe.each(['en', 'he'] as const)('play kit: the HUD in %s', lang => {
  const w = WORDS[lang], html = stage(lang);
  it('the stage holds the world under a camera and the HUD outside it', () => {
    expect(html).toContain('data-play-stage="mend-bowl"'); expect(html).toContain('data-grade="warm"');
    const camera = html.indexOf('play-stage__camera'), world = html.indexOf('data-play-world'), scene = html.indexOf('class="scene"'), fx = html.indexOf('data-play-fx'), hud = html.indexOf('data-play-hud'), coach = html.indexOf('data-play-coach');
    // World layers (and the particle canvas) are inside the camera; every HUD piece is after it, in the HUD layer.
    expect(camera).toBeGreaterThan(-1); expect(world).toBeGreaterThan(camera); expect(scene).toBeGreaterThan(world); expect(fx).toBeGreaterThan(scene); expect(hud).toBeGreaterThan(fx); expect(coach).toBeGreaterThan(hud);
    expect(html).toMatch(/<canvas[^>]*aria-hidden="true"/);
  });
  it('the coach is a kit head and one line, announced politely; the portrait is a real button when it can be patted', () => {
    expect(html).toContain(`/visuals/studio-v2/makers/${coachHead('chock', 'happy')}-480.webp`);
    expect(html).toMatch(/<p class="play-coach__bubble" aria-live="polite"[^>]*>/); expect(html).toContain(w.line);
    expect(html).toMatch(/<button type="button" class="play-coach__portrait" aria-label="Chock">/);
    expect(html).toContain('data-mood="happy"');
  });
  it('the quest is a list of things done: named, never numbered', () => {
    const quest = html.slice(html.indexOf('<ol class="play-quest"'), html.indexOf('</ol>'));
    expect(quest).toContain(`aria-label="${w.quest}"`);
    for (const step of w.steps) expect(quest).toContain(step);
    expect(quest.match(/data-state="done"/g)).toHaveLength(1); expect(quest.match(/data-state="now"/g)).toHaveLength(1); expect(quest.match(/data-state="next"/g)).toHaveLength(1);
    expect(quest).toContain('aria-current="step"');
    // No digit is shown to the child (the tick's own drawing is the one place digits live).
    expect(quest.replace(/<svg[\s\S]*?<\/svg>/g, '').replace(/<[^>]+>/g, '')).not.toMatch(/\d/);
  });
  it('the dock holds real buttons with names: one primary, an icon-only one that keeps its name, a chip', () => {
    expect(html).toMatch(new RegExp(`<button type="button" class="play-button" data-tone="go" data-size="l" data-cue="true"[^>]*data-go=""[^>]*>.*?${w.go}`));
    expect(html.match(/data-tone="go"/g)).toHaveLength(1);
    expect(html).toMatch(new RegExp(`data-icon-only="true"[^>]*aria-label="${w.turn}"`));
    expect(html).toContain(`<span class="play-chip" data-tone="chosen"><span class="play-chip__label">${w.chip}</span></span>`);
    expect(html).toMatch(new RegExp(`role="status" aria-live="polite"><span class="play-toast__body">${w.toast}`));
  });
  it('the opening is the title on the picture and one whole-stage skip button, named in the child’s language', () => {
    const open = stage(lang, true);
    expect(open).toContain(`<h2 class="play-opening__title">${w.title}</h2>`); expect(open).toContain(w.place);
    expect(open).toMatch(new RegExp(`<button type="button" class="play-opening__skip" aria-label="${w.skip}"`));
    expect(html).not.toContain('play-opening');
  });
  it('the set-piece shows its caption only while it is active', () => {
    expect(html).toContain('data-play-setpiece="" data-active="false"'); expect(html).not.toContain(w.caption);
    const finale = stage(lang, false, true);
    expect(finale).toContain('data-active="true"'); expect(finale).toContain(w.caption);
  });
});

describe('play kit: HUD details', () => {
  it('a quiet coach keeps the portrait and hides the bubble; a chip with an action is a button', () => {
    h.lang = 'en';
    const html = renderToStaticMarkup(<><HudCoach who="aya" mood="curious" line="Look." quiet side="end" /><HudChip onClick={() => {}} label="Lamp">Lamp</HudChip><HudToast show={false}>gone</HudToast><HudDock align="end" /></>);
    expect(html).toMatch(/class="play-coach__bubble"[^>]*hidden=""/); expect(html).toContain('data-side="end"');
    expect(html).toContain('<span class="play-coach__portrait" aria-hidden="true">');
    expect(html).toMatch(/<button type="button" class="play-chip" data-tone="paper" data-press="" aria-label="Lamp">/);
    expect(html).not.toContain('gone'); expect(html).toContain('data-align="end"');
  });
});
