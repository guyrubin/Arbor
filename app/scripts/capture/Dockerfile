# Dependencies/browser are installed before app source is present. The app never
# runs in the networked build. Runtime MUST use --network none (guarded in run.mjs).
FROM node:22-bookworm
ENV PLAYWRIGHT_BROWSERS_PATH=/ms-playwright
WORKDIR /capture/app
COPY app/package.json app/package-lock.json ./
RUN npm ci && npx --no-install playwright install --with-deps chromium
COPY app/src ./src
COPY app/public ./public
COPY app/scripts ./scripts
COPY app/server.ts app/vite.config.ts app/tsconfig.json app/index.html ./
COPY knowledge /capture/knowledge
RUN node scripts/copy-mediapipe-wasm.mjs
# Opt-in only for the disposable CI evidence build. Default full sweep is unchanged.
ARG CAPTURE_FONT_MODE=fallback
ARG CAPTURE_DISPOSABLE_CI=false
RUN CAPTURE_FONT_MODE=$CAPTURE_FONT_MODE CAPTURE_DISPOSABLE_CI=$CAPTURE_DISPOSABLE_CI node scripts/capture/prepare-font-cache.mjs
CMD ["node", "scripts/capture/run.mjs"]
