# SaaS First-Login Onboarding Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the real Spark IoT first-login SaaS flow: signup creates a guided starter workspace, email verification gates production use, and new users land on a clean Starter Workspace instead of a fake live dashboard.

**Architecture:** Keep the modular monolith shape. Add tenant/user onboarding and email verification state to the FastAPI domain model and expose small `/api/v1/auth/*` and `/api/v1/onboarding/*` interfaces. The React app decides whether to show verification pending, starter workspace, demo dashboard, or real dashboard from authenticated user/onboarding/project state.

**Tech Stack:** FastAPI, SQLAlchemy, Pydantic, Argon2/JWT auth, React/Vite/TypeScript, Vitest, pytest, Docker Compose, GitHub Actions deployment to VPS.

## Global Constraints

- New SaaS users must not be routed to simulated demo dashboard by default.
- New SaaS users must not see a blank empty page after signup.
- First-login state is `empty but guided`: workspace exists, project/device/dashboard do not exist until chosen.
- Email verification must be represented in backend state before public SaaS use.
- Demo dashboard remains available as an intentional preview and must be clearly labelled.
- Starter plan limits remain: 1 user, 3 projects, 3 devices, 30-day data history.
- Use existing app styling conventions and avoid creating a visually noisy Overview page.
- No billing checkout, mobile onboarding, or team invitation work in this iteration.

---

## File Structure

- Modify `backend/app/models/domain.py`: add `email_verified_at` to `User`; add `EmailVerificationToken`; add `OnboardingState`.
- Modify `backend/app/schemas/api.py`: add user verification fields plus onboarding response/update schemas.
- Modify `backend/app/api/routes/auth.py`: create verification token on register, expose verify/resend endpoints, include verification state in `/auth/me`.
- Create `backend/app/api/routes/onboarding.py`: expose current onboarding state and step update endpoint.
- Modify `backend/app/api/router.py`: include onboarding router.
- Modify `backend/tests/test_core.py`: cover signup verification token, email verification, onboarding state, and first-login response.
- Modify `frontend/src/lib/types.ts`: add `UserProfile` and `OnboardingState` types.
- Modify `frontend/src/lib/api.ts`: add verification and onboarding client methods; update `me()` return type.
- Modify `frontend/src/App.tsx`: add first-login routing logic and Starter Workspace page state.
- Create `frontend/src/pages/StarterWorkspacePage.tsx`: clean guided landing page for verified users with no projects.
- Create `frontend/src/pages/VerifyEmailPage.tsx`: verification pending screen with token testing field and resend action.
- Modify `frontend/src/pages/LoginPage.tsx`: after register, surface verification-pending intent through existing login callback state.
- Modify `frontend/src/App.test.tsx`: add onboarding UI tests.
- Modify `frontend/src/styles/app.css`: add clean Starter Workspace and verification screen styles.
- Modify `README.md`: document SaaS onboarding flow and MVP verification token behavior.

---

### Task 1: Backend Email Verification and Onboarding State

**Files:**
- Modify: `backend/app/models/domain.py`
- Modify: `backend/app/schemas/api.py`
- Modify: `backend/app/api/routes/auth.py`
- Create: `backend/app/api/routes/onboarding.py`
- Modify: `backend/app/api/router.py`
- Test: `backend/tests/test_core.py`

**Interfaces:**
- Produces: `User.email_verified_at: datetime | None`
- Produces: `EmailVerificationToken(user_id, token_hash, expires_at, used_at)`
- Produces: `OnboardingState(tenant_id, user_id, current_step, completed_steps, demo_viewed, first_project_id)`
- Produces: `GET /api/v1/onboarding` returning `OnboardingResponse`
- Produces: `PATCH /api/v1/onboarding` accepting `OnboardingUpdate`
- Produces: `POST /api/v1/auth/email-verification/resend` returning `StatusResponse`
- Produces: `POST /api/v1/auth/email-verification/confirm` accepting `{ token }` and returning `StatusResponse`
- Consumes: existing `refresh_token_digest()`, `issue_refresh_token()`, `current_user`, `get_db`

- [ ] **Step 1: Write failing backend tests**

Add these tests to `backend/tests/test_core.py`:

