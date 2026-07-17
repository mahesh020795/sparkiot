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
        <p>We created your Spark IoT Pro workspace for <strong>{user?.email}</strong>. Verify the email before creating production projects and device tokens.</p>
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
