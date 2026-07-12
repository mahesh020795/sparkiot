# Spark IoT MVP Design

## Product objective

Spark IoT is a lower-cost, multi-tenant IoT SaaS for Rectronx customers migrating from Blynk, especially students, universities, makers, and small businesses in Southeast Asia. The MVP must be a production-shaped starter that runs locally through Docker Compose, demonstrates the complete device-to-dashboard flow, and remains inexpensive to operate at approximately 100 customers.

The RM25 monthly plan provides one user account, three devices, three separate projects with one dashboard each, 30-day telemetry and GPS retention, and access to every MVP widget. Billing collection is outside the MVP; the database and policy layer retain plan and usage concepts so billing can be added without redesigning authorization.

## Scope

The MVP includes:

- Email/password authentication with access and rotating refresh tokens.
- Tenant-scoped projects, devices, dashboards, plan limits, and usage reporting.
- MQTT and HTTP telemetry ingestion with device tokens and topic authorization.
- Realtime browser updates over authenticated WebSockets.
- A responsive drag-and-drop and resize dashboard builder.
- Gauge, meter, numeric value, LED, text status, push button, switch, slider, chart, GPS map, camera/direct-stream, date, time, day, serial monitor/LCD, battery, and signal widgets.
- Thirty-day telemetry and GPS history with CSV export.
- Browser Web Push notifications using VAPID, plus in-app notification history.
- Threshold rules and a basic schedule model sufficient to demonstrate notifications and commands.
- Demo tenant, user, projects, devices, dashboards, telemetry, and alerts.
- ESP32 and ESP8266 reference examples and a versioned device protocol specification.
- Docker Compose, automated tests, CI, API documentation, operational documentation, and startup validation.

The MVP does not include subscription payment processing, native mobile apps, SMS or WhatsApp, cloud-relayed or recorded video, OTA firmware delivery, team collaboration, white labelling, a published Arduino library, or production-grade geocoding. These are later products or increments.

## Architecture

Spark IoT uses a modular monolith. React and Vite provide the browser application. A single FastAPI deployment contains independently structured modules for identity, tenants, plans, projects, devices, dashboards, telemetry, MQTT, alerts, notifications, and realtime delivery. PostgreSQL is the source of truth. Valkey provides Redis-compatible ephemeral state for caching, queues, rate limits, and cross-process realtime coordination. A worker process runs the same Python package with a distinct entry point for alerts, notifications, and retention jobs.

Eclipse Mosquitto is the default MQTT broker because its EPL/EDL licensing is suitable for this commercial starter. MQTT integration is isolated behind a broker adapter so EMQX can be configured later when Rectronx has an appropriate licence. No EMQX-only feature is required by the domain model.

Docker Compose runs frontend, API, worker, PostgreSQL, Valkey, and Mosquitto containers. A reverse proxy is not required for local development. Production deployment documentation requires TLS termination, secure secrets, off-server backups, monitoring, and a tested restore procedure.

## Module boundaries

- **Identity:** registration, login, logout, password hashing, access tokens, refresh-token families, and current-user resolution.
- **Tenancy and plans:** tenant membership, Starter plan entitlements, limit enforcement, and usage summaries.
- **Projects:** the three customer workspaces and their dashboard ownership.
- **Devices:** device lifecycle, one-time plaintext secret display, hashed secret persistence, online status, and channel metadata.
- **Dashboards:** layouts, widget configuration validation, revision timestamps, and ownership.
- **Telemetry:** normalized readings, latest values, historical queries, batching, CSV export, and retention.
- **Broker integration:** topic parsing, device authentication hooks, MQTT ingestion, commands, acknowledgements, and last-will handling.
- **Realtime:** tenant- and project-authorized WebSocket subscriptions and latest-value events.
- **Alerts and schedules:** threshold evaluation, cooldowns, basic time schedules, command jobs, and durable event records.
- **Notifications:** in-app records, Web Push subscriptions, VAPID delivery, retry policy, and read state.

Modules communicate through explicit service interfaces and domain events, not by importing another module's HTTP route implementation. They share one database and transaction boundary in the MVP.

## Multi-tenancy and authorization

Every tenant-owned table contains `tenant_id`. Project, device, dashboard, telemetry, alert, notification, and push-subscription access always starts from the authenticated tenant context. Repository methods require `tenant_id`; client-supplied identifiers alone never authorize access. Tests must attempt cross-tenant reads, writes, MQTT access, WebSocket subscriptions, and exports.

