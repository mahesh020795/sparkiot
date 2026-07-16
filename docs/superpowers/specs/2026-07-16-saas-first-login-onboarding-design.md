# Spark IoT SaaS First-Login Onboarding Design

## Purpose

Turn Spark IoT from a demo-style app into a real SaaS onboarding flow where a new customer can register, verify email, land in a clean starter workspace, and connect their first ESP32/ESP8266 board without confusion.

The first-login experience must not feel empty or broken. It also must not pretend the customer already has a project, device, or live dashboard. The correct experience is an empty-but-guided workspace.

## Customer flow

1. Customer visits `sparkiot.com`.
2. Customer clicks `Start Free Trial`.
3. Customer registers an account.
4. Customer verifies email.
5. Spark IoT creates a workspace automatically.
6. Customer lands on a Starter Workspace page.
7. Quick Start Wizard guides setup.
8. Customer creates first project.
9. Customer chooses board/template.
10. Customer configures datastreams.
11. Customer adds/provisions device.
12. Spark IoT generates Arduino code.
13. Customer uploads code to board.
14. Board connects via MQTT/HTTP.
15. Dashboard becomes live.

## First-login landing state

After email verification, the backend should create:

- Tenant/workspace.
- Starter plan subscription record.
- Owner membership.
- User profile.
- Onboarding progress state.

It should not create a real project, device, dashboard, or template until the customer chooses setup details.

The frontend should show a Starter Workspace page with:

- Welcome header: `Welcome to Spark IoT`.
- Clear promise: `Connect your first board in under 5 minutes`.
- Empty dashboard preview: `No live dashboard yet`.
- Primary call to action: `Create first project`.
- Secondary call to action: `View demo dashboard`.
- Quick Start checklist:
  - Create project.
  - Choose board.
  - Add datastreams.
  - Add device.
  - Generate Arduino code.
  - Connect board.
  - View live dashboard.

## Demo dashboard behavior

The demo dashboard remains available but must be clearly marked as demo data. It should never be mistaken for the customer's real workspace.

Recommended labels:

- `Demo dashboard`
- `Simulated telemetry`
- `Try before connecting hardware`

When the customer creates a real project, the app should route them back to their real workspace/dashboard.

## Quick Start Wizard behavior

The wizard should be the central onboarding path.

### Step 1: Project

Customer enters:

- Project name.
- Use case/category, such as Smart Irrigation, Smart Home, Energy Monitor, GPS Tracker, ESP32-CAM.

System creates:

- Project record.
- Empty dashboard shell tied to the project.

### Step 2: Board/template

Customer chooses:

- ESP32.
- ESP8266 / NodeMCU.
- Arduino WiFi-capable board.
- Custom MQTT device.

System suggests a template based on the chosen use case and board.

### Step 3: Datastreams

Customer confirms or edits virtual pins/datastreams:

- Name.
- Pin/channel, such as V0, V1, V2.
- Type: integer, float, string, boolean, GPS, camera URL.
- Unit.
- Minimum value.
- Maximum value.

### Step 4: Device

System creates:

- Device ID.
- Device token shown once.
- MQTT telemetry and command topics.

### Step 5: Arduino code

System generates board-specific Arduino IDE code using:

- WiFi SSID/password placeholders.
- Device token.
- MQTT host/port.
- Tenant ID.
- Device ID.
- Datastream pins.
- Command handlers for switches/buttons.

### Step 6: Live proof

Customer uploads code and opens Live Board Test.

System shows:

- Connection status.
- Latest telemetry.
- Serial/log events.
- Command test buttons.
- Dashboard live confirmation.

## UX principles

- Do not show a fake real dashboard on first login.
- Do not leave the user staring at a blank page.
- Always show one obvious next action.
- Keep Overview clean and calm; move detailed setup into Quick Start Wizard.
- Use consistent SaaS language: workspace, project, template, device, datastream, dashboard.
- Demo data must be visibly separated from customer data.
- Starter limits should be visible but not noisy:
  - 1 user.
  - 3 projects.
  - 3 devices.
  - 30-day data history.

## Backend requirements

- Store email verification status.
- Store onboarding progress per tenant/user.
- Return first-login state to frontend.
- Create workspace after signup.
- Gate app access if email is unverified, while allowing resend verification.
- Keep demo endpoints separate from customer-owned tenant data.

## Frontend requirements

- Add first-login Starter Workspace state.
- Add email verification pending screen.
- Add Quick Start Wizard entry point.
- Add empty dashboard preview.
- Add demo dashboard CTA.
- Ensure Overview stays minimal.

## Testing requirements

- Signup creates user, tenant, membership, starter plan, and onboarding state.
- Unverified user sees verification pending state.
- Verified new user sees Starter Workspace, not demo dashboard by default.
- Starter Workspace shows `Create first project` and `View demo dashboard`.
- Creating first project advances onboarding state.
- Demo dashboard remains accessible but clearly labelled.

## Out of scope for this iteration

- Paid billing checkout.
- Full SMTP deliverability optimization.
- Mobile app onboarding.
- Advanced project templates marketplace.
- Team invitations.

## Implementation recommendation

Build this in two small releases:

1. Email verification plus first-login Starter Workspace.
2. Quick Start Wizard that creates project, template/datastreams, device token, and generated Arduino code.

This avoids mixing account trust, onboarding UX, hardware provisioning, and live telemetry into one risky change.
