# ─── Stage 1: base ────────────────────────────────────────────────────────────
# All native npm dependencies resolved here — in Linux, once, for everyone.
# Both dev and prod inherit from this so they share the same node_modules layer.
FROM node:22-slim AS base
WORKDIR /app
COPY package*.json ./
RUN npm install --frozen-lockfile

# ─── Stage 2: dev ─────────────────────────────────────────────────────────────
# Used by docker compose for local development. Source is volume-mounted so
# edits on host (Windows or WSL) are reflected instantly — no rebuild needed.
FROM base AS dev
ENV NODE_ENV=development
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
# Run the Astro dev server (hot reload works via bind-mounted source)
CMD ["npm", "run", "dev"]

# ─── Stage 3: builder ─────────────────────────────────────────────────────────
FROM base AS builder
COPY . .
RUN npm run build

# ─── Stage 4: prod ────────────────────────────────────────────────────────────
# Minimal production image — only dist + runtime node_modules.
FROM node:22-slim AS prod
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/backup_cron.js ./
RUN mkdir -p /app/data /app/backups

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=4321
EXPOSE 4321
CMD ["sh", "-c", "node ./backup_cron.js & node ./dist/server/entry.mjs"]
