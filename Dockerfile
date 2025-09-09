# Multi-stage build: build web, compile api, run api + serve web build

FROM node:20-alpine AS base
WORKDIR /app
COPY package.json package-lock.json* ./
COPY apps ./apps

# Install root deps and workspace deps
RUN npm ci --omit=dev && npm --workspace apps/api ci && npm --workspace apps/web ci

# Build web
RUN npm --workspace apps/web run build

# Build api (ts -> js)
RUN npm --workspace apps/api run build

# Generate Prisma Client in base and keep node_modules
RUN npx --yes prisma --schema=apps/api/prisma/schema.prisma generate

FROM node:20-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

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

# Prisma client generate at runtime not needed (SQLite)
ENV API_PORT=5050
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_CHAT_ID=""

EXPOSE 5050

CMD ["node", "apps/api/dist/index.js"]


