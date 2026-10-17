import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import path from 'node:path';
const here = path.resolve(import.meta.dirname);
const adapters = ['context/ArborContext', 'context/AuthContext', 'context/LanguageContext', 'hooks/useChildCollection', 'practice/usePracticeData', 'lib/analytics', 'lib/kidModeGate', 'lib/voice', 'components/kidmode/useKidModeEntry'];
export default defineConfig({
  root: here, base: '/', publicDir: false,
  plugins: [{ name: 'synthetic-preview-adapters', enforce: 'pre', resolveId(source, importer) {
    if (!importer || !source.startsWith('.')) return;
    const resolved = path.resolve(path.dirname(importer), source).replace(/\.(tsx?|jsx?)$/, '');
    if (adapters.some(name => resolved.endsWith('/src/' + name))) return path.join(here, 'adapters.tsx');
  } }, react(), tailwindcss()],
  define: { __APP_VERSION__: JSON.stringify('v2-design-review') },
  build: { outDir: path.resolve(here, '../../dist-studio-preview'), emptyOutDir: true, chunkSizeWarningLimit: 1600 },
});
