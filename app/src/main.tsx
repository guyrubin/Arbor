import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import {track} from './lib/analytics';

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

// Register the PWA service worker (production only).
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}
