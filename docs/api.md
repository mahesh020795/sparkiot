# API Overview

REST APIs are versioned under `/api/v1`. OpenAPI is available at `/api/docs`.

Main resources:

- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`
- `/tenant/usage`
- `/projects`
- `/devices`
- `/dashboards/project/{project_id}`
- `/templates`
- `/templates/{template_id}`
- `/demo/templates`
- `/demo/templates/{template_id}`
- `/demo/devices/{device_id}/history`
- `/demo/devices/{device_id}/history.csv`
- `/telemetry/ingest`
- `/telemetry/projects/{project_id}/latest`
- `/telemetry/devices/{device_id}/history`
- `/notifications`
- `/notifications/push-public-key`
- `/notifications/push-subscriptions`
- `/schedules`
- `/realtime/ws`

## Realtime WebSocket

Dashboards connect to `GET /api/v1/realtime/ws?token={access_token}&project_id={project_id}`. The server validates the access token, confirms the project belongs to the authenticated tenant, then subscribes the browser only to telemetry events for that project.

## Demo Template Studio Persistence

The no-login MVP uses demo endpoints so the web dashboard can be tested before full auth is enabled:

- `GET /api/v1/demo/templates` lists the three persisted Starter templates.
- `GET /api/v1/demo/templates/{template_id}` loads one template.
- `PUT /api/v1/demo/templates/{template_id}` saves template name, board, description, datastreams, notification rules, and dashboard widget JSON.

The save payload includes `revision`. If the server revision has changed, the API returns `409` with `stale_template_revision`; the frontend should refresh before saving again.

Errors use HTTP status codes and stable detail codes for plan limits, stale dashboard revisions, and stale template revisions.

## Account Template Studio Persistence

Signed-in tenants use authenticated template endpoints for real customer projects:

- `GET /api/v1/templates` lists tenant templates.
- `POST /api/v1/templates` creates one template for a project dashboard.
- `GET /api/v1/templates/{template_id}` loads one tenant template.
- `PUT /api/v1/templates/{template_id}` saves template metadata, board, datastreams, notification rules, and dashboard widget JSON.

The payload shape matches the demo Template Studio payload. Spark IoT enforces one template per project and uses `revision` checks on both the template and dashboard. Duplicate project templates return `409` with `template_project_exists`; stale template saves return `409` with `stale_template_revision`.


## Demo History and CSV Export

The no-login dashboard uses demo history endpoints so board telemetry can be inspected without creating an account:

- `GET /api/v1/demo/devices/{device_id}/history` returns the latest 1,000 readings for one demo device.
- `GET /api/v1/demo/devices/{device_id}/history?channel=V0` filters history by virtual pin or channel.
- `GET /api/v1/demo/devices/{device_id}/history.csv` downloads the same data as CSV for reports, FYP logs, and board debugging.

CSV columns are `observed_at`, `server_at`, `device_id`, `channel`, `value`, and `unit`. Object values such as GPS coordinates are JSON-encoded inside the value column.

## Web Push

Spark IoT stores browser Web Push subscriptions and dispatches push payloads when notifications are created or threshold alerts fire.

- `GET /api/v1/notifications` lists in-app notification history for the authenticated tenant user.
- `POST /api/v1/notifications` creates an in-app notification and attempts browser push delivery when VAPID is configured.
- `PATCH /api/v1/notifications/{notification_id}/read` marks one authenticated user's notification as read.
- `GET /api/v1/notifications/push-public-key` returns `{ "public_key": "..." }` from `VAPID_PUBLIC_KEY`.
- `POST /api/v1/notifications/push-subscriptions` upserts the authenticated user's subscription endpoint and keys.
- `DELETE /api/v1/notifications/push-subscriptions` removes the authenticated user's subscription endpoint.

Push delivery is enabled only when `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_SUBJECT` are configured. If VAPID keys are empty, Spark IoT still stores in-app notifications and skips browser delivery safely.

## Schedules

Spark IoT schedule rules provide the Blynk Timer-style automation foundation for time input, day input, and scheduled commands.

- `GET /api/v1/schedules` lists the authenticated tenant's schedules.
- `POST /api/v1/schedules` creates a schedule for one project device channel.

Create payload:

```json
{
  "project_id": "project-irrigation",
  "device_id": "device-irrigation",
  "channel": "V3",
  "value": true,
  "time_of_day": "06:30",
  "recurrence": "mon,wed,fri",
  "timezone": "Asia/Kuala_Lumpur",
  "is_active": true
}
```

`recurrence` accepts `daily`, `weekdays`, `weekends`, or comma-separated day codes: `mon,tue,wed,thu,fri,sat,sun`. The worker checks schedules once per minute, publishes the command to the MQTT command topic, and writes a command log with an idempotency key so the same occurrence is not sent twice.
