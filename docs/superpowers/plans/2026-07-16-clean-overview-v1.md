# Clean Overview v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the Overview page minimal, calm, and overflow-safe while preserving access to the full setup flow.

**Architecture:** Keep the existing React app shell and dashboard pages. Replace the always-visible full launch wizard on Overview with a compact setup summary card, and move the full wizard into a separate setup view reachable from the compact card and sidebar/nav entry. Standardize hero/metric sizing through CSS selectors already used by the app.

**Tech Stack:** React, TypeScript, Vitest, Testing Library, CSS design-system tokens.

## Global Constraints

- No subagents for implementation.
- Use TDD: write failing frontend behavior tests before production changes.
- Keep dashboard selector visible on the Overview page.
- Do not remove Launch Wizard functionality; only reduce Overview clutter.
- Avoid orange gradients on dashboard cards/widgets.
- Preserve GitHub/VPS deploy flow after verification.

---

### Task 1: Compact Overview Setup Card

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/design-system.css`

**Interfaces:**
- Consumes: existing `LaunchWizardPanel` props and navigation handlers.
- Produces: `SetupSummaryCard` rendered on Overview with button text `Open setup flow`.

- [ ] Step 1: Add a failing test that Overview contains `Setup ready` and does not show all six wizard step cards.
- [ ] Step 2: Run the targeted frontend test and confirm it fails because the compact card does not exist yet.
- [ ] Step 3: Implement `SetupSummaryCard` and render it on Overview instead of `LaunchWizardPanel`.
- [ ] Step 4: Run the targeted frontend test and confirm it passes.

### Task 2: Dedicated Setup Flow View

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/design-system.css`

**Interfaces:**
- Consumes: existing `LaunchWizardPanel`.
- Produces: new `setup` view accessible by `Open setup flow`, sidebar `Setup Flow`, and existing launch actions.

- [ ] Step 1: Add a failing test that clicking `Open setup flow` opens the full `Spark IoT Launch Wizard` with all six steps.
- [ ] Step 2: Run targeted test and confirm it fails for missing setup view.
- [ ] Step 3: Add `setup` to `View`, sidebar nav, render `LaunchWizardPanel` only in setup view.
- [ ] Step 4: Run targeted test and confirm it passes.

### Task 3: Overview Header and Overflow Polish

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles/design-system.css`

**Interfaces:**
- Consumes: `dashboard-header-grid`, `top-actions`, `cockpit-metrics` classes.
- Produces: compact metric grid, overflow-safe cards, and no simulation strip on Overview.

- [ ] Step 1: Add a failing test that `Interactive live simulation` is absent from Overview and dashboard metrics remain visible.
- [ ] Step 2: Run targeted test and confirm it fails while simulation strip remains.
- [ ] Step 3: Remove simulation strip from Overview header and tighten responsive CSS for metrics/project cards.
- [ ] Step 4: Run frontend tests and production build.

### Task 4: Release Verification

**Files:**
- No source changes expected.

**Interfaces:**
- Produces: committed and pushed source, GitHub Actions CI/deploy green, VPS health green.

- [ ] Step 1: Run full frontend tests, backend tests, frontend build, package release.
- [ ] Step 2: Commit source changes.
- [ ] Step 3: Push to GitHub and verify CI/deploy.
- [ ] Step 4: Verify live VPS health and that the deployed JS contains `Setup ready`.
