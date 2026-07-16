import { ArrowRight, Bell, CalendarClock, CheckCircle2, ClipboardCheck, Copy, Cpu, Database, Gauge, LayoutDashboard, Lock, LogIn, LogOut, MapPinned, PlugZap, Plus, RadioTower, Settings, TerminalSquare, UserCircle, Workflow } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { DashboardPage, LocalDashboardPage } from "./pages/DashboardPage";
import { DevicesPage } from "./pages/DevicesPage";
import { HistoryPage } from "./pages/HistoryPage";
import { LoginPage } from "./pages/LoginPage";
import { NotificationsPage } from "./pages/NotificationsPage";
import { SchedulesPage } from "./pages/SchedulesPage";
import { SettingsPage } from "./pages/SettingsPage";
import { StarterWorkspacePage } from "./pages/StarterWorkspacePage";
import { TemplateStudioPage } from "./pages/TemplateStudioPage";
import { VerifyEmailPage } from "./pages/VerifyEmailPage";
import { demoDevices, demoLatest, demoNotifications, demoProjects, demoTemplates } from "./lib/demoData";
import { api, clearSession, getSession, type Session } from "./lib/api";
import type { CommandLogItem, Dashboard, Device, DeviceCreate, DeviceTemplate, LiveBoardTestPayload, NotificationItem, OnboardingState, Project, ProjectCreate, ScheduleCreate, ScheduleItem, Telemetry, UserProfile } from "./lib/types";

