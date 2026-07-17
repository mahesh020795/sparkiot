import { ArrowRight, Bell, CalendarClock, CheckCircle2, ChevronDown, Copy, Cpu, Database, LayoutDashboard, Lock, LogIn, LogOut, MapPinned, Pencil, PlugZap, Plus, RadioTower, Settings, TerminalSquare, Trash2, UserCircle, Workflow } from "lucide-react";
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
import { SparkSelect } from "./components/SparkSelect";
import { ConfirmDialog } from "./components/ConfirmDialog";
import { demoDevices, demoLatest, demoNotifications, demoProjects, demoTemplates } from "./lib/demoData";
import { api, clearSession, getSession, type Session } from "./lib/api";
import { copyText } from "./lib/clipboard";
import type { CommandLogItem, Dashboard, Device, DeviceCreate, DeviceTemplate, DeviceUpdate, LiveBoardTestPayload, NotificationItem, OnboardingState, Project, ProjectCreate, ProjectUpdate, ScheduleCreate, ScheduleItem, Telemetry, UserProfile } from "./lib/types";

type View = "dashboard" | "setup" | "projects" | "templates" | "devices" | "live" | "schedules" | "history" | "notifications" | "settings";
type SaveState = "saved" | "unsaved" | "saving" | "error";
type TemplatePreset = "Smart Irrigation" | "Smart Home" | "Energy Monitor" | "Blank";
type StudioLaunchStep = "Setup" | "Migrate" | "Datastreams" | "Dashboard" | "Notifications" | "Code" | "Simulator";
type QuickStartDraft = { projectName: string; projectDescription: string; board: DeviceTemplate["board"]; preset: TemplatePreset; deviceName: string };
type ProjectCreateWithTemplate = ProjectCreate & { template_id?: string };

