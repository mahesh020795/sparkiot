import { Activity, Building2, KeyRound, Lock, Mail, UserRound } from "lucide-react";
import type { FormEvent, ReactNode } from "react";
import { useState } from "react";
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

export function LoginPage({ onLogin, onCancel }: { onLogin: (session: Session) => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<AuthMode>("login");
  const [tenantName, setTenantName] = useState("Rectronx Customer Lab");
  const [fullName, setFullName] = useState("Mahesh Rajagopal");
  const [email, setEmail] = useState("demo@sparkiot.dev");
  const [password, setPassword] = useState("SparkDemo123!");
  const [resetToken, setResetToken] = useState("");
  const [resetMessage, setResetMessage] = useState("");
  const [resetRequested, setResetRequested] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    setResetMessage("");
    try {
      if (mode === "reset") {
        if (!resetRequested) {
          const response = await api.requestPasswordReset(email.trim());
          setResetRequested(true);
          setResetToken(response.reset_token ?? "");
          setResetMessage(response.reset_token ? "Reset token ready for testing" : response.message);
          return;
        }
        const response = await api.confirmPasswordReset(resetToken.trim(), password);
        setResetMessage(response.message);
        setMode("login");
        return;
      }

      const session = mode === "register"
        ? await api.register({ tenant_name: tenantName.trim(), full_name: fullName.trim(), email: email.trim(), password })
        : await api.login(email.trim(), password);
      saveSession(session);
      onLogin(session);
    } catch (caught) {
      const message = caught instanceof Error && caught.message.includes("duplicate_email")
        ? "This email already has a Spark IoT account. Sign in instead."
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
    if (nextMode === "register" && email === "demo@sparkiot.dev") setEmail("mahesh@example.com");
    if (nextMode === "reset" && email === "demo@sparkiot.dev") setEmail("mahesh@example.com");
  }

  const title = mode === "register"
    ? "Create your Spark IoT Starter workspace"
    : mode === "reset"
      ? "Reset your Spark IoT password"
      : "Sign in to your IoT control center";

  const intro = mode === "register"
    ? "Start with the RM25-style limits: 1 user, 3 projects, 3 devices, 30-day data, GPS, camera and push-ready notifications."
    : mode === "reset"
      ? "Request a one-time reset token, set a new password, then sign in again. Existing sessions are revoked after reset."
      : "Use the demo login or create a Starter account when you are ready to test real tenant APIs.";

  return (
    <main className="login-screen">
      <section className="login-panel auth-card" data-testid="auth-card">
        <div className="brand large auth-brand" data-testid="auth-brand"><Activity size={28} /><div><strong>Spark IoT</strong><span>Rectronx Cloud</span></div></div>
        <h1 className="auth-title">{title}</h1>
        <p className="muted-text auth-intro">{intro}</p>
        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode" data-testid="auth-tabs">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => changeMode("login")}>Existing account</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => changeMode("register")}>Create Starter account</button>
          <button type="button" className={mode === "reset" ? "active" : ""} onClick={() => changeMode("reset")}>Reset password</button>
        </div>
        <form className="auth-form" data-testid="auth-form" onSubmit={submit}>
          {mode === "register" && (
            <>
              <AuthField icon={<Building2 size={17} />} label="Company or workspace name"><input value={tenantName} onChange={(event) => setTenantName(event.target.value)} /></AuthField>
              <AuthField icon={<UserRound size={17} />} label="Full name"><input value={fullName} onChange={(event) => setFullName(event.target.value)} /></AuthField>
            </>
          )}
          <AuthField icon={<Mail size={17} />} label="Email"><input value={email} onChange={(event) => setEmail(event.target.value)} /></AuthField>
          {mode === "reset" && resetRequested && (
            <AuthField icon={<KeyRound size={17} />} label="Reset token"><input value={resetToken} onChange={(event) => setResetToken(event.target.value)} /></AuthField>
          )}
          {mode !== "reset" || resetRequested ? (
            <AuthField icon={<Lock size={17} />} label={mode === "reset" ? "New password" : "Password"}><input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></AuthField>
          ) : null}
          {mode === "login" && <button type="button" className="text-button" onClick={() => changeMode("reset")}>Forgot password?</button>}
          {resetMessage && <p className="success">{resetMessage}</p>}
          {error && <p className="error">{error}</p>}
          <button className="primary auth-primary-action" data-testid="auth-primary-action">{mode === "register" ? "Create account" : mode === "reset" ? (resetRequested ? "Update password" : "Send reset link") : "Sign in"}</button>
          {onCancel && <button type="button" className="auth-secondary-action" onClick={onCancel}>Continue demo mode</button>}
        </form>
        <p className="muted-text auth-footnote">{mode === "register" ? "After signup, use the Launch Wizard to build your first project, template, device and Arduino sketch." : mode === "reset" ? "For production, connect SMTP later. During MVP testing, the API returns a reset token directly." : "Demo: demo@sparkiot.dev / SparkDemo123!"}</p>
      </section>
    </main>
  );
}
