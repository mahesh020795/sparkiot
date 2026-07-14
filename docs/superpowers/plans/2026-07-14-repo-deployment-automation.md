# Repo Deployment Automation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Spark IoT easy to maintain like a real software product, with clean repository hygiene, repeatable tests, release packaging, GitHub CI, and VPS deployment automation.

**Architecture:** Keep the application as a modular monolith and add operational automation around it. GitHub validates backend and frontend builds, creates a ZIP artifact, and optionally deploys to the VPS through SSH when secrets are configured.

**Tech Stack:** FastAPI, React/Vite, Docker Compose, PostgreSQL, Valkey, Mosquitto, GitHub Actions, shell scripts, Python ZIP packaging.

## Global Constraints

- Do not commit `.env`, local databases, build output, dependency folders, or caches.
- Keep Docker Compose as the RM25-plan-friendly VPS deployment path.
- Keep `.env.example` safe for public GitHub.
- Preserve no-login demo mode for current board testing.
- VPS deployment must be repeatable from a GitHub checkout.

---

### Task 1: Repository hygiene and operator commands

**Files:**
- Create: `Makefile`
- Create: `backend/.dockerignore`
- Create: `frontend/.dockerignore`

**Interfaces:**
- Produces: `make up`, `make down`, `make test`, `make build`, `make package`, and `make deploy-check`
- Consumes: existing `docker-compose.yml`, backend pytest setup, frontend pnpm setup

- [x] Add Makefile commands for common development and deployment tasks.
- [x] Add backend Docker ignore rules for caches, tests, local databases, and virtualenvs.
- [x] Add frontend Docker ignore rules for `node_modules`, `dist`, logs, and local env files.
- [x] Verify `make deploy-check` can validate required automation files.

### Task 2: Release packaging

**Files:**
- Create: `scripts/package_release.py`

**Interfaces:**
- Produces: Linux-safe `outputs/Spark-IoT-MVP.zip`
- Excludes: `.env`, `.git`, `.superpowers`, `node_modules`, `dist`, caches, local DBs, logs

- [x] Implement a Python packager using forward-slash ZIP paths.
- [x] Print artifact path and size after packaging.
- [x] Verify the ZIP starts with `.env.example`, `.gitignore`, `docker-compose.yml`, and `README.md`.

### Task 3: VPS deployment automation

**Files:**
- Create: `scripts/deploy_vps.sh`
- Create: `docs/deployment.md`

**Interfaces:**
- Consumes environment variables: `APP_DIR`, `REPO_URL`, `BRANCH`, `BACKUP_DIR`
- Produces: updated Docker Compose stack and health-check result

- [x] Add deploy script that clones or pulls the GitHub repository.
- [x] Preserve existing `.env` when the app directory already exists.
- [x] Run `docker compose up -d --build`.
- [x] Set restart policies for long-running containers.
- [x] Check `http://localhost:8000/health/ready`.
- [x] Document first deployment, repeat deployment, GitHub secrets, and production hardening.

### Task 4: GitHub automation

**Files:**
- Modify: `.github/workflows/ci.yml`
- Create: `.github/workflows/deploy-vps.yml`

**Interfaces:**
- CI runs backend tests, frontend tests, frontend build, and release packaging.
- Deploy workflow requires secrets: `VPS_HOST`, `VPS_USER`, `VPS_SSH_KEY`, `VPS_APP_DIR`.

- [x] Use Python 3.12 and Node 22 in CI.
- [x] Use pnpm consistently for frontend install/test/build.
- [x] Upload the release ZIP as a CI artifact.
- [x] Add optional deployment workflow using SSH and `scripts/deploy_vps.sh`.

### Task 5: Documentation and GitHub handoff

**Files:**
- Modify: `README.md`

**Interfaces:**
- Produces: clear local setup, board testing references, GitHub push commands, and VPS deploy commands.

- [x] Link deployment, API, MQTT, and board-testing docs.
- [x] Document repeatable `make` commands.
- [x] Document GitHub remote/push flow.
- [x] Document current demo VPS environment values.