export function App() {
  const [view, setView] = useState<View>("dashboard");
  const [session, setSession] = useState<Session | null>(() => getSession());
  const [authScreenOpen, setAuthScreenOpen] = useState(false);
  const [selectedProjectId, setSelectedProjectId] = useState<string>(demoProjects[0].id);
  const [demoProjectRows, setDemoProjectRows] = useState<Project[]>(demoProjects);
  const [demoDeviceRows, setDemoDeviceRows] = useState<Device[]>(demoDevices);
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
  const [dashboardSelectorOpen, setDashboardSelectorOpen] = useState(false);
  const [templateStudioId, setTemplateStudioId] = useState<string | null>(null);
  const [templateStudioInitialStep, setTemplateStudioInitialStep] = useState<StudioLaunchStep>("Setup");
  const [templateSaveStates, setTemplateSaveStates] = useState<Record<string, SaveState>>(() => Object.fromEntries(demoTemplates.map((template) => [template.id, "saved"])));
  const [templateSaveError, setTemplateSaveError] = useState<string>("");

  const isAccountMode = Boolean(session) && !demoPreviewMode;
  const activeProjects = isAccountMode ? accountProjects : demoProjectRows;
  const activeDevices = isAccountMode ? accountDevices : demoDeviceRows;
  const activeLatest = isAccountMode ? accountLatest : demoLatest;
  const activeTemplates = isAccountMode ? accountTemplates : templates;
  const selectedProject = useMemo(() => activeProjects.find((project) => project.id === selectedProjectId), [activeProjects, selectedProjectId]);
  const selectedDevice = useMemo(() => activeDevices.find((device) => device.project_id === selectedProjectId), [activeDevices, selectedProjectId]);
  const selectedTemplate = useMemo(() => activeTemplates.find((template) => template.dashboard.project_id === selectedProjectId) ?? activeTemplates[0] ?? templates[0], [activeTemplates, selectedProjectId, templates]);

  const nav = [
    ["dashboard", LayoutDashboard, "Dashboard"],
    ["templates", Workflow, "Templates"],
    ["projects", MapPinned, "Projects"],
    ["devices", Cpu, "Devices"],
    ["live", PlugZap, "Board Test"],
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
      const latestDashboard = isAccountMode ? accountDashboards[template.dashboard.project_id] : undefined;
      const savePayload = latestDashboard && latestDashboard.revision > template.dashboard.revision
        ? { ...template, dashboard: { ...template.dashboard, revision: latestDashboard.revision } }
        : template;
      const saved = isAccountMode ? await api.saveTemplate(savePayload) : await api.saveDemoTemplate(savePayload);
      if (isAccountMode) {
        setAccountTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
        setAccountDashboards((current) => ({ ...current, [saved.dashboard.project_id]: saved.dashboard }));
      } else {
        setTemplates((current) => current.map((item) => item.id === saved.id ? saved : item));
      }
      setTemplateSaveStates((current) => ({ ...current, [templateId]: "saved" }));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Save failed";
      setTemplateSaveError(templateSaveErrorMessage(message));
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

  async function regenerateDemoDeviceToken(deviceId: string) {
    const updated = demoDeviceRows.find((device) => device.id === deviceId);
    if (!updated) throw new Error("Device not found");
    const rotated = { ...updated, token: `spk_demo_rotated_${Date.now().toString(36)}` };
    setDemoDeviceRows((current) => current.map((device) => device.id === deviceId ? rotated : device));
    return rotated;
  }

  async function updateDevice(deviceId: string, device: DeviceUpdate) {
    if (isAccountMode) {
      const updated = await api.updateDevice(deviceId, device);
      setAccountDevices((current) => current.map((item) => item.id === updated.id ? updated : item));
      return updated;
    }
    let updatedDevice: Device | undefined;
    setDemoDeviceRows((current) => current.map((item) => {
      if (item.id !== deviceId) return item;
      updatedDevice = { ...item, ...device };
      return updatedDevice;
    }));
    return updatedDevice ?? demoDeviceRows.find((item) => item.id === deviceId)!;
  }

  async function deleteDevice(deviceId: string) {
    if (isAccountMode) {
      await api.deleteDevice(deviceId);
      setAccountDevices((current) => current.filter((device) => device.id !== deviceId));
      return;
    }
    setDemoDeviceRows((current) => current.filter((device) => device.id !== deviceId));
  }

  async function createAccountDevice(device: DeviceCreate) {
    const created = await api.createDevice(device);
    const templatesForDevice = accountTemplates.filter((template) => template.dashboard.project_id === created.project_id);
    const savedTemplates: DeviceTemplate[] = [];
    for (const template of templatesForDevice) {
      const bound = bindUnassignedTemplateWidgetsToDevice(template, created);
      if (bound !== template) {
        savedTemplates.push(await api.saveTemplate(bound));
      }
    }
    setAccountDevices((current) => [created, ...current]);
    if (savedTemplates.length) {
      setAccountTemplates((current) => current.map((template) => savedTemplates.find((saved) => saved.id === template.id) ?? template));
      setAccountDashboards((current) => ({
        ...current,
        ...Object.fromEntries(savedTemplates.map((template) => [template.dashboard.project_id, template.dashboard]))
      }));
      setTemplateSaveStates((current) => ({ ...current, ...Object.fromEntries(savedTemplates.map((template) => [template.id, "saved" as SaveState])) }));
    }
    return created;
  }

  async function createDemoDevice(device: DeviceCreate) {
    const id = `demo-device-${Date.now()}`;
    const created: Device = {
      id,
      project_id: device.project_id,
      name: device.name,
      board: device.board,
      is_online: false,
      token: `spk_demo_${Date.now().toString(36)}`,
      telemetry_topic: `spark/v1/demo-tenant/${id}/telemetry/{channel}`,
      command_topic: `spark/v1/demo-tenant/${id}/command/{channel}`
    };
    setTemplates((current) => current.map((template) => bindUnassignedTemplateWidgetsToDevice(template, created)));
    setDemoDeviceRows((current) => [created, ...current]);
    return created;
  }

  async function createAccountProject(project: ProjectCreateWithTemplate) {
    const { template_id, ...projectPayload } = project;
    const created = await api.createProject(projectPayload);
    setAccountProjects((current) => [created, ...current]);
    setSelectedProjectId(created.id);
    markFirstProjectCreated(created.id);
    if (template_id) {
      const sourceTemplate = activeTemplates.find((template) => template.id === template_id);
      if (sourceTemplate) {
        const dashboard = await api.dashboard(created.id);
        const draft = cloneTemplateForProject(sourceTemplate, created, dashboard);
        const template = await api.createTemplate(draft);
        setAccountTemplates((current) => [template, ...current.filter((item) => item.id !== template.id)]);
        setAccountDashboards((current) => ({ ...current, [created.id]: template.dashboard }));
        setTemplateSaveStates((current) => ({ ...current, [template.id]: "saved" }));
      }
    }
    return created;
  }

  async function createDemoProject(project: ProjectCreateWithTemplate) {
    const id = `demo-project-${Date.now()}`;
    const created: Project = {
      id,
      name: project.name,
      description: project.description || "Demo sandbox project",
      is_active: true
    };
    setDemoProjectRows((current) => [created, ...current]);
    setSelectedProjectId(created.id);
    if (project.template_id) {
      const sourceTemplate = activeTemplates.find((template) => template.id === project.template_id);
      if (sourceTemplate) {
        const dashboard: Dashboard = {
          id: `demo-dashboard-${Date.now()}`,
          project_id: created.id,
          name: `${created.name} Dashboard`,
          revision: 1,
          widgets: []
        };
        const cloned = cloneTemplateForProject(sourceTemplate, created, dashboard);
        setTemplates((current) => [cloned, ...current]);
      }
    }
    return created;
  }

  async function updateProject(projectId: string, project: ProjectUpdate) {
    if (isAccountMode) {
      const updated = await api.updateProject(projectId, project);
      setAccountProjects((current) => current.map((item) => item.id === updated.id ? updated : item));
      return updated;
    }
    let updatedProject: Project | undefined;
    setDemoProjectRows((current) => current.map((item) => {
      if (item.id !== projectId) return item;
      updatedProject = { ...item, ...project };
      return updatedProject;
    }));
    return updatedProject ?? demoProjectRows.find((item) => item.id === projectId)!;
  }

  async function deleteProject(projectId: string) {
    if (isAccountMode) {
      await api.deleteProject(projectId);
      setAccountProjects((current) => current.filter((project) => project.id !== projectId));
      setAccountDevices((current) => current.filter((device) => device.project_id !== projectId));
      setAccountTemplates((current) => current.filter((template) => template.dashboard.project_id !== projectId));
    } else {
      setDemoProjectRows((current) => current.filter((project) => project.id !== projectId));
      setDemoDeviceRows((current) => current.filter((device) => device.project_id !== projectId));
      setTemplates((current) => current.filter((template) => template.dashboard.project_id !== projectId));
    }
    if (selectedProjectId === projectId) {
      const fallback = activeProjects.find((project) => project.id !== projectId);
      if (fallback) setSelectedProjectId(fallback.id);
    }
  }

  async function deleteTemplate(templateId: string) {
    if (isAccountMode) {
      await api.deleteTemplate(templateId);
      setAccountTemplates((current) => current.filter((template) => template.id !== templateId));
    } else {
      setTemplates((current) => current.filter((template) => template.id !== templateId));
    }
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

  async function createDemoTemplate(projectId: string, board: DeviceTemplate["board"], preset: TemplatePreset) {
    const project = demoProjectRows.find((item) => item.id === projectId) ?? activeProjects.find((item) => item.id === projectId);
    if (!project) throw new Error("Project not found");
    const device = demoDeviceRows.find((item) => item.project_id === projectId);
    const dashboard: Dashboard = {
      id: `demo-dashboard-${Date.now()}`,
      project_id: project.id,
      name: `${project.name} Dashboard`,
      revision: 1,
      widgets: []
    };
    const draft = buildStarterTemplateDraft(project, dashboard, device, board, preset);
    const created: DeviceTemplate = {
      ...draft,
      id: `demo-template-${Date.now()}`,
      dashboard: {
        ...draft.dashboard,
        id: dashboard.id,
        project_id: project.id
      }
    };
    setTemplates((current) => [created, ...current]);
    setSelectedProjectId(project.id);
    setTemplateStudioInitialStep("Setup");
    setTemplateStudioId(created.id);
    return created;
  }

  async function deleteSchedule(scheduleId: string) {
    if (isAccountMode) {
      await api.deleteSchedule(scheduleId);
      setAccountSchedules((current) => current.filter((schedule) => schedule.id !== scheduleId));
    }
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
        <div className="brand"><span className="brand-icon"><span className="material-symbols-outlined" aria-hidden="true">edgesensor_high</span></span><div><strong>Spark IoT</strong><span>Rectronx Cloud</span></div></div>
        <nav aria-label="Main navigation">{nav.map(([id, Icon, label]) => <button key={id} className={view === id ? "active" : ""} onClick={() => { setView(id); if (id === "templates") setTemplateStudioId(null); }}><Icon size={18} />{label}</button>)}</nav>
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
      </aside>
      <main className={view === "dashboard" ? "dashboard-main" : undefined}>
        <header className={view === "dashboard" ? "topbar app-page-header cockpit-header" : "topbar app-page-header"} data-testid="cockpit-header">
          <div className={view === "dashboard" ? "dashboard-header-grid spark-page-header-grid product-header-grid" : "standard-header-grid product-header-grid"} data-testid={view === "dashboard" ? "dashboard-header-grid" : undefined}>
          <div className={view === "dashboard" ? "cockpit-title-block spark-page-header-primary" : "cockpit-title-block"} data-testid={view === "dashboard" ? "dashboard-header-primary" : undefined}>
            {view !== "dashboard" && <div className="cockpit-kicker-row"><span className="eyebrow">Control Center</span></div>}
            <h1>{view === "dashboard" ? `${selectedProject?.name ?? "Smart Irrigation"} Dashboard` : selectedProject?.name ?? "Spark IoT Dashboard"}</h1>
          </div>
          <div className="top-actions">
            {view === "dashboard" && (
              <DashboardProjectSelector
                projects={activeProjects}
                selectedProjectId={selectedProjectId}
                open={dashboardSelectorOpen}
                onToggle={() => setDashboardSelectorOpen((current) => !current)}
                onSelect={(projectId) => {
                  setSelectedProjectId(projectId);
                  setDashboardSelectorOpen(false);
                }}
              />
            )}
            {view !== "dashboard" && <SparkSelect ariaLabel="Project selector" value={selectedProjectId} onChange={setSelectedProjectId} options={activeProjects.map((project) => ({ value: project.id, label: project.name }))} />}
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
        {view === "projects" && <ProjectsView projects={activeProjects} templates={activeTemplates} accountMode={isAccountMode} onCreateProject={isAccountMode ? createAccountProject : createDemoProject} onUpdateProject={updateProject} onDeleteProject={deleteProject} />}
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
              onCreateTemplate={isAccountMode ? createAccountTemplate : createDemoTemplate}
              onDeleteTemplate={deleteTemplate}
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
            onCreateDevice={isAccountMode ? createAccountDevice : createDemoDevice}
            onRegenerateToken={isAccountMode ? regenerateAccountDeviceToken : regenerateDemoDeviceToken}
            onUpdateDevice={updateDevice}
            onDeleteDevice={deleteDevice}
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
            onDeleteSchedule={deleteSchedule}
          />
        )}
        {view === "history" && <HistoryPage devices={activeDevices} initialLatest={activeLatest} accountMode={isAccountMode} />}
        {view === "notifications" && <NotificationsPage initialItems={isAccountMode ? accountNotifications : demoNotifications} accountMode={isAccountMode} />}
        {view === "settings" && <SettingsPage />}
      </main>
    </div>
  );
}

