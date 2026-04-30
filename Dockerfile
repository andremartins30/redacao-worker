# Multi-stage build para o worker BullMQ
FROM node:20-alpine AS base

WORKDIR /app

RUN apk add --no-cache dumb-init

# Dependências completas para compilar TypeScript
FROM base AS deps

COPY package*.json ./
RUN npm ci

# Build da aplicação
FROM deps AS build

COPY tsconfig.json ./
COPY src ./src
RUN npm run build

# Runtime enxuto com dependências de produção apenas
FROM base AS runtime

ENV NODE_ENV=production

COPY package*.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY --from=build /app/dist ./dist

RUN addgroup -g 1001 -S nodejs && \
    adduser -S nodejs -u 1001 && \
    chown -R nodejs:nodejs /app

USER nodejs

HEALTHCHECK --interval=30s --timeout=10s --start-period=10s --retries=3 \
  CMD node -e "const Redis=require('ioredis'); const client=new Redis({host: process.env.REDIS_HOST || 'localhost', port: process.env.REDIS_PORT || 6379, password: process.env.REDIS_PASSWORD || undefined, db: process.env.REDIS_DB || 0, maxRetriesPerRequest: null}); client.ping().then(() => client.quit()).catch(() => process.exit(1));" || exit 1

ENTRYPOINT ["dumb-init", "--"]

CMD ["node", "dist/worker.js"]
