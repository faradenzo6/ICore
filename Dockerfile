# Multi-stage build: build web, compile api, run api + serve web build

FROM node:20-bookworm-slim AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps ./apps

# Build deps for native modules (e.g., bcrypt)
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ ca-certificates \
  && rm -rf /var/lib/apt/lists/*

# Install deps for all workspaces (dev deps included)
RUN npm ci

# Build web+api via root script
RUN npm run build

# Generate Prisma Client using workspace prisma version
RUN npm --workspace apps/api exec prisma generate --schema=apps/api/prisma/schema.prisma

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Ensure certs present
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/*

# Copy built app
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/web/dist ./apps/web/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/apps/api/prisma ./apps/api/prisma

# Copy installed modules (to avoid re-install and ensure generated Prisma Client exists)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

# Ensure production prune to reduce size
RUN npm prune --omit=dev && npm --workspace apps/api prune --omit=dev

# Remove build tool meta if any (no effect in runtime stage, but keep stage clean)
RUN true

# Prisma client generate at runtime not needed (SQLite)
ENV API_PORT=5050
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_CHAT_ID=""

EXPOSE 5050

CMD ["node", "apps/api/dist/index.js"]