```python
def test_register_creates_unverified_user_email_token_and_onboarding_state(db):
    response = register(RegisterRequest(
        tenant_name="Acme Farm",
        full_name="Acme Owner",
        email="owner@acme.test",
        password="SparkDemo123!",
    ), db)
    assert response.access_token

    user = db.scalar(select(User).where(User.email == "owner@acme.test"))
    assert user is not None
    assert user.email_verified_at is None

    token = db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.user_id == user.id))
    assert token is not None
    assert token.used_at is None
    assert len(token.token_hash) == 64

    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    assert state is not None
    assert state.current_step == "verify_email"
    assert state.completed_steps == []
    assert state.demo_viewed is False
    assert state.first_project_id is None


def test_email_verification_confirms_user_and_advances_onboarding(db):
    register_response = register(RegisterRequest(
        tenant_name="Acme Farm",
        full_name="Acme Owner",
        email="verify@acme.test",
        password="SparkDemo123!",
    ), db)
    user = db.scalar(select(User).where(User.email == "verify@acme.test"))
    resend_response = resend_email_verification(user=user, db=db)

    assert resend_response.verification_token
    confirm_response = confirm_email_verification(EmailVerificationConfirmRequest(token=resend_response.verification_token), db=db)
    assert confirm_response.status == "ok"

    db.refresh(user)
    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    assert user.email_verified_at is not None
    assert state.current_step == "starter_workspace"
    assert "verify_email" in state.completed_steps

    me_response = me(user=user)
    assert me_response.email_verified is True
    assert me_response.onboarding_step == "starter_workspace"
    assert register_response.access_token


def test_onboarding_state_can_mark_demo_viewed_and_first_project(db):
    register(RegisterRequest(
        tenant_name="Lab",
        full_name="Lab Owner",
        email="lab@example.test",
        password="SparkDemo123!",
    ), db)
    user = db.scalar(select(User).where(User.email == "lab@example.test"))
    confirm = resend_email_verification(user=user, db=db)
    confirm_email_verification(EmailVerificationConfirmRequest(token=confirm.verification_token), db=db)

    updated = update_onboarding(OnboardingUpdate(
        current_step="project",
        completed_steps=["verify_email", "starter_workspace"],
        demo_viewed=True,
        first_project_id="project-123",
    ), user=user, db=db)

    assert updated.current_step == "project"
    assert updated.demo_viewed is True
    assert updated.first_project_id == "project-123"
```

Also update imports in `backend/tests/test_core.py`:

```python
from app.api.routes.auth import confirm_email_verification, me, register, resend_email_verification
from app.api.routes.onboarding import get_onboarding, update_onboarding
from app.models.domain import EmailVerificationToken, OnboardingState, User
from app.schemas.api import EmailVerificationConfirmRequest, OnboardingUpdate, RegisterRequest
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
py -3 -m pytest backend/tests/test_core.py -q
```

Expected: FAIL with import errors for `EmailVerificationToken`, `OnboardingState`, `EmailVerificationConfirmRequest`, `OnboardingUpdate`, `resend_email_verification`, and `confirm_email_verification`.

- [ ] **Step 3: Add backend models**

Add to `backend/app/models/domain.py`:

```python
class EmailVerificationToken(Base):
    __tablename__ = "email_verification_tokens"
    __table_args__ = (Index("ix_email_verification_tokens_user_expires", "user_id", "expires_at"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)


class OnboardingState(Base):
    __tablename__ = "onboarding_states"
    __table_args__ = (UniqueConstraint("tenant_id", "user_id", name="uq_onboarding_state_per_user"),)
    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    tenant_id: Mapped[str] = mapped_column(String(36), ForeignKey("tenants.id"), nullable=False)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False)
    current_step: Mapped[str] = mapped_column(String(80), default="verify_email", nullable=False)
    completed_steps: Mapped[list] = mapped_column(JSON, default=list)
    demo_viewed: Mapped[bool] = mapped_column(Boolean, default=False)
    first_project_id: Mapped[str | None] = mapped_column(String(36), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=now_utc)
```

Add this column to `User`:

```python
email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
```

- [ ] **Step 4: Add schemas**

Modify `backend/app/schemas/api.py`:

```python
class EmailVerificationConfirmRequest(BaseModel):
    token: str = Field(min_length=24, max_length=256)


class StatusResponse(BaseModel):
    status: str = "ok"
    message: str
    reset_token: str | None = None
    verification_token: str | None = None


class UserResponse(BaseModel):
    id: str
    tenant_id: str
    email: str
    full_name: str
    plan_code: str
    email_verified: bool
    onboarding_step: str


class OnboardingResponse(BaseModel):
    current_step: str
    completed_steps: list[str]
    demo_viewed: bool
    first_project_id: str | None = None


class OnboardingUpdate(BaseModel):
    current_step: str = Field(min_length=2, max_length=80)
    completed_steps: list[str] = Field(default_factory=list, max_length=20)
    demo_viewed: bool = False
    first_project_id: str | None = None
```

- [ ] **Step 5: Add auth verification logic**

Modify `backend/app/api/routes/auth.py` imports:

```python
from app.models.domain import EmailVerificationToken, Notification, OnboardingState, PasswordResetToken, RefreshToken, Tenant, User
from app.schemas.api import EmailVerificationConfirmRequest, LoginRequest, PasswordResetConfirmRequest, PasswordResetRequest, RegisterRequest, StatusResponse, TokenResponse, UserResponse
```

Add helper:

```python
def _create_email_verification(db: Session, user: User) -> str:
    raw_token = issue_refresh_token()
    db.add(EmailVerificationToken(
        user_id=user.id,
        token_hash=refresh_token_digest(raw_token),
        expires_at=datetime.now(UTC) + timedelta(hours=24),
    ))
    return raw_token
```

In `register()`, after `db.flush()` for user:

```python
verification_token = _create_email_verification(db, user)
db.add(OnboardingState(
    tenant_id=tenant.id,
    user_id=user.id,
    current_step="verify_email",
    completed_steps=[],
    demo_viewed=False,
))
```

Change the register return to:

```python
tokens = _token_pair(db, user)
tokens.verification_token = verification_token
return tokens
```

If `TokenResponse` is kept strict without `verification_token`, instead return verification token only through resend endpoint and keep this note out of register. The preferred implementation is to add `verification_token: str | None = None` to `TokenResponse` for MVP testing.

Add endpoints:

```python
@router.post("/email-verification/resend", response_model=StatusResponse)
def resend_email_verification(user: User = Depends(current_user), db: Session = Depends(get_db)):
    if user.email_verified_at is not None:
        return StatusResponse(message="Email is already verified.")
    raw_token = _create_email_verification(db, user)
    db.add(Notification(
        tenant_id=user.tenant_id,
        user_id=user.id,
        title="Email verification requested",
        body="Use the latest verification token within 24 hours.",
    ))
    db.commit()
    return StatusResponse(message="Verification instructions are ready.", verification_token=raw_token)


@router.post("/email-verification/confirm", response_model=StatusResponse)
def confirm_email_verification(payload: EmailVerificationConfirmRequest, db: Session = Depends(get_db)):
    record = db.scalar(select(EmailVerificationToken).where(EmailVerificationToken.token_hash == refresh_token_digest(payload.token)))
    now = datetime.now(UTC)
    if not record or record.used_at is not None or record.expires_at.replace(tzinfo=UTC) < now:
        raise HTTPException(status_code=400, detail={"code": "invalid_verification_token", "message": "Verification token is invalid or expired"})
    user = db.get(User, record.user_id)
    if not user or not user.is_active:
        raise HTTPException(status_code=400, detail={"code": "invalid_verification_token", "message": "Verification token is invalid or expired"})
    user.email_verified_at = now
    record.used_at = now
    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    if state:
        state.current_step = "starter_workspace"
        state.completed_steps = sorted(set([*state.completed_steps, "verify_email"]))
        state.updated_at = now
    db.add(Notification(
        tenant_id=user.tenant_id,
        user_id=user.id,
        title="Email verified",
        body="Your Spark IoT workspace is ready. Create your first project to connect a board.",
    ))
    db.commit()
    return StatusResponse(message="Email verified. Your Starter Workspace is ready.")
```

Update `me()`:

```python
state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
return UserResponse(
    id=user.id,
    tenant_id=user.tenant_id,
    email=user.email,
    full_name=user.full_name,
    plan_code=user.tenant.plan_code,
    email_verified=user.email_verified_at is not None,
    onboarding_step=state.current_step if state else "starter_workspace",
)
```

Change `me` signature to include `db: Session = Depends(get_db)`.

- [ ] **Step 6: Add onboarding route**

Create `backend/app/api/routes/onboarding.py`:

```python
from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import current_user
from app.core.database import get_db
from app.models.domain import OnboardingState, User
from app.schemas.api import OnboardingResponse, OnboardingUpdate

router = APIRouter(prefix="/onboarding", tags=["onboarding"])


def _ensure_state(db: Session, user: User) -> OnboardingState:
    state = db.scalar(select(OnboardingState).where(OnboardingState.user_id == user.id))
    if state:
        return state
    state = OnboardingState(
        tenant_id=user.tenant_id,
        user_id=user.id,
        current_step="starter_workspace" if user.email_verified_at else "verify_email",
        completed_steps=["verify_email"] if user.email_verified_at else [],
        demo_viewed=False,
    )
    db.add(state)
    db.commit()
    db.refresh(state)
    return state


@router.get("", response_model=OnboardingResponse)
def get_onboarding(user: User = Depends(current_user), db: Session = Depends(get_db)):
    state = _ensure_state(db, user)
    return OnboardingResponse(
        current_step=state.current_step,
        completed_steps=state.completed_steps,
        demo_viewed=state.demo_viewed,
        first_project_id=state.first_project_id,
    )


@router.patch("", response_model=OnboardingResponse)
def update_onboarding(payload: OnboardingUpdate, user: User = Depends(current_user), db: Session = Depends(get_db)):
    state = _ensure_state(db, user)
    state.current_step = payload.current_step
    state.completed_steps = payload.completed_steps
    state.demo_viewed = payload.demo_viewed
    state.first_project_id = payload.first_project_id
    state.updated_at = datetime.now(UTC)
    db.commit()
    db.refresh(state)
    return OnboardingResponse(
        current_step=state.current_step,
        completed_steps=state.completed_steps,
        demo_viewed=state.demo_viewed,
        first_project_id=state.first_project_id,
    )
```

