# Real Account Templates v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan inline. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make signed-in Spark IoT workspaces use real persistent Blynk-style templates instead of frontend-only surrogate templates.

**Architecture:** Add authenticated FastAPI template routes backed by the existing `DeviceTemplateRecord` and `Dashboard` models. Wire React account mode to load/create/save these real templates while leaving no-login demo template behavior unchanged.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic v2, React/Vite/TypeScript, Vitest.

## Global Constraints

- Starter plan supports 3 projects and 3 templates, with one template per project.
- Template payloads must preserve board, datastreams, notifications, dashboard widgets, and optimistic revision checks.
- Demo mode remains `/api/v1/demo/templates`; account mode uses `/api/v1/templates`.
- Verification must include backend tests, frontend tests, frontend build, release package, GitHub push, and VPS health/deploy checks.

---

### Task 1: Authenticated Template API

**Files:**
- Create: `backend/app/api/routes/templates.py`
- Modify: `backend/app/api/router.py`
- Modify/Test: `backend/tests/test_core.py`

**Interfaces:**
- Produces: `GET /api/v1/templates`, `POST /api/v1/templates`, `PUT /api/v1/templates/{template_id}`
- Consumes: `TemplateStudioUpdate`, `TemplateStudioResponse`, `DeviceTemplateRecord`, `Dashboard`, `current_user`

- [ ] Write failing tests for create/list/update, one-template-per-project, stale revision, and tenant ownership.
- [ ] Implement route helpers and authenticated CRUD.
- [ ] Run backend tests.

### Task 2: Account Template Frontend Flow

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.tsx`
- Modify/Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Produces: `api.templates()`, `api.createTemplate()`, `api.saveTemplate()`
- Consumes: existing `TemplateStudioPage` props and `DeviceTemplate`

- [ ] Write failing frontend test for signed-in template creation and account save.
- [ ] Add account template state loading, create-template modal/card, and save routing.
- [ ] Run frontend tests.

### Task 3: Verification and Release

**Files:**
- Modify: `README.md`
- Modify: `docs/board-testing.md`

**Interfaces:**
- Produces: updated package artifact and pushed deployment.

- [ ] Update docs with real project → template → device flow.
- [ ] Run frontend tests, frontend build, backend tests, package release.
- [ ] Commit, push, and verify VPS health plus deployed bundle markers.