The Starter policy is one active user, three active devices, three projects, one dashboard per project, and 30-day retention. Limits are enforced within transactions to prevent concurrent requests from exceeding the allowance. Deactivated records do not consume active limits unless explicitly documented by the endpoint.

## Authentication and secrets

Passwords are hashed with Argon2. Access JWTs are short-lived. Opaque refresh tokens rotate on every refresh; only hashes are stored, and reuse revokes the token family. Device secrets are cryptographically random, shown only on creation or regeneration, and stored as hashes. Authentication and token endpoints are rate-limited. Secrets and VAPID keys come from environment variables and never from committed files.

## Device protocol

Each device has a public UUID and secret token. MQTT credentials map the connection to exactly one tenant and device. The version-one namespace is:

```text
spark/v1/{tenant_id}/{device_id}/telemetry/{channel}
spark/v1/{tenant_id}/{device_id}/command/{channel}
spark/v1/{tenant_id}/{device_id}/ack/{channel}
spark/v1/{tenant_id}/{device_id}/status
```

Devices may publish only telemetry, acknowledgement, and status topics in their namespace and subscribe only to their command topics. Telemetry accepts a documented JSON envelope containing value, optional unit, optional device timestamp, quality metadata, and message ID. GPS uses latitude, longitude, optional altitude, speed, heading, and accuracy. Camera telemetry sends snapshot or direct-stream URLs; the SaaS does not relay or record video in the MVP.

The protocol defines reconnect behavior, exponential backoff, keepalive, retained status, last will, message size, rate limits, duplicate message IDs, command acknowledgements, and server timestamps. HTTP ingestion mirrors the same envelope. ESP32 and ESP8266 examples expose patterns that can later become an Arduino library with `begin`, `run`, `virtualWrite`, `onCommand`, `setLocation`, and `setCameraUrl` APIs. Protocol versions remain explicit so future SDKs can preserve compatibility.

## Telemetry and realtime flow

Mosquitto receives a device publication. The API-side broker consumer parses the topic, verifies its device mapping, validates and normalizes the payload, and rejects malformed or oversized messages. Latest values go to Valkey and are broadcast through the realtime service immediately. Historical readings are buffered briefly and inserted into PostgreSQL in batches. Alert evaluation consumes the normalized event without delaying realtime display.

The browser obtains an authenticated WebSocket ticket from the API and subscribes only to authorized project channels. Events carry protocol version, device ID, channel, value, unit, observed timestamp, and server timestamp. The client reconnects with bounded exponential backoff and refetches latest values after reconnect so missed ephemeral events do not leave stale widgets.

Historical storage applies a configurable minimum persistence interval per channel while realtime values can update more frequently. A scheduled retention job deletes readings and GPS points older than the tenant entitlement. PostgreSQL indexes cover tenant, device, channel, and time-range queries.

## Dashboard and widget model

Each project owns one dashboard in the Starter plan. A dashboard stores a revision and validated widget array. Every widget has an ID, type, grid position, dimensions, title, data binding, and type-specific configuration. Layout and data remain separate. Optimistic revision checks prevent silent overwrites.

Normal mode presents a clean monitoring dashboard. Edit mode reveals the widget library, grid guides, drag and resize handles, duplicate/delete actions, and a configuration inspector. Desktop layouts use a 12-column grid; smaller screens render responsive stacked cards. The initial soft limit is ten widgets per dashboard, enforced as a plan policy that can be changed later.

Apache ECharts renders charts, gauges, and meters. Leaflet renders GPS maps. The map tile URL and attribution are runtime configuration, not hard-coded, because public OpenStreetMap tiles are not an SLA-backed commercial service. Lucide supplies consistent professional SVG icons.

## Visual design

The approved direction is the Spark IoT Control Center shown in the visual companion. It uses a clean light canvas, white cards, subtle borders and shadows, deep navy text, neutral grey navigation, status green, data blue and purple, and Rectronx orange as a restrained primary accent. It must feel familiar to Blynk users through clear device status, project dashboards, and direct controls without copying Blynk branding or layout.

The persistent sidebar contains Overview, Projects, Devices, Notifications, Data History, and Settings. The dashboard header contains project context, freshness, online device status, export, and Edit Dashboard. Cards prioritize readable units, freshness, state, and control feedback. Emoji and improvised symbols are prohibited in the product UI; Lucide icons and purpose-built ECharts graphics are used instead.

