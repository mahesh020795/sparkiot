# Hesh IoT Product Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand and redesign the customer-facing Spark IoT application as Hesh IoT while preserving all device, protocol, API, persistence, and workflow compatibility.

**Architecture:** Build one reusable `HeshBrand` component and evolve the existing canonical `design-system.css` into Hesh IoT Product UI Standard v4. Apply the identity and customer-facing language across the shell, authentication, onboarding, dashboards, Template Studio, plans, notifications, and email surfaces while retaining `SparkIoT` only where it is a compatibility identifier.

**Tech Stack:** React 19, TypeScript, Vite, Vitest, React Testing Library, CSS custom properties, FastAPI, Pytest.

## Global Constraints

- Hesh Orange is `#F25522`; Ink is `#121722`; Product Cobalt is `#2457F5`; Online Green is `#22A865`; Warm Canvas is `#F7F6F2`.
- Orange is limited to identity and primary actions; cobalt owns navigation, selection, workflow, chart, link, and focus states; green represents healthy/connected/success states only.
- Preserve Arduino `SparkIoT`, MQTT `spark/v1`, API routes, environment keys, database identifiers, packages, stored data, credentials, and firmware behaviour.
- Preserve all existing product workflows and the 44px minimum control target.
- Meet WCAG AA contrast, keyboard, reduced-motion, and 375px responsive requirements.
- Do not create a second product-wide CSS override file; `frontend/src/styles/design-system.css` remains canonical.
- Rollback tag `before-hesh-ui-rebrand-2026-07-30` must remain at `693fff81c8653ec4d86e61e6db95fba2a38edf41`.

---

### Task 1: Reusable Hesh Identity

**Files:**
- Create: `frontend/src/components/HeshBrand.tsx`
- Create: `frontend/src/components/HeshBrand.test.tsx`
- Modify: `frontend/src/styles/design-system.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/index.html`

**Interfaces:**
- Consumes: existing React component patterns and canonical design-system classes.
- Produces: `HeshBrand({ variant, tagline, className })`, `.hesh-brand`, `.hesh-circuit`, and Hesh semantic colour tokens.

- [ ] **Step 1: Write the failing identity tests**

```tsx
render(<HeshBrand tagline />);
expect(screen.getByLabelText("Hesh IoT")).toBeInTheDocument();
expect(screen.getByText("Hesh")).toBeInTheDocument();
expect(screen.getByText("IoT")).toHaveClass("hesh-word-iot");
expect(screen.getByText("Make IoT simple.")).toBeInTheDocument();
expect(screen.getByTestId("hesh-circuit")).toHaveAttribute("aria-hidden", "true");
```

- [ ] **Step 2: Run the focused test and confirm RED**

Run: `cd frontend && pnpm vitest run src/components/HeshBrand.test.tsx`

Expected: FAIL because `HeshBrand.tsx` does not exist.

- [ ] **Step 3: Implement the reusable component**

```tsx
type HeshBrandProps = {
  variant?: "full" | "compact" | "mark";
  tagline?: boolean;
  className?: string;
};

export function HeshBrand({ variant = "full", tagline = false, className = "" }: HeshBrandProps) {
  return (
    <span className={`hesh-brand hesh-brand-${variant} ${className}`.trim()} aria-label="Hesh IoT">
      <span className="hesh-circuit" data-testid="hesh-circuit" aria-hidden="true">
        <i className="hesh-rail hesh-rail-left" /><i className="hesh-rail hesh-rail-right" />
        <b className="hesh-link" /><i className="hesh-node hesh-node-left" />
        <i className="hesh-node hesh-node-center" /><i className="hesh-node hesh-node-right" />
      </span>
      {variant !== "mark" && <span className="hesh-brand-copy"><span className="hesh-wordmark"><strong>Hesh</strong><em className="hesh-word-iot">IoT</em></span>{tagline && <small>Make IoT simple.</small>}</span>}
    </span>
  );
}
```

- [ ] **Step 4: Add brand tokens and connected-H component styles to the canonical CSS**

Add `--hesh-orange`, `--hesh-ink`, `--hesh-cobalt`, `--hesh-online`, and `--hesh-canvas` at `:root`, then style the mark with CSS rails, bridge, and nodes. Use the full variant in the sidebar and authentication surfaces; use the mark variant only where width requires it.