type View = "dashboard" | "setup" | "projects" | "templates" | "devices" | "live" | "schedules" | "history" | "notifications" | "settings";
type SaveState = "saved" | "unsaved" | "saving" | "error";
type TemplatePreset = "Smart Irrigation" | "Smart Home" | "Energy Monitor" | "Blank";
type StudioLaunchStep = "Setup" | "Migrate" | "Datastreams" | "Dashboard" | "Notifications" | "Code" | "Simulator";
type QuickStartDraft = { projectName: string; projectDescription: string; board: DeviceTemplate["board"]; preset: TemplatePreset; deviceName: string };

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [authScreenOpen, setAuthScreenOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(demoProjects[0].id);
  const [templates, setTemplates] = useState<DeviceTemplate[]>(demoTemplates);
  const [accountProjects, setAccountProjects] = useState<Project[]>([]);
  const [accountDevices, setAccountDevices] = useState<Device[]>([]);
  const [accountTemplates, setAccountTemplates] = useState<DeviceTemplate[]>([]);
  const [accountDashboards, setAccountDashboards] = useState<Record<string, Dashboard>>({});
  const [accountLatest, setAccountLatest] = useState<Record<string, Telemetry>>({});
  const [accountNotifications, setAccountNotifications] = useState<NotificationItem[]>([]);
  const [accountSchedules, setAccountSchedules] = useState<ScheduleItem[]>([]);
  const [accountUsage, setAccountUsage] = useState<{ devices: number; max_devices: number; projects: number; max_projects: number; retention_days: number } | null>(null);
  const [accountLoadState, setAccountLoadState] = useState<"idle" | "loading" | "ready" | "error">("idle");
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [onboarding, setOnboarding] = useState<OnboardingState | null>(null);
  const [demoPreviewMode, setDemoPreviewMode] = useState(false);
  const [templateStudioId, setTemplateStudioId] = useState<string | null>(null);
  const [templateStudioInitialStep, setTemplateStudioInitialStep] = useState<StudioLaunchStep>("Setup");
  const [templateSaveStates, setTemplateSaveStates] = useState<Record<string, SaveState>>(() => Object.fromEntries(demoTemplates.map((template) => [template.id, "saved"])));
  const [templateSaveError, setTemplateSaveError] = useState<string>("");

  const isAccountMode = Boolean(session) && !demoPreviewMode;
  const activeProjects = isAccountMode ? accountProjects : demoProjects;
  const activeDevices = isAccountMode ? accountDevices : demoDevices;
  const activeLatest = isAccountMode ? accountLatest : demoLatest;
  const activeTemplates = isAccountMode ? accountTemplates : templates;
  const selectedProject = useMemo(() => activeProjects.find((project) => project.id === selectedProjectId), [activeProjects, selectedProjectId]);
  const selectedDevice = useMemo(() => activeDevices.find((device) => device.project_id === selectedProjectId), [activeDevices, selectedProjectId]);
  const selectedTemplate = useMemo(() => activeTemplates.find((template) => template.dashboard.project_id === selectedProjectId) ?? activeTemplates[0] ?? templates[0], [activeTemplates, selectedProjectId, templates]);

  const nav = [
    ["dashboard", LayoutDashboard, "Overview"],
    ["projects", MapPinned, "Projects"],
    ["templates", Workflow, "Templates"],
    ["devices", Cpu, "Devices"],
    ["live", PlugZap, "Live Test"],
    ["schedules", CalendarClock, "Schedules"],
    ["history", Database, "Data History"],
    ["notifications", Bell, "Notifications"],
    ["settings", Settings, "Settings"]
  ] as const;

  async function refreshAccountData() {
    if (!session) return;
    const [me, onboardingState] = await Promise.all([
      api.me().catch(() => null),
      api.onboarding().catch(() => null)
    ]);
    setUserProfile(me);
    setOnboarding(onboardingState);
  }

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

  useEffect(() => {
    let mounted = true;
    async function loadAccountWorkspace() {
      if (!session) {
        setAccountProjects([]);
        setAccountDevices([]);
        setAccountTemplates([]);
        setAccountDashboards({});
        setAccountLatest({});
        setAccountNotifications([]);
        setAccountSchedules([]);
        setAccountUsage(null);
        setUserProfile(null);
        setOnboarding(null);
        setDemoPreviewMode(false);
        setAccountLoadState("idle");
        if (!demoProjects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(demoProjects[0].id);
        return;
      }
      setAccountLoadState("loading");
      try {
        const [me, onboardingState] = await Promise.all([
          api.me().catch(() => null),
          api.onboarding().catch(() => null)
        ]);
        if (!mounted) return;
        setUserProfile(me);
        setOnboarding(onboardingState);
        if (me && !me.email_verified) {
          setAccountLoadState("ready");
          return;
        }
        const [projects, devices, accountTemplateRows, notifications, schedules, usage] = await Promise.all([
          api.projects(),
          api.devices(),
          api.templates().catch(() => []),
          api.notifications().catch(() => []),
          api.schedules().catch(() => []),
          api.usage().catch(() => null)
        ]);
        if (!mounted) return;
        setAccountProjects(projects);
        setAccountDevices(devices);
        setAccountTemplates(accountTemplateRows);
        setTemplateSaveStates((current) => ({ ...current, ...Object.fromEntries(accountTemplateRows.map((template) => [template.id, "saved" as SaveState])) }));
        setAccountNotifications(notifications);
        setAccountSchedules(schedules);
        setAccountUsage(usage);
        setAccountLoadState("ready");
        if (projects.length && !projects.some((project) => project.id === selectedProjectId)) setSelectedProjectId(projects[0].id);
      } catch {
        if (mounted) setAccountLoadState("error");
      }
    }
    void loadAccountWorkspace();
    return () => {
      mounted = false;
    };
  }, [session]);

  useEffect(() => {
    if (!session || !selectedProjectId || !accountProjects.some((project) => project.id === selectedProjectId)) return;
    let mounted = true;
    async function loadSelectedAccountProject() {
      try {
        const [dashboard, readings] = await Promise.all([api.dashboard(selectedProjectId), api.latest(selectedProjectId)]);
        if (!mounted) return;
        setAccountDashboards((current) => ({ ...current, [selectedProjectId]: dashboard }));
        setAccountLatest(Object.fromEntries(readings.map((reading) => [`${reading.device_id}:${reading.channel}`, reading])));
      } catch {
        // Keep the account shell usable even when a tenant has no dashboard yet.
      }
    }
    void loadSelectedAccountProject();
    return () => {
      mounted = false;
    };
  }, [session, selectedProjectId, accountProjects]);

  function updateTemplate(nextTemplate: DeviceTemplate) {
    if (isAccountMode) {
      setAccountTemplates((current) => current.map((item) => item.id === nextTemplate.id ? nextTemplate : item));
    } else {
      setTemplates((current) => current.map((item) => item.id === nextTemplate.id ? nextTemplate : item));
    }
    setTemplateSaveStates((current) => ({ ...current, [nextTemplate.id]: "unsaved" }));
    setTemplateSaveError("");
  }

  async function saveTemplate(templateId: string) {
    const source = isAccountMode ? accountTemplates : templates;
    const template = source.find((item) => item.id === templateId);
    if (!template) return;
    setTemplateSaveStates((current) => ({ ...current, [templateId]: "saving" }));
    setTemplateSaveError("");
    try {
      const saved = isAccountMode ? await api.saveTemplate(template) : await api.saveDemoTemplate(template);
      if (isAccountMode) {
        setAccountTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
        setAccountDashboards((current) => ({ ...current, [saved.dashboard.project_id]: saved.dashboard }));
      } else {
        setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
      }
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
    setDemoPreviewMode(false);
    setView("dashboard");
  }

  function signOut() {
    clearSession();
    setSession(null);
    setAuthScreenOpen(false);
    setUserProfile(null);
    setOnboarding(null);
    setDemoPreviewMode(false);
    setView("dashboard");
  }

  async function createAccountSchedule(schedule: ScheduleCreate) {
    const created = await api.createSchedule(schedule);
    setAccountSchedules((current) => [created, ...current]);
    return created;
  }

  async function regenerateAccountDeviceToken(deviceId: string) {
    const updated = await api.regenerateDeviceToken(deviceId);
    setAccountDevices((current) => current.map((device) => device.id === updated.id ? updated : device));
    return updated;
  }

  async function createAccountDevice(device: DeviceCreate) {
    const created = await api.createDevice(device);
    setAccountDevices((current) => [created, ...current]);
    return created;
  }

  async function createAccountProject(project: ProjectCreate) {
    const created = await api.createProject(project);
    setAccountProjects((current) => [created, ...current]);
    setSelectedProjectId(created.id);
    markFirstProjectCreated(created.id);
    return created;
  }

  async function createAccountTemplate(projectId: string, board: DeviceTemplate["board"], preset: TemplatePreset) {
    const project = accountProjects.find((item) => item.id === projectId);
    if (!project) throw new Error("Project not found");
    const dashboard = accountDashboards[projectId] ?? await api.dashboard(projectId);
    const device = accountDevices.find((item) => item.project_id === projectId);
    const draft = buildStarterTemplateDraft(project, dashboard, device, board, preset);
    const created = await api.createTemplate(draft);
    setAccountTemplates((current) => [created, ...current.filter((item) => item.id !== created.id)]);
    setAccountDashboards((current) => ({ ...current, [created.dashboard.project_id]: created.dashboard }));
    setTemplateSaveStates((current) => ({ ...current, [created.id]: "saved" }));
    setSelectedProjectId(created.dashboard.project_id);
    setTemplateStudioId(created.id);
    return created;
  }

  async function createAccountQuickStart(draft: QuickStartDraft) {
    const projectName = draft.projectName.trim();
    const projectDescription = draft.projectDescription.trim();
    const deviceName = draft.deviceName.trim();
    if (!projectName || !deviceName) throw new Error("Project and device name are required");

    const project = await api.createProject({
      name: projectName,
      description: projectDescription || `${draft.preset} workspace`
    });
    const dashboard = await api.dashboard(project.id);
    const templateDraft = buildStarterTemplateDraft(project, dashboard, undefined, draft.board, draft.preset);
    const template = await api.createTemplate(templateDraft);
    const device = await api.createDevice({ project_id: project.id, name: deviceName, board: draft.board });

    setAccountProjects((current) => [project, ...current.filter((item) => item.id !== project.id)]);
    setAccountDashboards((current) => ({ ...current, [project.id]: template.dashboard }));
    setAccountTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
    setAccountDevices((current) => [device, ...current.filter((item) => item.id !== device.id)]);
    setTemplateSaveStates((current) => ({ ...current, [template.id]: "saved" }));
    setSelectedProjectId(project.id);
    markFirstProjectCreated(project.id);
    setTemplateStudioInitialStep("Code");
    setTemplateStudioId(template.id);
    setView("templates");
  }

  async function openDemoPreview() {
    setDemoPreviewMode(true);
    if (onboarding) {
      const updated = { ...onboarding, demo_viewed: true };
      setOnboarding(updated);
      try {
        await api.updateOnboarding(updated);
      } catch {
        // Demo preview still works if the progress update fails.
      }
    }
  }

  function markFirstProjectCreated(projectId: string) {
    if (!onboarding) return;
    if (onboarding.first_project_id) return;
    const updated = {
      ...onboarding,
      current_step: "project",
      completed_steps: Array.from(new Set([...onboarding.completed_steps, "starter_workspace", "project"])),
      first_project_id: projectId,
    };
    setOnboarding(updated);
    void api.updateOnboarding(updated).catch(() => {
      // Project creation succeeded; keep the UI moving even if progress persistence needs retry later.
    });
  }

  function openSelectedTemplateStudio(initialStep: StudioLaunchStep = "Setup") {
    const template = selectedTemplate ?? activeTemplates[0] ?? templates[0];
    if (!template) {
      setView("templates");
      setTemplateStudioId(null);
      return;
    }
    setSelectedProjectId(template.dashboard.project_id);
    setTemplateStudioInitialStep(initialStep);
    setTemplateStudioId(template.id);
    setView("templates");
  }

  if (authScreenOpen) {
    return <LoginPage onLogin={handleLogin} onCancel={() => setAuthScreenOpen(false)} />;
  }

  const onboardingStep = onboarding?.current_step ?? userProfile?.onboarding_step;

  if (session && userProfile && !userProfile.email_verified && !demoPreviewMode) {
    return (
      <VerifyEmailPage
        user={userProfile}
        onVerified={() => {
          void refreshAccountData();
        }}
        onPreviewDemo={() => void openDemoPreview()}
        onLogout={signOut}
      />
    );
  }

  if (session && userProfile?.email_verified && accountLoadState === "ready" && accountProjects.length === 0 && view === "dashboard" && !demoPreviewMode && (onboardingStep === "starter_workspace" || onboardingStep === undefined)) {
    return (
      <StarterWorkspacePage
        user={userProfile}
        onCreateProject={() => setView("setup")}
        onOpenSetupFlow={() => setView("setup")}
        onPreviewDemo={() => void openDemoPreview()}
      />
    );
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
          <span className="section-kicker">{isAccountMode ? "Account mode active" : demoPreviewMode ? "Demo preview active" : "Demo mode active"}</span>
          <div><UserCircle size={16} /><strong>{isAccountMode ? "Authenticated workspace" : demoPreviewMode ? "Simulated dashboard preview" : "No-login preview"}</strong></div>
          <small>{isAccountMode ? "Tenant API session connected. Starter limits and protected endpoints are available." : demoPreviewMode ? "Previewing Spark IoT with simulated telemetry before creating real tenant data." : "Default sales/demo dashboard remains open before account signup."}</small>
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
          <div className={view === "dashboard" ? "dashboard-header-grid spark-page-header-grid product-header-grid" : "standard-header-grid product-header-grid"} data-testid={view === "dashboard" ? "dashboard-header-grid" : undefined}>
          <div className={view === "dashboard" ? "cockpit-title-block spark-page-header-primary" : "cockpit-title-block"} data-testid={view === "dashboard" ? "dashboard-header-primary" : undefined}>
            <div className="cockpit-kicker-row"><span className="eyebrow">{view === "dashboard" ? "Live control cockpit" : "Control Center"}</span>{view === "dashboard" && <span className="cockpit-badge">Premium industrial widgets</span>}</div>
            <h1>{view === "dashboard" ? `${selectedProject?.name ?? "Smart Irrigation"} Dashboard` : selectedProject?.name ?? "Spark IoT Dashboard"}</h1>
            {view === "dashboard" && <p>Elevated radial scale sensors, interactive video streams, GIS field coordinate tracking</p>}
          </div>
          <div className="top-actions">
            {view === "dashboard" && (
              <label className="project-switcher spark-page-header-selector" data-testid="dashboard-header-selector">
                <span>Dashboard</span>
                <select aria-label="Dashboard project selector" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>
              </label>
            )}
            {view === "dashboard" && (
              <div className="cockpit-metrics spark-page-header-metrics" data-testid="dashboard-header-metrics">
                <span><PlugZap size={19} /><strong>{activeDevices.filter((device) => device.is_online).length}/{activeDevices.length}</strong><small>Nodes online</small></span>
                <span><LayoutDashboard size={19} /><strong>{selectedTemplate?.dashboard.widgets.length ?? 0}</strong><small>Widgets active</small></span>
                <span><RadioTower size={19} /><strong>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</strong><small>Telemetry time</small></span>
                <span><Bell size={19} /><strong>Active</strong><small>Flow safety</small></span>
              </div>
            )}
            {view !== "dashboard" && <div className="preview-status"><RadioTower size={16} /><div><strong>Production preview</strong><small>Local MVP Â· no login mode</small></div></div>}
            {view !== "dashboard" && <select aria-label="Project selector" value={selectedProjectId} onChange={(event) => setSelectedProjectId(event.target.value)}>{activeProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}</select>}
          </div>
          </div>
        </header>
        {demoPreviewMode && (
          <div className="demo-preview-banner" role="status">
            <strong>Demo dashboard</strong>
            <span>Simulated telemetry. Create your first project to connect real hardware.</span>
            <button type="button" onClick={() => setDemoPreviewMode(false)}>Back to workspace</button>
          </div>
        )}
        {view === "setup" && (
          <LaunchWizardPanel
            projectCount={activeProjects.length}
            templateCount={activeTemplates.length}
            deviceCount={activeDevices.length}
            datastreamCount={selectedTemplate?.datastreams.length ?? 0}
            selectedProjectName={selectedProject?.name ?? "Spark IoT project"}
            selectedDeviceName={selectedDevice?.name ?? activeDevices[0]?.name ?? "ESP board"}
            accountMode={isAccountMode}
            onCreateQuickStart={isAccountMode ? createAccountQuickStart : undefined}
            onOpenProjects={() => setView("projects")}
            onOpenTemplate={() => openSelectedTemplateStudio("Setup")}
            onOpenDatastreams={() => openSelectedTemplateStudio("Datastreams")}
            onOpenDevices={() => setView("devices")}
            onOpenCode={() => openSelectedTemplateStudio("Code")}
            onOpenLiveTest={() => setView("live")}
          />
        )}
        {view === "dashboard" && (isAccountMode ? <DashboardPage key={selectedProjectId} projectId={selectedProjectId} devices={selectedDevice ? [selectedDevice] : activeDevices} /> : <LocalDashboardPage key={selectedTemplate.id} projectId={selectedProjectId} initialDashboard={selectedTemplate.dashboard} initialLatest={demoLatest} devices={selectedDevice ? [selectedDevice] : demoDevices} />)}
        {view === "setup" && (
          <section className="setup-flow-note panel">
            <span className="section-kicker">Setup lives here now</span>
            <h2>Keep Overview clean, open the full builder only when needed</h2>
            <p>The Overview stays focused on live telemetry. This setup page keeps the professional Blynk-style onboarding flow available for projects, templates, V-pins, devices, Arduino code and board testing.</p>
          </section>
        )}
        {view === "projects" && <ProjectsView projects={activeProjects} templates={activeTemplates} accountMode={isAccountMode} onCreateProject={isAccountMode ? createAccountProject : undefined} />}
        {view === "templates" && (
          templateStudioId ? (
            <TemplateStudioPage
              key={`${templateStudioId}-${templateStudioInitialStep}`}
              templates={activeTemplates}
              selectedTemplateId={templateStudioId}
              initialStep={templateStudioInitialStep}
              device={selectedDevice}
              latest={activeLatest}
              saveState={templateSaveStates[templateStudioId] ?? "saved"}
              saveError={templateSaveError}
              onSave={() => void saveTemplate(templateStudioId)}
              onChange={updateTemplate}
            />
          ) : (
            <TemplateLibrary
              templates={activeTemplates}
              projects={activeProjects}
              accountMode={isAccountMode}
              onCreateTemplate={isAccountMode ? createAccountTemplate : undefined}
              onOpen={(template) => {
                setSelectedProjectId(template.dashboard.project_id);
                setTemplateStudioInitialStep("Setup");
                setTemplateStudioId(template.id);
              }}
            />
          )
        )}
        {view === "devices" && (
          <DevicesPage
            devices={activeDevices}
            templates={activeTemplates}
            projects={activeProjects}
            accountMode={isAccountMode}
            onCreateDevice={isAccountMode ? createAccountDevice : undefined}
            onRegenerateToken={isAccountMode ? regenerateAccountDeviceToken : undefined}
          />
        )}
        {view === "live" && <LiveBoardTestView projectId={selectedProjectId} devices={selectedDevice ? [selectedDevice] : activeDevices} latest={activeLatest} accountMode={isAccountMode} />}
        {view === "schedules" && (
          <SchedulesPage
            accountMode={isAccountMode}
            projects={activeProjects}
            devices={activeDevices}
            schedules={accountSchedules}
            selectedProjectId={selectedProjectId}
            onCreateSchedule={createAccountSchedule}
          />
        )}
        {view === "history" && <HistoryPage devices={activeDevices} initialLatest={activeLatest} accountMode={isAccountMode} />}
        {view === "notifications" && <NotificationsPage initialItems={isAccountMode ? accountNotifications : demoNotifications} accountMode={isAccountMode} />}
        {view === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function LaunchWizardPanel({
  projectCount,
  templateCount,
  deviceCount,
  datastreamCount,
  selectedProjectName,
  selectedDeviceName,
  accountMode = false,
  onCreateQuickStart,
  onOpenProjects,
  onOpenTemplate,
  onOpenDatastreams,
  onOpenDevices,
  onOpenCode,
  onOpenLiveTest
}: {
  projectCount: number;
  templateCount: number;
  deviceCount: number;
  datastreamCount: number;
  selectedProjectName: string;
  selectedDeviceName: string;
  accountMode?: boolean;
  onCreateQuickStart?: (draft: QuickStartDraft) => Promise<void>;
  onOpenProjects: () => void;
  onOpenTemplate: () => void;
  onOpenDatastreams: () => void;
  onOpenDevices: () => void;
  onOpenCode: () => void;
  onOpenLiveTest: () => void;
}) {
  const [quickStartDraft, setQuickStartDraft] = useState<QuickStartDraft>({
    projectName: "Smart Irrigation",
    projectDescription: "GPS, camera and pump controls",
    board: "ESP32",
    preset: "Smart Irrigation",
    deviceName: "ESP32 Irrigation Node"
  });
  const [quickStartState, setQuickStartState] = useState<"idle" | "building" | "error">("idle");
  const [quickStartError, setQuickStartError] = useState("");
  const steps = [
    { title: "Create project", detail: `${projectCount}/3 projects ready`, action: "Open project setup", onClick: onOpenProjects, icon: MapPinned },
    { title: "Choose template", detail: `${templateCount}/3 templates ready`, action: "Open template studio", onClick: onOpenTemplate, icon: Workflow },
    { title: "Add datastreams", detail: `${datastreamCount} virtual pins mapped`, action: "Edit datastreams", onClick: onOpenDatastreams, icon: Database },
    { title: "Add device", detail: `${deviceCount}/3 devices provisioned`, action: "Open devices", onClick: onOpenDevices, icon: Cpu },
    { title: "Generate Arduino code", detail: `Sketch targets ${selectedDeviceName}`, action: "Open code generator", onClick: onOpenCode, icon: TerminalSquare },
    { title: "Live board test", detail: "MQTT telemetry and command ACK", action: "Open live test", onClick: onOpenLiveTest, icon: PlugZap }
  ] as const;

  async function buildQuickStartWorkspace() {
    if (!onCreateQuickStart) return;
    setQuickStartState("building");
    setQuickStartError("");
    try {
      await onCreateQuickStart(quickStartDraft);
      setQuickStartState("idle");
    } catch (error) {
      setQuickStartState("error");
      setQuickStartError(error instanceof Error ? error.message : "Quick start failed. Check Starter plan limits and try again.");
    }
  }

  return (
    <section className="launch-wizard-panel" data-testid="launch-wizard-panel" aria-label="Spark IoT first-use launch wizard">
      <div className="launch-wizard-copy">
        <span className="section-kicker">Customer onboarding</span>
        <h2>Spark IoT Launch Wizard</h2>
        <p>Follow the same professional flow customers expect from Blynk, but faster for Rectronx boards: project, template, V-pins, device token, Arduino code and live proof.</p>
        <div className="launch-wizard-status">
          <span><CheckCircle2 size={16} /><strong>6/6 ready</strong></span>
          <small>{selectedProjectName} is ready for ESP32 / NodeMCU testing.</small>
        </div>
        {accountMode && (
          <div className="account-quickstart-card" data-testid="account-quickstart-card">
            <span className="section-kicker">Account Quick Start Builder</span>
            <div className="account-quickstart-grid">
              <label>
                Project name
                <input
                  aria-label="Quick start project name"
                  value={quickStartDraft.projectName}
                  onChange={(event) => setQuickStartDraft((current) => ({ ...current, projectName: event.target.value }))}
                />
              </label>
              <label>
                Description
                <input
                  aria-label="Quick start project description"
                  value={quickStartDraft.projectDescription}
                  onChange={(event) => setQuickStartDraft((current) => ({ ...current, projectDescription: event.target.value }))}
                />
              </label>
              <label>
                Board
                <select
                  aria-label="Quick start board"
                  value={quickStartDraft.board}
                  onChange={(event) => setQuickStartDraft((current) => ({ ...current, board: event.target.value as DeviceTemplate["board"] }))}
                >
                  {["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"].map((board) => <option key={board}>{board}</option>)}
                </select>
              </label>
              <label>
                Preset
                <select
                  aria-label="Quick start preset"
                  value={quickStartDraft.preset}
                  onChange={(event) => setQuickStartDraft((current) => ({ ...current, preset: event.target.value as TemplatePreset }))}
                >
                  {["Smart Irrigation", "Smart Home", "Energy Monitor", "Blank"].map((preset) => <option key={preset}>{preset}</option>)}
                </select>
              </label>
              <label>
                Device name
                <input
                  aria-label="Quick start device name"
                  value={quickStartDraft.deviceName}
                  onChange={(event) => setQuickStartDraft((current) => ({ ...current, deviceName: event.target.value }))}
                />
              </label>
            </div>
            <button className="primary" type="button" onClick={() => void buildQuickStartWorkspace()} disabled={quickStartState === "building"}>
              <Plus size={16} />{quickStartState === "building" ? "Building..." : "Build workspace"}
            </button>
            {quickStartError && <small className="account-quickstart-error">{quickStartError}</small>}
          </div>
        )}
      </div>
      <div className="launch-wizard-steps">
        {steps.map((step, index) => {
          const Icon = step.icon;
          return (
            <article key={step.title} className="launch-wizard-step">
              <span className="launch-wizard-step-number">{index + 1}</span>
              <Icon size={18} />
              <div>
                <strong>{step.title}</strong>
                <small>{step.detail}</small>
              </div>
              <button type="button" onClick={step.onClick}>{step.action}<ArrowRight size={14} /></button>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LiveBoardTestView({ projectId, devices, latest, accountMode = false }: { projectId: string; devices: Device[]; latest: Record<string, Telemetry>; accountMode?: boolean }) {
  const fallback: LiveBoardTestPayload = {
    tenant_id: tenantFromDeviceTopic(devices[0]?.telemetry_topic) ?? "demo-tenant",
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
      if (accountMode) {
        setPayload(fallback);
        setStatus(devices.length ? "live" : "offline");
        return;
      }
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
  }, [accountMode, devices, projectId, latest]);

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
      if (accountMode) {
        await api.command(device.id, quickTestChannel, true);
        setQuickTestStatus("published");
        const queuedLog = {
          id: `local-command-${Date.now()}`,
          device_id: device.id,
          channel: quickTestChannel,
          value: true,
          status: "Command queued",
          created_at: new Date().toISOString()
        };
        try {
          const next = await api.commandLogs(device.id);
          setCommandLogs(next.length ? next : [queuedLog]);
        } catch {
          setCommandLogs((current) => [queuedLog, ...current]);
        }
      } else {
        const response = await api.demoCommand(device.id, quickTestChannel, true);
        setQuickTestStatus(response.status === "published" ? "published" : "error");
        const next = await api.demoCommandLogs(device.id);
        setCommandLogs(next);
      }
    } catch {
      setQuickTestStatus("error");
    }
  }

  useEffect(() => {
    if (!device?.id) return;
    let mounted = true;
    async function loadLogs() {
      try {
        const next = accountMode ? await api.commandLogs(device.id) : await api.demoCommandLogs(device.id);
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
  }, [accountMode, device?.id]);

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

      <section className="panel board-readiness-checklist" data-testid="board-readiness-checklist">
        <div>
          <span className="section-kicker">Real board readiness</span>
          <h2>Before you upload the sketch</h2>
          <p>Use this quick checklist when testing ESP32, NodeMCU ESP8266, Arduino Uno R4 WiFi or Ethernet boards.</p>
        </div>
        <div className="readiness-steps">
          <span><CheckCircle2 size={16} /><strong>Install SparkIoT v1.0.0</strong><small>Arduino IDE library plus PubSubClient.</small></span>
          <span><RadioTower size={16} /><strong>Set broker host</strong><small>34.73.29.12 or your LAN IP</small></span>
          <span><TerminalSquare size={16} /><strong>Open Serial Monitor at 115200</strong><small>Watch WiFi, MQTT and command logs.</small></span>
          <span><Database size={16} /><strong>Publish V0 telemetry</strong><small>Confirm a live value appears here.</small></span>
          <span><PlugZap size={16} /><strong>Confirm command ACK</strong><small>Switch command must return board ACK.</small></span>
        </div>
      </section>

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
          <p>This sends a real command to the selected device. Your sketch should receive it in `SparkIoT.onCommand`, apply the output, then call `SparkIoT.ack`.</p>
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

function tenantFromDeviceTopic(topic?: string) {
  const parts = topic?.split("/") ?? [];
  return parts.length >= 4 && parts[0] === "spark" && parts[1] === "v1" ? parts[2] : undefined;
}

function buildStarterTemplateDraft(project: Project, dashboard: Dashboard, device: Device | undefined, board: DeviceTemplate["board"], preset: TemplatePreset): DeviceTemplate {
  const seedStreams = starterDatastreams(preset);
  const datastreams = seedStreams.map((stream, index) => ({ ...stream, id: `ds-${project.id}-${index}` }));
  const widgets = datastreams.slice(0, 10).map((stream, index) => {
    const type = widgetTypeForTemplateStream(stream.dataType);
    const isWide = type === "gps" || type === "camera" || type === "serial_lcd";
    return {
      id: `w-${project.id}-${index}`,
      type,
      title: stream.name,
      x: (index % 4) * 3,
      y: Math.floor(index / 4) * 3,
      w: isWide ? 6 : 3,
      h: isWide ? 3 : 2,
      deviceId: device?.id ?? "",
      channel: stream.pin,
      datastreamId: stream.id,
      unit: stream.unit,
      min: stream.min,
      max: stream.max,
      color: stream.color,
      align: "center" as const
    };
  });
  return {
    id: `draft-${project.id}`,
    name: project.name,
    board,
    description: `${preset} template for ${project.name}`,
    revision: 1,
    datastreams,
    notifications: datastreams[0] ? [{
      id: `rule-${project.id}-${datastreams[0].pin}`,
      name: `${datastreams[0].name} Alert`,
      datastreamId: datastreams[0].id,
      operator: ">",
      threshold: datastreams[0].max ? Math.round(datastreams[0].max * 0.8) : 1,
      channel: "push",
      cooldownMinutes: 15
    }] : [],
    dashboard: {
      ...dashboard,
      name: `${project.name} Dashboard`,
      widgets
    }
  };
}

function starterDatastreams(preset: TemplatePreset) {
  const streams = {
    "Smart Irrigation": [
      ["Temperature", "V0", "float", "C", 0, 100, "#2563eb"],
      ["Humidity", "V1", "integer", "%", 0, 100, "#0ea5e9"],
      ["Soil Moisture", "V2", "integer", "%", 0, 100, "#10b981"],
      ["Pump Control", "V3", "boolean", "", 0, 1, "#f59e0b"],
      ["GPS Location", "V4", "gps", "", undefined, undefined, "#2563eb"],
      ["Camera Snapshot", "V5", "image", "", undefined, undefined, "#7c3aed"]
    ],
    "Smart Home": [
      ["Room Temperature", "V0", "float", "C", 0, 60, "#2563eb"],
      ["Main Switch", "V1", "boolean", "", 0, 1, "#10b981"],
      ["LED State", "V2", "boolean", "", 0, 1, "#f59e0b"],
      ["Power Meter", "V3", "float", "W", 0, 5000, "#0ea5e9"],
      ["LCD Message", "V4", "string", "", undefined, undefined, "#64748b"]
    ],
    "Energy Monitor": [
      ["Voltage", "V0", "float", "V", 0, 260, "#2563eb"],
      ["Current", "V1", "float", "A", 0, 100, "#0ea5e9"],
      ["Power", "V2", "float", "W", 0, 10000, "#10b981"],
      ["Energy", "V3", "float", "kWh", 0, 1000, "#f59e0b"],
      ["Relay", "V4", "boolean", "", 0, 1, "#7c3aed"]
    ],
    Blank: [
      ["Value", "V0", "float", "", 0, 100, "#2563eb"]
    ]
  } satisfies Record<TemplatePreset, Array<[string, `V${number}`, DeviceTemplate["datastreams"][number]["dataType"], string, number | undefined, number | undefined, string]>>;
  return streams[preset].map(([name, pin, dataType, unit, min, max, color]) => ({ name, pin, dataType, unit, min, max, color }));
}

function widgetTypeForTemplateStream(dataType: DeviceTemplate["datastreams"][number]["dataType"]) {
  if (dataType === "boolean") return "switch";
  if (dataType === "gps") return "gps";
  if (dataType === "image") return "camera";
  if (dataType === "string") return "serial_lcd";
  if (dataType === "time") return "time";
  if (dataType === "date") return "date";
  return "gauge";
}

function TemplateLibrary({
  templates,
  projects,
  accountMode = false,
  onCreateTemplate,
  onOpen
}: {
  templates: DeviceTemplate[];
  projects: Project[];
  accountMode?: boolean;
  onCreateTemplate?: (projectId: string, board: DeviceTemplate["board"], preset: TemplatePreset) => Promise<DeviceTemplate>;
  onOpen: (template: DeviceTemplate) => void;
}) {
  const templateLimit = 3;
  const isAtLimit = templates.length >= templateLimit;
  const availableProjects = projects.filter((project) => !templates.some((template) => template.dashboard.project_id === project.id));
  const [createOpen, setCreateOpen] = useState(false);
  const [draftProjectId, setDraftProjectId] = useState(availableProjects[0]?.id ?? projects[0]?.id ?? "");
  const [draftBoard, setDraftBoard] = useState<DeviceTemplate["board"]>("ESP32");
  const [draftPreset, setDraftPreset] = useState<TemplatePreset>("Smart Irrigation");
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState("");

  useEffect(() => {
    if (!draftProjectId && availableProjects[0]) setDraftProjectId(availableProjects[0].id);
  }, [draftProjectId, availableProjects]);

  async function createTemplate() {
    if (!onCreateTemplate || isAtLimit || !draftProjectId) return;
    setCreateState("saving");
    setCreateMessage("");
    try {
      const created = await onCreateTemplate(draftProjectId, draftBoard, draftPreset);
      setCreateState("saved");
      setCreateMessage("Template created. Open studio to configure datastreams, dashboard and code.");
      setCreateOpen(false);
      onOpen(created);
    } catch {
      setCreateState("error");
      setCreateMessage("Template creation failed. Check project limits and API session.");
    }
  }

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
        <button
          className="primary"
          disabled={isAtLimit || (accountMode && (!onCreateTemplate || !availableProjects.length))}
          aria-disabled={isAtLimit || (accountMode && (!onCreateTemplate || !availableProjects.length))}
          title={isAtLimit ? "Starter plan limit reached" : accountMode ? "Create account template" : "Demo templates are already filled"}
          onClick={() => accountMode && setCreateOpen((current) => !current)}
        >
          {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
          Create template
        </button>
      </div>

      {createOpen && (
        <article className="panel project-create-card" data-testid="template-create-form">
          <div>
            <span className="section-kicker">New device template</span>
            <h2>Create template</h2>
            <p>Select the project, board and starter preset. Spark IoT will generate virtual pins, starter widgets and Arduino-ready bindings.</p>
          </div>
          <div className="project-create-grid">
            <label>
              Project
              <select aria-label="Template project" value={draftProjectId} onChange={(event) => setDraftProjectId(event.target.value)}>
                {availableProjects.map((project) => <option key={project.id} value={project.id}>{project.name}</option>)}
              </select>
            </label>
            <label>
              Board
              <select aria-label="Template board" value={draftBoard} onChange={(event) => setDraftBoard(event.target.value as DeviceTemplate["board"])}>
                {["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"].map((board) => <option key={board}>{board}</option>)}
              </select>
            </label>
            <label>
              Preset
              <select aria-label="Template preset" value={draftPreset} onChange={(event) => setDraftPreset(event.target.value as TemplatePreset)}>
                {["Smart Irrigation", "Smart Home", "Energy Monitor", "Blank"].map((preset) => <option key={preset}>{preset}</option>)}
              </select>
            </label>
          </div>
          <div className="provisioning-actions">
            <button className="primary" type="button" disabled={createState === "saving"} onClick={() => void createTemplate()}>
              <Plus size={16} />{createState === "saving" ? "Saving..." : "Save template"}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
          </div>
        </article>
      )}

      {createMessage && <span className={`project-create-state ${createState}`}>{createMessage}</span>}

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

function ProjectsView({ projects, templates, accountMode = false, onCreateProject }: { projects: Project[]; templates: DeviceTemplate[]; accountMode?: boolean; onCreateProject?: (project: ProjectCreate) => Promise<Project> }) {
  const projectLimit = 3;
  const isAtLimit = projects.length >= projectLimit;
  const [createOpen, setCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectCreate>({ name: "", description: "" });
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState("");

  async function createProject() {
    if (!onCreateProject || isAtLimit) return;
    const name = projectDraft.name.trim();
    const description = projectDraft.description.trim();
    if (name.length < 2) {
      setCreateState("error");
      setCreateMessage("Enter a project name with at least 2 characters.");
      return;
    }
    setCreateState("saving");
    setCreateMessage("");
    try {
      await onCreateProject({ name, description });
      setProjectDraft({ name: "", description: "" });
      setCreateOpen(false);
      setCreateState("saved");
      setCreateMessage("Project created. Next: add a template and provision a board.");
    } catch {
      setCreateState("error");
      setCreateMessage("Project creation failed. Check Starter limits and API session.");
    }
  }

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

      <div className="library-toolbar project-create-toolbar">
        <div>
          <strong>{projects.length}/3 projects used</strong>
          <span>Starter plan supports three separate dashboards/projects.</span>
        </div>
        <button
          className="primary"
          disabled={isAtLimit || !onCreateProject}
          aria-disabled={isAtLimit || !onCreateProject}
          title={isAtLimit ? "Starter plan project limit reached" : accountMode ? "Create project" : "Sign in to create real projects"}
          onClick={() => setCreateOpen((current) => !current)}
        >
          {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
          Create project
        </button>
      </div>

      {createOpen && (
        <article className="panel project-create-card" data-testid="project-create-form">
          <div>
            <span className="section-kicker">New customer workspace</span>
            <h2>Create a project</h2>
            <p>Each project gets one dashboard and can later bind a template, device and datastream set.</p>
          </div>
          <div className="project-create-grid">
            <label>
              Project name
              <input aria-label="Project name" value={projectDraft.name} placeholder="Aquaponics Lab" onChange={(event) => setProjectDraft((current) => ({ ...current, name: event.target.value }))} />
            </label>
            <label>
              Project description
              <input aria-label="Project description" value={projectDraft.description} placeholder="Fish tank and plant bed monitoring" onChange={(event) => setProjectDraft((current) => ({ ...current, description: event.target.value }))} />
            </label>
          </div>
          <div className="provisioning-actions">
            <button className="primary" type="button" onClick={() => void createProject()} disabled={createState === "saving"}>
              <Plus size={16} />{createState === "saving" ? "Saving..." : "Save project"}
            </button>
            <button type="button" onClick={() => setCreateOpen(false)}>Cancel</button>
          </div>
        </article>
      )}

      {createMessage && <span className={`project-create-state ${createState}`}>{createMessage}</span>}

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
