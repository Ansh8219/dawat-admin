# syntax=docker/dockerfile:1

# ── Build stage ──────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

# Install dependencies first (better layer caching)
# Use npm install (not ci) so a slightly stale lockfile still builds
COPY package.json package-lock.json ./
RUN npm install

# Copy source and build for Node (Nitro node-server)
COPY . .
ENV NITRO_PRESET=node-server
RUN npm run build

# ── Production stage ─────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV HOST=0.0.0.0
ENV PORT=3000

# Non-root user for security
RUN addgroup --system --gid 1001 nodejs \
  && adduser --system --uid 1001 daawat

# Nitro node-server output
COPY --from=builder --chown=daawat:nodejs /app/.output ./.output
COPY --from=builder --chown=daawat:nodejs /app/package.json ./package.json

USER daawat

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/ || exit 1

CMD ["node", ".output/server/index.mjs"]
