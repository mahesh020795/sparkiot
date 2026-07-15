import { LogIn, LogOut, Map, ShieldCheck, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, clearSession, getSession, saveSession } from "../lib/api";

type AccountProfile = { full_name: string; email: string; tenant_id: string; plan_code: string };
type AccountStatus = "idle" | "loading" | "signed-in" | "error";

export function SettingsPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [status, setStatus] = useState<AccountStatus>(getSession() ? "loading" : "idle");
  const [error, setError] = useState("");

  async function loadProfile() {
    if (!getSession()) {
      setProfile(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const next = await api.me();
      setProfile(next);
      setStatus("signed-in");
    } catch {
      clearSession();
      setProfile(null);
      setStatus("error");
      setError("Saved session expired. Sign in again to reconnect the account workspace.");
    }
  }

  useEffect(() => {
    void loadProfile();
  }, []);

  async function signInDemo() {
    setStatus("loading");
    setError("");
    try {
      const session = await api.login("demo@sparkiot.dev", "SparkDemo123!");
      saveSession(session);
      const next = await api.me();
      setProfile(next);
      setStatus("signed-in");
    } catch {
      setStatus("error");
      setError("Could not sign in. Check that the API container is running and seeded.");
    }
  }

  function signOut() {
    clearSession();
    setProfile(null);
    setStatus("idle");
    setError("");
  }

  return (
    <section className="support-page">
      <div className="support-hero"><div><span className="section-kicker">Platform settings</span><h2>Production readiness controls</h2><p>Keep plan limits, map-tile guidance, account access and deployment assumptions visible before Spark IoT goes live.</p></div></div>
      <section className="content-grid">
        <article className="panel settings-card account-access-card" data-testid="account-access-card">
          <div className="panel-title"><UserCircle size={18} /><h2>Account access</h2></div>
          {profile ? (
            <div className="account-state signed-in">
              <strong>Signed in as {profile.full_name}</strong>
              <span>{profile.email} - {profile.plan_code} - {profile.tenant_id}</span>
              <button type="button" onClick={signOut}><LogOut size={16} />Sign out</button>
            </div>
          ) : (
            <div className="account-state">
              <strong>{status === "loading" ? "Connecting account..." : "Not signed in"}</strong>
              <span>Use the seeded demo account to test the authenticated API, plan limits and tenant-scoped workspace.</span>
              <button type="button" className="primary" onClick={signInDemo} disabled={status === "loading"}><LogIn size={16} />Sign in demo account</button>
            </div>
          )}
          {error && <p className="error account-error">{error}</p>}
        </article>
        <article className="panel settings-card"><div className="panel-title"><ShieldCheck size={18} /><h2>Starter plan</h2></div><p>1 user, 3 devices, 3 dashboards, GPS, camera URL, push notifications and 30-day history.</p></article>
        <article className="panel settings-card"><div className="panel-title"><Map size={18} /><h2>Map tiles</h2></div><p>Set VITE_MAP_TILE_URL and VITE_MAP_ATTRIBUTION for a commercial-safe tile provider before production.</p></article>
      </section>
    </section>
  );
}
