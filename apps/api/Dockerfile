# ==========================================
# Builder Stage
# ==========================================
FROM node:22-alpine AS builder

WORKDIR /app

RUN corepack enable && corepack prepare pnpm@9.0.0 --activate

# Copy workspace package definitions first for Docker layer caching
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/ui/package.json ./packages/ui/

# Install dependencies (cached by Docker unless lockfile changes)
RUN pnpm install --frozen-lockfile

# Copy source code after dependency installation
COPY . .

ENV NODE_OPTIONS="--max-old-space-size=4096"

RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

# ==========================================
# Runner Stage
# ==========================================
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

RUN apk add --no-cache wget

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps ./apps
COPY --from=builder /app/package.json ./
COPY --from=builder /app/pnpm-workspace.yaml ./

WORKDIR /app/apps/api

USER node

EXPOSE 3000

CMD ["sh", "-c", "node dist/prisma/seed-rbac.js && node dist/src/main.js"]
