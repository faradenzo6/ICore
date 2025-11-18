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

# Generate Prisma Client before build (needed for TypeScript compilation)
# Use local engines if available, ignore checksum errors
ENV PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1
RUN cd apps/api && \
    echo "Installing @prisma/engines..." && \
    npm install @prisma/engines@6.19.0 --save-optional 2>&1 | tail -5 && \
    echo "Generating Prisma Client..." && \
    npm exec prisma generate --schema=prisma/schema.prisma 2>&1 && \
    echo "Verifying Prisma Client generation..." && \
    (test -f node_modules/.prisma/client/index.js && echo "Client in apps/api") || \
    (test -f ../../node_modules/.prisma/client/index.js && echo "Client in root") || \
    (echo "WARNING: Prisma Client files not found, but continuing...")

# Build web+api via root script
RUN npm run build

FROM node:20-bookworm-slim AS runner
ENV NODE_ENV=production
WORKDIR /app

# Ensure certs present and generate self-signed certificate
RUN apt-get update && apt-get install -y --no-install-recommends ca-certificates openssl \
  && rm -rf /var/lib/apt/lists/* \
  && mkdir -p /app/certs \
  && openssl req -x509 -newkey rsa:4096 -nodes \
    -keyout /app/certs/key.pem \
    -out /app/certs/cert.pem \
    -days 365 \
    -subj "/C=RU/ST=State/L=City/O=Organization/CN=localhost" \
    -addext "subjectAltName=DNS:localhost,DNS:*.local,IP:127.0.0.1,IP:0.0.0.0,IP:192.168.110.11,IP:10.6.160.61"

# Copy built app
COPY --from=base /app/apps/api/dist ./apps/api/dist
COPY --from=base /app/apps/web/dist ./apps/web/dist
COPY --from=base /app/apps/api/package.json ./apps/api/package.json
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/apps/api/prisma ./apps/api/prisma

# Copy installed modules (to avoid re-install and ensure generated Prisma Client exists)
COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/apps/api/node_modules ./apps/api/node_modules

# Explicitly ensure Prisma Client directories exist
RUN mkdir -p /app/node_modules/.prisma /app/apps/api/node_modules/.prisma

# Install prisma CLI and ensure @prisma/client is available
RUN npm install -g prisma@6.19.0 && \
    npm install @prisma/client@6.19.0 @prisma/engines@6.19.0 --save-optional || true

# Prisma client generate at runtime not needed (SQLite)
ENV API_PORT=5050
ENV USE_HTTPS=true
ENV TELEGRAM_BOT_TOKEN=""
ENV TELEGRAM_CHAT_ID=""
ENV HTTPS_PROXY=""

EXPOSE 5050

# Create entrypoint script - always regenerate Prisma Client to ensure it's properly initialized
RUN echo '#!/bin/sh\n\
echo "=== Regenerating Prisma Client ==="\n\
cd /app/apps/api\n\
export PRISMA_ENGINES_CHECKSUM_IGNORE_MISSING=1\n\
export PRISMA_CLI_BINARY_TARGETS=debian-openssl-3.0.x\n\
\n\
# Always regenerate to ensure engines are linked\n\
echo "Generating Prisma Client..."\n\
prisma generate --schema=prisma/schema.prisma 2>&1 | grep -v "^$" | tail -20 || {\n\
  echo "Generation had errors, but continuing..."\n\
}\n\
\n\
# Ensure client is accessible from root node_modules\n\
if [ -f "/app/apps/api/node_modules/.prisma/client/index.js" ] && [ ! -f "/app/node_modules/.prisma/client/index.js" ]; then\n\
  echo "Creating symlink to root node_modules..."\n\
  mkdir -p /app/node_modules/.prisma\n\
  ln -sf /app/apps/api/node_modules/.prisma/client /app/node_modules/.prisma/client || true\n\
fi\n\
\n\
echo "=== Starting application ==="\n\
exec node /app/apps/api/dist/index.js\n\
' > /app/entrypoint.sh && chmod +x /app/entrypoint.sh

CMD ["/app/entrypoint.sh"]
