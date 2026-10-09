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
CMD ["node", "scripts/capture/run.mjs"]
