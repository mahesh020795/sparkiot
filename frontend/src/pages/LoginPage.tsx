import { Activity, Building2, Lock, Mail, UserRound } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, saveSession, type Session } from "../lib/api";

export function LoginPage({ onLogin, onCancel }: { onLogin: (session: Session) => void; onCancel?: () => void }) {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [tenantName, setTenantName] = useState("Rectronx Customer Lab");
  const [fullName, setFullName] = useState("Mahesh Rajagopal");
  const [email, setEmail] = useState("demo@sparkiot.dev");
  const [password, setPassword] = useState("SparkDemo123!");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = mode === "register"
        ? await api.register({ tenant_name: tenantName.trim(), full_name: fullName.trim(), email: email.trim(), password })
        : await api.login(email, password);
      saveSession(session);
      onLogin(session);
    } catch (caught) {
      const message = caught instanceof Error && caught.message.includes("duplicate_email")
        ? "This email already has a Spark IoT account. Sign in instead."
        : mode === "register"
          ? "Account creation failed. Check the details and API connection."
          : "Invalid login or API is not ready.";
      setError(message);
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand large"><Activity size={28} /><div><strong>Spark IoT</strong><span>Rectronx Cloud</span></div></div>
        <h1>{mode === "register" ? "Create your Spark IoT Starter workspace" : "Sign in to your IoT control center"}</h1>
        <p className="muted-text auth-intro">
          {mode === "register"
            ? "Start with the RM25-style limits: 1 user, 3 projects, 3 devices, 30-day data, GPS, camera and push-ready notifications."
            : "Use the demo login or create a Starter account when you are ready to test real tenant APIs."}
        </p>
        <div className="auth-mode-tabs" role="tablist" aria-label="Authentication mode">
          <button type="button" className={mode === "login" ? "active" : ""} onClick={() => setMode("login")}>Existing account</button>
          <button type="button" className={mode === "register" ? "active" : ""} onClick={() => {
            setMode("register");
            if (email === "demo@sparkiot.dev") setEmail("mahesh@example.com");
          }}>Create Starter account</button>
        </div>
        <form onSubmit={submit}>
          {mode === "register" && (
            <>
              <label><Building2 size={17} />Company or workspace name<input value={tenantName} onChange={(event) => setTenantName(event.target.value)} /></label>
              <label><UserRound size={17} />Full name<input value={fullName} onChange={(event) => setFullName(event.target.value)} /></label>
            </>
          )}
          <label><Mail size={17} />Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><Lock size={17} />Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary">{mode === "register" ? "Create account" : "Sign in"}</button>
          {onCancel && <button type="button" onClick={onCancel}>Continue demo mode</button>}
        </form>
        <p className="muted-text">{mode === "register" ? "After signup, use the Launch Wizard to build your first project, template, device and Arduino sketch." : "Demo: demo@sparkiot.dev / SparkDemo123!"}</p>
      </section>
    </main>
  );
}
