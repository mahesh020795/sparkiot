import { Map, ShieldCheck } from "lucide-react";

export function SettingsPage() {
  return <section className="support-page"><div className="support-hero"><div><span className="section-kicker">Platform settings</span><h2>Production readiness controls</h2><p>Keep plan limits, map-tile guidance and deployment assumptions visible before Spark IoT goes live.</p></div></div><section className="content-grid"><article className="panel settings-card"><div className="panel-title"><ShieldCheck size={18} /><h2>Starter plan</h2></div><p>1 user, 3 devices, 3 dashboards, GPS, camera URL, push notifications and 30-day history.</p></article><article className="panel settings-card"><div className="panel-title"><Map size={18} /><h2>Map tiles</h2></div><p>Set VITE_MAP_TILE_URL and VITE_MAP_ATTRIBUTION for a commercial-safe tile provider before production.</p></article></section></section>;
}
