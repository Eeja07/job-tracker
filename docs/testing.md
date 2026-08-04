# 🧪 Integration & End-to-End (E2E) Testing Guide (`testing.md`)

## 1. Overview & Isolation Architecture

The Job Tracker API uses Supertest and NestJS `TestingModule` for integration and E2E testing against an actual PostgreSQL database instance.

### Key Principles:
- **Database Isolation**: Tests execute against a dedicated PostgreSQL instance. The `cleanDatabase()` utility purges data in reverse foreign key order before and after each test suite.
- **Zero Mocking of Repositories**: E2E tests execute full HTTP request-response cycles from Controllers down to PostgreSQL DB tables.

---

## 2. Local Execution Instructions

Ensure local PostgreSQL container is running on port `5432`:

```bash
# 1. Sync database schema
pnpm --filter api exec prisma db push

# 2. Run E2E test suite
pnpm --filter api test:e2e

# 3. Run E2E tests with coverage report
pnpm --filter api test:e2e --coverage
```

---

## 3. CI/CD Execution (`ci.yml`)

In GitHub Actions:
1. A ephemeral PostgreSQL 16 service container is launched on port 5432.
2. Prisma schema is synced via `prisma db push`.
3. Unit tests (`pnpm test:cov`) execute first.
4. E2E tests (`pnpm test:e2e --coverage`) execute second.
5. HTML and JSON coverage reports are combined and saved to GitHub Actions artifacts.
