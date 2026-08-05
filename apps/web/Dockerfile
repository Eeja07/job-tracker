# ==========================================
# Builder Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

COPY . .

ENV NEXT_TELEMETRY_DISABLED=1

RUN pnpm install --frozen-lockfile
RUN pnpm --filter web build

# ==========================================
# Runner Stage
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3001

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/apps/web/public ./apps/web/public
COPY --from=builder --chown=nextjs:nodejs /app/apps/web/.next ./apps/web/.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/web/package.json ./apps/web/package.json

WORKDIR /app/apps/web

USER nextjs

EXPOSE 3001

CMD ["npx", "next", "start", "-p", "3001"]