In `backend/app/api/router.py`, include:

```python
from app.api.routes import onboarding
api_router.include_router(onboarding.router)
```

- [ ] **Step 7: Run backend tests**

Run:

```powershell
py -3 -m pytest backend/tests/test_core.py -q
```

Expected: PASS.

- [ ] **Step 8: Commit backend**

```powershell
git add backend/app backend/tests/test_core.py
git commit -m "feat: add email verification onboarding state"
```

---

### Task 2: Frontend Verification Pending and Starter Workspace

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Modify: `frontend/src/lib/api.ts`
- Create: `frontend/src/pages/VerifyEmailPage.tsx`
- Create: `frontend/src/pages/StarterWorkspacePage.tsx`
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/styles/app.css`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: `api.me(): Promise<UserProfile>`
- Consumes: `api.onboarding(): Promise<OnboardingState>`
- Consumes: `api.resendEmailVerification(): Promise<StatusResponse>`
- Consumes: `api.confirmEmailVerification(token): Promise<StatusResponse>`
- Produces: `VerifyEmailPage({ onVerified, onPreviewDemo, onLogout })`
- Produces: `StarterWorkspacePage({ user, onCreateProject, onPreviewDemo, onOpenSetupFlow })`

- [ ] **Step 1: Write failing frontend tests**

Add to `frontend/src/App.test.tsx`:

```tsx
it("shows verification pending after signup before the SaaS workspace", async () => {
  localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
  vi.spyOn(api, "me").mockResolvedValue({
    full_name: "Acme Owner",
    email: "owner@acme.test",
    tenant_id: "tenant-1",
    plan_code: "starter",
    email_verified: false,
    onboarding_step: "verify_email",
  });
  vi.spyOn(api, "onboarding").mockResolvedValue({
    current_step: "verify_email",
    completed_steps: [],
    demo_viewed: false,
    first_project_id: null,
  });

  render(<App />);

  expect(await screen.findByText(/Verify your email/i)).toBeInTheDocument();
  expect(screen.getByText(/owner@acme.test/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /View demo dashboard/i })).toBeInTheDocument();
});


it("shows starter workspace for verified users with no projects", async () => {
  localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
  vi.spyOn(api, "me").mockResolvedValue({
    full_name: "Acme Owner",
    email: "owner@acme.test",
    tenant_id: "tenant-1",
    plan_code: "starter",
    email_verified: true,
    onboarding_step: "starter_workspace",
  });
  vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
  vi.spyOn(api, "projects").mockResolvedValue([]);
  vi.spyOn(api, "devices").mockResolvedValue([]);
  vi.spyOn(api, "templates").mockResolvedValue([]);
  vi.spyOn(api, "onboarding").mockResolvedValue({
    current_step: "starter_workspace",
    completed_steps: ["verify_email"],
    demo_viewed: false,
    first_project_id: null,
  });

  render(<App />);

  expect(await screen.findByText(/Welcome to Spark IoT/i)).toBeInTheDocument();
  expect(screen.getByText(/No live dashboard yet/i)).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /Create first project/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /View demo dashboard/i })).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm --dir frontend test -- --run frontend/src/App.test.tsx
```

Expected: FAIL because `api.onboarding`, verification fields, and new pages do not exist.

- [ ] **Step 3: Add frontend types and API methods**

Modify `frontend/src/lib/types.ts`:

```ts
export type UserProfile = {
  id?: string;
  tenant_id: string;
  email: string;
  full_name: string;
  plan_code: string;
  email_verified: boolean;
  onboarding_step: string;
};

export type OnboardingState = {
  current_step: string;
  completed_steps: string[];
  demo_viewed: boolean;
  first_project_id?: string | null;
};

export type StatusResponse = {
  status: string;
  message: string;
  reset_token?: string;
  verification_token?: string;
};
```

Modify `frontend/src/lib/api.ts` import:

```ts
import type { CommandLogItem, Dashboard, Device, DeviceCreate, DeviceTemplate, LiveBoardTestPayload, NotificationItem, OnboardingState, Project, ProjectCreate, ScheduleCreate, ScheduleItem, StatusResponse, Telemetry, UserProfile } from "./types";
```

Add methods:

```ts
me: () => request<UserProfile>("/auth/me"),
resendEmailVerification: () => request<StatusResponse>("/auth/email-verification/resend", { method: "POST" }),
confirmEmailVerification: (token: string) => request<StatusResponse>("/auth/email-verification/confirm", { method: "POST", body: JSON.stringify({ token }) }),
onboarding: () => request<OnboardingState>("/onboarding"),
updateOnboarding: (state: OnboardingState) => request<OnboardingState>("/onboarding", { method: "PATCH", body: JSON.stringify(state) }),
```

Replace the existing `me` method with the typed version above.

- [ ] **Step 4: Add VerifyEmailPage**

Create `frontend/src/pages/VerifyEmailPage.tsx`:

```tsx
import { CheckCircle2, LogOut, Mail, PlayCircle, RefreshCcw } from "lucide-react";
import { useState } from "react";
import { api } from "../lib/api";
import type { UserProfile } from "../lib/types";