- [ ] **Step 5: Replace shell/auth marks and browser title**

Use `<HeshBrand tagline />` in the sidebar, `<HeshBrand className="auth-brand" />` in authentication and verification, and change `<title>` to `Hesh IoT | Make IoT simple` plus `<meta name="theme-color" content="#F25522">`.

- [ ] **Step 6: Run tests and commit**

Run: `cd frontend && pnpm vitest run src/components/HeshBrand.test.tsx src/App.test.tsx`

Commit: `feat: add Hesh IoT product identity`

---

### Task 2: Customer-Facing Product Rebrand

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/StarterWorkspacePage.tsx`
- Modify: `frontend/src/pages/VerifyEmailPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.tsx`
- Modify: `frontend/src/pages/SettingsPage.test.tsx`
- Modify: `frontend/src/pages/TemplateStudioPage.tsx`
- Modify: `frontend/src/lib/planCatalog.ts`
- Modify: `backend/app/core/config.py`
- Modify: `backend/app/services/email.py`
- Modify: `backend/app/services/plans.py`
- Modify: `backend/app/api/routes/auth.py`
- Modify: `backend/app/seed.py`
- Modify: relevant tests under `backend/tests/`

**Interfaces:**
- Consumes: the new `HeshBrand` component and existing authentication/onboarding APIs.
- Produces: Hesh IoT customer copy while preserving technical compatibility strings.

- [ ] **Step 1: Change UI expectations to Hesh IoT and verify RED**

Add assertions for `Hesh IoT Dashboard`, `Hesh IoT Launch Wizard`, `Hesh IoT Template Studio`, `Hesh IoT Pro`, and Hesh authentication/reset language. Keep assertions for `#include <SparkIoT.h>`, `SparkIoT.begin`, and `SparkIoT.ack` unchanged.

Run: `cd frontend && pnpm vitest run src/App.test.tsx src/pages/SettingsPage.test.tsx`

Expected: FAIL on the first visible Spark IoT product label.

- [ ] **Step 2: Change email and account expectations to Hesh IoT and verify RED**

```python
assert message.subject == "Verify your Hesh IoT account"
assert "Welcome to Hesh IoT" in message.text
assert "Hesh IoT workspace is ready" in notification.body
```

Run: `.venv/Scripts/python -m pytest backend/tests -q`

Expected: FAIL because the current email and account copy says Spark IoT.

- [ ] **Step 3: Rename visible product copy without changing compatibility identifiers**

Replace customer-visible `Spark IoT` with `Hesh IoT` across the listed UI and backend customer-message files. In generated code comments, use `Hesh IoT generated sketch`; leave filenames, include paths, object names, topic namespaces, credentials, and API identifiers unchanged.

- [ ] **Step 4: Run focused frontend/backend tests and commit**

Run: `cd frontend && pnpm vitest run src/App.test.tsx src/pages/SettingsPage.test.tsx`

Run: `.venv/Scripts/python -m pytest backend/tests -q`

Commit: `feat: rebrand customer surfaces as Hesh IoT`

---

### Task 3: Hesh Product UI Standard v4

**Files:**
- Modify: `tests/test_frontend_design_system_contract.py`
- Modify: `frontend/src/styles/design-system.css`
- Modify: `frontend/src/styles/app.css` only to remove or disable conflicting legacy rules.

**Interfaces:**
- Consumes: Hesh tokens from Task 1 and existing `.spark-ui` DOM contracts.
- Produces: one canonical shell, control, card, header, dashboard, and status system.

- [ ] **Step 1: Add failing semantic design-contract assertions**

Require `Hesh IoT Product UI Standard v4`, the five exact Hesh colour tokens, orange primary controls with ink text, cobalt active navigation/focus states, green healthy status, warm canvas, 44px controls, and reduced-motion handling. Forbid legacy brand hex values in brand and primary-action rules.

Run: `.venv/Scripts/python -m pytest tests/test_frontend_design_system_contract.py -q`

Expected: FAIL because Product UI Standard v4 and Hesh tokens are absent.

- [ ] **Step 2: Refactor the root tokens and primary controls**