Authentication pages use the same visual language with concise Rectronx/Spark IoT branding. Empty, loading, disconnected, stale, permission-denied, and error states are intentionally designed rather than left as raw messages.

## GPS, camera, and maps

GPS widgets show current location, last update time, accuracy when available, and a recent trail within the 30-day entitlement. Queries are bounded by time and point count, and the UI simplifies dense trails. Geofencing is deferred.

The camera widget safely displays a configured snapshot or direct-stream URL. It includes refresh, stale/offline, unavailable, and mixed-content guidance. Direct ESP32-CAM streaming may require the customer to provide secure network reachability. Cloud relay, transcoding, recording, and storage are deferred pending a separate cost study of WebRTC, MJPEG/HLS, object storage, egress, and CDN choices.

## Notifications and automation

Users opt in to browser notifications. The server stores endpoint and encrypted subscription keys scoped to the user and tenant. Threshold rules compare normalized numeric values with a configured operator and threshold. Cooldowns prevent notification floods. Each trigger creates a durable in-app notification and queues a Web Push attempt. Failed or expired subscriptions are handled without failing telemetry ingestion.

Basic schedules store tenant timezone, execution time, recurrence, target device channel, and command value. The worker uses an idempotency key per occurrence to prevent duplicate commands. Advanced rule composition is deferred.

## API and errors

REST endpoints are versioned under `/api/v1`. FastAPI exposes OpenAPI documentation. List endpoints use bounded pagination. Validation errors use a consistent envelope containing code, message, field details, and request ID. Domain conflicts such as plan limits, stale dashboard revisions, duplicate emails, and offline commands receive stable machine-readable codes.

External work is never performed inside a database transaction. MQTT, push, and worker failures use bounded retries with jitter where safe. Operations use idempotency keys where duplicates would cause a visible side effect. Logs are structured and include request/job identifiers but exclude passwords, tokens, push keys, and sensitive payloads.

## Testing and quality

Backend tests cover authentication, refresh rotation and reuse, tenant isolation, limits, device-token lifecycle, topic authorization, telemetry validation and deduplication, history, retention, alerts, schedules, WebSocket authorization, and push-subscription lifecycle. Integration tests use PostgreSQL and Valkey-compatible services rather than replacing core persistence behavior with mocks.

Frontend tests cover authentication flows, project and device management, widget configuration validation, edit interactions, responsive rendering, realtime updates, reconnect behavior, error states, and accessibility-critical controls. One end-to-end smoke test signs in with seeded credentials, opens a dashboard, publishes demo telemetry, observes the realtime update, sends a command, and creates a notification.

CI runs backend formatting, linting, type checking, tests, migration checks, frontend formatting, linting, type checking, tests, and production builds. Docker images use non-root runtime users, health checks, pinned dependency lock files, and minimal production stages.

## Operations and maintenance

The repository includes `.env.example`, local startup and reset commands, demo credentials, migration and seed commands, API and MQTT protocol documentation, backup and restore instructions, production checklist, upgrade guidance, and troubleshooting. Health endpoints distinguish liveness from readiness. Docker Compose uses persistent development volumes and dependency health conditions.

Production readiness requires HTTPS, randomly generated secrets, an external backup location, restoration testing, alerting, domain and transactional email setup, a commercial-safe map tile arrangement, privacy and acceptable-use documents, dependency patching, and load testing. The starter must state these requirements rather than implying Docker Compose alone provides a complete production environment.

## Cost and scaling posture

At approximately 100 Starter customers, the upper bound is 100 users, 300 devices, and 300 dashboards. Realtime updates are not all persisted; channel logging intervals, batching, rate limits, payload limits, and 30-day retention control storage and write load. Camera relay is excluded to prevent unpredictable bandwidth expense. The initial deployment can run on one VPS, while PostgreSQL backups are stored off-server.

The broker adapter, worker entry point, event interfaces, and realtime abstraction define the future extraction seams. A component becomes a separate service only when measured load, failure isolation, or team ownership justifies the operational cost.

## Acceptance criteria

The delivered artifact is accepted when a clean machine with Docker can copy `.env.example`, start the Compose stack, pass health checks, run migrations and seed data, sign in using documented demo credentials, view all initial widget types, manage devices and projects within plan limits, publish MQTT demo telemetry, see it update over WebSocket, retrieve history, display a GPS trail and camera URL, send a device command, create and observe a notification, access OpenAPI docs, and run the automated verification suite successfully.
