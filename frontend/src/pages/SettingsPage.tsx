import { BellRing, CheckCircle2, CreditCard, LockKeyhole, LogIn, LogOut, MailCheck, ShieldCheck, UserCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { api, clearSession, getSession, saveSession } from "../lib/api";
import { findPlan, normalizePlanCode, planCatalog } from "../lib/planCatalog";
import type { UsageSummary, UserProfile } from "../lib/types";

type AccountStatus = "idle" | "loading" | "signed-in" | "error";
type PushStatus = "idle" | "checking" | "enabled" | "error" | "unsupported";

const demoUsage: UsageSummary = {
  plan_code: "pro",
  plan_name: "Pro",
  monthly_price_rm: 49,
  users: 1,
  max_users: 1,
  devices: 3,
  max_devices: 10,
  projects: 3,
  max_projects: 10,
  message_quota_monthly: 10_000_000,
  automation_limit: 20,
  max_widgets: 30,
  retention_days: 90,
  features: ["Advanced widgets", "Full API access", "Priority support"],
  widget_groups: ["Core widgets", "Smart widgets", "Advanced widgets"],
  support: "Priority support",
};

function priceLabel(usage: UsageSummary | null, profile: UserProfile | null) {
  const code = normalizePlanCode(usage?.plan_code ?? profile?.plan_code);
  if (usage?.monthly_price_rm === null) return "Contact sales";
  if (typeof usage?.monthly_price_rm === "number") return `RM${usage.monthly_price_rm}/month`;
  return findPlan(code).price;
}

function formatMessageQuota(usage: UsageSummary | null, planCode: string) {
  if (usage?.message_quota_monthly === null) return "Custom message quota";
  if (typeof usage?.message_quota_monthly === "number") return `${usage.message_quota_monthly.toLocaleString()} messages/month`;
  return findPlan(planCode).usageHighlights.find((item) => item.includes("messages")) ?? "Plan message quota";
}

function formatAutomationLimit(usage: UsageSummary | null, planCode: string) {
  if (usage?.automation_limit === null) return "Unlimited automations";
  if (typeof usage?.automation_limit === "number") return `${usage.automation_limit} automations`;
  return findPlan(planCode).usageHighlights.find((item) => item.includes("automation")) ?? "Plan automations";
}

export function SettingsPage() {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [usage, setUsage] = useState<UsageSummary | null>(null);
  const [status, setStatus] = useState<AccountStatus>(getSession() ? "loading" : "idle");
  const [pushStatus, setPushStatus] = useState<PushStatus>("idle");
  const [pushMessage, setPushMessage] = useState("Sign in, then enable browser notifications for alert delivery.");
  const [error, setError] = useState("");

  const activePlanCode = useMemo(() => normalizePlanCode(usage?.plan_code ?? profile?.plan_code), [usage?.plan_code, profile?.plan_code]);

  async function loadProfile() {
    if (!getSession()) {
      setProfile(null);
      setUsage(null);
      setStatus("idle");
      return;
    }
    setStatus("loading");
    setError("");
    try {
      const [nextProfile, nextUsage] = await Promise.all([
        api.me(),
        api.usage().catch(() => null),
      ]);
      setProfile(nextProfile);
      setUsage(nextUsage);
      setStatus("signed-in");
    } catch {
      clearSession();
      setProfile(null);
      setUsage(null);
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
      const [nextProfile, nextUsage] = await Promise.all([
        api.me(),
        api.usage().catch(() => demoUsage),
      ]);
      setProfile(nextProfile);
      setUsage(nextUsage ?? demoUsage);
      setStatus("signed-in");
    } catch {
      setStatus("error");
      setError("Could not sign in. Check that the API container is running and seeded.");
    }
  }

  function signOut() {
    clearSession();
    setProfile(null);
    setUsage(null);
    setStatus("idle");
    setPushStatus("idle");
    setPushMessage("Sign in, then enable browser notifications for alert delivery.");
    setError("");
  }

  async function enableBrowserPush() {
    if (!profile || !getSession()) {
      setPushStatus("error");
      setPushMessage("Sign in before enabling browser push notifications.");
      return;
    }
    if (!window.isSecureContext) {
      setPushStatus("unsupported");
      setPushMessage("Browser push needs HTTPS or localhost. Chrome is supported, but this domain must use HTTPS before push can be enabled.");
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
      setPushMessage("Browser push enabled.");
    } catch {
      setPushStatus("error");
      setPushMessage("Could not enable browser push. Check HTTPS/domain setup and VAPID keys.");
    }
  }

  const signedIn = Boolean(profile);
  const currentPlan = findPlan(activePlanCode);
  const currentPlanName = usage?.plan_name ?? currentPlan.name;

  return (
    <section className="support-page settings-page">
      <section className="settings-overview-grid">
        <article className="panel settings-card account-access-card" data-testid="account-access-card">
          <div className="panel-title"><UserCircle size={18} /><h2>Account access</h2></div>
          {profile ? (
            <div className="settings-detail-list">
              <SettingsRow label="Account name" value={profile.full_name} />
              <SettingsRow label="Email" value={profile.email} />
              <SettingsRow label="Workspace ID" value={profile.tenant_id} />
              <SettingsRow label="Email status" value={profile.email_verified ? "Email verified" : "Verification pending"} />
              <button type="button" onClick={signOut}><LogOut size={16} />Sign out</button>
            </div>
          ) : (
            <div className="account-state">
              <strong>{status === "loading" ? "Connecting account..." : "Not signed in"}</strong>
              <span>Sign in to view account details, plan usage, security status and push notification setup.</span>
              <button type="button" className="primary" onClick={signInDemo} disabled={status === "loading"}><LogIn size={16} />Sign in demo account</button>
            </div>
          )}
          {error && <p className="error account-error">{error}</p>}
        </article>

        <article className="panel settings-card plan-usage-card" data-testid="plan-usage-card">
          <div className="panel-title"><CreditCard size={18} /><h2>Plan &amp; usage</h2></div>
          <div className="current-plan-box">
            <span>Current plan</span>
            <strong>Spark IoT {currentPlanName}</strong>
            <em>{priceLabel(usage, profile)}</em>
            <p>{currentPlan.purpose}</p>
          </div>
          <div className="usage-meter-list">
            <SettingsRow label="Projects" value={usage ? `${usage.projects} / ${usage.max_projects} projects` : signedIn ? "Loading usage" : "Sign in to view"} />
            <SettingsRow label="Devices" value={usage ? `${usage.devices} / ${usage.max_devices} devices` : signedIn ? "Loading usage" : "Sign in to view"} />
            <SettingsRow label="Users" value={usage ? `${usage.users} / ${usage.max_users} users` : signedIn ? "Loading usage" : "Sign in to view"} />
            <SettingsRow label="Messages" value={formatMessageQuota(usage, activePlanCode)} />
            <SettingsRow label="Automation" value={formatAutomationLimit(usage, activePlanCode)} />
            <SettingsRow label="Data window" value={usage ? `${usage.retention_days}-day history` : "Plan based"} />
          </div>
        </article>

        <article className="panel settings-card security-card">
          <div className="panel-title"><LockKeyhole size={18} /><h2>Security</h2></div>
          <div className="security-list">
            <SecurityItem icon={<MailCheck size={16} />} title={profile?.email_verified ? "Email verified" : "Email verification"} detail={profile?.email_verified ? "Account email is verified." : "Verify email before production use."} />
            <SecurityItem icon={<ShieldCheck size={16} />} title="Password protected" detail="Passwords are hashed; reset tokens are single-use." />
            <SecurityItem icon={<CheckCircle2 size={16} />} title="Workspace isolation" detail="Projects, devices and dashboards stay inside your account." />
          </div>
        </article>

        <article className={`panel settings-card browser-push-card ${pushStatus}`} data-testid="browser-push-card">
          <div className="panel-title"><BellRing size={18} /><h2>Browser push</h2></div>
          <p>Enable browser push subscriptions for threshold alerts, schedule events and manual notification tests.</p>
          <div className="push-state-row">
            <strong>{pushStatus === "enabled" ? "Browser push enabled" : pushStatus === "checking" ? "Enabling push..." : pushStatus === "unsupported" && pushMessage.includes("HTTPS") ? "HTTPS required" : pushStatus === "unsupported" ? "Push unsupported" : "Push opt-in required"}</strong>
            <span>{pushMessage}</span>
          </div>
          <button type="button" className="primary" onClick={enableBrowserPush} disabled={!profile || pushStatus === "checking"}>
            <BellRing size={16} />Enable browser push
          </button>
        </article>
      </section>

      <article className="panel settings-plan-ladder">
        <div className="panel-title"><CreditCard size={18} /><h2>Account plans</h2></div>
        <div className="plan-ladder-grid">
          {planCatalog.map((plan) => (
            <div key={plan.code} className={`plan-tier-card ${activePlanCode === plan.code ? "active" : ""}`}>
              <span>{activePlanCode === plan.code ? "Current plan" : "Available"}</span>
              {plan.badge && <b>{plan.badge}</b>}
              <strong>{plan.name}</strong>
              <em>{plan.price}</em>
              <p>{plan.shortDescription}</p>
              <small>{plan.usageHighlights.slice(0, 3).join(" · ")}</small>
            </div>
          ))}
        </div>
      </article>
    </section>
  );
}

function SettingsRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="settings-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function SecurityItem({ icon, title, detail }: { icon: ReactNode; title: string; detail: string }) {
  return (
    <div className="security-item">
      {icon}
      <span>
        <strong>{title}</strong>
        <small>{detail}</small>
      </span>
    </div>
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
