import { ArrowRight, CheckCircle2, Code2, Cpu, LayoutDashboard, PlayCircle, Rocket, Wifi } from "lucide-react";
import type { UserProfile } from "../lib/types";

const steps = [
  { icon: Rocket, title: "Create project", detail: "Name the use case and select a reusable template." },
  { icon: Cpu, title: "Provision device", detail: "Generate the board ID, token and MQTT namespace." },
  { icon: Code2, title: "Upload code", detail: "Copy the generated ESP32 or ESP8266 sketch." },
  { icon: Wifi, title: "Connect board", detail: "Send telemetry and receive command acknowledgements." },
  { icon: LayoutDashboard, title: "View live dashboard", detail: "Widgets come alive when the first reading arrives." },
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
  const firstName = user?.full_name?.split(" ")[0] || "there";

  return (
    <main className="starter-workspace">
      <section className="starter-hero">
        <div className="starter-hero-copy">
          <span className="section-kicker">Pro workspace</span>
          <h1>Welcome, {firstName}</h1>
          <p>Your Spark IoT Pro workspace is ready. Create a project to connect your first board and generate a live dashboard.</p>
          <div className="starter-plan-strip" aria-label="Pro plan limits">
            <span><CheckCircle2 size={16} /> Pro plan</span>
            <span>10 projects</span>
            <span>10 devices</span>
            <span>90-day history</span>
          </div>
          <div className="starter-actions">
            <button className="primary" type="button" onClick={onCreateProject}><Rocket size={17} /> Create first project</button>
            <button type="button" onClick={onPreviewDemo}><PlayCircle size={17} /> View demo dashboard</button>
          </div>
        </div>
        <aside className="starter-empty-preview">
          <div className="starter-empty-icon"><LayoutDashboard size={24} /></div>
          <div>
            <h2>No live dashboard yet</h2>
            <p>Create your first project to generate datastreams, widgets and Arduino-ready device code.</p>
          </div>
        </aside>
      </section>

      <section className="starter-panel starter-quickstart">
        <div className="starter-panel-heading">
          <span>Get started</span>
          <small>Project → device → code → live dashboard</small>
        </div>
          <ol className="starter-step-list">
            {steps.map(({ icon: Icon, title, detail }, index) => (
              <li key={title} className="starter-step-card">
                <span className="starter-step-number">{index + 1}</span>
                <Icon size={18} />
                <strong>{title}</strong>
                <small>{detail}</small>
              </li>
            ))}
          </ol>
        <button type="button" className="starter-link-button" onClick={onOpenSetupFlow}>Open guided setup <ArrowRight size={16} /></button>
      </section>
    </main>
  );
}
