# ═══════════════════════════════════════════════════════════════════════════════
# OMNI-PRIME — Multi-Stage Docker Build (Next.js Standalone)
# ═══════════════════════════════════════════════════════════════════════════════

# ─── Stage 1: Dependencies ────────────────────────────────────────────────────
FROM node:18-alpine AS deps

RUN apk add --no-cache libc6-compat python3 make g++

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --ignore-scripts && \
    npm rebuild better-sqlite3

# ─── Stage 2: Build ───────────────────────────────────────────────────────────
FROM node:18-alpine AS builder

RUN apk add --no-cache libc6-compat

WORKDIR /app

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV NEXT_TELEMETRY_DISABLED=1
ENV NODE_ENV=production

RUN npm run build

# ─── Stage 3: Production Runner ───────────────────────────────────────────────
FROM node:18-alpine AS runner

RUN apk add --no-cache libc6-compat

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME="0.0.0.0"

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public

RUN mkdir -p .next/static && \
    mkdir -p data && \
    chown -R nextjs:nodejs .next && \
    chown -R nextjs:nodejs data

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs

EXPOSE 3000

CMD ["node", "server.js"]
