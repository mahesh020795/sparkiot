import { Activity, Lock, Mail } from "lucide-react";
import { FormEvent, useState } from "react";
import { api, saveSession, type Session } from "../lib/api";

export function LoginPage({ onLogin }: { onLogin: (session: Session) => void }) {
  const [email, setEmail] = useState("demo@sparkiot.dev");
  const [password, setPassword] = useState("SparkDemo123!");
  const [error, setError] = useState("");

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError("");
    try {
      const session = await api.login(email, password);
      saveSession(session);
      onLogin(session);
    } catch {
      setError("Invalid login or API is not ready.");
    }
  }

  return (
    <main className="login-screen">
      <section className="login-panel">
        <div className="brand large"><Activity size={28} /><div><strong>Spark IoT</strong><span>Rectronx Cloud</span></div></div>
        <h1>Sign in to your IoT control center</h1>
        <form onSubmit={submit}>
          <label><Mail size={17} />Email<input value={email} onChange={(event) => setEmail(event.target.value)} /></label>
          <label><Lock size={17} />Password<input type="password" value={password} onChange={(event) => setPassword(event.target.value)} /></label>
          {error && <p className="error">{error}</p>}
          <button className="primary">Sign in</button>
        </form>
        <p className="muted-text">Demo: demo@sparkiot.dev / SparkDemo123!</p>
      </section>
    </main>
  );
}
