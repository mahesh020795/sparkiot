# API Overview

REST APIs are versioned under `/api/v1`. OpenAPI is available at `/api/docs`.

Main resources:

- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`
- `/tenant/usage`
- `/projects`
- `/devices`
- `/dashboards/project/{project_id}`
- `/demo/templates`
- `/demo/templates/{template_id}`
- `/telemetry/ingest`
- `/telemetry/projects/{project_id}/latest`
- `/telemetry/devices/{device_id}/history`
- `/notifications`
- `/notifications/push-public-key`
- `/notifications/push-subscriptions`
- `/realtime/ws`

## Demo Template Studio Persistence

The no-login MVP uses demo endpoints so the web dashboard can be tested before full auth is enabled:

- `GET /api/v1/demo/templates` lists the three persisted Starter templates.
- `GET /api/v1/demo/templates/{template_id}` loads one template.
- `PUT /api/v1/demo/templates/{template_id}` saves template name, board, description, datastreams, notification rules, and dashboard widget JSON.

The save payload includes `revision`. If the server revision has changed, the API returns `409` with `stale_template_revision`; the frontend should refresh before saving again.

Errors use HTTP status codes and stable detail codes for plan limits, stale dashboard revisions, and stale template revisions.

## Web Push

Spark IoT stores browser Web Push subscriptions and dispatches push payloads when notifications are created or threshold alerts fire.

- `GET /api/v1/notifications/push-public-key` returns `{ "public_key": "..." }` from `VAPID_PUBLIC_KEY`.
- `POST /api/v1/notifications/push-subscriptions` upserts the authenticated user's subscription endpoint and keys.
- `DELETE /api/v1/notifications/push-subscriptions` removes the authenticated user's subscription endpoint.

Push delivery is enabled only when `VAPID_PRIVATE_KEY`, `VAPID_PUBLIC_KEY`, and `VAPID_SUBJECT` are configured. If VAPID keys are empty, Spark IoT still stores in-app notifications and skips browser delivery safely.
