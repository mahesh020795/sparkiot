import { ArrowRight, Bell, CheckCircle2, ClipboardCheck, Copy, Cpu, Database, Gauge, LayoutDashboard, Lock, LogIn, LogOut, MapPinned, PlugZap, Plus, RadioTower, Settings, TerminalSquare, UserCircle, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { LocalDashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SettingsPage } from "./pages/SettingsPage";
import { TemplateStudioPage } from "./pages/TemplateStudioPage";
import { demoDevices, demoLatest, demoNotifications, demoProjects, demoTemplates } from "./lib/demoData";
import { api, clearSession, getSession, type Session } from "./lib/api";
import type { CommandLogItem, Device, DeviceTemplate, LiveBoardTestPayload, Project, Telemetry } from "./lib/types";

type View = "dashboard" | "projects" | "templates" | "devices" | "live" | "history" | "notifications" | "settings";
type SaveState = "saved" | "unsaved" | "saving" | "error";

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [authScreenOpen, setAuthScreenOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(demoProjects[0].id);
  const [templates, setTemplates] = useState<DeviceTemplate[]>(demoTemplates);
  const [templateStudioId, setTemplateStudioId] = useState<string | null>(null);
  const [templateSaveStates, setTemplateSaveStates] = useState<Record<string, SaveState>>(() => Object.fromEntries(demoTemplates.map((template) => [template.id, "saved"])));
  const [templateSaveError, setTemplateSaveError] = useState<string>("");

  const selectedProject = useMemo(() => demoProjects.find((project) => project.id === selectedProjectId), [selectedProjectId]);
  const selectedDevice = useMemo(() => demoDevices.find((device) => device.project_id === selectedProjectId), [selectedProjectId]);
  const selectedTemplate = useMemo(() => templates.find((template) => template.dashboard.project_id === selectedProjectId) ?? templates[0], [selectedProjectId, templates]);

  const nav = [
    ["dashboard", LayoutDashboard, "Overview"],
    ["projects", MapPinned, "Projects"],
    ["templates", Workflow, "Templates"],
    ["devices", Cpu, "Devices"],
    ["live", PlugZap, "Live Test"],
    ["history", Database, "Data History"],
    ["notifications", Bell, "Notifications"],
    ["settings", Settings, "Settings"]
  ] as const;

  useEffect(() => {
    let mounted = true;
    async function loadTemplates() {
      try {
        const persisted = await api.demoTemplates();
        if (!mounted || !persisted.length) return;
        setTemplates(persisted);
        setTemplateSaveStates(Object.fromEntries(persisted.map((template) => [template.id, "saved"])));
      } catch {
        if (mounted) {
          setTemplates(demoTemplates);
          setTemplateSaveStates(Object.fromEntries(demoTemplates.map((template) => [template.id, "saved"])));
        }
      }
    }
    void loadTemplates();
    return () => {
      mounted = false;
    };
  }, []);

  function updateTemplate(nextTemplate: DeviceTemplate) {
    setTemplates((current) => current.map((item) => item.id === nextTemplate.id ? nextTemplate : item));
    setTemplateSaveStates((current) => ({ ...current, [nextTemplate.id]: "unsaved" }));
    setTemplateSaveError("");
  }

  async function saveTemplate(templateId: string) {
    const template = templates.find((item) => item.id === templateId);
    if (!template) return;
    setTemplateSaveStates((current) => ({ ...current, [templateId]: "saving" }));
    setTemplateSaveError("");
    try {
      const saved = await api.saveDemoTemplate(template);
      setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
      setTemplateSaveStates((current) => ({ ...current, [templateId]: "saved" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      setTemplateSaveError(message.includes("stale_template_revision") ? "Template changed on the server. Refresh, then apply your latest edits again." : "Save failed. Check the API connection and try again.");
      setTemplateSaveStates((current) => ({ ...current, [templateId]: "error" }));
    }
  }

  function handleLogin(nextSession: Session) {
    setSession(nextSession);
    setAuthScreenOpen(false);
    setView("dashboard");
  }

  function signOut() {
    clearSession();
    setSession(null);
    setAuthScreenOpen(false);
    setView("dashboard");
  }

  if (authScreenOpen) {
    return <LoginPage onLogin={handleLogin} onCancel={() => setAuthScreenOpen(false)} />;
  }

  return (
    <div className={view === "dashboard" ? "app-shell spark-ui dashboard-shell" : "app-shell spark-ui"} data-testid="app-shell">
      <aside className="sidebar">
        <div className="brand"><span className="brand-icon"><span className="material-symbols-outlined" aria-hidden="true">edgesensor_high</span></span><div><strong>Spark IoT</strong><span>Redronix Cloud</span></div></div>
        <nav aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); if (id === "templates") setTemplateStudioId(null); }}><Icon size={18} />{label}</button>)}</nav>
        <div className="workspace-card">
          <span className="section-kicker">Workspace health</span>
          <div><CheckCircle2 size={16} /><strong>Demo realtime active</strong></div>
          <small>3 projects Â· 3 devices Â· 30-day data window</small>
        </div>
        <div className={`session-card ${session ? "signed-in" : ""}`} data-testid="session-mode-card">
          <span className="section-kicker">{session ? "Account mode active" : "Demo mode active"}</span>
          <div><UserCircle size={16} /><strong>{session ? "Authenticated workspace" : "No-login preview"}</strong></div>
          <small>{session ? "Tenant API session connected. Starter limits and protected endpoints are available." : "Default sales/demo dashboard remains open before account signup."}</small>
          {session ? (
            <button type="button" onClick={signOut}><LogOut size={16} />Sign out</button>
          ) : (
            <button type="button" className="primary" onClick={() => setAuthScreenOpen(true)}><LogIn size={16} />Sign in to account</button>
          )}
        </div>
        {view !== "dashboard" && (
          <>
            <div className="responsive-card">
              <span className="section-kicker">Responsive readiness</span>
              <strong>Mobile, tablet and desktop</strong>
              <small>Overflow-safe panels, tables, code and dashboard cards</small>
            </div>
            <div className="qa-card">
              <span className="section-kicker">Quality assurance console</span>
              <div><ClipboardCheck size={16} /><strong>Keyboard, states and export checks</strong></div>
              <small>Visible focus, empty states and readable production handoff surfaces</small>
            </div>
            <div className="plan-card"><Gauge size={18} /><strong>Starter RM25</strong><span>3 devices, 3 dashboards, 30-day GPS and camera access</span></div>
          </>
        )}
      </aside>
      <main className={view === "dashboard" ? "dashboard-main" : undefined}>
        <header className={view === "dashboard" ? "topbar app-page-header cockpit-header" : "topbar app-page-header"} data-testid="cockpit-header">
          <div className={view === "dashboard" ? "dashboard-header-grid spark-page-header-grid" : "standard-header-grid"} data-testid={view === "dashboard" ? "dashboard-header-grid" : undefined}>
          <div className={view === "dashboard" ? "cockpit-title-block spark-page-header-primary" : "cockpit-title-block"} data-testid={view === "dashboard" ? "dashboard-header-primary" : undefined}>
            <div className="cockpit-kicker-row"><span className="eyebrow">{view === "dashboard" ? "Live control cockpit" : "Control Center"}</span>{view === "dashboard" && <span className="cockpit-badge">Premium industrial widgets</span>}</div>
            <h1>{view === "dashboard" ? `${selectedProject?.name ?? "Smart Irrigation"} Dashboard` : selectedProject?.name ?? "Spark IoT Dashboard"}</h1>
            {view === "dashboard" && <p>Elevated radial scale sensors, interactive video streams, GIS field coordinate tracking</p>}
            {view === "dashboard" && <div className="cockpit-simulation-strip"><RadioTower size={16} /><strong>Interactive live simulation</strong><span>Solenoid outputs synchronized with maps & video stream</span></div>}
          </div>
          <div className="top-actions">
            {view === "dashboard" && (
              <label className="project-switcher spark-page-header-selector" data-testid="dashboard-header-selector">
                <span>Dashboard</span>
                <select aria-label="Dashboard project selector" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{demoProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              </label>
            )}
            {view === "dashboard" && (
              <div className="cockpit-metrics spark-page-header-metrics" data-testid="dashboard-header-metrics">
                <span><PlugZap size={19} /><strong>{demoDevices.filter((device) => device.is_online).length}/{demoDevices.length}</strong><small>Nodes online</small></span>
                <span><LayoutDashboard size={19} /><strong>{selectedTemplate.dashboard.widgets.length}</strong><small>Widgets active</small></span>
                <span><RadioTower size={19} /><strong>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong><small>Telemetry time</small></span>
                <span><Bell size={19} /><strong>Active</strong><small>Flow safety</small></span>
              </div>
            )}
            {view !== "dashboard" && <div className="preview-status"><RadioTower size={16} /><div><strong>Production preview</strong><small>Local MVP Â· no login mode</small></div></div>}
            {view !== "dashboard" && <select aria-label="Project selector" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{demoProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
          </div>
          </div>
        </header>
        {view === "dashboard" && <LocalDashboardPage key={selectedTemplate.id} projectId={selectedProjectId} initialDashboard={selectedTemplate.dashboard} initialLatest={demoLatest} devices={selectedDevice ? [selectedDevice] : demoDevices} />}
        {view === "projects" && <ProjectsView projects={demoProjects} templates={templates} />}
        {view === "templates" && (
          templateStudioId ? (
            <TemplateStudioPage
              templates={templates}
              selectedTemplateId={templateStudioId}
              device={selectedDevice}
              latest={demoLatest}
              saveState={templateSaveStates[templateStudioId] ?? "saved"}
              saveError={templateSaveError}
              onSave={() => void saveTemplate(templateStudioId)}
              onChange={updateTemplate}
            />
          ) : (
            <TemplateLibrary
              templates={templates}
              onOpen={(template) => {
                setSelectedProjectId(template.dashboard.project_id);
                setTemplateStudioId(template.id);
              }}
            />
          )
        )}
        {view === "devices" && <DevicesPage devices={demoDevices} templates={templates} />}
        {view === "live" && <LiveBoardTestView projectId={selectedProjectId} devices={selectedDevice ? [selectedDevice] : demoDevices} latest={demoLatest} />}
        {view === "history" && <HistoryPage devices={demoDevices} initialLatest={demoLatest} />}
        {view === "notifications" && <NotificationsPage initialItems={demoNotifications} />}
        {view === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function LiveBoardTestView({ projectId, devices, latest }: { projectId: string; devices: Device[]; latest: Record<string, Telemetry> }) {
  const fallback: LiveBoardTestPayload = {
    tenant_id: "demo-tenant",
    project_id: projectId,
    mqtt: {
      host: typeof window === "undefined" ? "localhost" : window.location.hostname,
      port: 1883,
      protocol: "mqtt"
    },
    devices: devices.map((device) => ({
      id: device.id,
      name: device.name,
      board: device.board,
      is_online: device.is_online,
      last_seen_at: device.last_seen_at ?? null,
      telemetry_topic: device.telemetry_topic,
      command_topic: device.command_topic
    })),
    latest
  };
  const [payload, setPayload] = useState<LiveBoardTestPayload>(fallback);
  const [commandLogs, setCommandLogs] = useState<CommandLogItem[]>([]);
  const [status, setStatus] = useState<"connecting" | "live" | "offline">("connecting");
  const [quickTestStatus, setQuickTestStatus] = useState<"idle" | "publishing" | "published" | "error">("idle");

  useEffect(() => {
    let mounted = true;
    async function load() {
      try {
        const next = await api.demoBoardTest(projectId);
        if (!mounted) return;
        setPayload(next);
        setStatus("live");
      } catch {
        if (!mounted) return;
        setPayload(fallback);
        setStatus("offline");
      }
    }
    void load();
    const id = window.setInterval(load, 5000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [projectId]);

  const device = payload.devices[0] ?? fallback.devices[0];
  const latestRows = Object.values(payload.latest).filter((reading) => reading.device_id === device?.id);
  const hasTelemetry = latestRows.length > 0;
  const hasCommand = commandLogs.some((log) => log.status !== "ack");
  const hasAck = commandLogs.some((log) => log.status === "ack");
  const quickTestChannel = device?.id === "device-home" ? "V0" : "V3";
  const quickTestTopic = (device?.command_topic ?? "spark/v1/demo-tenant/device-irrigation/command/{channel}").replace("{channel}", quickTestChannel);
  const quickTestAckTopic = quickTestTopic.replace("/command/", "/ack/");
  const quickTestPayload = "{\"value\":true}";

  async function publishQuickTestCommand() {
    if (!device?.id) return;
    setQuickTestStatus("publishing");
    try {
      const response = await api.demoCommand(device.id, quickTestChannel, true);
      setQuickTestStatus(response.status === "published" ? "published" : "error");
      const next = await api.demoCommandLogs(device.id);
      setCommandLogs(next);
    } catch {
      setQuickTestStatus("error");
    }
  }

  useEffect(() => {
    if (!device?.id) return;
    let mounted = true;
    async function loadLogs() {
      try {
        const next = await api.demoCommandLogs(device.id);
        if (mounted) setCommandLogs(next);
      } catch {
        if (mounted) setCommandLogs([]);
      }
    }
    void loadLogs();
    const id = window.setInterval(loadLogs, 4000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [device?.id]);

  return (
    <section className="support-page live-test-page live-system-page" data-testid="live-test-page">
      <div className="support-hero live-test-hero live-system-hero" data-testid="live-test-hero">
        <div>
          <span className="section-kicker">Live board test</span>
          <h2>Connect ESP32 or NodeMCU and watch real telemetry land here</h2>
          <p>This screen is the practical test bench: MQTT broker, token, topics, latest V-pin values and board status in one place.</p>
        </div>
        <div className="support-metrics">
          <span><strong>{payload.mqtt.port}</strong><small>MQTT port</small></span>
          <span><strong>{latestRows.length}</strong><small>Live values</small></span>
          <span><strong>{status}</strong><small>API state</small></span>
        </div>
      </div>

      <section className="connection-proof-timeline" data-testid="connection-proof-timeline">
        <div>
          <span className="section-kicker">Connection proof timeline</span>
          <h2>Prove the full ESP32 / NodeMCU loop</h2>
          <p>Use this as your board test checklist: first telemetry arrives, then Spark IoT sends a dashboard command, then the board publishes an ACK.</p>
        </div>
        <div className="proof-steps">
          <ProofStep
            state={hasTelemetry ? "complete" : "waiting"}
            title="1. Telemetry received"
            body={hasTelemetry ? "Latest V-pin readings are landing from the selected board." : "Waiting for MQTT or HTTP telemetry from the selected board."}
          />
          <ProofStep
            state={hasCommand ? "complete" : "waiting"}
            title="2. Command published"
            body={hasCommand ? "A dashboard switch/button command was published to the device topic." : "Waiting for switch/button command activity."}
          />
          <ProofStep
            state={hasAck ? "complete" : "waiting"}
            title="3. Board ACK"
            body={hasAck ? "The board confirmed it received and applied the command." : "Waiting for the board to publish an ACK packet."}
          />
        </div>
      </section>

      <section className="live-test-grid live-system-grid" data-testid="live-test-grid">
        <article className="panel live-connection-card">
          <div className="panel-title"><RadioTower size={18} /><h2>MQTT broker</h2></div>
          <div className="connection-stack">
            <ConnectionLine label="Host" value={payload.mqtt.host} />
            <ConnectionLine label="Port" value={String(payload.mqtt.port)} />
            <ConnectionLine label="Tenant" value={payload.tenant_id} />
            <ConnectionLine label="Device ID" value={device?.id ?? "No device"} />
            <ConnectionLine label="Token" value={devices.find((item) => item.id === device?.id)?.token ?? "Use device token"} />
          </div>
        </article>

        <article className="panel live-topic-card">
          <div className="panel-title"><TerminalSquare size={18} /><h2>Board publish topics</h2></div>
          <p>Use these exact patterns in Arduino IDE. Replace <strong>{"{channel}"}</strong> with V0, V1, V2 and so on.</p>
          <code>{device?.telemetry_topic ?? "spark/v1/demo-tenant/device-irrigation/telemetry/{channel}"}</code>
          <code>{device?.command_topic ?? "spark/v1/demo-tenant/device-irrigation/command/{channel}"}</code>
          <div className="command-test-note">
            <strong>Command test</strong>
            <span>Click the dashboard switch. Spark IoT publishes <code>{(device?.command_topic ?? "spark/v1/demo-tenant/device-irrigation/command/{channel}").replace("{channel}", device?.id === "device-home" ? "V0" : "V3")}</code> with <code>{"{\"value\":true}"}</code> or <code>{"{\"value\":false}"}</code>.</span>
          </div>
        </article>
      </section>

      <section className="panel board-quick-test" data-testid="board-quick-test">
        <div>
          <span className="section-kicker">Board Quick Test</span>
          <h2>Publish one command and confirm the board ACK</h2>
          <p>This sends a real demo command to the selected device. Your sketch should receive it in `SparkIoT.onCommand`, apply the output, then call `SparkIoT.ack`.</p>
        </div>
        <div className="quick-test-command-grid">
          <span><small>Test command topic</small><code>{quickTestTopic}</code></span>
          <span><small>Payload</small><code>{quickTestPayload}</code></span>
          <span><small>Expected board ACK</small><code>{quickTestAckTopic}</code></span>
        </div>
        <div className="quick-test-actions">
          <button className="primary" onClick={publishQuickTestCommand} disabled={quickTestStatus === "publishing"}>
            <PlugZap size={16} />{quickTestStatus === "publishing" ? "Publishing..." : "Publish test command"}
          </button>
          <span className={`quick-test-status ${quickTestStatus}`}>{quickTestStatus === "idle" ? "Ready to test" : quickTestStatus}</span>
        </div>
      </section>

      <section className="panel live-values-panel">
        <div className="panel-title"><Database size={18} /><h2>Latest received V pins</h2></div>
        <div className="live-values-grid">
          {latestRows.length ? latestRows.map((reading) => (
            <article key={`${reading.device_id}:${reading.channel}`} className="live-value-card">
              <span>{reading.channel}</span>
              <strong>{formatLiveValue(reading.value)}{reading.unit ?? ""}</strong>
              <small>{new Date(reading.server_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</small>
            </article>
          )) : <div className="empty-state"><strong>No board data yet</strong><p>Publish MQTT telemetry to V0, V1 or another virtual pin and this panel will update.</p></div>}
        </div>
      </section>

      <section className="panel command-monitor-panel live-system-command-monitor" data-testid="live-command-monitor">
        <div className="panel-title"><TerminalSquare size={18} /><h2>Command monitor</h2></div>
        <p>Shows dashboard commands and board acknowledgements. This is how you prove the switch reached the ESP32/NodeMCU.</p>
        <div className="command-log-list">
          {commandLogs.length ? commandLogs.map((log) => (
            <article key={log.id} className={`command-log-row ${log.status}`}>
              <span className="command-log-status">{log.status === "ack" ? "Board ACK" : log.status}</span>
              <div>
                <strong>{log.channel}</strong>
                <code>{formatCommandValue(log.value)}</code>
              </div>
              <time>{new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time>
            </article>
          )) : (
            <div className="empty-state compact"><strong>No command activity yet</strong><p>Click a dashboard switch, then publish an ACK from the board to see the full loop.</p></div>
          )}
        </div>
      </section>
    </section>
  );
}

function ProofStep({ state, title, body }: { state: "complete" | "waiting"; title: string; body: string }) {
  return (
    <article className={`proof-step ${state}`}>
      <span>{state === "complete" ? <CheckCircle2 size={16} /> : <RadioTower size={16} />}</span>
      <div>
        <strong>{title}</strong>
        <p>{body}</p>
      </div>
    </article>
  );
}

function ConnectionLine({ label, value }: { label: string; value: string }) {
  return <div className="connection-line"><span>{label}</span><code>{value}</code><button onClick={() => navigator.clipboard?.writeText(value)} aria-label={`Copy ${label}`}><Copy size={14} /></button></div>;
}

function formatLiveValue(value: unknown) {
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function formatCommandValue(value: unknown) {
  if (typeof value === "object" && value !== null) return JSON.stringify(value);
  return String(value);
}

function TemplateLibrary({ templates, onOpen }: { templates: DeviceTemplate[]; onOpen: (template: DeviceTemplate) => void }) {
  const templateLimit = 3;
  const isAtLimit = templates.length >= templateLimit;

  return (
    <section className="support-page template-library-page">
      <div className="support-hero template-library-hero">
        <div>
          <span className="section-kicker">Template library</span>
          <h2>Start from a product model, then build the dashboard</h2>
          <p>Each Spark IoT template owns the board type, virtual pins, dashboard canvas, alert rules and Arduino-ready protocol for one customer project.</p>
        </div>
        <div className="support-metrics">
          <span><strong>{templates.length}/3</strong><small>Templates</small></span>
          <span><strong>{templates.reduce((total, template) => total + template.datastreams.length, 0)}</strong><small>V pins</small></span>
          <span><strong>{templates.reduce((total, template) => total + template.notifications.length, 0)}</strong><small>Rules</small></span>
        </div>
      </div>

      <div className="library-toolbar">
        <div>
          <strong>{templates.length}/3 templates used</strong>
          <span>Starter plan keeps the MVP simple: one template/dashboard per project.</span>
        </div>
        <button className="primary" disabled={isAtLimit} aria-disabled={isAtLimit} title={isAtLimit ? "Starter plan limit reached" : "Create template"}>
          {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
          Create template
        </button>
      </div>

      <section className="template-library-grid">
        {templates.map((template) => (
          <article className="panel template-library-card" key={template.id} aria-label={`${template.name} template`}>
            <div className="template-card-topline">
              <span className="template-board-badge">{template.board}</span>
              <span className="pill online-pill">Active</span>
            </div>
            <div>
              <h2>{template.name}</h2>
              <p>{template.description}</p>
            </div>
            <div className="project-stat-row">
              <span><strong>{template.datastreams.length}</strong><small>Virtual pins</small></span>
              <span><strong>{template.dashboard.widgets.length}</strong><small>Widgets</small></span>
              <span><strong>{template.notifications.length}</strong><small>Alerts</small></span>
            </div>
            <div className="template-channel-strip">
              {template.datastreams.slice(0, 5).map((stream) => <span key={stream.id}>{stream.pin}</span>)}
              {template.datastreams.length > 5 && <span>+{template.datastreams.length - 5}</span>}
            </div>
            <button className="template-open-button" onClick={() => onOpen(template)}>
              Open studio <ArrowRight size={16} />
            </button>
          </article>
        ))}
      </section>
    </section>
  );
}

function ProjectsView({ projects, templates }: { projects: Project[]; templates: DeviceTemplate[] }) {
  return (
    <section className="support-page">
      <div className="support-hero">
        <div>
          <span className="section-kicker">Project command center</span>
          <h2>Three production-ready project spaces</h2>
          <p>Each project owns one template, one dashboard, one device group and the data rules needed for a low-cost Spark IoT starter plan.</p>
        </div>
        <div className="support-metrics">
          <span><strong>{projects.length}/3</strong><small>Projects</small></span>
          <span><strong>{templates.reduce((total, template) => total + template.datastreams.length, 0)}</strong><small>Virtual pins</small></span>
          <span><strong>{templates.reduce((total, template) => total + template.dashboard.widgets.length, 0)}</strong><small>Widgets</small></span>
        </div>
      </div>
      <section className="content-grid project-grid">{projects.map((project) => {
        const template = templates.find((item) => item.dashboard.project_id === project.id);
        return (
          <article className="panel project-card" key={project.id}>
            <div className="project-card-head"><span className="status-dot online" /><span className="pill online-pill">Active</span></div>
            <h2>{project.name}</h2>
            <p>{project.description}</p>
            <div className="project-stat-row">
              <span><strong>{template?.board}</strong><small>Board</small></span>
              <span><strong>{template?.datastreams.length ?? 0}</strong><small>V pins</small></span>
              <span><strong>{template?.dashboard.widgets.length ?? 0}</strong><small>Widgets</small></span>
            </div>
          </article>
        );
      })}<article className="panel starter-capacity-card"><span className="section-kicker">Starter plan capacity</span><h2>RM25 plan limits</h2><p>3 projects, 3 devices and one template dashboard per project with 30-day data, GPS and camera access.</p></article></section>
    </section>
  );
}