export function VerifyEmailPage({
  user,
  onVerified,
  onPreviewDemo,
  onLogout,
}: {
  user: UserProfile | null;
  onVerified: () => void;
  onPreviewDemo: () => void;
  onLogout: () => void;
}) {
  const [token, setToken] = useState("");
  const [message, setMessage] = useState("");
  const [state, setState] = useState<"idle" | "loading" | "success" | "error">("idle");

  async function resend() {
    setState("loading");
    setMessage("");
    try {
      const response = await api.resendEmailVerification();
      setToken(response.verification_token ?? "");
      setMessage(response.verification_token ? "Verification token ready for MVP testing." : response.message);
      setState("success");
    } catch {
      setMessage("Could not prepare verification token. Check API connection.");
      setState("error");
    }
  }

  async function confirm() {
    setState("loading");
    setMessage("");
    try {
      const response = await api.confirmEmailVerification(token.trim());
      setMessage(response.message);
      setState("success");
      onVerified();
    } catch {
      setMessage("Verification failed. Use the latest token.");
      setState("error");
    }
  }

  return (
    <main className="onboarding-screen">
      <section className="onboarding-card verify-card">
        <span className="onboarding-icon"><Mail size={24} /></span>
        <span className="section-kicker">Secure workspace setup</span>
        <h1>Verify your email</h1>
        <p>We created your Spark IoT Starter workspace for <strong>{user?.email}</strong>. Verify the email before creating production projects and device tokens.</p>
        <div className="verify-token-row">
          <input aria-label="Verification token" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Paste verification token" />
          <button className="primary" type="button" onClick={() => void confirm()} disabled={!token.trim() || state === "loading"}><CheckCircle2 size={16} /> Verify</button>
        </div>
        {message && <p className={state === "error" ? "error" : "success"}>{message}</p>}
        <div className="onboarding-actions">
          <button type="button" onClick={() => void resend()} disabled={state === "loading"}><RefreshCcw size={16} /> Resend token</button>
          <button type="button" onClick={onPreviewDemo}><PlayCircle size={16} /> View demo dashboard</button>
          <button type="button" onClick={onLogout}><LogOut size={16} /> Sign out</button>
        </div>
      </section>
    </main>
  );
}
```

- [ ] **Step 5: Add StarterWorkspacePage**

Create `frontend/src/pages/StarterWorkspacePage.tsx`:

```tsx
import { ArrowRight, BarChart3, Cpu, Gauge, LayoutDashboard, PlayCircle, Rocket, ShieldCheck } from "lucide-react";
import type { UserProfile } from "../lib/types";

const steps = [
  ["Create project", "Name the customer project and use case."],
  ["Choose board", "ESP32, ESP8266, Arduino or custom MQTT."],
  ["Add datastreams", "Map V pins, types, units and limits."],
  ["Add device", "Generate secure device ID and token."],
  ["Generate Arduino code", "Compile-ready sketch with MQTT topics."],
  ["Connect board", "Live proof through telemetry and commands."],
  ["View live dashboard", "Widgets become real once data arrives."],
];

