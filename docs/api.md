# API Overview

REST APIs are versioned under `/api/v1`. OpenAPI is available at `/api/docs`.

Main resources:

- `/auth/register`, `/auth/login`, `/auth/refresh`, `/auth/me`
- `/tenant/usage`
- `/projects`
- `/devices`
- `/dashboards/project/{project_id}`
- `/telemetry/ingest`
- `/telemetry/projects/{project_id}/latest`
- `/telemetry/devices/{device_id}/history`
- `/notifications`
- `/realtime/ws`

Errors use HTTP status codes and stable detail codes for plan limits and stale dashboard revisions.
