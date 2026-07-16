import { BellRing, Database, LogIn, LogOut, ShieldCheck, UserCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { api, clearSession, getSession, saveSession } from "../lib/api";

type AccountProfile = { full_name: string; email: string; tenant_id: string; plan_code: string };
type AccountStatus = "idle" | "loading" | "signed-in" | "error";
type PushStatus = "idle" | "checking" | "enabled" | "error" | "unsupported";

export function SettingsPage() {
  const [profile, setProfile] = useState<AccountProfile | null>(null);
  const [status, setStatus] = useState<AccountStatus>(getSession() ? "loading" : "idle");
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushMessage, setPushMessage] = useState("Sign in, then enable browser notifications for Blynk-style alert delivery.");
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
    setPushStatus("idle");
    setPushMessage("Sign in, then enable browser notifications for Blynk-style alert delivery.");
    setError("");
  }

  async function enableBrowserPush() {
    if (!profile || !getSession()) {
      setPushStatus("error");
      setPushMessage("Sign in before enabling browser push notifications.");
      return;
    }
    if (!("serviceWorker" in navigator) || !("PushManager" in window) || !("Notification" in window)) {
      setPushStatus("unsupported");
      setPushMessage("This browser does not support Web Push. Use Chrome, Edge, Firefox or another supported browser.");
      return;
    }

    setPushStatus("checking");
    setPushMessage("Requesting browser permission and registering Spark IoT push worker...");
    try {
      const permission = Notification.permission === "granted" ? "granted" : await Notification.requestPermission();
      if (permission !== "granted") {
        setPushStatus("error");
        setPushMessage("Browser notification permission was not granted.");
        return;
      }

      const { public_key: publicKey } = await api.pushPublicKey();
      if (!publicKey) {
        setPushStatus("error");
        setPushMessage("VAPID public key is not configured on the server yet.");
        return;
      }

      const registration = await navigator.serviceWorker.register("/spark-push-sw.js");
      const existing = await registration.pushManager.getSubscription();
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey)
      });
      await api.savePushSubscription(subscription.toJSON());
      setPushStatus("enabled");
      setPushMessage("Browser push enabled");
    } catch {
      setPushStatus("error");
      setPushMessage("Could not enable browser push. Check HTTPS/domain setup and VAPID keys.");
    }
  }

  return (
    <section className="support-page">
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
        <article className={`panel settings-card browser-push-card ${pushStatus}`} data-testid="browser-push-card">
          <div className="panel-title"><BellRing size={18} /><h2>Browser push</h2></div>
          <p>Enable real browser push subscriptions for threshold alerts, schedule events and manual notification tests.</p>
          <div className="push-state-row">
            <strong>{pushStatus === "enabled" ? "Browser push enabled" : pushStatus === "checking" ? "Enabling push..." : pushStatus === "unsupported" ? "Push unsupported" : "Push opt-in required"}</strong>
            <span>{pushMessage}</span>
          </div>
          <button type="button" className="primary" onClick={enableBrowserPush} disabled={!profile || pushStatus === "checking"}>
            <BellRing size={16} />Enable browser push
          </button>
        </article>
        <article className="panel settings-card settings-info-card">
          <div className="panel-title"><ShieldCheck size={18} /><h2>Starter plan</h2></div>
          <p>1 user, 3 devices, 3 dashboards, GPS, camera URL, push notifications and 30-day history.</p>
          <div className="settings-state-row">
            <strong>RM25-ready limits</strong>
            <span>Customer-facing controls stay inside the Starter package boundaries.</span>
          </div>
        </article>
        <article className="panel settings-card settings-info-card">
          <div className="panel-title"><Database size={18} /><h2>Data window</h2></div>
          <p>Telemetry, GPS trails and camera references are designed around the 30-day Starter retention window.</p>
          <div className="settings-state-row">
            <strong>30-day retention</strong>
            <span>Production map tile provider setup stays in deployment docs, not customer settings.</span>
          </div>
        </article>
      </section>
    </section>
  );
}

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);
  for (let index = 0; index < rawData.length; index++) {
    outputArray[index] = rawData.charCodeAt(index);
  }
  return outputArray;
}