export function StarterWorkspacePage({
  user,
  onCreateProject,
  onPreviewDemo,
  onOpenSetupFlow,
}: {
  user: UserProfile | null;
  onCreateProject: () => void;
  onPreviewDemo: () => void;
  onOpenSetupFlow: () => void;
}) {
  return (
    <main className="starter-workspace">
      <section className="starter-hero">
        <div>
          <span className="section-kicker">Starter workspace ready</span>
          <h1>Welcome to Spark IoT{user?.full_name ? `, ${user.full_name.split(" ")[0]}` : ""}</h1>
          <p>Connect your first board in under 5 minutes. Your workspace is ready, but no real project, device or dashboard has been created yet.</p>
          <div className="starter-actions">
            <button className="primary" type="button" onClick={onCreateProject}><Rocket size={17} /> Create first project</button>
            <button type="button" onClick={onPreviewDemo}><PlayCircle size={17} /> View demo dashboard</button>
          </div>
        </div>
        <aside className="starter-empty-preview">
          <LayoutDashboard size={30} />
          <h2>No live dashboard yet</h2>
          <p>Create your first project to generate widgets, datastreams and Arduino-ready device code.</p>
        </aside>
      </section>

      <section className="starter-grid">
        <article className="starter-panel">
          <div className="starter-panel-heading"><Gauge size={18} /><span>Quick Start Wizard</span></div>
          <ol className="starter-step-list">
            {steps.map(([title, detail], index) => (
              <li key={title}>
                <strong>{index + 1}. {title}</strong>
                <span>{detail}</span>
              </li>
            ))}
          </ol>
          <button type="button" className="starter-link-button" onClick={onOpenSetupFlow}>Open setup flow <ArrowRight size={16} /></button>
        </article>
        <article className="starter-panel compact">
          <div className="starter-panel-heading"><ShieldCheck size={18} /><span>Starter limits</span></div>
          <p>1 user, 3 projects, 3 devices, GPS, camera, push-ready notifications and 30-day data history.</p>
        </article>
        <article className="starter-panel compact">
          <div className="starter-panel-heading"><Cpu size={18} /><span>Board ready</span></div>
          <p>Generate code for ESP32, NodeMCU ESP8266 and Arduino-compatible WiFi boards from the selected template.</p>
        </article>
        <article className="starter-panel compact">
          <div className="starter-panel-heading"><BarChart3 size={18} /><span>Demo available</span></div>
          <p>Preview Spark IoT with simulated telemetry anytime, clearly separated from customer-owned data.</p>
        </article>
      </section>
    </main>
  );
}
```

- [ ] **Step 6: Wire App routing**

Modify `frontend/src/App.tsx`:

```tsx
import { StarterWorkspacePage } from "./pages/StarterWorkspacePage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import type { OnboardingState, UserProfile } from "./lib/types";
```

Add state:

```tsx
const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
const [demoPreviewMode, setDemoPreviewMode] = useState(false);
```

Inside the authenticated data load effect, fetch:

```tsx
const [me, onboardingState] = await Promise.all([api.me(), api.onboarding()]);
setUserProfile(me);
setOnboarding(onboardingState);
```

Before the main app shell return, add:

```tsx
if (session && userProfile && !userProfile.email_verified && !demoPreviewMode) {
  return (
    <VerifyEmailPage
      user={userProfile}
      onVerified={() => {
        void refreshAccountData();
      }}
      onPreviewDemo={() => setDemoPreviewMode(true)}
      onLogout={() => {
        clearSession();
        setSession(null);
        setUserProfile(null);
        setDemoPreviewMode(false);
      }}
    />
  );
}

if (session && userProfile?.email_verified && accountProjects.length === 0 && !demoPreviewMode) {
  return (
    <StarterWorkspacePage
      user={userProfile}
      onCreateProject={() => setView("setup")}
      onOpenSetupFlow={() => setView("setup")}
      onPreviewDemo={() => setDemoPreviewMode(true)}
    />
  );
}
```

If `refreshAccountData` is currently inline inside `useEffect`, extract it into a named async function so `VerifyEmailPage` can reuse it after verification.

- [ ] **Step 7: Add CSS**

Add to `frontend/src/styles/app.css`:

```css
.onboarding-screen,
.starter-workspace {
  min-height: 100vh;
  background: #f6f8fc;
  color: var(--text-primary);
  padding: 32px;
}

.onboarding-card,
.starter-hero,
.starter-panel {
  background: #ffffff;
  border: 1px solid var(--border-subtle);
  border-radius: 28px;
  box-shadow: var(--shadow-soft);
}

.verify-card {
  max-width: 720px;
  margin: 64px auto;
  padding: 36px;
}

.onboarding-icon {
  width: 56px;
  height: 56px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border-radius: 18px;
  background: #eff6ff;
  color: #2563eb;
}

.verify-token-row {
  display: grid;
  grid-template-columns: 1fr auto;
  gap: 12px;
  margin: 24px 0 12px;
}

.onboarding-actions,
.starter-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
  margin-top: 20px;
}

.starter-hero {
  display: grid;
  grid-template-columns: minmax(0, 1.3fr) minmax(280px, 0.7fr);
  gap: 24px;
  padding: 36px;
}

.starter-hero h1 {
  max-width: 760px;
  font-size: clamp(2.2rem, 5vw, 4.8rem);
  line-height: 0.95;
  letter-spacing: -0.07em;
  margin: 12px 0;
}

.starter-hero p {
  max-width: 680px;
  color: var(--text-secondary);
  font-size: 1.05rem;
  line-height: 1.7;
}