function DashboardProjectSelector({ projects, selectedProjectId, open, onToggle, onSelect }: {
  projects: Project[];
  selectedProjectId: string;
  open: boolean;
  onToggle: () => void;
  onSelect: (projectId: string) => void;
}) {
  const selectedProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  return (
    <div className="project-switcher spark-page-header-selector spark-select" data-testid="dashboard-header-selector">
      <span>Dashboard</span>
      <button
        type="button"
        className="spark-select-trigger"
        aria-label="Dashboard project selector"
        aria-haspopup="listbox"
        aria-expanded={open}
        onClick={onToggle}
      >
        <strong>{selectedProject?.name ?? "Select dashboard"}</strong>
        <ChevronDown size={18} aria-hidden="true" />
      </button>
      {open && (
        <div className="spark-select-menu" role="listbox" aria-label="Dashboard projects">
          {projects.map((project) => (
            <button
              type="button"
              role="option"
              aria-selected={project.id === selectedProjectId}
              className={project.id === selectedProjectId ? "spark-select-option selected" : "spark-select-option"}
              key={project.id}
              onClick={() => onSelect(project.id)}
            >
              <span>{project.name}</span>
              {project.id === selectedProjectId && <CheckCircle2 size={16} aria-hidden="true" />}
            </button>
          ))}
        </div>
      )}
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
    { title: "Board test", detail: "MQTT telemetry and command ACK", action: "Open board test", onClick: onOpenLiveTest, icon: PlugZap }
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
                <SparkSelect
                  ariaLabel="Quick start board"
                  value={quickStartDraft.board}
                  onChange={(value) => setQuickStartDraft((current) => ({ ...current, board: value as DeviceTemplate["board"] }))}
                  options={["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"].map((board) => ({ value: board, label: board }))}
                />
              </label>
              <label>
                Preset
                <SparkSelect
                  ariaLabel="Quick start preset"
                  value={quickStartDraft.preset}
                  onChange={(value) => setQuickStartDraft((current) => ({ ...current, preset: value as TemplatePreset }))}
                  options={["Smart Irrigation", "Smart Home", "Energy Monitor", "Blank"].map((preset) => ({ value: preset, label: preset }))}
                />
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
          <span className="section-kicker">Board Test</span>
          <h2>Verify your ESP32 / NodeMCU connection</h2>
          <p>A clean hardware proof screen for real telemetry, dashboard commands and board ACK packets.</p>
        </div>
        <div className="support-metrics">
          <span><strong>{device?.board ?? "Board"}</strong><small>Selected device</small></span>
          <span><strong>{latestRows.length}</strong><small>Live values</small></span>
          <span><strong>{status}</strong><small>API state</small></span>
        </div>
      </div>

      <section className="connection-proof-timeline" data-testid="connection-proof-timeline">
        <div>
          <span className="section-kicker">Connection proof</span>
          <h2>Three checks before handover</h2>
          <p>Telemetry must arrive, Spark IoT must publish a command, and the board should return an ACK.</p>
        </div>
        <div className="proof-steps">
          <ProofStep
            state={hasTelemetry ? "complete" : "waiting"}
            title="Telemetry received"
            body={hasTelemetry ? "Latest V-pin readings are landing from the selected board." : "Waiting for MQTT or HTTP telemetry from the selected board."}
          />
          <ProofStep
            state={hasCommand ? "complete" : "waiting"}
            title="Command published"
            body={hasCommand ? "A dashboard switch/button command was published to the device topic." : "Waiting for switch/button command activity."}
          />
          <ProofStep
            state={hasAck ? "complete" : "waiting"}
            title="Board ACK"
            body={hasAck ? "The board confirmed it received and applied the command." : "Waiting for the board to publish an ACK packet."}
          />
        </div>
      </section>

      <section className="panel board-quick-test" data-testid="board-quick-test">
        <div>
          <span className="section-kicker">Command test</span>
          <h2>Send one test command</h2>
          <p>This sends a real command to the selected device. Your sketch should receive it in `SparkIoT.onCommand`, apply the output, then call `SparkIoT.ack`.</p>
        </div>
        <div className="quick-test-command-grid">
          <span><small>Test command topic</small><code>{quickTestTopic}</code></span>
          <span><small>Payload</small><code>{quickTestPayload}</code></span>
          <span><small>Expected board ACK</small><code>{quickTestAckTopic}</code></span>
        </div>
        <div className="quick-test-actions">
          <button className="primary" onClick={publishQuickTestCommand} disabled={quickTestStatus === "publishing"}>
            <PlugZap size={16} />{quickTestStatus === "publishing" ? "Sending..." : "Send test command"}
          </button>
          <span className={`quick-test-status ${quickTestStatus}`}>{quickTestStatus === "idle" ? "Ready to test" : quickTestStatus}</span>
        </div>
      </section>

      <details className="panel live-test-advanced">
        <summary><RadioTower size={18} /> Advanced MQTT details</summary>
        <div className="live-test-grid live-system-grid" data-testid="live-test-grid">
          <article className="live-connection-card">
            <div className="panel-title"><RadioTower size={18} /><h2>MQTT broker</h2></div>
            <div className="connection-stack">
              <ConnectionLine label="Host" value={payload.mqtt.host} />
              <ConnectionLine label="Port" value={String(payload.mqtt.port)} />
              <ConnectionLine label="Tenant" value={payload.tenant_id} />
              <ConnectionLine label="Device ID" value={device?.id ?? "No device"} />
              <ConnectionLine label="Token" value={devices.find((item) => item.id === device?.id)?.token ?? "Use device token"} />
            </div>
          </article>

          <article className="live-topic-card">
            <div className="panel-title"><TerminalSquare size={18} /><h2>Board publish topics</h2></div>
            <p>Use these exact patterns in Arduino IDE. Replace <strong>{"{channel}"}</strong> with V0, V1, V2 and so on.</p>
            <code>{device?.telemetry_topic ?? "spark/v1/demo-tenant/device-irrigation/telemetry/{channel}"}</code>
            <code>{device?.command_topic ?? "spark/v1/demo-tenant/device-irrigation/command/{channel}"}</code>
          </article>
        </div>
      </details>

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
        <p>Shows commands sent by Spark IoT and ACK packets returned by the board.</p>
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
  return <div className="connection-line"><span>{label}</span><code>{value}</code><button onClick={() => void copyText(value)} aria-label={`Copy ${label}`}><Copy size={14} /></button></div>;
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

export function templateSaveErrorMessage(rawMessage: string) {
  const code = extractApiErrorCode(rawMessage);
  if (code === "stale_template_revision") return "Template changed on the server. Refresh, then apply your latest edits again.";
  if (code === "stale_dashboard_revision") return "Dashboard changed on the server. Refresh, then apply your latest edits again.";
  const detail = extractApiErrorDetail(rawMessage);
  if (detail) return detail;
  return "Save failed. Check the API connection and try again.";
}

function extractApiErrorCode(rawMessage: string) {
  try {
    const parsed = JSON.parse(rawMessage);
    return parsed?.detail?.code;
  } catch {
    return rawMessage.includes("stale_dashboard_revision")
      ? "stale_dashboard_revision"
      : rawMessage.includes("stale_template_revision")
        ? "stale_template_revision"
        : "";
  }
}

function extractApiErrorDetail(rawMessage: string) {
  try {
    const parsed = JSON.parse(rawMessage);
    if (typeof parsed?.detail?.message === "string") return parsed.detail.message;
    if (typeof parsed?.detail === "string") return parsed.detail;
    if (Array.isArray(parsed?.detail)) {
      const firstMessage = parsed.detail
        .map((item: { msg?: string }) => item?.msg)
        .find((message: unknown): message is string => typeof message === "string" && message.length > 0);
      return firstMessage?.replace(/^Value error,\s*/i, "") ?? "";
    }
  } catch {
    return "";
  }
  return "";
}

function cloneTemplateForProject(source: DeviceTemplate, project: Project, dashboard: Dashboard, device?: Device): DeviceTemplate {
  const idSuffix = `${project.id}-${Date.now().toString(36)}`;
  const streamIdMap = new Map<string, string>();
  const datastreams = source.datastreams.map((stream, index) => {
    const id = `ds-${idSuffix}-${index}`;
    streamIdMap.set(stream.id, id);
    return { ...stream, id };
  });
  const widgets = source.dashboard.widgets.map((widget, index) => {
    const datastreamId = widget.datastreamId ? streamIdMap.get(widget.datastreamId) : undefined;
    const stream = datastreams.find((item) => item.id === datastreamId);
    return {
      ...widget,
      id: `w-${idSuffix}-${index}`,
      datastreamId,
      deviceId: device?.id ?? "",
      title: stream?.name ?? widget.title,
      channel: stream?.pin ?? widget.channel,
      unit: stream?.unit ?? widget.unit,
      min: stream?.min ?? widget.min,
      max: stream?.max ?? widget.max,
      color: stream?.color ?? widget.color
    };
  });
  const notifications = source.notifications.map((rule, index) => ({
    ...rule,
    id: `rule-${idSuffix}-${index}`,
    datastreamId: streamIdMap.get(rule.datastreamId) ?? datastreams[0]?.id ?? rule.datastreamId
  }));
  return {
    ...source,
    id: `template-${idSuffix}`,
    name: project.name,
    description: `${source.name} template applied to ${project.name}`,
    revision: 1,
    datastreams,
    notifications,
    dashboard: {
      ...dashboard,
      name: `${project.name} Dashboard`,
      widgets
    }
  };
}

function bindUnassignedTemplateWidgetsToDevice(template: DeviceTemplate, device: Device): DeviceTemplate {
  if (template.dashboard.project_id !== device.project_id) return template;
  if (!template.dashboard.widgets.some((widget) => !widget.deviceId)) return template;
  return {
    ...template,
    dashboard: {
      ...template.dashboard,
      widgets: template.dashboard.widgets.map((widget) => widget.deviceId ? widget : { ...widget, deviceId: device.id })
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
  onDeleteTemplate,
  onOpen
}: {
  templates: DeviceTemplate[];
  projects: Project[];
  accountMode?: boolean;
  onCreateTemplate?: (projectId: string, board: DeviceTemplate["board"], preset: TemplatePreset) => Promise<DeviceTemplate>;
  onDeleteTemplate: (templateId: string) => Promise<void>;
  onOpen: (template: DeviceTemplate) => void;
}) {
  const templateLimit = 3;
  const isAtLimit = templates.length >= templateLimit;
  const availableProjects = projects.filter((project) => !templates.some((template) => template.dashboard.project_id === project.id));
  const templateProjectOptions = accountMode ? availableProjects : (availableProjects.length ? availableProjects : projects);
  const [createOpen, setCreateOpen] = useState(false);
  const [draftProjectId, setDraftProjectId] = useState(availableProjects[0]?.id ?? projects[0]?.id ?? "");
  const [draftBoard, setDraftBoard] = useState<DeviceTemplate["board"]>("ESP32");
  const [draftPreset, setDraftPreset] = useState<TemplatePreset>("Smart Irrigation");
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState("");
  const [deleteTemplateDraft, setDeleteTemplateDraft] = useState<DeviceTemplate | null>(null);

  useEffect(() => {
    if (!draftProjectId && templateProjectOptions[0]) setDraftProjectId(templateProjectOptions[0].id);
  }, [draftProjectId, templateProjectOptions]);

  async function createTemplate() {
    if (!onCreateTemplate || (accountMode && isAtLimit) || !draftProjectId) return;
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
      <div className="library-toolbar">
        <div>
          <strong>{templates.length}/3 templates used</strong>
          <span>Reusable starter designs. Apply one when creating a project.</span>
        </div>
        <button
          className="primary"
          disabled={(accountMode && isAtLimit) || !onCreateTemplate || (accountMode && !availableProjects.length)}
          aria-disabled={(accountMode && isAtLimit) || !onCreateTemplate || (accountMode && !availableProjects.length)}
          title={isAtLimit ? "Starter plan limit reached" : accountMode ? "Create reusable template" : "Create reusable demo template"}
          onClick={() => setCreateOpen((current) => !current)}
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
            <p>Create a reusable template first. Later, when you create a project, choose this template to generate the project dashboard, V-pins and Arduino-ready bindings.</p>
          </div>
          <div className="project-create-grid">
            <label>
              Board
              <SparkSelect
                ariaLabel="Template board"
                value={draftBoard}
                onChange={(value) => setDraftBoard(value as DeviceTemplate["board"])}
                options={["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"].map((board) => ({ value: board, label: board }))}
              />
            </label>
            <label>
              Starter design
              <SparkSelect
                ariaLabel="Template starter design"
                value={draftPreset}
                onChange={(value) => setDraftPreset(value as TemplatePreset)}
                options={["Smart Irrigation", "Smart Home", "Energy Monitor", "Blank"].map((preset) => ({ value: preset, label: preset }))}
              />
            </label>
            <div className="template-starter-help">
              <strong>What this does</strong>
              <span>Pre-fills V-pins, starter widgets and notification rules. You can edit everything inside Template Studio.</span>
            </div>
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
            <div className="entity-card-actions">
              <button className="template-open-button entity-edit-button" onClick={() => onOpen(template)} aria-label={`Open studio / Edit template ${template.name}`}>
                <Pencil size={16} />Edit template
              </button>
              <button
                className="entity-delete-button"
                type="button"
                aria-label={`Delete template ${template.name}`}
                onClick={() => setDeleteTemplateDraft(template)}
              >
                <Trash2 size={16} />Delete template
              </button>
            </div>
          </article>
        ))}
      </section>
      <ConfirmDialog
        open={Boolean(deleteTemplateDraft)}
        title="Delete template?"
        body={`This will remove "${deleteTemplateDraft?.name ?? "this template"}" from the template library. Existing saved demo state can be recreated from the starter presets.`}
        confirmLabel="Delete template"
        onCancel={() => setDeleteTemplateDraft(null)}
        onConfirm={() => {
          const templateId = deleteTemplateDraft?.id;
          setDeleteTemplateDraft(null);
          if (templateId) void onDeleteTemplate(templateId);
        }}
      />
    </section>
  );
}

