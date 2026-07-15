# SaaS Foundation Auth v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add production-shaped SaaS authentication surfaces for login, signup, and password reset.

**Architecture:** Keep the modular monolith auth router. Add a hashed one-time password reset token table, tenant-safe notifications, refresh-token revocation after password change, and frontend auth modes that guide customers through login, Starter signup, and reset without leaving the app.

**Tech Stack:** FastAPI, SQLAlchemy, Argon2/passlib, React/Vite, Vitest, Pytest.

## Global Constraints

- Keep Starter plan assumptions: 1 user, 3 projects, 3 devices, 30-day data.
- Store only token hashes; raw reset token is returned only for MVP/dev testing until SMTP is connected.
- Reset confirmation must revoke existing refresh tokens for the user.
- Use TDD for backend and frontend behavior.
- No subagents.

---

### Task 1: Backend Reset Token Flow

**Files:**
- Modify: `backend/app/models/domain.py`
- Modify: `backend/app/schemas/api.py`
- Modify: `backend/app/api/routes/auth.py`
- Test: `backend/tests/test_core.py`

**Interfaces:**
- `POST /api/v1/auth/password-reset/request` with `{ email }` returns `{ status, message, reset_token? }`.
- `POST /api/v1/auth/password-reset/confirm` with `{ token, password }` returns `{ status, message }`.

- [x] Add failing tests for hashed reset token creation and one-time confirm.
- [x] Add `PasswordResetToken` model.
- [x] Add reset request/confirm schemas.
- [x] Implement request/confirm routes.
- [x] Verify targeted backend tests pass.

### Task 2: Frontend Auth Flow

**Files:**
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- `api.requestPasswordReset(email)`
- `api.confirmPasswordReset(token, password)`
- Auth page modes: Existing account, Create Starter account, Reset password.

- [x] Add failing UI test for reset request + confirm + login.
- [x] Add API client methods.
- [x] Add Reset password auth mode with token and new password fields.
- [x] Add success/error styling.
- [x] Verify targeted frontend test passes.

### Task 3: Release Verification

**Files:**
- Modify: `README.md`

- [x] Document MVP reset-token behavior and future SMTP requirement.
- [x] Run full frontend tests, backend tests, frontend build, release package.
- [ ] Commit, push, and verify CI/deploy/VPS health.
