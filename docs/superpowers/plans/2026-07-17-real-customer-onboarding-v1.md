# Real Customer Onboarding v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Spark IoT usable as a real customer account flow from signup to live ESP32/ESP8266 board testing, while deferring billing/payment.

**Architecture:** Keep the modular monolith shape: React/Vite frontend, FastAPI account APIs, PostgreSQL/SQLite-compatible models, Mosquitto MQTT commands, and telemetry as the source of truth for latest widget values. Dashboard input widgets persist by publishing commands and recording those command values as latest telemetry for the same device/channel.

**Tech Stack:** React, Vite, TypeScript, FastAPI, SQLAlchemy, PostgreSQL/SQLite, pytest, Vitest, SMTP via Python `smtplib`.

## Global Constraints

- Billing/payment is explicitly deferred as item 9.
- Customer account plans remain Free, Plus — RM25/month, Pro — RM49/month, Enterprise.
- Login, signup, reset, settings, template, project, device, code, and board-test flows must stay clean and SaaS-like.
- Production email must be configurable through environment variables without forcing SMTP during local/VPS testing.
- Time-only and Schedule dashboard input values must survive refresh for signed-in customer workspaces.

---

### Task 1: SMTP-ready authentication email hooks

**Files:**
- Create: `backend/app/services/email.py`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/api/routes/auth.py`
- Modify: `.env.example`
- Test: `backend/tests/test_core.py`

**Interfaces:**
- Produces: `build_verification_email(to_email, full_name, token, app_url=None) -> EmailMessage`
- Produces: `build_password_reset_email(to_email, full_name, token, app_url=None) -> EmailMessage`
- Produces: `send_email(message: EmailMessage) -> dict[str, str]`

- [x] Write tests that verification and reset email messages include public links, tokens for MVP testing, and no token hashes.
- [x] Write a test that `send_email()` safely skips delivery when `SMTP_HOST` is empty.
- [x] Add SMTP settings and `APP_PUBLIC_URL`.
- [x] Wire signup, verification resend, and password reset request to `send_email()`.
- [x] Document SMTP environment variables and the public-launch step to hide raw tokens.

### Task 2: Account dashboard input persistence

**Files:**
- Modify: `backend/app/api/routes/devices.py`
- Test: `backend/tests/test_core.py`
- Test: `frontend/src/pages/DashboardPage.test.tsx`

**Interfaces:**
- Consumes: `POST /api/v1/devices/{device_id}/commands`
- Produces: a `Telemetry` row for the same tenant, project, device, channel, and command value.

- [x] Write backend test proving a command persists as latest telemetry.
- [x] Update account command API to insert `CommandLog` and `Telemetry` rows together.
- [x] Write frontend test proving a signed-in time input reloads from protected latest telemetry after refresh.
- [x] Keep localStorage fallback for demo/offline browser testing.

### Task 3: Handoff and verification

**Files:**
- Modify: `README.md`
- Modify: `docs/SPARK_IOT_HANDOFF.md`

**Interfaces:**
- Produces: continuation documentation for future developers and AI agents.

- [x] Update onboarding/auth documentation.
- [x] Update dashboard input persistence documentation.
- [x] Keep billing/payment marked as the next deferred area.
