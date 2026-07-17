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
          <span className="section-kicker">Pro workspace ready</span>
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
          <button type="button" className="starter-link-button" onClick={onOpenSetupFlow}>Open project builder <ArrowRight size={16} /></button>
        </article>
        <article className="starter-panel compact">
          <div className="starter-panel-heading"><ShieldCheck size={18} /><span>Pro access</span></div>
          <p>3 users, 10 projects, 10 devices, GPS, camera, push-ready notifications and 90-day data history.</p>
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
