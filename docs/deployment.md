# 🚀 Production Deployment & Rollback Guide (`deployment.md`)

## 1. Production Deployment Pipeline Flow

```text
GitHub (push / PR merge to main)
      │
      ▼
GitHub Actions CI Pipeline (Lint, Typecheck, Unit Tests & Coverage)
      │
      ▼
GitHub Actions Docker Workflow (Multi-stage Build & Trivy Security Scan)
      │
      ▼
GHCR (Publish Container Image: ghcr.io/<owner>/job-tracker-api:<tag>)
      │
      ▼
Target Host / VPS Automated Deployment Trigger
      │
      ├── 1. docker compose pull
      ├── 2. docker compose run --rm api pnpm prisma migrate deploy
      ├── 3. docker compose up -d --no-deps api
      └── 4. Health Check Probe Verification (GET /api/v1/health/ready)
```

---

## 2. Release Procedure

1. **Feature Merge**: Merge tested feature branch into `main` after passing GitHub Actions CI checks (`ci.yml` and `docker.yml`).
2. **Container Image Publishing**: Upon push to `main`, GitHub Actions builds and tags the multi-stage Docker image with both `:latest` and `:sha-<commit-hash>`.
3. **Database Migration Execution**: Database schema changes are deployed non-destructively using `prisma migrate deploy` prior to updating running containers.
4. **Zero-Downtime Container Rolling Update**: Target VPS pulls the latest image tag and updates the container instance:
   ```bash
   docker compose pull api
   docker compose run --rm api npx prisma migrate deploy
   docker compose up -d --no-deps api
   ```
5. **Health Probe Verification**: The process confirms system readiness via `http://localhost:3000/api/v1/health/ready`.

---

## 3. Automated Rollback Strategy

If the production health check fails or errors spike post-deployment:

1. **Identify Previous Stable Release Tag**: Locate previous working container tag (e.g. `ghcr.io/eeja07/job-tracker-api:sha-previous`).
2. **Revert Running Container**:
   ```bash
   docker compose pull api:<previous-tag>
   docker compose up -d --no-deps api
   ```
3. **Verify Health Status**:
   ```bash
   curl -f http://localhost:3000/api/v1/health/ready
   ```

---

## 4. Secrets & Security Compliance

- **Zero Hardcoded Secrets**: Secrets (`DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`) are injected strictly at runtime via environment variables or secret managers.
- **Trivy Vulnerability Gating**: Builds automatically fail if `HIGH` or `CRITICAL` vulnerability CVEs are detected during the container scanning step.
