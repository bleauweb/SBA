# syntax=docker/dockerfile:1

# ---- build: compile client, SSR bundle and server ----
FROM node:22-bookworm-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm prune --omit=dev

# ---- runtime: only production deps and build output ----
FROM node:22-bookworm-slim AS runtime
ENV NODE_ENV=production \
    PORT=3000 \
    DATABASE_URL=/app/var/sba.sqlite \
    STORAGE_DIR=/app/var/storage
WORKDIR /app
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
COPY --from=build /app/drizzle ./drizzle
COPY --from=build /app/data ./data
COPY package.json ./
# Uploads, generated PDFs and the SQLite file live here. The directory is deliberately not a
# volume: project data is ephemeral and disappears when the container is replaced.
RUN mkdir -p /app/var && chown -R node:node /app
USER node
EXPOSE 3000
CMD ["node", "dist/server/main.js"]
