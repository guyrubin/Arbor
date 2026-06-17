import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {track, setGlobalProps} from './lib/analytics';
import {captureAttribution, attributionProps} from './lib/attribution';
import {trackAppStart} from './lib/loopEvents';
import {installApiBaseShim} from './lib/runtime';
import {initNativeShell} from './lib/native';

// Native shells (iOS/Android) load the bundle from a local origin, so re-point
// relative `/api/*` calls at the remote backend. No-op on the web. Must run
// before any fetch fires.
installApiBaseShim();
void initNativeShell();

// Growth loop: capture first-touch attribution (referral/utm/source/market) and
// attach it to every analytics event, then emit install/app_open.
const attribution = captureAttribution();
setGlobalProps(() => attributionProps(attribution));
trackAppStart();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// First-party capture of uncaught errors / promise rejections.
window.addEventListener('error', (e) => {
  track('window_error', { message: String(e.message || '').slice(0, 300) });
});
window.addEventListener('unhandledrejection', (e) => {
  track('unhandled_rejection', { reason: String((e as PromiseRejectionEvent).reason || '').slice(0, 300) });
});

// Register the PWA service worker (production only). When a new worker takes
// control (i.e. a fresh deploy activated), reload once so users never get
// stranded on a stale shell. The `hadController` guard avoids a reload on the
// very first install, where there was no prior version controlling the page.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  const hadController = !!navigator.serviceWorker.controller;
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing || !hadController) return;
    refreshing = true;
    window.location.reload();
  });
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').then((reg) => {
      // Proactively check for a new SW on each load.
      reg.update?.();
    }).catch(() => {});
  });
}
