# 💼 Job Tracker Application & Production API

[![Build Status](https://github.com/eeja07/job-tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/eeja07/job-tracker/actions/workflows/ci.yml)
[![Docker Security Scan](https://github.com/eeja07/job-tracker/actions/workflows/docker.yml/badge.svg)](https://github.com/eeja07/job-tracker/actions/workflows/docker.yml)
![Coverage](https://img.shields.io/badge/coverage-100%25-brightgreen)
![License](https://img.shields.io/badge/license-MIT-blue)

Production-grade job application tracking monorepo powered by NestJS, Prisma, PostgreSQL, and React / Next.js.

---

## 🏗️ Architecture & Monorepo Structure

- **`apps/api`**: Production REST API powered by NestJS, Prisma Client, Pino, and Argon2id security.
- **`apps/web`**: Frontend application built with Next.js.
- **`packages/ui`**: Shared UI component library.

---

## 🔄 CI/CD Pipeline & DevOps Operations

### 1. How CI Works (`ci.yml`)
- Triggered automatically on every `push` or `pull_request` to `main` or `feature/*` branches.
- Uses `actions/setup-node@v4` with `pnpm` caching.
- Enforces strict quality gates:
  1. `pnpm install --frozen-lockfile`
  2. `pnpm --filter api exec prisma generate`
  3. `pnpm lint`
  4. `pnpm --filter api exec tsc --noEmit`
  5. `pnpm --filter api test:cov` (Unit tests + coverage reports)
- Uploads code coverage reports as downloadable workflow artifacts.

### 2. How Docker Build Works (`docker.yml`)
- Uses a multi-stage Docker build (`apps/api/Dockerfile`) on `node:22-alpine` image to produce minimal production images (<180MB).
- Runs automated container vulnerability scans using **Trivy** (`aquasecurity/trivy-action@master`).
- Automatically fails the build on `HIGH` or `CRITICAL` vulnerability CVEs.

### 3. How Release Works
1. Code approved via PR is merged into `main`.
2. GitHub Actions builds production container images tagged with both `:latest` and `:sha-<commit>`.
3. Target host runs `prisma migrate deploy` prior to zero-downtime container rolling restart.
4. Process health is verified via `/api/v1/health/ready`.

### 4. How Rollback Works
If post-deployment health probes fail:
```bash
docker compose pull api:<previous-stable-sha>
docker compose up -d --no-deps api
curl -f http://localhost:3000/api/v1/health/ready
```

---

## 🚀 Quick Start (Local Development)

```bash
# Install dependencies
pnpm install

# Generate Prisma Client
pnpm --filter api exec prisma generate

# Run TypeScript typecheck
pnpm exec tsc --noEmit

# Run unit tests
pnpm --filter api test

# Start API in development mode
pnpm --filter api start:dev
```

---

## 📜 License

[MIT License](LICENSE)
