# Persistent Template Studio v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist Spark IoT Template Studio edits in PostgreSQL so template setup, datastreams, notifications, and dashboard widgets survive refreshes, deploys, and VPS restarts.

**Architecture:** Add a compact `DeviceTemplateRecord` SQLAlchemy model linked to tenant/project/dashboard. Store datastream and notification definitions as validated JSON while reusing the existing `dashboards.widgets` persistence for widget layout/config. Add demo-safe API endpoints under `/api/v1/demo/templates` for the no-login MVP, then wire the React app to load/save templates with visible saved/unsaved/error states.

**Tech Stack:** FastAPI, SQLAlchemy, PostgreSQL JSON columns, Pydantic validation, React/Vite/TypeScript, Vitest, Docker Compose.

## Global Constraints

- Keep the current no-login MVP flow working.
- Starter plan remains 3 templates/projects, 3 devices, 10 widgets per dashboard.
- Preserve existing demo tenant `demo-tenant` and seeded project IDs.
- Do not introduce microservices or paid managed services.
- Keep GitHub-to-VPS deployment compatible with existing Docker Compose.

---

### Task 1: Backend model, schemas, and seed

**Files:**
- Modify: `backend/app/models/domain.py`
- Modify: `backend/app/schemas/api.py`
- Modify: `backend/app/seed.py`
- Test: `backend/tests/test_core.py`

**Interfaces:**
- Produces SQLAlchemy model `DeviceTemplateRecord` with fields `id`, `tenant_id`, `project_id`, `dashboard_id`, `name`, `board`, `description`, `datastreams`, `notifications`, `revision`, `created_at`, `updated_at`.
- Produces Pydantic schemas `TemplateStudioUpdate` and `TemplateStudioResponse`.

**Steps:**
- [ ] Add failing tests for seeded demo templates and validation limits.
- [ ] Add `DeviceTemplateRecord` model with tenant/project indexes and one template per project.
- [ ] Add Pydantic validation for datastreams, notifications, dashboard widgets, and starter plan limits.
- [ ] Seed one template per demo project from existing dashboards and stable virtual pin maps.
- [ ] Run backend tests.

### Task 2: Demo template persistence API

**Files:**
- Modify: `backend/app/api/routes/demo.py`
- Test: `backend/tests/test_core.py`

**Interfaces:**
- `GET /api/v1/demo/templates` returns `list[TemplateStudioResponse]`.
- `GET /api/v1/demo/templates/{template_id}` returns `TemplateStudioResponse`.
- `PUT /api/v1/demo/templates/{template_id}` accepts `TemplateStudioUpdate`, updates the template record and linked dashboard widgets, increments revision, returns `TemplateStudioResponse`.

**Steps:**
- [ ] Add tests for listing templates, saving template metadata/datastreams/notifications/widgets, revision increment, and 409 stale revision.
- [ ] Implement serializer helpers in `demo.py`.
- [ ] Implement endpoints with demo tenant scoping.
- [ ] Run backend tests.

### Task 3: Frontend API and app state

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Modify: `frontend/src/App.tsx`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Adds `templateRevision` to `DeviceTemplate`.
- Adds API calls `demoTemplates()` and `saveDemoTemplate(template)`.
- App loads templates from backend on startup and after save.

**Steps:**
- [ ] Add TypeScript types for persisted template revision.
- [ ] Add API functions for demo template persistence.
- [ ] Replace hard-only demoTemplates state with backend load plus fallback.
- [ ] Track save status per template: saved, unsaved, saving, error.
- [ ] Run frontend tests.

### Task 4: Template Studio save UX

**Files:**
- Modify: `frontend/src/pages/TemplateStudioPage.tsx`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- `TemplateStudioPage` receives `saveState`, `onSave`, and `onChange`.
- Save button persists setup/datastreams/notifications/dashboard widgets.
- Save status appears in header and builder toolbar.

**Steps:**
- [ ] Add save props and wire buttons.
- [ ] Show Saved / Unsaved / Saving / Save failed states.
- [ ] Disable save while saving.
- [ ] Add stale conflict copy instructing refresh if backend returns 409.
- [ ] Run frontend tests and build.

### Task 5: Verification, docs, package, commit

**Files:**
- Modify: `README.md`
- Modify: `docs/api.md`
- Modify: `docs/deployment.md` if needed

**Steps:**
- [ ] Document persistent Template Studio endpoints and demo workflow.
- [ ] Run backend tests.
- [ ] Run frontend tests/build.
- [ ] Run Docker Compose config validation.
- [ ] Package release ZIP.
- [ ] Commit changes.