function ProjectsView({ projects, templates, accountMode = false, onCreateProject, onUpdateProject, onDeleteProject }: { projects: Project[]; templates: DeviceTemplate[]; accountMode?: boolean; onCreateProject?: (project: ProjectCreateWithTemplate) => Promise<Project>; onUpdateProject: (projectId: string, project: ProjectUpdate) => Promise<Project>; onDeleteProject: (projectId: string) => Promise<void> }) {
  const projectLimit = 3;
  const isAtLimit = projects.length >= projectLimit;
  const [createOpen, setCreateOpen] = useState(false);
  const [projectDraft, setProjectDraft] = useState<ProjectCreate>({ name: "", description: "" });
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id ?? "");
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [editProjectDraft, setEditProjectDraft] = useState<ProjectUpdate>({ name: "", description: "" });
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [createMessage, setCreateMessage] = useState("");
  const [deleteProjectDraft, setDeleteProjectDraft] = useState<Project | null>(null);

  useEffect(() => {
    if (!selectedTemplateId && templates[0]) setSelectedTemplateId(templates[0].id);
  }, [selectedTemplateId, templates]);

  async function createProject() {
    if (!onCreateProject || (accountMode && isAtLimit)) return;
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
      await onCreateProject({ name, description, template_id: selectedTemplateId || undefined });
      setProjectDraft({ name: "", description: "" });
      setCreateOpen(false);
      setCreateState("saved");
      setCreateMessage(selectedTemplateId ? "Project created with the selected template. Next: provision a board." : "Project created. Next: choose a template and provision a board.");
    } catch {
      setCreateState("error");
      setCreateMessage("Project creation failed. Check Starter limits and API session.");
    }
  }

  async function saveProjectEdit(projectId: string) {
    const name = editProjectDraft.name.trim();
    if (name.length < 2) return;
    await onUpdateProject(projectId, { name, description: editProjectDraft.description.trim() });
    setEditingProjectId(null);
  }

  return (
    <section className="support-page">
      <div className="library-toolbar project-create-toolbar">
        <div>
          <strong>{projects.length}/3 projects used</strong>
          <span>Starter plan supports three separate dashboards/projects.</span>
        </div>
        <button
          className="primary"
          disabled={(accountMode && isAtLimit) || !onCreateProject}
          aria-disabled={(accountMode && isAtLimit) || !onCreateProject}
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
            <p>Each project chooses a reusable template, then binds one or more devices to that dashboard and V-pin contract.</p>
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
            <label>
              Start from template
              <SparkSelect
                ariaLabel="Project template"
                value={selectedTemplateId}
                onChange={setSelectedTemplateId}
                options={[{ value: "", label: "Blank project" }, ...templates.map((template) => ({ value: template.id, label: template.name, hint: template.board }))]}
              />
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
          <article className="panel project-card" key={project.id} aria-label={`${project.name} project`}>
            <div className="project-card-head"><span className="status-dot online" /><span className="pill online-pill">Active</span></div>
            {editingProjectId === project.id ? (
              <div className="entity-edit-form">
                <label>
                  Project name
                  <input aria-label="Edit project name" value={editProjectDraft.name} onChange={(event) => setEditProjectDraft((current) => ({ ...current, name: event.target.value }))} />
                </label>
                <label>
                  Description
                  <input aria-label="Edit project description" value={editProjectDraft.description} onChange={(event) => setEditProjectDraft((current) => ({ ...current, description: event.target.value }))} />
                </label>
                <div className="entity-card-actions">
                  <button className="entity-edit-button" type="button" onClick={() => void saveProjectEdit(project.id)}>Save project</button>
                  <button type="button" onClick={() => setEditingProjectId(null)}>Cancel</button>
                </div>
              </div>
            ) : (
              <>
                <h2>{project.name}</h2>
                <p>{project.description}</p>
              </>
            )}
            <div className="project-stat-row">
              <span><strong>{template?.board}</strong><small>Board</small></span>
              <span><strong>{template?.datastreams.length ?? 0}</strong><small>V pins</small></span>
              <span><strong>{template?.dashboard.widgets.length ?? 0}</strong><small>Widgets</small></span>
            </div>
            <div className="entity-card-actions">
              <button className="entity-edit-button" type="button" aria-label={`Edit project ${project.name}`} onClick={() => { setEditingProjectId(project.id); setEditProjectDraft({ name: project.name, description: project.description }); }}><Pencil size={16} />Edit project</button>
              <button className="entity-delete-button" type="button" aria-label={`Delete project ${project.name}`} onClick={() => setDeleteProjectDraft(project)}><Trash2 size={16} />Delete project</button>
            </div>
          </article>
        );
      })}<article className="panel starter-capacity-card"><span className="section-kicker">Starter plan capacity</span><h2>RM25 plan limits</h2><p>3 projects, 3 devices and one template dashboard per project with 30-day data, GPS and camera access.</p></article></section>
      <ConfirmDialog
        open={Boolean(deleteProjectDraft)}
        title="Delete project?"
        body={`This will remove "${deleteProjectDraft?.name ?? "this project"}" and its dashboard workspace from this starter account.`}
        confirmLabel="Delete project"
        onCancel={() => setDeleteProjectDraft(null)}
        onConfirm={() => {
          const projectId = deleteProjectDraft?.id;
          setDeleteProjectDraft(null);
          if (projectId) void onDeleteProject(projectId);
        }}
      />
    </section>
  );
}
