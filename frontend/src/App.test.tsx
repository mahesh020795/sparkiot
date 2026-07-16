import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { api, realtimeUrl } from "./lib/api";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), dispose: vi.fn() })
}));

vi.mock("leaflet", () => ({
  default: {
    map: () => ({ setView: vi.fn().mockReturnThis(), remove: vi.fn() }),
    tileLayer: () => ({ addTo: vi.fn() }),
    marker: () => ({ addTo: vi.fn() })
  }
}));

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("App", () => {
  it("shows verification pending after signup before the SaaS workspace", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: false,
      onboarding_step: "verify_email",
    });
    vi.spyOn(api, "onboarding").mockResolvedValue({
      current_step: "verify_email",
      completed_steps: [],
      demo_viewed: false,
      first_project_id: null,
    });

    render(<App />);

    expect(await screen.findByText(/Verify your email/i)).toBeInTheDocument();
    expect(screen.getByText(/owner@acme.test/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View demo dashboard/i })).toBeInTheDocument();
  });

  it("shows starter workspace for verified users with no projects", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: true,
      onboarding_step: "starter_workspace",
    });
    vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
    vi.spyOn(api, "projects").mockResolvedValue([]);
    vi.spyOn(api, "devices").mockResolvedValue([]);
    vi.spyOn(api, "templates").mockResolvedValue([]);
    vi.spyOn(api, "onboarding").mockResolvedValue({
      current_step: "starter_workspace",
      completed_steps: ["verify_email"],
      demo_viewed: false,
      first_project_id: null,
    });

    render(<App />);

    expect(await screen.findByText(/Welcome to Spark IoT/i)).toBeInTheDocument();
    expect(screen.getByText(/No live dashboard yet/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create first project/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /View demo dashboard/i })).toBeInTheDocument();
  });

  it("opens the simulated demo dashboard from the verified starter workspace", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: true,
      onboarding_step: "starter_workspace",
    });
    vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
    vi.spyOn(api, "projects").mockResolvedValue([]);
    vi.spyOn(api, "devices").mockResolvedValue([]);
    vi.spyOn(api, "templates").mockResolvedValue([]);
    vi.spyOn(api, "notifications").mockResolvedValue([]);
    vi.spyOn(api, "schedules").mockResolvedValue([]);
    vi.spyOn(api, "onboarding").mockResolvedValue({
      current_step: "starter_workspace",
      completed_steps: ["verify_email"],
      demo_viewed: false,
      first_project_id: null,
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /View demo dashboard/i }));

    expect(await screen.findByRole("heading", { name: "Smart Irrigation Dashboard" })).toBeInTheDocument();
    const demoBanner = screen.getByRole("status");
    expect(within(demoBanner).getByText(/Demo dashboard/i)).toBeInTheDocument();
    expect(within(demoBanner).getByText(/Simulated telemetry/i)).toBeInTheDocument();
    expect(screen.getByText("Temperature")).toBeInTheDocument();
  });

  it("marks demo preview separately from customer workspace", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: true,
      onboarding_step: "starter_workspace",
    });
    vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
    vi.spyOn(api, "projects").mockResolvedValue([]);
    vi.spyOn(api, "devices").mockResolvedValue([]);
    vi.spyOn(api, "templates").mockResolvedValue([]);
    vi.spyOn(api, "notifications").mockResolvedValue([]);
    vi.spyOn(api, "schedules").mockResolvedValue([]);
    vi.spyOn(api, "onboarding").mockResolvedValue({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: false, first_project_id: null });
    const update = vi.spyOn(api, "updateOnboarding").mockResolvedValue({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: true, first_project_id: null });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /View demo dashboard/i }));

    expect(update).toHaveBeenCalledWith({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: true, first_project_id: null });
    const demoBanner = await screen.findByRole("status");
    expect(within(demoBanner).getByText(/Demo dashboard/i)).toBeInTheDocument();
    expect(within(demoBanner).getByText(/Simulated telemetry/i)).toBeInTheDocument();
  });

  it("advances onboarding after account quick start creates the first project", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const createdProject = { id: "project-aquaponics", name: "Aquaponics Lab", description: "Fish tank and plant bed monitoring", is_active: true };
    const createdDashboard = { id: "dashboard-aquaponics", project_id: "project-aquaponics", name: "Aquaponics Lab Dashboard", revision: 1, widgets: [] };
    const createdTemplate = {
      id: "template-aquaponics",
      name: "Aquaponics Lab",
      board: "ESP8266" as const,
      description: "Smart Irrigation template for Aquaponics Lab",
      revision: 1,
      datastreams: [
        { id: "ds-project-aquaponics-0", name: "Temperature", pin: "V0" as const, dataType: "float" as const, unit: "C", min: 0, max: 100, color: "#2563eb" }
      ],
      notifications: [],
      dashboard: {
        ...createdDashboard,
        widgets: [{ id: "w-project-aquaponics-0", type: "gauge", title: "Temperature", x: 0, y: 0, w: 3, h: 2, deviceId: "", channel: "V0", datastreamId: "ds-project-aquaponics-0" }]
      }
    };
    const createdDevice = {
      id: "device-aquaponics",
      project_id: "project-aquaponics",
      name: "NodeMCU Tank Controller",
      board: "ESP8266",
      is_online: false,
      token: "spk_dev_aquaponics_once_1234",
      telemetry_topic: "spark/v1/account-tenant/device-aquaponics/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/device-aquaponics/command/{channel}"
    };
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: true,
      onboarding_step: "starter_workspace",
    });
    vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 0, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
    vi.spyOn(api, "projects").mockResolvedValue([]);
    vi.spyOn(api, "devices").mockResolvedValue([]);
    vi.spyOn(api, "templates").mockResolvedValue([]);
    vi.spyOn(api, "notifications").mockResolvedValue([]);
    vi.spyOn(api, "schedules").mockResolvedValue([]);
    vi.spyOn(api, "onboarding").mockResolvedValue({ current_step: "starter_workspace", completed_steps: ["verify_email"], demo_viewed: false, first_project_id: null });
    vi.spyOn(api, "createProject").mockResolvedValue(createdProject);
    vi.spyOn(api, "dashboard").mockResolvedValue(createdDashboard);
    vi.spyOn(api, "createTemplate").mockResolvedValue(createdTemplate);
    vi.spyOn(api, "createDevice").mockResolvedValue(createdDevice);
    const update = vi.spyOn(api, "updateOnboarding").mockResolvedValue({
      current_step: "project",
      completed_steps: ["verify_email", "starter_workspace", "project"],
      demo_viewed: false,
      first_project_id: "project-aquaponics",
    });

    render(<App />);
    fireEvent.click(await screen.findByRole("button", { name: /Create first project/i }));
    fireEvent.change(await screen.findByLabelText("Quick start project name"), { target: { value: "Aquaponics Lab" } });
    fireEvent.change(screen.getByLabelText("Quick start project description"), { target: { value: "Fish tank and plant bed monitoring" } });
    fireEvent.change(screen.getByLabelText("Quick start board"), { target: { value: "ESP8266" } });
    fireEvent.change(screen.getByLabelText("Quick start device name"), { target: { value: "NodeMCU Tank Controller" } });
    fireEvent.click(screen.getByRole("button", { name: /Build workspace/i }));

    await vi.waitFor(() => expect(update).toHaveBeenCalledWith({
      current_step: "project",
      completed_steps: ["verify_email", "starter_workspace", "project"],
      demo_viewed: false,
      first_project_id: "project-aquaponics",
    }));
  });

  it("does not overwrite the original first project when later projects are created", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const existingProject = { id: "project-original", name: "Original Farm", description: "First connected project", is_active: true };
    const createdProject = { id: "project-later", name: "Later Project", description: "Second project", is_active: true };
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Acme Owner",
      email: "owner@acme.test",
      tenant_id: "tenant-1",
      plan_code: "starter",
      email_verified: true,
      onboarding_step: "project",
    });
    vi.spyOn(api, "usage").mockResolvedValue({ users: 1, max_users: 1, projects: 1, max_projects: 3, devices: 0, max_devices: 3, retention_days: 30 });
    vi.spyOn(api, "projects").mockResolvedValue([existingProject]);
    vi.spyOn(api, "devices").mockResolvedValue([]);
    vi.spyOn(api, "templates").mockResolvedValue([]);
    vi.spyOn(api, "notifications").mockResolvedValue([]);
    vi.spyOn(api, "schedules").mockResolvedValue([]);
    vi.spyOn(api, "dashboard").mockResolvedValue({ id: "dashboard-original", project_id: "project-original", name: "Original Farm Dashboard", revision: 1, widgets: [] });
    vi.spyOn(api, "latest").mockResolvedValue([]);
    vi.spyOn(api, "onboarding").mockResolvedValue({
      current_step: "project",
      completed_steps: ["verify_email", "starter_workspace", "project"],
      demo_viewed: true,
      first_project_id: "project-original",
    });
    vi.spyOn(api, "createProject").mockResolvedValue(createdProject);
    const update = vi.spyOn(api, "updateOnboarding").mockResolvedValue({
      current_step: "project",
      completed_steps: ["verify_email", "starter_workspace", "project"],
      demo_viewed: true,
      first_project_id: "project-original",
    });

    render(<App />);
    fireEvent.click(await screen.findByText("Projects"));
    fireEvent.click(await screen.findByRole("button", { name: /Create project/i }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Later Project" } });
    fireEvent.change(screen.getByLabelText("Project description"), { target: { value: "Second project" } });
    fireEvent.click(screen.getByRole("button", { name: /Save project/i }));

    await vi.waitFor(() => expect(api.createProject).toHaveBeenCalledWith({ name: "Later Project", description: "Second project" }));
    expect(update).not.toHaveBeenCalled();
  });

  it("opens directly on the Spark IoT dashboard without login", async () => {
    render(<App />);
    expect(await screen.findByRole("heading", { name: "Smart Irrigation Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText("Live control cockpit")).not.toBeInTheDocument();
    expect(screen.queryByText("Premium industrial widgets")).not.toBeInTheDocument();
    expect(screen.queryByText("Elevated radial scale sensors, interactive video streams, GIS field coordinate tracking")).not.toBeInTheDocument();
    expect(screen.getAllByText("Live value").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Valve status").length).toBeGreaterThan(0);
    expect(screen.queryByText("Workspace health")).not.toBeInTheDocument();
    expect(screen.queryByText("Production preview")).not.toBeInTheDocument();
    const dashboardSelector = screen.getByLabelText("Dashboard project selector");
    expect(dashboardSelector).toBeInTheDocument();
    expect(dashboardSelector).toHaveValue("project-irrigation");
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(navigation).toHaveTextContent("Settings");
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.queryByText("Launch checklist")).not.toBeInTheDocument();
    expect(screen.queryByText("Project → Template → Device → Code → Live Test")).not.toBeInTheDocument();
    expect(navigation).not.toHaveTextContent("Setup Flow");
  });

  it("keeps the overview minimal without setup summary or launch checklist clutter", async () => {
    render(<App />);

    expect(await screen.findByRole("heading", { name: "Smart Irrigation Dashboard" })).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-simulation-pill")).not.toBeInTheDocument();
    expect(screen.queryByText("Interactive live simulation")).not.toBeInTheDocument();
    expect(screen.queryByText("Solenoid outputs synchronized with maps & video stream")).not.toBeInTheDocument();
    expect(screen.queryByText("Nodes online")).not.toBeInTheDocument();
    expect(screen.queryByText("Widgets active")).not.toBeInTheDocument();
    expect(screen.queryByText("Telemetry time")).not.toBeInTheDocument();
    expect(screen.queryByText("Flow safety")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-action-bar")).not.toBeInTheDocument();
    expect(screen.queryByText("Virtual IoT Simulator Connected")).not.toBeInTheDocument();
    expect(screen.queryByTestId("setup-summary-card")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Open setup flow/i })).not.toBeInTheDocument();
    expect(screen.queryByText("Spark IoT Launch Wizard")).not.toBeInTheDocument();
    expect(screen.queryByText("Create project")).not.toBeInTheDocument();
    expect(screen.queryByText("Customer setup flow")).not.toBeInTheDocument();
    expect(screen.queryByText("Launch checklist")).not.toBeInTheDocument();
  });

  it("uses the standardized design-system shell and non-overlapping dashboard header", async () => {
    render(<App />);

    const shell = await screen.findByTestId("app-shell");
    expect(shell).toHaveClass("app-shell", "dashboard-shell", "spark-ui");
    expect(screen.getByTestId("cockpit-header")).toHaveClass("app-page-header", "cockpit-header");
    expect(screen.getByTestId("dashboard-header-grid")).toHaveClass("dashboard-header-grid", "spark-page-header-grid");
    expect(screen.getByTestId("dashboard-header-primary")).toHaveClass("spark-page-header-primary");
    expect(screen.getByTestId("dashboard-header-selector")).toHaveClass("spark-page-header-selector");
    expect(screen.getByText("Redronix Cloud")).toBeInTheDocument();
    expect(screen.getByText("edgesensor_high")).toHaveClass("material-symbols-outlined");
    expect(screen.queryByText("Rectronx Cloud")).not.toBeInTheDocument();
    expect(screen.queryByText("Responsive readiness")).not.toBeInTheDocument();
    expect(screen.queryByText("Quality assurance console")).not.toBeInTheDocument();
    expect(screen.getByTestId("dashboard-header-primary")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-legacy-hero")).not.toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard project selector")).toBeInTheDocument();
    expect(screen.getByText("Energy Monitor")).toBeInTheDocument();
    expect(screen.getByText("Smart Home")).toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-simulation-pill")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-header-metrics")).not.toBeInTheDocument();
    expect(screen.queryByTestId("dashboard-action-bar")).not.toBeInTheDocument();
    expect(screen.getByTestId("gemini-widget-canvas")).toHaveClass("gemini-widget-canvas");
    expect(screen.queryByText("Virtual IoT Simulator Connected")).not.toBeInTheDocument();
    expect(screen.queryByText("Water, pressure, flow models synced with scheduler output")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Edit labels/i })).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /Publish Changes/i })).not.toBeInTheDocument();
  });

  it("keeps compact cards inside narrow screens with shared overflow-safe CSS", () => {
    const css = `${readFileSync(resolve(__dirname, "styles/app.css"), "utf8")}\n${readFileSync(resolve(__dirname, "styles/design-system.css"), "utf8")}`;

    expect(css).toContain("--spark-metric-min");
    expect(css).toContain("--spark-compact-metric-min");
    expect(css).toContain(".spark-ui .spark-page-header-grid > .top-actions");
    expect(css).toContain("display: contents");
    expect(css).toContain("--spark-metric-min: 7.25rem");
    expect(css).toContain("--spark-compact-metric-min: 4.75rem");
    expect(css).toContain("--spark-title-xl: clamp(1.55rem, 1.8vw, 2.05rem)");
    expect(css).toContain('"primary"');
    expect(css).toContain('"selector"');
    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--spark-metric-min)), 1fr))");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain(".spark-ui .project-grid");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 15.5rem), 1fr))");
    expect(css).toContain("overflow: clip");
    expect(css).toContain(".spark-ui .dashboard-header-grid.spark-page-header-grid");
    expect(css).toContain(".spark-ui .spark-page-header-primary h1");
    expect(css).toContain(".spark-ui .project-stat-row span > *");
    expect(css).toContain("grid-row: 1 / span 2");
    expect(css).toContain("grid-column: 2");
    expect(css).toContain("overflow-wrap: anywhere");
    expect(css).toContain("white-space: normal");
    expect(css).toContain("contain: inline-size");
    expect(css).toContain("container-type: inline-size");
    expect(css).toContain(".spark-ui .project-card::after");
    expect(css).toContain("display: none");
    expect(css).toContain("@container spark-page-header (max-width: 84rem)");
    expect(css).toContain("@container spark-page-header (max-width: 58rem)");
    expect(css).toContain("@container spark-metric-row (max-width: 25rem)");
    expect(css).toContain("@container spark-project-card (max-width: 20rem)");
    expect(css).toContain(".spark-ui .device-binding-panel.bound");
    expect(css).toContain("background: #f8fbff");
    expect(css).toContain(".spark-ui .entity-card-actions button.entity-edit-button");
    expect(css).toContain("background: #0f172a");
    expect(css).toContain(".spark-ui .spark-widget-card.cockpit-media-widget .media-frame");
    expect(css).toContain("min-height: clamp(22rem, 28vw, 27rem)");
  });

  it("builds same-origin websocket URLs when the production API base is relative", () => {
    expect(realtimeUrl("demo-token", "project-irrigation")).toBe("ws://localhost:3000/api/v1/realtime/ws?token=demo-token&project_id=project-irrigation");
  });

  it("toggles the demo solenoid switch immediately on the dashboard", async () => {
    render(<App />);

    const solenoidCard = (await screen.findByText("Zone 1 Solenoid")).closest("article");
    expect(solenoidCard).not.toBeNull();
    expect(within(solenoidCard as HTMLElement).getByText("OPEN (FLOW ENABLED)")).toBeInTheDocument();

    fireEvent.click(within(solenoidCard as HTMLElement).getByRole("button"));

    expect(within(solenoidCard as HTMLElement).getByText("CLOSED (BLOCKED)")).toBeInTheDocument();
  });

  it("renders the Gemini-style irrigation cockpit widget set", async () => {
    render(<App />);

    expect(await screen.findByText("Line Pressure")).toBeInTheDocument();
    expect(screen.getByText("Irrigation Schedule")).toBeInTheDocument();
    expect(screen.getByText("Zone 1 Solenoid")).toBeInTheDocument();
    expect(screen.getByText("Zone 2 Solenoid")).toBeInTheDocument();
    expect(screen.getByText("S-Power Hub")).toBeInTheDocument();
    expect(screen.getByText("Event Monitor")).toBeInTheDocument();
    expect(screen.getByText("SPATIAL MAP")).toBeInTheDocument();
    expect(screen.getByText("VIDEO OUT")).toBeInTheDocument();
    expect(screen.getByText("PRESSURE OPTIMAL & SYSTEM NOMINAL")).toBeInTheDocument();
    expect(screen.getByText("[WARN] Soil moisture low at 31%")).toBeInTheDocument();
  });

  it("shows template builder with board, virtual pins, datastreams and notifications", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));

    expect(screen.queryByText("Template library")).not.toBeInTheDocument();
    expect(screen.queryByText("Start from a product model, then build the dashboard")).not.toBeInTheDocument();
    expect(screen.getByText("3/3 templates used")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create template/i })).toBeDisabled();

    const energyTemplateCard = screen.getByRole("article", { name: /Energy Monitor template/i });
    expect(within(energyTemplateCard).queryByText("Active")).not.toBeInTheDocument();
    expect(within(energyTemplateCard).queryByText("", { selector: ".status-dot" })).not.toBeInTheDocument();
    expect(within(energyTemplateCard).getByRole("button", { name: /Edit template/i })).toBeInTheDocument();
    expect(within(energyTemplateCard).getByRole("button", { name: /Delete template/i })).toBeInTheDocument();
    fireEvent.click(within(energyTemplateCard).getByRole("button", { name: /Edit template/i }));

    expect(screen.getByText("Spark IoT Template Studio")).toBeInTheDocument();
    expect(screen.getByTestId("template-studio")).toHaveClass("spark-studio");
    expect(screen.getByTestId("template-studio-header")).toHaveClass("wizard-header", "studio-system-header");
    expect(screen.getByLabelText("Template setup steps")).toHaveClass("wizard-steps", "studio-system-steps");
    expect(screen.getAllByDisplayValue("Energy Monitor").length).toBeGreaterThan(0);
    expect(screen.getByText("Migrate")).toBeInTheDocument();
    expect(screen.getByText("Datastreams")).toBeInTheDocument();
    expect(screen.getByText("Dashboard")).toBeInTheDocument();
    expect(screen.getByText("Code")).toBeInTheDocument();
    expect(screen.getByText("Product model studio")).toBeInTheDocument();
    expect(screen.getByText("Template accelerators")).toBeInTheDocument();
    expect(screen.getByDisplayValue("ESP32")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Migrate"));
    expect(screen.getByText("Blynk import command center")).toBeInTheDocument();
    expect(screen.getByText("Virtual pin parser")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Datastreams"));
    expect(screen.getByText("Virtual pin registry")).toBeInTheDocument();
    expect(screen.getByText("Firmware-safe channel map")).toBeInTheDocument();
    expect(screen.getByTestId("datastream-editor")).toHaveClass("studio-system-datastreams");
    expect(screen.getByDisplayValue("V0")).toBeInTheDocument();
    expect(screen.getAllByDisplayValue("Voltage").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Dashboard"));
    expect(screen.getByText("Dashboard layout lab")).toBeInTheDocument();
    expect(screen.getByText("Professional widget canvas")).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-builder-workbench")).toHaveClass("studio-system-workbench");
    expect(screen.getByText("Widget Library")).toBeInTheDocument();
    fireEvent.click(screen.getAllByText("Notifications")[1]);
    expect(screen.getByText("Alert operations center")).toBeInTheDocument();
    expect(screen.getByText("Push-safe rule engine")).toBeInTheDocument();
    expect(screen.getByTestId("notification-builder")).toHaveClass("studio-system-rules");
    expect(screen.getAllByText("Notifications").length).toBeGreaterThan(0);
    fireEvent.click(screen.getByText("Code"));
    expect(screen.getByText("Firmware command center")).toBeInTheDocument();
    expect(screen.getByText("Arduino-ready sketch")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Simulator"));
    expect(screen.getByText("Live payload simulator")).toBeInTheDocument();
    expect(screen.getByText("GPS and camera cost control")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Projects"));
    expect(screen.queryByText("Project command center")).not.toBeInTheDocument();
    expect(screen.getByText("Starter plan capacity")).toBeInTheDocument();
    const irrigationProject = screen.getByRole("article", { name: /Smart Irrigation project/i });
    expect(within(irrigationProject).getByText("Active")).toBeInTheDocument();
    expect(within(irrigationProject).getByRole("button", { name: /Edit project/i })).toBeInTheDocument();
    expect(within(irrigationProject).getByRole("button", { name: /Delete project/i })).toBeInTheDocument();
  });


  it("shows demo data history with real CSV export links", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Data History"));

    expect(screen.getByTestId("data-history-page")).toHaveClass("data-history-panel");
    expect(screen.getByText("30-day data history")).toBeInTheDocument();
    expect(screen.getByText("readings ready")).toBeInTheDocument();
    expect(screen.getByLabelText("Device")).toHaveValue("device-irrigation");
    expect(screen.getByLabelText("Datastream")).toHaveValue("all");
    expect(screen.getAllByText("ESP32 Irrigation Node").length).toBeGreaterThan(0);
    expect(screen.getAllByText("V0").length).toBeGreaterThan(0);
    expect(screen.getAllByText("29.4").length).toBeGreaterThan(0);
    const exportLink = screen.getByRole("link", { name: /Export CSV/i });
    expect(exportLink).toHaveAttribute("href", expect.stringContaining("/api/v1/demo/devices/device-irrigation/history.csv"));
  });

  it("shows device provisioning with template binding, tokens and starter limit", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Devices"));

    expect(screen.getByTestId("devices-page")).toHaveClass("device-system-page");
    expect(screen.queryByTestId("device-provisioning-hero")).not.toBeInTheDocument();
    expect(screen.getByTestId("device-provisioning-grid")).toHaveClass("device-system-grid");
    expect(screen.queryByText("Provisioning center")).not.toBeInTheDocument();
    expect(screen.queryByText("Bind boards to templates and ship firmware-ready credentials")).not.toBeInTheDocument();
    expect(screen.queryByText("Production rule")).not.toBeInTheDocument();
    expect(screen.queryByText(/raw device token only once/i)).not.toBeInTheDocument();
    expect(screen.getByText("3/3 devices used")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Provision device/i })).toBeDisabled();

    const irrigationDevice = screen.getByRole("article", { name: /ESP32 Irrigation Node provisioning card/i });
    expect(irrigationDevice).toHaveClass("device-system-card");
    expect(within(irrigationDevice).getByText("Smart Irrigation")).toBeInTheDocument();
    expect(within(irrigationDevice).getByText("ESP32")).toBeInTheDocument();
    expect(within(irrigationDevice).getByText("Device token")).toBeInTheDocument();
    expect(within(irrigationDevice).getAllByText(/spk_dev_/).length).toBeGreaterThan(0);
    expect(within(irrigationDevice).getByText("Telemetry topic")).toBeInTheDocument();
    expect(within(irrigationDevice).getByText("Command topic")).toBeInTheDocument();
    expect(within(irrigationDevice).getByText("Arduino bind")).toBeInTheDocument();
    expect(within(irrigationDevice).getByRole("button", { name: /Edit device/i })).toBeInTheDocument();
    expect(within(irrigationDevice).getByRole("button", { name: /Delete device/i })).toBeInTheDocument();
  });

  it("edits and deletes projects, templates and devices from their card actions", async () => {
    vi.spyOn(window, "confirm").mockReturnValue(true);
    render(<App />);

    fireEvent.click(await screen.findByText("Projects"));
    const irrigationProject = screen.getByRole("article", { name: /Smart Irrigation project/i });
    fireEvent.click(within(irrigationProject).getByRole("button", { name: /Edit project/i }));
    fireEvent.change(screen.getByLabelText("Edit project name"), { target: { value: "Irrigation Pro" } });
    fireEvent.click(screen.getByRole("button", { name: /Save project/i }));
    expect(screen.getByRole("article", { name: /Irrigation Pro project/i })).toBeInTheDocument();

    const homeProject = screen.getByRole("article", { name: /Smart Home project/i });
    fireEvent.click(within(homeProject).getByRole("button", { name: /Delete project/i }));
    expect(screen.queryByRole("article", { name: /Smart Home project/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Templates"));
    const energyTemplate = screen.getByRole("article", { name: /Energy Monitor template/i });
    fireEvent.click(within(energyTemplate).getByRole("button", { name: /Delete template/i }));
    expect(screen.queryByRole("article", { name: /Energy Monitor template/i })).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Devices"));
    const irrigationDevice = screen.getByRole("article", { name: /ESP32 Irrigation Node provisioning card/i });
    fireEvent.click(within(irrigationDevice).getByRole("button", { name: /Edit device/i }));
    fireEvent.change(screen.getByLabelText("Edit device name"), { target: { value: "Irrigation Edge Node" } });
    fireEvent.click(screen.getByRole("button", { name: /Save device/i }));
    expect(screen.getByRole("article", { name: /Irrigation Edge Node provisioning card/i })).toBeInTheDocument();

    const energyDevice = screen.getByRole("article", { name: /ESP32 Energy Node provisioning card/i });
    fireEvent.click(within(energyDevice).getByRole("button", { name: /Delete device/i }));
    expect(screen.queryByRole("article", { name: /ESP32 Energy Node provisioning card/i })).not.toBeInTheDocument();
  });

  it("regenerates account device tokens and updates the Arduino bind block", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Live protected tenant workspace", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "Customer ESP32",
      board: "ESP32",
      is_online: true,
      token: null,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const rotatedDevice = { ...accountDevice, token: "spk_dev_rotated_once_1234" };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/projects")) {
        return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/devices") && init?.method !== "POST") {
        return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/devices/account-device/regenerate-token")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify(rotatedDevice), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications") || url.includes("/schedules")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tenant/usage")) {
        return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/dashboards/project/account-project")) {
        return new Response(JSON.stringify({ id: "account-dashboard", project_id: "account-project", name: "Customer Greenhouse Dashboard", revision: 1, widgets: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/telemetry/projects/account-project/latest")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Devices"));

    const deviceCard = await screen.findByRole("article", { name: /Customer ESP32 provisioning card/i });
    expect(within(deviceCard).getByText("Token hidden after first issue")).toBeInTheDocument();
    fireEvent.click(within(deviceCard).getByRole("button", { name: /Regenerate token/i }));

    expect(await within(deviceCard).findByText("spk_dev_rotated_once_1234")).toBeInTheDocument();
    expect(within(deviceCard).getByText(/#define SPARK_TOKEN "spk_dev_rotated_once_1234"/)).toBeInTheDocument();
  });

  it("provisions an account device and reveals its one-time token", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Live protected tenant workspace", is_active: true };
    const existingDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "Existing ESP32",
      board: "ESP32",
      is_online: true,
      token: null,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const createdDevice = {
      id: "new-node",
      project_id: "account-project",
      name: "Greenhouse Node 2",
      board: "ESP8266",
      is_online: false,
      token: "spk_dev_new_node_once_5678",
      telemetry_topic: "spark/v1/account-tenant/new-node/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/new-node/command/{channel}"
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices") && init?.method !== "POST") return new Response(JSON.stringify([existingDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices") && init?.method === "POST") {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        expect(JSON.parse(String(init.body))).toEqual({ project_id: "account-project", name: "Greenhouse Node 2", board: "ESP8266" });
        return new Response(JSON.stringify(createdDevice), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify({ id: "account-dashboard", project_id: "account-project", name: "Customer Greenhouse Dashboard", revision: 1, widgets: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Devices"));

    expect(await screen.findByText("1/3 devices used")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Provision device/i }));
    fireEvent.change(screen.getByLabelText("Device name"), { target: { value: "Greenhouse Node 2" } });
    fireEvent.change(screen.getByLabelText("Board type"), { target: { value: "ESP8266" } });
    fireEvent.click(screen.getByRole("button", { name: /Create device/i }));

    const newDeviceCard = await screen.findByRole("article", { name: /Greenhouse Node 2 provisioning card/i });
    expect(within(newDeviceCard).getByText("spk_dev_new_node_once_5678")).toBeInTheDocument();
    expect(within(newDeviceCard).getByText(/#define SPARK_TOKEN "spk_dev_new_node_once_5678"/)).toBeInTheDocument();
    expect(screen.getByText("New device token shown once. Copy it before leaving this page.")).toBeInTheDocument();
  });

  it("creates account projects within the Starter three-project limit", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Live protected tenant workspace", is_active: true };
    const createdProject = { id: "project-aquaponics", name: "Aquaponics Lab", description: "Fish tank and plant bed monitoring", is_active: true };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects") && init?.method === "POST") {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        expect(JSON.parse(String(init.body))).toEqual({ name: "Aquaponics Lab", description: "Fish tank and plant bed monitoring" });
        return new Response(JSON.stringify(createdProject), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 0, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify({ id: "account-dashboard", project_id: "account-project", name: "Customer Greenhouse Dashboard", revision: 1, widgets: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Projects"));

    expect(await screen.findByText("1/3 projects used")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create project/i }));
    fireEvent.change(screen.getByLabelText("Project name"), { target: { value: "Aquaponics Lab" } });
    fireEvent.change(screen.getByLabelText("Project description"), { target: { value: "Fish tank and plant bed monitoring" } });
    fireEvent.click(screen.getByRole("button", { name: /Save project/i }));

    expect((await screen.findAllByText("Aquaponics Lab")).length).toBeGreaterThan(0);
    expect(screen.getByText("Fish tank and plant bed monitoring")).toBeInTheDocument();
    expect(screen.getByText("Project created. Next: add a template and provision a board.")).toBeInTheDocument();
  });

  it("creates and saves real account templates for signed-in projects", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Live protected tenant workspace", is_active: true };
    const accountDashboard = { id: "account-dashboard", project_id: "account-project", name: "Customer Greenhouse Dashboard", revision: 1, widgets: [] };
    const createdTemplate = {
      id: "template-account",
      name: "Customer Greenhouse",
      board: "ESP32",
      description: "Smart Irrigation template for Customer Greenhouse",
      revision: 1,
      datastreams: [
        { id: "ds-temp", name: "Temperature", pin: "V0", dataType: "float", unit: "C", min: 0, max: 100, color: "#2563eb" }
      ],
      notifications: [],
      dashboard: {
        ...accountDashboard,
        widgets: [{ id: "w-temp", type: "gauge", title: "Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "", channel: "V0", datastreamId: "ds-temp" }]
      }
    };
    const savedTemplate = { ...createdTemplate, name: "Greenhouse Controller", revision: 2, dashboard: { ...createdTemplate.dashboard, revision: 2 } };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates") && init?.method === "POST") {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        const payload = JSON.parse(String(init.body));
        expect(payload.dashboard.project_id).toBe("account-project");
        expect(payload.datastreams[0].pin).toBe("V0");
        return new Response(JSON.stringify(createdTemplate), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      if (url.endsWith("/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/templates/template-account") && init?.method === "PUT") {
        const payload = JSON.parse(String(init.body));
        expect(payload.name).toBe("Greenhouse Controller");
        return new Response(JSON.stringify(savedTemplate), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 0, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify(accountDashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));

    expect(await screen.findByText("0/3 templates used")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Create template/i }));
    fireEvent.click(screen.getByRole("button", { name: /Save template/i }));

    expect(await screen.findByText("Spark IoT Template Studio")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Template name"), { target: { value: "Greenhouse Controller" } });
    fireEvent.click(screen.getByRole("button", { name: /Save/i }));

    expect(await screen.findByText("Saved")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Greenhouse Controller")).toBeInTheDocument();
  });

  it("shows a live board test panel with MQTT connection details", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Live Test"));

    expect(screen.getByTestId("live-test-page")).toHaveClass("live-system-page");
    expect(screen.getByTestId("live-test-hero")).toHaveClass("live-system-hero");
    expect(screen.getByTestId("live-test-grid")).toHaveClass("live-system-grid");
    expect(screen.getByTestId("connection-proof-timeline")).toHaveClass("connection-proof-timeline");
    expect(screen.getByTestId("live-command-monitor")).toHaveClass("live-system-command-monitor");
    expect(screen.getByText("Live board test")).toBeInTheDocument();
    expect(screen.getByText("Connection proof timeline")).toBeInTheDocument();
    expect(screen.getByText("1. Telemetry received")).toBeInTheDocument();
    expect(screen.getByText("2. Command published")).toBeInTheDocument();
    expect(screen.getByText("3. Board ACK")).toBeInTheDocument();
    expect(screen.getByText("Latest V-pin readings are landing from the selected board.")).toBeInTheDocument();
    expect(screen.getByText("Waiting for switch/button command activity.")).toBeInTheDocument();
    expect(screen.getByTestId("board-quick-test")).toHaveClass("board-quick-test");
    expect(screen.getByText("Board Quick Test")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish test command/i })).toBeInTheDocument();
    expect(screen.getByText("Test command topic")).toBeInTheDocument();
    expect(screen.getAllByText("spark/v1/demo-tenant/device-irrigation/command/V3").length).toBeGreaterThan(0);
    expect(screen.getByText("Expected board ACK")).toBeInTheDocument();
    expect(screen.getByText("spark/v1/demo-tenant/device-irrigation/ack/V3")).toBeInTheDocument();
    expect(screen.getByText("MQTT broker")).toBeInTheDocument();
    expect(screen.getByText("device-irrigation")).toBeInTheDocument();
    expect(screen.getByText("spark/v1/demo-tenant/device-irrigation/telemetry/{channel}")).toBeInTheDocument();
    expect(screen.getByText("spk_dev_irrigation_demo_9f3a")).toBeInTheDocument();
    expect(screen.getByText("Command monitor")).toBeInTheDocument();
    expect(screen.getByText("Shows dashboard commands and board acknowledgements. This is how you prove the switch reached the ESP32/NodeMCU.")).toBeInTheDocument();
  });

  it("shows a Blynk Timer-style schedule automation page in demo mode", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Schedules"));

    expect(screen.getByTestId("schedules-page")).toHaveClass("schedule-system-page");
    expect(screen.getByTestId("schedule-workbench")).toHaveClass("schedule-workbench-single");
    expect(document.querySelector(".premium-schedule-form-grid")).toBeTruthy();
    expect(document.querySelectorAll(".premium-schedule-field").length).toBe(6);
    expect(screen.queryByText("Schedule automation")).not.toBeInTheDocument();
    expect(screen.queryByText("Blynk Timer-style day and time control for boards, pumps, relays and status outputs.")).not.toBeInTheDocument();
    expect(screen.queryByText("Demo-only planner")).not.toBeInTheDocument();
    expect(screen.queryByText("Active rules")).not.toBeInTheDocument();
    expect(screen.queryByText("Plan window")).not.toBeInTheDocument();
    expect(screen.queryByText("Production guardrails")).not.toBeInTheDocument();
    expect(screen.getByText("Irrigation morning run")).toBeInTheDocument();
    expect(screen.getAllByText("V3").length).toBeGreaterThan(0);
    expect(screen.getByLabelText("Device")).toHaveValue("device-irrigation");
    expect(screen.getByLabelText("Virtual pin")).toHaveValue("V3");
    expect(screen.getByLabelText("Command value")).toHaveValue("true");
    expect(screen.getByLabelText("Run time")).toHaveValue("06:00");
    expect(screen.getByLabelText("Repeat")).toHaveValue("mon,wed,fri");
    expect(screen.getByRole("button", { name: /Add demo schedule/i })).toBeInTheDocument();
  });

  it("loads and creates authenticated schedules with the protected API", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "ESP32 Greenhouse Node",
      board: "ESP32",
      is_online: true,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountSchedule = {
      id: "schedule-greenhouse-fan",
      project_id: "account-project",
      device_id: "account-device",
      channel: "V4",
      value: true,
      time_of_day: "18:30",
      recurrence: "daily",
      timezone: "Asia/Kuala_Lumpur",
      is_active: true
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/projects")) {
        return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/devices")) {
        return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tenant/usage")) {
        return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/dashboards/project/account-project")) {
        return new Response(JSON.stringify({ id: "account-dashboard", project_id: "account-project", name: "Customer Greenhouse Dashboard", revision: 1, widgets: [] }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/telemetry/projects/account-project/latest")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/schedules") && init?.method === "POST") {
        expect((init.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        expect(init.body).toContain('"device_id":"account-device"');
        expect(init.body).toContain('"channel":"V3"');
        return new Response(JSON.stringify({ ...accountSchedule, id: "schedule-new", channel: "V3", time_of_day: "06:00" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/schedules")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify([accountSchedule]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Schedules"));

    expect(await screen.findByText("Customer Greenhouse fan")).toBeInTheDocument();
    expect(screen.getByText("18:30")).toBeInTheDocument();
    expect(screen.getByText("Asia/Kuala_Lumpur")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Create live schedule/i }));

    expect(await screen.findByText("schedule-new")).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/schedules"), expect.objectContaining({ method: "POST" }));
  });

  it("generates board-specific SparkIoT Arduino library sketches from selected templates and devices", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));

    const irrigationTemplateCard = screen.getByRole("article", { name: /Smart Irrigation template/i });
    fireEvent.click(within(irrigationTemplateCard).getByRole("button", { name: /Open studio/i }));
    fireEvent.click(screen.getByText("Code"));

    expect(screen.getByText(/#include <SparkIoT\.h>/)).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_TOKEN = "spk_dev_irrigation_demo_9f3a"/)).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_ID = "device-irrigation"/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.begin\(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.virtualWrite\("V0", 50, "C"\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.setLocation\("V7", 3\.139, 101\.6869, 14, 8\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.onCommand\("V4", onV4Command\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.ack\("V4", state, "V4 command applied"\)/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Templates"));
    const homeTemplateCard = screen.getByRole("article", { name: /Smart Home template/i });
    fireEvent.click(within(homeTemplateCard).getByRole("button", { name: /Open studio/i }));
    fireEvent.click(screen.getByText("Code"));

    expect(screen.getByText(/#include <SparkIoT\.h>/)).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_TOKEN = "spk_dev_home_demo_2c8b"/)).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_ID = "device-home"/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.virtualWrite\("V1", 50, "%"\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.onCommand\("V0", onV0Command\)/)).toBeInTheDocument();
    expect(screen.getByText(/SparkIoT\.ack\("V0", state, "V0 command applied"\)/)).toBeInTheDocument();
  });

  it("makes account Code tab binding explicit when the matching device token is hidden", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "Customer ESP32",
      board: "ESP32",
      is_online: false,
      token: null,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountTemplate = {
      id: "template-account",
      name: "Customer Greenhouse",
      board: "ESP32",
      description: "Real account template",
      revision: 1,
      datastreams: [
        { id: "ds-temp", name: "Temperature", pin: "V0", dataType: "float", unit: "C", min: 0, max: 100, color: "#2563eb" },
        { id: "ds-pump", name: "Pump", pin: "V1", dataType: "boolean", unit: "", min: 0, max: 1, color: "#10b981" }
      ],
      notifications: [],
      dashboard: {
        id: "account-dashboard",
        project_id: "account-project",
        name: "Customer Greenhouse Dashboard",
        revision: 1,
        widgets: [{ id: "w-temp", type: "gauge", title: "Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "account-device", channel: "V0", datastreamId: "ds-temp" }]
      }
    };
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates")) return new Response(JSON.stringify([accountTemplate]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify(accountTemplate.dashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));
    fireEvent.click(within(await screen.findByRole("article", { name: /Customer Greenhouse template/i })).getByRole("button", { name: /Open studio/i }));
    fireEvent.click(screen.getByText("Code"));

    expect(screen.getByText("Customer ESP32")).toBeInTheDocument();
    expect(screen.getByText("Token hidden after first issue")).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_ID = "account-device"/)).toBeInTheDocument();
    expect(screen.getByText(/SPARK_DEVICE_TOKEN = "ROTATE_TOKEN_TO_REVEAL_ONCE"/)).toBeInTheDocument();
    expect(screen.queryByText(/SPARK_DEVICE_TOKEN = "YOUR_DEVICE_TOKEN"/)).not.toBeInTheDocument();
  });

  it("binds account template dashboard widgets to the selected project device before saving", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token" }));
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "Customer ESP32",
      board: "ESP32",
      is_online: true,
      token: "spk_once_visible",
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountTemplate = {
      id: "template-account",
      name: "Customer Greenhouse",
      board: "ESP32",
      description: "Real account template",
      revision: 1,
      datastreams: [
        { id: "ds-temp", name: "Temperature", pin: "V0", dataType: "float", unit: "C", min: 0, max: 100, color: "#2563eb" }
      ],
      notifications: [],
      dashboard: {
        id: "account-dashboard",
        project_id: "account-project",
        name: "Customer Greenhouse Dashboard",
        revision: 1,
        widgets: [{ id: "w-temp", type: "gauge", title: "Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "", channel: "V0", datastreamId: "ds-temp" }]
      }
    };
    let savedTemplateBody = "";
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates")) return new Response(JSON.stringify([accountTemplate]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates/template-account") && init?.method === "PUT") {
        savedTemplateBody = String(init.body ?? "");
        return new Response(savedTemplateBody, { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify(accountTemplate.dashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));
    fireEvent.click(within(await screen.findByRole("article", { name: /Customer Greenhouse template/i })).getByRole("button", { name: /Open studio/i }));

    expect(await screen.findByText("Dashboard needs device binding")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Bind dashboard to Customer ESP32/i }));
    expect(screen.getByText("Dashboard bound to Customer ESP32")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^Save$/i }));

    await vi.waitFor(() => expect(savedTemplateBody).toContain('"deviceId":"account-device"'));
    expect(JSON.parse(savedTemplateBody).dashboard.widgets[0].deviceId).toBe("account-device");
  });


  it("lets users sign in and out from the Settings account panel", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/login")) {
        expect(init?.method).toBe("POST");
        return new Response(JSON.stringify({ access_token: "access-demo", refresh_token: "refresh-demo", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/me")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer access-demo");
        return new Response(JSON.stringify({ full_name: "Demo User", email: "demo@sparkiot.dev", tenant_id: "demo-tenant", plan_code: "starter" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Settings"));

    expect(screen.queryByText("Platform settings")).not.toBeInTheDocument();
    expect(screen.queryByText("Production readiness controls")).not.toBeInTheDocument();
    expect(screen.queryByText("Map tiles")).not.toBeInTheDocument();
    expect(screen.queryByText("VITE_MAP_TILE_URL")).not.toBeInTheDocument();
    expect(screen.getByText("Account access")).toBeInTheDocument();
    expect(screen.getByText("Data window")).toBeInTheDocument();
    expect(screen.getByText("30-day retention")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign in demo account/i }));

    expect(await screen.findByText("Signed in as Demo User")).toBeInTheDocument();
    expect(screen.getByText(/demo@sparkiot\.dev/)).toBeInTheDocument();
    expect(screen.getByText(/starter/)).toBeInTheDocument();
    expect(screen.getByText(/demo-tenant/)).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toContain("access-demo");

    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(screen.getByText("Not signed in")).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toBeNull();
  });

  it("lets signed-in users enable browser push notifications from Settings", async () => {
    const subscriptionJson = {
      endpoint: "https://push.example/subscription",
      keys: { p256dh: "client-key", auth: "client-auth" }
    };
    const subscribe = vi.fn(async () => ({ toJSON: () => subscriptionJson }));
    const register = vi.fn(async () => ({
      pushManager: {
        getSubscription: vi.fn(async () => null),
        subscribe
      }
    }));
    Object.defineProperty(navigator, "serviceWorker", { value: { register }, configurable: true });
    vi.stubGlobal("PushManager", function PushManager() {});
    vi.stubGlobal("Notification", {
      permission: "default",
      requestPermission: vi.fn(async () => "granted")
    });

    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/login")) {
        return new Response(JSON.stringify({ access_token: "push-token", refresh_token: "refresh-token", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/me")) {
        return new Response(JSON.stringify({ full_name: "Demo User", email: "demo@sparkiot.dev", tenant_id: "demo-tenant", plan_code: "starter" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications/push-public-key")) {
        return new Response(JSON.stringify({ public_key: "AQID" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications/push-subscriptions")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer push-token");
        expect(init?.body).toContain("https://push.example/subscription");
        return new Response(JSON.stringify({ status: "stored" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(await screen.findByText("Settings"));
    fireEvent.click(screen.getByRole("button", { name: /Sign in demo account/i }));
    expect(await screen.findByText("Signed in as Demo User")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Enable browser push/i }));

    expect((await screen.findAllByText("Browser push enabled")).length).toBeGreaterThan(0);
    expect(register).toHaveBeenCalledWith("/spark-push-sw.js");
    expect(subscribe).toHaveBeenCalledWith(expect.objectContaining({ userVisibleOnly: true }));
  });

  it("supports switching from no-login demo mode into authenticated account mode", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/login")) {
        expect(init?.method).toBe("POST");
        expect(init?.body).toContain("demo@sparkiot.dev");
        return new Response(JSON.stringify({ access_token: "account-demo", refresh_token: "refresh-demo", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Demo mode active")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign in to account/i }));

    expect(screen.getByRole("heading", { name: /Sign in to your IoT control center/i })).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByText("Account mode active")).toBeInTheDocument();
    expect(screen.getByText("Authenticated workspace")).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toContain("account-demo");

    fireEvent.click(screen.getByRole("button", { name: /Sign out/i }));
    expect(screen.getByText("Demo mode active")).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toBeNull();
  });

  it("uses one standardized premium auth layout across login, register and reset modes", async () => {
    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Sign in to account/i }));

    const authCard = screen.getByTestId("auth-card");
    expect(authCard).toHaveClass("login-panel", "auth-card");
    expect(screen.getByTestId("auth-brand")).toHaveClass("auth-brand");
    expect(screen.getByTestId("auth-tabs")).toHaveClass("auth-mode-tabs");
    expect(screen.getByTestId("auth-form")).toHaveClass("auth-form");
    expect(screen.getByTestId("auth-primary-action")).toHaveClass("primary", "auth-primary-action");
    expect(screen.getByRole("button", { name: /Continue demo mode/i })).toHaveClass("auth-secondary-action");
    expect(screen.getAllByTestId("auth-field").length).toBeGreaterThanOrEqual(2);

    fireEvent.click(screen.getByRole("button", { name: /Create Starter account/i }));
    expect(screen.getByTestId("auth-card")).toHaveClass("auth-card");
    expect(screen.getByTestId("auth-tabs")).toHaveClass("auth-mode-tabs");
    expect(screen.getByTestId("auth-form")).toHaveClass("auth-form");
    expect(screen.getAllByTestId("auth-field").length).toBeGreaterThanOrEqual(4);
    expect(screen.getByTestId("auth-primary-action")).toHaveClass("primary", "auth-primary-action");

    fireEvent.click(screen.getByRole("button", { name: /Reset password/i }));
    expect(screen.getByTestId("auth-card")).toHaveClass("auth-card");
    expect(screen.getByTestId("auth-tabs")).toHaveClass("auth-mode-tabs");
    expect(screen.getByTestId("auth-form")).toHaveClass("auth-form");
    expect(screen.getAllByTestId("auth-field").length).toBe(1);
    expect(screen.getByTestId("auth-primary-action")).toHaveClass("primary", "auth-primary-action");
  });

  it("lets a new customer create a Starter account from the auth screen", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/register")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({
          tenant_name: "Rectronx Customer Lab",
          full_name: "Mahesh Rajagopal",
          email: "mahesh@example.com",
          password: "SparkDemo123!"
        });
        return new Response(JSON.stringify({ access_token: "new-account-token", refresh_token: "new-refresh-token", token_type: "bearer" }), { status: 201, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Sign in to account/i }));
    fireEvent.click(screen.getByRole("button", { name: /Create Starter account/i }));
    fireEvent.change(screen.getByLabelText("Company or workspace name"), { target: { value: "Rectronx Customer Lab" } });
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Mahesh Rajagopal" } });
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mahesh@example.com" } });
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "SparkDemo123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Create account/i }));

    expect(await screen.findByText("Account mode active")).toBeInTheDocument();
    expect(screen.getByText("Authenticated workspace")).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toContain("new-account-token");
    expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/auth/register"), expect.objectContaining({ method: "POST" }));
  });

  it("lets customers request and confirm a password reset from the auth screen", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/password-reset/request")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ email: "mahesh@example.com" });
        return new Response(JSON.stringify({ status: "ok", message: "If the account exists, reset instructions are ready.", reset_token: "dev-reset-token-123" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/password-reset/confirm")) {
        expect(init?.method).toBe("POST");
        expect(JSON.parse(String(init?.body))).toEqual({ token: "dev-reset-token-123", password: "NewSpark123!" });
        return new Response(JSON.stringify({ status: "ok", message: "Password updated. Sign in with your new password." }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/login")) {
        expect(JSON.parse(String(init?.body))).toEqual({ email: "mahesh@example.com", password: "NewSpark123!" });
        return new Response(JSON.stringify({ access_token: "reset-login-token", refresh_token: "reset-refresh-token", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    fireEvent.click(await screen.findByRole("button", { name: /Sign in to account/i }));
    fireEvent.click(screen.getByRole("button", { name: /Forgot password/i }));
    fireEvent.change(screen.getByLabelText("Email"), { target: { value: "mahesh@example.com" } });
    fireEvent.click(screen.getByRole("button", { name: /Send reset link/i }));

    expect(await screen.findByText("Reset token ready for testing")).toBeInTheDocument();
    expect(screen.getByDisplayValue("dev-reset-token-123")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("New password"), { target: { value: "NewSpark123!" } });
    fireEvent.click(screen.getByRole("button", { name: /Update password/i }));

    expect(await screen.findByText("Password updated. Sign in with your new password.")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Password"), { target: { value: "NewSpark123!" } });
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByText("Account mode active")).toBeInTheDocument();
    expect(localStorage.getItem("spark_iot_session")).toContain("reset-login-token");
  });

  it("loads protected workspace data after account sign in while preserving demo mode before login", async () => {
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "ESP32 Greenhouse Node",
      board: "ESP32",
      is_online: true,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountDashboard = {
      id: "account-dashboard",
      project_id: "account-project",
      name: "Customer Greenhouse Dashboard",
      revision: 4,
      widgets: [
        { id: "account-widget-temp", type: "value", title: "Greenhouse Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "account-device", channel: "V0", unit: "C", min: 0, max: 60 }
      ]
    };
    const accountLatest = [
      { id: "account-reading-v0", device_id: "account-device", channel: "V0", value: 28.6, unit: "C", observed_at: "2026-07-15T05:00:00Z", server_at: "2026-07-15T05:00:01Z" }
    ];
    const accountNotifications = [
      { id: "account-notification", title: "Account alert", body: "Greenhouse temperature stable", read: false, created_at: "2026-07-15T05:01:00Z" }
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) {
        return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/auth/login")) {
        return new Response(JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/dashboards/project/account-project")) {
        return new Response(JSON.stringify(accountDashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/telemetry/projects/account-project/latest")) {
        return new Response(JSON.stringify(accountLatest), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/projects")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/devices")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications/account-notification/read")) {
        expect(init?.method).toBe("PATCH");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify({ ...accountNotifications[0], read: true }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications")) {
        return new Response(JSON.stringify(accountNotifications), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/tenant/usage")) {
        return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);

    expect(await screen.findByText("Smart Irrigation Dashboard")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Sign in to account/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByText("Customer Greenhouse Dashboard")).toBeInTheDocument();
    expect(screen.getByLabelText("Dashboard project selector")).toHaveValue("account-project");
    expect(await screen.findByText("Greenhouse Temperature")).toBeInTheDocument();
    expect(await screen.findByText(/28\.6/)).toBeInTheDocument();

    fireEvent.click(screen.getByText("Projects"));
    expect((await screen.findAllByText("Customer Greenhouse")).length).toBeGreaterThan(0);
    expect(screen.queryByText("Smart Irrigation")).not.toBeInTheDocument();

    fireEvent.click(screen.getByText("Devices"));
    expect((await screen.findAllByText("ESP32 Greenhouse Node")).length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Notifications"));
    expect(await screen.findByText("Account alert")).toBeInTheDocument();
    expect(screen.getByText("Unread")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /Mark Account alert as read/i }));
    expect(await screen.findByText("Read")).toBeInTheDocument();
    expect(screen.queryByText("Unread")).not.toBeInTheDocument();
  });

  it("uses tenant-scoped account history and CSV export links after sign in", async () => {
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "ESP32 Greenhouse Node",
      board: "ESP32",
      is_online: true,
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountDashboard = {
      id: "account-dashboard",
      project_id: "account-project",
      name: "Customer Greenhouse Dashboard",
      revision: 4,
      widgets: [
        { id: "account-widget-temp", type: "value", title: "Greenhouse Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "account-device", channel: "V0", unit: "C", min: 0, max: 60 }
      ]
    };
    const accountLatest = [
      { id: "account-reading-v0", device_id: "account-device", channel: "V0", value: 28.6, unit: "C", observed_at: "2026-07-15T05:00:00Z", server_at: "2026-07-15T05:00:01Z" }
    ];
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/auth/login")) return new Response(JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify(accountDashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify(accountLatest), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/devices/account-device/history")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        return new Response(JSON.stringify(accountLatest), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/demo/devices/account-device/history")) throw new Error("Account history must not use demo CSV or demo history endpoints");
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Sign in to account/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByText("Customer Greenhouse Dashboard")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Data History"));

    expect((await screen.findAllByText("ESP32 Greenhouse Node")).length).toBeGreaterThan(0);
    const exportLink = screen.getByRole("link", { name: /Export CSV/i });
    expect(exportLink).toHaveAttribute("href", expect.stringContaining("/api/v1/telemetry/devices/account-device/history.csv"));
    expect(exportLink).not.toHaveAttribute("href", expect.stringContaining("/demo/devices/account-device/history.csv"));
    await vi.waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/api/v1/telemetry/devices/account-device/history"), expect.anything()));
  });

  it("uses account device APIs on Live Test after sign in instead of demo board-test endpoints", async () => {
    const accountProject = { id: "account-project", name: "Customer Greenhouse", description: "Real tenant project", is_active: true };
    const accountDevice = {
      id: "account-device",
      project_id: "account-project",
      name: "ESP32 Greenhouse Node",
      board: "ESP32",
      is_online: true,
      token: "spk_once_visible",
      telemetry_topic: "spark/v1/account-tenant/account-device/telemetry/{channel}",
      command_topic: "spark/v1/account-tenant/account-device/command/{channel}"
    };
    const accountDashboard = {
      id: "account-dashboard",
      project_id: "account-project",
      name: "Customer Greenhouse Dashboard",
      revision: 4,
      widgets: [
        { id: "account-widget-temp", type: "value", title: "Greenhouse Temperature", x: 0, y: 0, w: 3, h: 3, deviceId: "account-device", channel: "V0", unit: "C", min: 0, max: 60 }
      ]
    };
    const accountLatest = [
      { id: "account-reading-v0", device_id: "account-device", channel: "V0", value: 28.6, unit: "C", observed_at: "2026-07-15T05:00:00Z", server_at: "2026-07-15T05:00:01Z" }
    ];
    let commandPublished = false;
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("/demo/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/auth/login")) return new Response(JSON.stringify({ access_token: "account-token", refresh_token: "refresh-token", token_type: "bearer" }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/dashboards/project/account-project")) return new Response(JSON.stringify(accountDashboard), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/telemetry/projects/account-project/latest")) return new Response(JSON.stringify(accountLatest), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/projects")) return new Response(JSON.stringify([accountProject]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/devices")) return new Response(JSON.stringify([accountDevice]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.endsWith("/templates")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/notifications") || url.includes("/schedules")) return new Response(JSON.stringify([]), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/tenant/usage")) return new Response(JSON.stringify({ users: 1, max_users: 1, devices: 1, max_devices: 3, projects: 1, max_projects: 3, retention_days: 30 }), { status: 200, headers: { "Content-Type": "application/json" } });
      if (url.includes("/devices/account-device/commands")) {
        expect(init?.method).toBe("POST");
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        expect(init?.body).toContain('"channel":"V3"');
        commandPublished = true;
        return new Response(JSON.stringify({ status: "published" }), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/devices/account-device/command-logs")) {
        expect((init?.headers as Record<string, string>).Authorization).toBe("Bearer account-token");
        const logs = commandPublished
          ? [
              { id: "ack-1", device_id: "account-device", channel: "V3", value: { status: "ok", value: true, message: "Pump command applied" }, status: "ack", created_at: "2026-07-15T05:00:05Z" },
              { id: "cmd-1", device_id: "account-device", channel: "V3", value: true, status: "published", created_at: "2026-07-15T05:00:04Z" }
            ]
          : [];
        return new Response(JSON.stringify(logs), { status: 200, headers: { "Content-Type": "application/json" } });
      }
      if (url.includes("/demo/projects/account-project/board-test") || url.includes("/demo/devices/account-device")) {
        throw new Error(`Account Live Test must not call demo endpoint ${url}`);
      }
      return new Response("not found", { status: 404 });
    });
    vi.stubGlobal("fetch", fetchMock);

    render(<App />);
    fireEvent.click(screen.getByRole("button", { name: /Sign in to account/i }));
    fireEvent.click(screen.getByRole("button", { name: /^Sign in$/i }));

    expect(await screen.findByText("Customer Greenhouse Dashboard")).toBeInTheDocument();
    fireEvent.click(screen.getByText("Live Test"));

    expect(await screen.findByText("account-tenant")).toBeInTheDocument();
    expect(screen.getByText("account-device")).toBeInTheDocument();
    expect(screen.getByText("spk_once_visible")).toBeInTheDocument();
    expect(screen.getByText(/28\.6C/)).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Publish test command/i }));

    expect((await screen.findAllByText("published")).length).toBeGreaterThan(0);
    expect(await screen.findByText("Board ACK")).toBeInTheDocument();
    expect(await screen.findByText(/Pump command applied/)).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining("/demo/projects/account-project/board-test"), expect.anything());
  });

  it("shows a real-board readiness checklist on Live Test", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Live Test"));

    expect(await screen.findByTestId("board-readiness-checklist")).toHaveClass("board-readiness-checklist");
    expect(screen.getByText("Real board readiness")).toBeInTheDocument();
    expect(screen.getByText("Install SparkIoT v1.0.0")).toBeInTheDocument();
    expect(screen.getByText("Set broker host")).toBeInTheDocument();
    expect(screen.getByText("Open Serial Monitor at 115200")).toBeInTheDocument();
    expect(screen.getByText("Publish V0 telemetry")).toBeInTheDocument();
    expect(screen.getByText("Confirm command ACK")).toBeInTheDocument();
    expect(screen.getByText("34.73.29.12 or your LAN IP")).toBeInTheDocument();
  });

  it("shows a production-ready firmware export workflow in the Code tab", async () => {
    render(<App />);
    fireEvent.click(await screen.findByText("Templates"));

    const irrigationTemplateCard = screen.getByRole("article", { name: /Smart Irrigation template/i });
    fireEvent.click(within(irrigationTemplateCard).getByRole("button", { name: /Open studio/i }));
    fireEvent.click(screen.getByText("Code"));

    expect(screen.getByTestId("firmware-export-panel")).toHaveClass("firmware-system-panel");
    expect(screen.getByText("Firmware export package")).toBeInTheDocument();
    expect(screen.getByText("Install SparkIoT library")).toBeInTheDocument();
    expect(screen.getByText("Copy folder to Documents/Arduino/libraries/SparkIoT")).toBeInTheDocument();
    expect(screen.getByText("Set WiFi and broker")).toBeInTheDocument();
    expect(screen.getByText(/Do not use localhost/)).toBeInTheDocument();
    expect(screen.getByText("Upload and watch Live Test")).toBeInTheDocument();
    expect(screen.getByText("Download .ino")).toBeInTheDocument();
    expect(screen.getByText("Copy sketch")).toBeInTheDocument();
    expect(screen.getByText("Smart_Irrigation_SparkIoT.ino")).toBeInTheDocument();
    expect(screen.getByText("ESP32")).toBeInTheDocument();
    expect(screen.getByText("device-irrigation")).toBeInTheDocument();
    expect(screen.getByText("spk_dev_irrigation_demo_9f3a")).toBeInTheDocument();
  });
});
