# Hesh IoT Product Design System

## Purpose

Transform the customer-facing Spark IoT application into Hesh IoT with a distinctive, trustworthy product design that works for students, makers, educators, operators, and growing businesses. The redesign must strengthen brand recognition without making the daily dashboard feel like a marketing page.

## Product Principle

Hesh IoT has two coordinated modes:

- **Brand mode:** confident orange identity, the connected-H mark, concise language, and memorable primary actions.
- **Operation mode:** calm white and warm-neutral surfaces, cobalt navigation and workflow states, semantic status colours, predictable density, and restrained motion.

The product should feel approachable on first use and dependable after hundreds of daily sessions.

## Approved Visual System

### Colour roles

- Hesh Orange `#F25522`: logo, brand moments, primary calls to action, onboarding progress, and selective emphasis.
- Ink `#121722`: text, strong borders, high-contrast controls, and code surfaces.
- Product Cobalt `#2457F5`: navigation, selected states, builder steps, charts, links, focus rings, and data interaction.
- Online Green `#22A865`: connected, healthy, acknowledged, and successful states only.
- Warm Canvas `#F7F6F2`: application background and welcoming empty states.
- White `#FFFFFF`: operational cards, forms, tables, dashboards, and dialogs.
- Muted Slate `#697184`: supporting copy and secondary metadata.

Orange must not represent telemetry categories or online status. Cobalt must not replace the orange brand signature. Status colours must carry the same meaning across every page.

### Typography and shape

- Keep Plus Jakarta Sans as the primary interface typeface.
- Use compact uppercase labels only for navigation groups, status metadata, and builder stages.
- Use strong but calm page titles; dense operational cards use smaller titles and clearer numeric hierarchy.
- Use 12–18px radii for controls and cards, with larger radii reserved for onboarding and empty-state compositions.
- Prefer thin neutral borders and restrained shadows over heavy floating-card effects.

### Brand mark

Create a reusable `HeshBrand` component containing a CSS-rendered connected-H circuit mark and the two-colour `Hesh IoT` wordmark. The mark is decorative and `aria-hidden`; the component exposes a readable Hesh IoT label. It supports full, compact, and mark-only variants for sidebar, authentication, mobile, and favicon-style contexts.

The sidebar brand block uses the line `Make IoT simple.` The product does not reuse the landing page’s oversized editorial typography inside operational screens.

## Application Architecture

### Design tokens

Extend the existing canonical `design-system.css` rather than adding another override layer. Introduce Hesh semantic tokens while retaining existing internal `--spark-*` aliases where required for compatibility. Components consume role-based tokens instead of scattered hex values.

### Product shell

- Replace the current Spark IoT brand block with `HeshBrand`.
- Keep a stable desktop sidebar and existing navigation information architecture.
- Use cobalt for active navigation; orange appears in the mark and primary workspace action.
- Improve sidebar grouping, account context, and footer actions without hiding frequently used destinations.
- On narrow screens, collapse cleanly while preserving readable labels and touch targets.

### Page headers and dashboards

- Preserve the existing dashboard selector, metric summary, command strip, and widget canvas flow.
- Reduce visual competition between the page title, selector, metrics, and widgets.
- Keep realtime status immediately visible using green only when the connection is actually healthy.
- Maintain information density for business operators while keeping cards understandable to first-time users.
- Charts and widget accents remain data-driven; Hesh Orange is not used as a generic chart series colour.

### Onboarding, authentication, and empty states

- Use the strongest brand expression on sign-in, registration, verification, starter workspace, and empty dashboards.
- Present one obvious orange primary action and quieter secondary actions.
- Use plain-language guidance and short, visible next steps for students and first-time makers.
- Avoid decorative illustrations that do not explain the board-to-cloud workflow.

### Template Studio and setup workflows

- Preserve the existing Template → Datastreams → Device → Code → Test → Dashboard sequence.
- Use cobalt for step selection and workspace editing, orange for the action that advances or completes the flow, and green for verified results.
- Keep advanced options available without placing them ahead of the primary task.
- Improve form grouping, helper text, validation, and responsive stacking without changing stored data contracts.

### Tables, forms, dialogs, and notifications

- Controls retain a minimum 44px target and visible cobalt focus treatment.
- Primary actions use orange with ink text; destructive actions remain red and require explicit confirmation.
- Dialogs use one clear title, consequence text, and ordered actions.
- Success, warning, error, stale, offline, loading, and permission states use consistent semantic components and language.

## Customer Range

- **Students:** guided defaults, clear vocabulary, visible progress, and forgiving empty states.
- **Makers:** fast access to virtual pins, firmware code, board tests, and live values.
- **Educators and teams:** predictable navigation, reusable templates, and understandable project context.
- **Businesses:** compact metrics, reliable status signals, scalable cards, and low-fatigue daily operation.

No separate “student” and “enterprise” themes are introduced. The same interface adapts through progressive disclosure, density, and content hierarchy.

## Rebrand Boundary

Rename customer-visible product references to `Hesh IoT`, including browser title, navigation branding, authentication, onboarding, plans, notifications, and user-facing documentation touched by this release.

Retain compatibility identifiers in this phase:

- Arduino class and library name `SparkIoT`
- MQTT namespace `spark/v1`
- API routes, environment keys, database identifiers, package names, and source-level compatibility types
- Existing device credentials and generated firmware behaviour

Where a technical compatibility name must be shown, explain it once as the Hesh IoT `SparkIoT` device library rather than silently renaming it.

## Accessibility and Responsive Requirements

- Meet WCAG AA contrast for interface text and controls.
- Preserve keyboard navigation and visible focus states.
- Do not encode status by colour alone.
- Respect reduced-motion preferences.
- Prevent horizontal page overflow at 375px, 768px, 1024px, and wide desktop layouts.
- Keep touch targets at least 44px and ensure menus escape clipping containers.

## Testing and Verification

- Add failing tests for the Hesh brand component, visible Hesh product name, brand tagline, semantic colour tokens, and customer-facing rename boundary.
- Keep all existing workflow and widget tests passing.
- Run frontend unit tests, frontend production build, backend tests, and repository contract tests.
- Visually inspect authentication, dashboard, Template Studio, empty dashboard, dialogs, and mobile navigation.
- Check browser console errors and verify no horizontal overflow at target breakpoints.

## Reversibility

Tag `before-hesh-ui-rebrand-2026-07-30` points to the original Spark IoT design at commit `693fff81c8653ec4d86e61e6db95fba2a38edf41` and is pushed to GitHub. Implementation occurs on `feat/hesh-ui-rebrand`. Reverting the release or resetting a deployment to the tagged commit restores the previous product design without changing customer data or device protocols.