```css
:root {
  --hesh-orange: #f25522;
  --hesh-ink: #121722;
  --hesh-cobalt: #2457f5;
  --hesh-online: #22a865;
  --hesh-canvas: #f7f6f2;
  --spark-primary: var(--hesh-cobalt);
  --spark-success: var(--hesh-online);
}

.spark-ui .primary { background: var(--hesh-orange); color: var(--hesh-ink); }
.spark-ui .sidebar nav button.active { background: #edf2ff; color: var(--hesh-cobalt); }
```

- [ ] **Step 3: Refine shell, headers, cards, controls, and status components**

Update existing canonical selectors instead of appending a competing override layer. Use lower-shadow neutral surfaces, clearer spacing, orange brand/action accents, cobalt interaction states, and consistent semantic badges. Preserve dashboard grid areas, selector layering, menu escape rules, widget sizing, and mobile breakpoints.

- [ ] **Step 4: Verify the design contract and commit**

Run: `.venv/Scripts/python -m pytest tests/test_frontend_design_system_contract.py -q`

Run: `cd frontend && pnpm vitest run`

Commit: `feat: apply Hesh product UI standard v4`

---

### Task 4: Guided Brand Mode and Calm Operation Mode

**Files:**
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/pages/DashboardPage.test.tsx`
- Modify: `frontend/src/styles/design-system.css`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/LoginPage.tsx`
- Modify: `frontend/src/pages/StarterWorkspacePage.tsx`
- Modify: `frontend/src/pages/VerifyEmailPage.tsx`
- Modify: `frontend/src/pages/TemplateStudioPage.tsx`
- Modify: `frontend/src/pages/DashboardPage.tsx` only where semantic structure is required.

**Interfaces:**
- Consumes: HeshBrand, Hesh semantic tokens, existing workflows and data.
- Produces: stronger onboarding/auth expression and lower-fatigue operational screens.

- [ ] **Step 1: Add failing behavioural assertions for the redesigned hierarchy**

Assert one obvious primary action on starter/auth surfaces, the `Make IoT simple.` identity in the shell, unchanged dashboard selector and workflow controls, explicit text accompanying status colour, and the existing empty-dashboard next steps.

- [ ] **Step 2: Run focused tests and verify RED**

Run: `cd frontend && pnpm vitest run src/App.test.tsx src/pages/DashboardPage.test.tsx`

- [ ] **Step 3: Implement surface refinements**

Use orange progress/completion actions in onboarding and Template Studio, cobalt step selection and editing, green verified/connected states, restrained white operational cards, and plain-language helper copy. Preserve all event handlers, API calls, component props, and persisted object shapes.

- [ ] **Step 4: Run frontend tests and build, then commit**

Run: `cd frontend && pnpm test && pnpm build`

Commit: `feat: balance Hesh onboarding and operations`

---

### Task 5: Documentation, Responsive QA, and Release

**Files:**
- Modify: `README.md`
- Modify: `docs/SPARK_IOT_HANDOFF.md`
- Modify: `.env.example` and `.env.vps.example` only where customer-visible sender/product defaults require Hesh IoT.
- Modify: plan checkboxes as tasks complete.

**Interfaces:**
- Consumes: complete validated Hesh IoT frontend and unchanged compatibility protocols.
- Produces: documented, reviewed, reversible release on `main`.

- [ ] **Step 1: Update product documentation with the compatibility boundary**

Describe Hesh IoT as the product name and `SparkIoT` as the retained device library/API compatibility name. Do not rename repository paths or firmware examples in commands.

- [ ] **Step 2: Run complete automated verification**

Run: `cd frontend && pnpm test && pnpm build && pnpm lint`

Run: `.venv/Scripts/python -m pytest -q`

Run: `.venv/Scripts/python -m ruff check backend/app backend/tests`

Run: `git diff --check`

- [ ] **Step 3: Perform visual and responsive QA**

Run the app and inspect authentication, starter workspace, dashboard, Template Studio, empty dashboard, confirmation dialog, and mobile navigation at 375px, 768px, 1024px, and wide desktop. Verify no horizontal overflow, clipped menus, console errors, inaccessible focus, or colour-only status.

- [ ] **Step 4: Request independent code/design review and resolve Critical or Important findings**

Review the full range from `before-hesh-ui-rebrand-2026-07-30` to branch HEAD against the approved design specification.

- [ ] **Step 5: Merge and push without force**

Merge `feat/hesh-ui-rebrand` into `main`, rerun smoke verification from `main`, and push `main` to `origin`. Keep the rollback tag unchanged and report the final commit plus rollback command.
