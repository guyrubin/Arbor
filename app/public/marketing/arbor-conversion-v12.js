/* Navigation carries campaign attribution, never the example a family explored. */
export function trialHref(href, search, lang) {
  const target = new URL(href, 'https://arborparentingapp.com');
  const incoming = new URLSearchParams(search);
  for (const key of ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term', 'ref', 'referral']) {
    const value = incoming.get(key);
    if (value && value.length <= 120) target.searchParams.set(key, value);
  }
  if ((incoming.has('ref') || incoming.has('referral')) && !incoming.has('utm_source')) target.searchParams.delete('utm_source');
  target.searchParams.set('lang', lang === 'he' ? 'he' : 'en');
  return target.pathname + target.search;
}

if (typeof document !== 'undefined') {
  const he = document.documentElement.lang === 'he';
  document.querySelectorAll('a[href*="entry=landing"]').forEach(link => {
    link.href = trialHref(link.getAttribute('href'), location.search, he ? 'he' : 'en');
  });

  // A real, locally hosted video. The poster is useful before any media download.
  const video = document.getElementById('family-film');
  const toggle = document.getElementById('film-toggle');
  if (video && toggle) {
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    const connection = navigator.connection;
    const constrained = () => connection?.saveData || /(^|-)2g$/.test(connection?.effectiveType || '');
    let manuallyPaused = false;
    let visible = false;
    let explicitlyPlaying = false;
    toggle.hidden = false;
    const label = () => {
      toggle.textContent = video.paused
        ? (he ? 'הפעלת סרטון הרקע' : 'Play background video')
        : (he ? 'השהיית סרטון הרקע' : 'Pause background video');
    };
    label();
    const play = () => {
      if (!video.getAttribute('src')) video.src = video.dataset.src;
      video.muted = true;
      video.play().catch(label);
    };
    const sync = () => {
      if (!visible || document.hidden || manuallyPaused || ((reduced.matches || constrained()) && !explicitlyPlaying)) video.pause();
      else play();
    };
    toggle.addEventListener('click', () => {
      if (video.paused) { manuallyPaused = false; explicitlyPlaying = true; play(); }
      else { manuallyPaused = true; explicitlyPlaying = false; video.pause(); }
    });
    video.addEventListener('play', label);
    video.addEventListener('pause', label);
    video.addEventListener('error', () => { video.removeAttribute('src'); toggle.hidden = true; });
    document.addEventListener('visibilitychange', sync);
    reduced.addEventListener('change', () => { explicitlyPlaying = false; sync(); });
    connection?.addEventListener?.('change', () => { explicitlyPlaying = false; sync(); });
    const start = () => {
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(entries => { visible = entries[0].isIntersecting; sync(); }, { threshold: 0.1 }).observe(video);
      } else { visible = true; sync(); }
    };
    if (document.readyState === 'complete') start();
    else window.addEventListener('load', start, { once: true });
  }

  const choices = document.getElementById('share-example');
  const lines = document.getElementById('share-preview-lines');
  if (choices) choices.disabled = false;
  if (choices && lines) choices.addEventListener('change', () => {
    const selected = [...choices.querySelectorAll('input:checked')];
    lines.replaceChildren(...selected.map(input => {
      const li = document.createElement('li');
      li.textContent = input.closest('label').querySelector('small').textContent;
      return li;
    }));
    document.getElementById('share-preview-empty').hidden = selected.length > 0;
  });
}
