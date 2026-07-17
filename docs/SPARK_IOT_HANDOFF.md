# Spark IoT product and engineering handoff

This document is the working map for Spark IoT. Keep it updated whenever a page, backend route, device protocol, workflow, or deployment assumption changes. It is written for a future developer or AI agent that needs to continue the project without rereading the full chat history.

## Product direction

Spark IoT is a lower-cost, Rectronx-branded Blynk-style IoT SaaS for students, makers, universities, and small businesses. The intended customer flow is:

1. Customer visits Spark IoT.
2. Customer signs up or starts a free/demo trial.
3. Customer creates or selects a reusable template.
4. Customer creates a project and applies a template.
5. Customer provisions a device and receives a one-time device token.
6. Customer copies generated Arduino code into ESP32/ESP8266/Arduino IDE.
7. Board publishes telemetry through MQTT or HTTP.
8. Dashboard widgets update live and commands publish back to the board.

The MVP keeps the architecture simple and cheap: React/Vite frontend, FastAPI modular monolith backend, PostgreSQL, Valkey, Mosquitto MQTT, worker, Docker Compose, and GitHub Actions deployment to a VPS.

## Account tiers

The UI and backend are moving toward these SaaS plans:

- Free: trial/demo-friendly limits.
- Plus: RM25/month, starter customer plan.
- Pro: RM49/month, larger limits.
- Enterprise: custom limits, support, and deployment needs.

Current starter-style limits used throughout the MVP are 1 user, 3 projects, 3 devices, 3 templates/dashboards, 30-day telemetry retention, GPS, camera URL, browser push, charts, switch/button/LED/gauge/meter/value/serial/time/schedule widgets.

## Core entities

### Template

A reusable product model. It defines board type, virtual pins/datastreams, default dashboard widgets, alert rules, and Arduino protocol shape. Templates should not carry live/active state because they are not real deployed jobs. A template can be reused across projects later.

### Project

A customer workspace/dashboard instance. A project chooses a template, then owns live dashboard state, data history, notification rules, schedules, and device bindings. Projects can show active status because they represent real customer deployments.

### Device

A physical board credential and MQTT namespace. One project can support more than one device later, but the starter plan currently limits total active devices to three. Devices store topics and a one-time token model. Tokens are revealed once, stored hashed in production, and can be regenerated.

### Datastream / virtual pin

The Blynk-style contract between dashboard widgets and firmware. Examples: `V0` temperature float, `V3` pump boolean, `V7` GPS, `V10` camera URL, `V11` time input, `V12` schedule input.

## Frontend pages

### Auth pages

Files: `frontend/src/pages/AuthPage.tsx`, related API client functions in `frontend/src/lib/api.ts`.

Purpose:

- Login.
- Signup.
- Reset password.
- Email verification flow.
- Demo mode entry.

Design rule: login, signup, and reset forms should use the same card width, logo block, tabs, input styling, button hierarchy, and typography. Any future field should reuse the same form classes instead of creating one-off layouts.

### Dashboard

Main file: `frontend/src/App.tsx`; widgets in `frontend/src/components/widgets/`.

Purpose:

- Main customer control center.
- Project/dashboard selector.
- Live telemetry cards.
- Simulate data in demo mode.
- Edit labels/dashboard mode.
- Publish/save changes.

Current direction:

- Keep overview minimal and clean.
- Avoid bloated launch checklist cards.
- Dashboard widgets should feel industrial and premium, not AI-generated.
- Drag and resize are implemented through `react-grid-layout`; drag handle and selected-state styling should remain easy to discover.

Important widgets:

- Gauge / meter / value card.
- Switch / push button / LED.
- Chart.
- GPS map.
- Camera image panel.
- Serial/LCD.
- Time input.
- Schedule input with day and time slots.

Standalone day/date widgets were intentionally removed from the product direction. Keep “Time only” and “Schedule” as the main user input widgets.

### Templates

Main functions: `TemplateLibrary` in `frontend/src/App.tsx`, studio in `frontend/src/pages/TemplateStudioPage.tsx`.

Purpose:

- Create reusable templates.
- Edit board type, datastreams, dashboard widgets, notifications, Arduino code, simulator payloads.
- Apply templates later when creating projects.

Important behavior:

- Template creation button must work in demo and account modes.
- Add virtual pin must work.
- Add widget must work.
- Add notification rule must work.
- Save should not show false “failed” if local/demo save succeeds.
- Templates should not show green active status, because templates are reusable designs, not live deployments.

### Projects

Main function: `ProjectsView` in `frontend/src/App.tsx`.

Purpose:

- Create customer project spaces.
- Select template during project creation.
- Edit/delete projects.
- Show plan capacity.

Important behavior:

- Create project should choose a template, not force template to include project.
- Edit and delete actions should work.
- Delete uses the shared `ConfirmDialog`, not browser `window.confirm`.

### Devices

File: `frontend/src/pages/DevicesPage.tsx`.

Purpose:

- Provision boards.
- Copy telemetry topic.
- Copy device token.
- Regenerate token.
- Edit/delete devices.
- Show Arduino bind block.

Important behavior:

- Copy must work on HTTP test VPS, so use `copyText()` fallback instead of direct `navigator.clipboard`.
- Demo mode token regeneration rotates a local demo token.
- Account mode token regeneration calls the backend and reveals the new one-time token.
- Delete uses `ConfirmDialog`.

### Live Test / Board Test

File: `frontend/src/pages/LiveBoardTestView.tsx` and demo API endpoint `/api/v1/demo/projects/{project_id}/board-test`.

