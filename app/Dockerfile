FROM node:22-slim AS build
WORKDIR /app
COPY app/package*.json ./
RUN npm ci
COPY app .
RUN npm run build

FROM node:22-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV KNOWLEDGE_PATH=/app/knowledge
COPY --from=build /app/package*.json ./
RUN npm ci --omit=dev
COPY --from=build /app/dist ./dist
COPY knowledge ./knowledge
EXPOSE 3000
CMD ["node", "dist/server.cjs"]
