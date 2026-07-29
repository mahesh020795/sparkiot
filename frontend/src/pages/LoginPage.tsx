import { Building2, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
import { HeshBrand } from "../components/HeshBrand";
import { api, saveSession, type Session } from "../lib/api";

type AuthMode = "login" | "register" | "reset";

function AuthField({ icon, label, children }: { icon: ReactNode; label: string; children: ReactNode }) {
  return (
    <label className="auth-field" data-testid="auth-field">
      <span className="auth-field-label">
        <span className="auth-field-icon" aria-hidden="true">{icon}</span>
        <span>{label}</span>
      </span>
      {children}
    </label>
  );
}

export function LoginPage({
  onLogin,
  onCancel,
  initialMode = "login",
  initialEmail = "",
  initialResetToken = "",
}: {
  onLogin: (session: Session) => void;
  onCancel?: () => void;
  initialMode?: AuthMode;
  initialEmail?: string;
  initialResetToken?: string;
}) {
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [tenantName, setTenantName] = useState("Rectronx Customer Lab");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState(initialEmail);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [resetToken, setResetToken] = useState(initialResetToken);
  const [resetMessage, setResetMessage] = useState(initialResetToken ? "Reset link loaded. Set a new password to continue." : "");
  const [resetRequested, setResetRequested] = useState(Boolean(initialResetToken));
  const [error, setError] = useState("");
  const isResetLinkMode = initialMode === "reset" && Boolean(initialResetToken) && mode === "reset";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResetMessage("");
    try {
      if (mode === "reset") {
        if (!resetRequested) {
          const response = await api.requestPasswordReset(email.trim());
          if (response.reset_token) {
            setResetRequested(true);
            setResetToken(response.reset_token);
            setResetMessage("Reset token ready for local testing.");
          } else {
            setResetRequested(false);
            setResetMessage("Check your email for the reset link, then open it to set a new password.");
          }
          return;
        }
        if (confirmPassword && password !== confirmPassword) {
          setError("New passwords do not match.");
          return;
        }
        const response = await api.confirmPasswordReset(resetToken.trim(), password);
        setResetMessage(response.message);
        setMode("login");
        setPassword("");
        setConfirmPassword("");
        return;
      }

      const session = mode === "register"
        ? await api.register({ tenant_name: tenantName.trim(), full_name: fullName.trim(), email: email.trim(), password })
        : await api.login(email.trim(), password);
      saveSession(session);
      onLogin(session);
    } catch (caught) {
      const message = caught instanceof Error && caught.message.includes("duplicate_email")
        ? "This email already has a Hesh IoT account. Sign in instead."
        : mode === "register"
          ? "Account creation failed. Check the details and API connection."
          : mode === "reset"
            ? "Password reset failed. Check the token, new password and API connection."
            : "Invalid login or API is not ready.";
      setError(message);
    }
  }

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError("");
    setResetMessage("");
    if (nextMode !== "reset") {
      setResetRequested(false);
      setResetToken("");
    }
    setPassword("");
    setConfirmPassword("");
  }

  const title = mode === "register"
    ? "Create your Hesh IoT Pro workspace"
    : mode === "reset"
      ? "Reset your Hesh IoT password"
      : "Sign in to your IoT control center";

  const intro = mode === "register"
    ? "Create a real Pro account for board testing: more projects, more devices, 90-day history, GPS, camera and push-ready notifications."
    : mode === "reset" && isResetLinkMode
      ? "Set a new password for your Hesh IoT account. The reset token stays hidden and is used only once."
      : mode === "reset"
      ? "Request a one-time reset link, set a new password, then sign in again. Existing sessions are revoked after reset."
      : "Sign in to your Hesh IoT workspace, or create a Pro account when you are ready to test real boards.";

  return (
    <main className="login-screen" data-ui-mode="brand">
      <section className="login-panel auth-card" data-testid="auth-card">
        <HeshBrand className="auth-brand" tagline />
        <h1 className="auth-title">{title}</h1>
        <p className="muted-text auth-intro">{intro}</p>
        {!isResetLinkMode && (
          <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode" data-testid="auth-tabs">
            <button id="auth-tab-login" type="button" role="tab" aria-selected={mode === "login"} aria-controls="auth-mode-panel" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Existing account</button>
            <button id="auth-tab-register" type="button" role="tab" aria-selected={mode === "register"} aria-controls="auth-mode-panel" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create Pro account</button>
            <button id="auth-tab-reset" type="button" role="tab" aria-selected={mode === "reset"} aria-controls="auth-mode-panel" className={mode === "reset" ? "active" : ""} onClick={() => changeMode("reset")}>Reset password</button>
          </div>
        )}
        <form id="auth-mode-panel" className="auth-form" data-testid="auth-form" role={isResetLinkMode ? undefined : "tabpanel"} aria-labelledby={isResetLinkMode ? undefined : `auth-tab-${mode}`} onSubmit={submit}>
          {mode === "register" && (
            <>
              <AuthField icon={<Building2 size={17} />} label="Company or workspace name"><input value={tenantName} onChange={(event) => setTenantName(event.target.value)} /></AuthField>
              <AuthField icon={<UserRound size={17} />} label="Full name"><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></AuthField>
            </>
          )}
          {isResetLinkMode ? (
            <div className="auth-link-account" aria-label="Reset account">
              <span className="auth-field-icon" aria-hidden="true"><Mail size={17} /></span>
              <span>
                <small>Resetting account</small>
                <strong>{email || "Email from secure reset link"}</strong>
              </span>
            </div>
          ) : (
            <AuthField icon={<Mail size={17} />} label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} /></AuthField>
          )}
          {mode === "reset" && resetRequested && !isResetLinkMode && (
            <AuthField icon={<KeyRound size={17} />} label="Reset token"><input value={resetToken} onChange={(event) => setResetToken(event.target.value)} /></AuthField>
          )}
          {mode !== "reset" || resetRequested ? (
            <AuthField icon={<Lock size={17} />} label={mode === "reset" ? "New password" : "Password"}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></AuthField>
          ) : null}
          {mode === "reset" && resetRequested && (
            <AuthField icon={<KeyRound size={17} />} label="Confirm new password"><input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} /></AuthField>
          )}
          {mode === "login" && <button type="button" className="text-button" onClick={() => changeMode("reset")}>Forgot password?</button>}
          {resetMessage && <p className="success">{resetMessage}</p>}
          {error && <p className="error">{error}</p>}
          <button className="primary auth-primary-action" data-testid="auth-primary-action">{mode === "register" ? "Create account" : mode === "reset" ? (resetRequested ? "Update password" : "Send reset link") : "Sign in"}</button>
          {onCancel && <button type="button" className="auth-secondary-action" onClick={onCancel}>Continue demo mode</button>}
        </form>
        <p className="muted-text auth-footnote">{mode === "register" ? "After signup, verify your email, create your first project, add a device and generate Arduino code." : mode === "reset" ? (isResetLinkMode ? "For security, reset tokens are never displayed on emailed reset-link pages." : "Reset links are sent through the configured email provider. Local mode can still show a testing token.") : "Use the account you registered. Demo mode stays available as a separate testing shortcut."}</p>
      </section>
    </main>
  );
}