Purpose:

- Verify real ESP32/ESP8266 board connectivity before polishing a customer dashboard.
- Show device online state, MQTT topics, latest telemetry, command topic, and live proof.
- Useful for customer onboarding because it answers “is my board really connected?” separately from dashboard design.

Design direction:

- Keep Live Test simpler than the full dashboard.
- It should prove connection, telemetry, command, ACK, and token correctness.
- Avoid duplicating the dashboard simulator. Simulator is for demo payloads; Live Test is for real board proof.

### Schedules

File: `frontend/src/pages/SchedulesPage.tsx`.

Purpose:

- Fixed backend automation timers.
- Create a command schedule for a device/channel/value/time/recurrence/timezone.
- Delete schedules.

Difference from dashboard schedule widget:

- Side-nav Schedules page is backend automation. It should run even if the browser is closed.
- Dashboard Schedule widget is an input widget for user-controlled day/time values sent to a project/device.

Important behavior:

- Delete uses `ConfirmDialog`.
- Delete button uses the same red hover styling as other delete buttons.
- Schedule form uses premium `SparkSelect` where possible.

### Data History

File: `frontend/src/pages/HistoryPage.tsx`.

Purpose:

- Show telemetry history.
- Filter by project/device/channel.
- Export CSV.

Important behavior:

- Export CSV must create a downloadable CSV blob and trigger an anchor click.
- Keep table/card heights and input styles consistent with the rest of SaaS UI.

### Notifications

Main notification-related UI is in Template Studio and account notification surfaces.

Purpose:

- Template notification rules define reusable alert logic.
- Runtime notification records/browser push are account/tenant level.

Important behavior:

- Add rule in Template Studio must work.
- Future push delivery should be tied to verified accounts and VAPID keys.

### Settings

File: `frontend/src/pages/SettingsPage.tsx`.

Purpose:

- SaaS account summary.
- Email/security basics.
- Browser push opt-in.
- Plan summary.

Direction:

- Show Free, Plus, Pro, Enterprise structure.
- Keep settings short and useful.
- Do not overemphasize map tile provider settings in the main customer settings page unless needed for production/admin.

## Shared frontend utilities and components

### `SparkSelect`

File: `frontend/src/components/SparkSelect.tsx`.

Custom select replacement used to avoid raw browser dropdown UI. It should be used for all visible dropdowns. It includes a hidden native proxy select for accessibility/tests.

### `ConfirmDialog`

File: `frontend/src/components/ConfirmDialog.tsx`.

Premium confirmation modal for destructive actions. Use this everywhere instead of `window.confirm`.

### `copyText`

File: `frontend/src/lib/clipboard.ts`.

Clipboard helper with fallback for HTTP/local VPS testing. Use this for copy actions instead of direct `navigator.clipboard.writeText`.

## Backend overview

Backend folder: `backend/app/`.

Key responsibilities:

- FastAPI app and settings.
- Auth, tenant, plan, and account APIs.
- Projects, devices, dashboards, telemetry, schedules, notifications.
- MQTT adapter/consumer.
- WebSocket realtime updates.
- Worker for schedules, alert evaluation, push delivery, and retention.
- Seed demo data.

Public interface examples:

- REST base path: `/api/v1`.
- Health: `/health/live`, `/health/ready`.
- Realtime WebSocket: `/api/v1/realtime/ws`.
- MQTT telemetry: `spark/v1/{tenant_id}/{device_id}/telemetry/{channel}`.
- MQTT command: `spark/v1/{tenant_id}/{device_id}/command/{channel}`.

## Arduino examples and library direction

Arduino examples live under `examples/arduino/`. The intended library is SparkIoT Arduino Library v1 for ESP32, ESP8266, and common Arduino-compatible boards.

Core firmware flow:

1. Configure WiFi.
2. Configure broker host/port.
3. Configure tenant ID, device ID, device token.
4. Bind virtual pins to callbacks.
5. Publish telemetry with `virtualWrite`.
6. Publish GPS/camera/serial where supported.
7. Receive command messages for switch/push/timer/schedule widgets.
8. ACK commands back to the platform.

## Deployment

The GitHub repo is intended to deploy to a VPS through GitHub Actions.

Expected VPS state:

- Docker and Docker Compose installed.
- Repository checked out under `~/spark-iot`.
- `.env` configured on the VPS.
- Containers run with restart policy.
- Swap enabled on small VPS to avoid hangs.

Important:

- Test VPS IPs are temporary and should not be hardcoded in app logic.
- CORS origins must include current frontend origin for VPS testing.
- Production should use a domain, HTTPS, and locked-down firewall rules.

## Current quality bar

Before claiming a change is complete:

1. Run targeted tests for the changed frontend behavior.
2. Run full frontend tests when practical.
3. Run production build.
4. Search for old patterns such as `window.confirm` and direct visible `navigator.clipboard` calls.
5. Commit changes with a clear message.
6. Push so GitHub Actions can deploy to the VPS.

## Known next improvements

- Replace remaining demo-only persistence with real backend persistence for dashboard inputs and template studio save edge cases.
- Continue simplifying dashboard and settings surfaces to reduce cognitive load.
- Add billing provider later for Free/Plus/Pro/Enterprise.
- Add robust email provider configuration for verification and reset emails.
- Add production-grade map tile provider and video streaming cost strategy later.
- Improve drag handle discoverability for dashboard widgets.
- Add stronger end-to-end browser tests for template creation, widget add, project creation, device provisioning, board test, schedule creation, CSV export, and delete confirmations.