.starter-empty-preview {
  min-height: 280px;
  border: 1px dashed #bfdbfe;
  border-radius: 24px;
  background: linear-gradient(135deg, #f8fbff, #ffffff);
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 28px;
}

.starter-grid {
  display: grid;
  grid-template-columns: minmax(320px, 1.2fr) repeat(3, minmax(220px, 0.6fr));
  gap: 18px;
  margin-top: 20px;
}

.starter-panel {
  padding: 24px;
}

.starter-panel-heading {
  display: flex;
  align-items: center;
  gap: 10px;
  font-weight: 800;
  color: #0f172a;
}

.starter-step-list {
  display: grid;
  gap: 12px;
  padding-left: 0;
  list-style: none;
}

.starter-step-list li {
  display: grid;
  gap: 3px;
  padding: 12px 0;
  border-bottom: 1px solid #eef2f7;
}

.starter-step-list span,
.starter-panel.compact p {
  color: var(--text-secondary);
}

.starter-link-button {
  width: 100%;
  justify-content: center;
}

@media (max-width: 1100px) {
  .starter-hero,
  .starter-grid {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 8: Run frontend tests**

Run:

```powershell
pnpm --dir frontend test -- --run frontend/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 9: Commit frontend**

```powershell
git add frontend/src
git commit -m "feat: add starter workspace onboarding screens"
```

---

### Task 3: Quick Start Onboarding Progress and Demo Separation

**Files:**
- Modify: `frontend/src/App.tsx`
- Modify: `frontend/src/pages/StarterWorkspacePage.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `README.md`

**Interfaces:**
- Consumes: `api.updateOnboarding(state)`
- Produces: demo preview mode labelled as demo.
- Produces: after `createProject`, onboarding state advances to `project`.

- [ ] **Step 1: Write failing tests**

Add to `frontend/src/App.test.tsx`:

```tsx
it("marks demo preview separately from customer workspace", async () => {
  localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
  vi.spyOn(api, "me").mockResolvedValue({
    full_name: "Acme Owner",
    email: "owner@acme.test",
    tenant_id: "tenant-1",
    plan_code: "starter",
    email_verified: true,
    onboarding_step: "starter_workspace",
  });
  vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
  vi.spyOn(api, "projects").mockResolvedValue([]);
  vi.spyOn(api, "devices").mockResolvedValue([]);
  vi.spyOn(api, "templates").mockResolvedValue([]);
  vi.spyOn(api, "onboarding").mockResolvedValue({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: false, first_project_id: null });
  const update = vi.spyOn(api, "updateOnboarding").mockResolvedValue({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: true, first_project_id: null });

  render(<App />);
  await userEvent.click(await screen.findByRole("button", { name: /View demo dashboard/i }));

  expect(update).toHaveBeenCalledWith({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: true, first_project_id: null });
  expect(await screen.findByText(/Demo dashboard/i)).toBeInTheDocument();
  expect(screen.getByText(/Simulated telemetry/i)).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```powershell
pnpm --dir frontend test -- --run frontend/src/App.test.tsx
```

Expected: FAIL because demo preview is not marked via onboarding state and the dashboard header is not explicitly labelled demo.

- [ ] **Step 3: Implement demo preview onboarding update**

In `frontend/src/App.tsx`, add:

```tsx
async function openDemoPreview() {
  setDemoPreviewMode(true);
  if (onboarding) {
    const updated = { ...onboarding, demo_viewed: true };
    setOnboarding(updated);
    try {
      await api.updateOnboarding(updated);
    } catch {
      // Demo preview still works if the progress update fails.
    }
  }
}
```

Replace `setDemoPreviewMode(true)` preview handlers with `void openDemoPreview()`.

Add a small banner in demo preview mode near the dashboard page:

```tsx
{demoPreviewMode && (
  <div className="demo-preview-banner">
    <strong>Demo dashboard</strong>
    <span>Simulated telemetry. Create your first project to connect real hardware.</span>
    <button type="button" onClick={() => setDemoPreviewMode(false)}>Back to workspace</button>
  </div>
)}
```

- [ ] **Step 4: Advance onboarding after project creation**

In the account project creation handler in `frontend/src/App.tsx`, after project creation:

```tsx
if (onboarding) {
  const updated = {
    ...onboarding,
    current_step: "project",
    completed_steps: Array.from(new Set([...onboarding.completed_steps, "starter_workspace", "project"])),
    first_project_id: created.id,
  };
  setOnboarding(updated);
  void api.updateOnboarding(updated);
}
```

If the existing handler does not retain `created`, change:

```tsx
await api.createProject(project);
```

to:

```tsx
const created = await api.createProject(project);
```

- [ ] **Step 5: Add banner CSS**

Add to `frontend/src/styles/app.css`:

```css
.demo-preview-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  margin: 0 0 16px;
  padding: 12px 16px;
  border: 1px solid #bfdbfe;
  border-radius: 18px;
  background: #eff6ff;
  color: #1e3a8a;
}

.demo-preview-banner span {
  flex: 1;
  color: #475569;
}
```

- [ ] **Step 6: Document behavior**

Add to `README.md`:

```markdown
### First-login SaaS onboarding

New accounts start in a guided Starter Workspace. Spark IoT creates the tenant, owner user, Starter plan and onboarding state, but it does not create a real project/device/dashboard until the user chooses a project and board.

The demo dashboard remains available from the Starter Workspace as a clearly labelled preview using simulated telemetry. It is separate from customer-owned tenant data.
```

- [ ] **Step 7: Run tests**

Run:

```powershell
pnpm --dir frontend test -- --run frontend/src/App.test.tsx
```

Expected: PASS.

- [ ] **Step 8: Commit**

```powershell
git add frontend/src README.md
git commit -m "feat: separate demo preview from onboarding workspace"
```

---

### Task 4: Full Verification, Package, Push, and VPS Smoke

**Files:**
- Modify: `outputs/Spark-IoT-MVP.zip` generated by script, not committed.
- No source files should be changed unless verification finds a real bug.

**Interfaces:**
- Consumes: existing GitHub Actions CI and deploy workflow.
- Produces: deployed VPS with first-login onboarding UI and backend endpoints.

- [ ] **Step 1: Run full backend test suite**

Run:

```powershell
py -3 -m pytest backend/tests tests -q
```

Expected: all tests PASS.

- [ ] **Step 2: Run full frontend test suite**

Run:

```powershell
pnpm --dir frontend test -- --run
```

Expected: all tests PASS.

- [ ] **Step 3: Build frontend**

Run:

```powershell
pnpm --dir frontend build
```

Expected: Vite build succeeds. Existing chunk-size warning is acceptable.

- [ ] **Step 4: Package release ZIP**

Run:

```powershell
py -3 scripts/package_release.py
```

Expected: `outputs/Spark-IoT-MVP.zip` exists and excludes `.git`, caches, `node_modules`, and temporary files.

- [ ] **Step 5: Verify clean git status before push**

Run:

```powershell
git status --short
```

Expected: no unexpected source changes. `outputs/Spark-IoT-MVP.zip` may remain ignored/untracked depending `.gitignore`.

- [ ] **Step 6: Push to GitHub**

Run:

```powershell
git push
```

Expected: push succeeds and GitHub Actions starts CI.

- [ ] **Step 7: Watch CI and deploy**

Run:

```powershell
gh run list --limit 8
```

Use the newest `ci` run ID:

```powershell
$ciRun='<ci-run-id>'
for ($i=0; $i -lt 20; $i++) {
  $info = gh run view $ciRun --json status,conclusion | ConvertFrom-Json
  Write-Output "ci $($info.status) $($info.conclusion)"
  if ($info.status -eq 'completed') { if ($info.conclusion -ne 'success') { exit 1 }; break }
  Start-Sleep -Seconds 15
}
```

After CI success, find the newest `deploy-vps` run and watch it:

```powershell
gh run list --limit 8
$deployRun='<deploy-run-id>'
for ($i=0; $i -lt 24; $i++) {
  $info = gh run view $deployRun --json status,conclusion | ConvertFrom-Json
  Write-Output "deploy $($info.status) $($info.conclusion)"
  if ($info.status -eq 'completed') { if ($info.conclusion -ne 'success') { exit 1 }; break }
  Start-Sleep -Seconds 15
}
```

Expected: CI and deploy both complete with `success`.

- [ ] **Step 8: VPS smoke test**

Run:

```powershell
$health = Invoke-WebRequest -UseBasicParsing 'http://34.73.29.12/health/live' -TimeoutSec 20
$ready = Invoke-WebRequest -UseBasicParsing 'http://34.73.29.12/health/ready' -TimeoutSec 20
$page = Invoke-WebRequest -UseBasicParsing 'http://34.73.29.12/' -TimeoutSec 20
$asset = [regex]::Match($page.Content, 'src="([^"]+\.js)"').Groups[1].Value
$js = Invoke-WebRequest -UseBasicParsing "http://34.73.29.12$asset" -TimeoutSec 30
[PSCustomObject]@{
  Live=$health.StatusCode
  Ready=$ready.StatusCode
  Asset=$asset
  HasStarterWorkspace=$js.Content.Contains('Starter workspace ready')
  HasVerifyEmail=$js.Content.Contains('Verify your email')
  HasDemoDashboard=$js.Content.Contains('Demo dashboard')
} | ConvertTo-Json
```

Expected:

```json
{
  "Live": 200,
  "Ready": 200,
  "HasStarterWorkspace": true,
  "HasVerifyEmail": true,
  "HasDemoDashboard": true
}
```

- [ ] **Step 9: Final handoff**

Report:

- commits created,
- tests run,
- package path,
- CI/deploy status,
- VPS health result,
- what the user should manually test in browser.

---

## Self-Review

Spec coverage:

- Customer visits/signup/verify/first-login workspace: Task 1 and Task 2.
- Empty but guided first dashboard state: Task 2.
- Demo dashboard separated and labelled: Task 3.
- Quick Start Wizard entry from Starter Workspace: Task 2.
- Project creation advances onboarding: Task 3.
- Backend verification/onboarding state: Task 1.
- Tests and deployment validation: Task 4.

No placeholders are intentionally left. The only code comments included are explicit behavior notes, not incomplete work markers.
