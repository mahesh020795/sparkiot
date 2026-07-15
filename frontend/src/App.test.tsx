import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";
import { realtimeUrl } from "./lib/api";

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
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("App", () => {
  it("opens directly on the Spark IoT dashboard without login", async () => {
    render(<App />);
    expect(await screen.findByText("Live control cockpit")).toBeInTheDocument();
    expect(screen.getByText("Premium industrial widgets")).toBeInTheDocument();
    expect(screen.getByText("Elevated radial scale sensors, interactive video streams, GIS field coordinate tracking")).toBeInTheDocument();
    expect(screen.getAllByText("Live value").length).toBeGreaterThan(0);
    expect(screen.getAllByText("Valve status").length).toBeGreaterThan(0);
    expect(screen.getByText("Workspace health")).toBeInTheDocument();
    expect(screen.queryByText("Production preview")).not.toBeInTheDocument();
    const dashboardSelector = screen.getByLabelText("Dashboard project selector");
    expect(dashboardSelector).toBeInTheDocument();
    expect(dashboardSelector).toHaveValue("project-irrigation");
    const navigation = screen.getByRole("navigation", { name: "Main navigation" });
    expect(navigation).toHaveTextContent("Settings");
    expect(navigation.compareDocumentPosition(screen.getByText("Workspace health")) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Smart Irrigation Dashboard" })).toBeInTheDocument();
    expect(screen.queryByText("Sign in")).not.toBeInTheDocument();
    expect(screen.getByText("Launch checklist")).toBeInTheDocument();
    expect(screen.getByText("Project → Template → Device → Code → Live Test")).toBeInTheDocument();
    expect(screen.getByText("Use this flow when connecting ESP32 or NodeMCU boards.")).toBeInTheDocument();
  });

  it("guides first-time users from project setup to live board testing", async () => {
    render(<App />);

    expect(await screen.findByText("Spark IoT Launch Wizard")).toBeInTheDocument();
    expect(screen.getByText("Create project")).toBeInTheDocument();
    expect(screen.getByText("Choose template")).toBeInTheDocument();
    expect(screen.getByText("Add datastreams")).toBeInTheDocument();
    expect(screen.getByText("Add device")).toBeInTheDocument();
    expect(screen.getByText("Generate Arduino code")).toBeInTheDocument();
    expect(screen.getByText("Live board test")).toBeInTheDocument();
    expect(screen.getByText("6/6 ready")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /Open project setup/i }));
    expect(screen.getByText("Project command center")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overview"));
    fireEvent.click(screen.getByRole("button", { name: /Open template studio/i }));
    expect(screen.getByText("Spark IoT Template Studio")).toBeInTheDocument();
    expect(screen.getAllByText("Smart Irrigation").length).toBeGreaterThan(0);

    fireEvent.click(screen.getByText("Overview"));
    fireEvent.click(screen.getByRole("button", { name: /Open devices/i }));
    expect(screen.getByText("Bind boards to templates and ship firmware-ready credentials")).toBeInTheDocument();

    fireEvent.click(screen.getByText("Overview"));
    fireEvent.click(screen.getByRole("button", { name: /Open live test/i }));
    expect(await screen.findByText("Connect ESP32 or NodeMCU and watch real telemetry land here")).toBeInTheDocument();
  });

  it("uses the standardized design-system shell and non-overlapping dashboard header", async () => {
    render(<App />);

    const shell = await screen.findByTestId("app-shell");
    expect(shell).toHaveClass("app-shell", "dashboard-shell", "spark-ui");
    expect(screen.getByTestId("cockpit-header")).toHaveClass("app-page-header", "cockpit-header");
    expect(screen.getByTestId("dashboard-header-grid")).toHaveClass("dashboard-header-grid", "spark-page-header-grid");
    expect(screen.getByTestId("dashboard-header-primary")).toHaveClass("spark-page-header-primary");
    expect(screen.getByTestId("dashboard-header-selector")).toHaveClass("spark-page-header-selector");
    expect(screen.getByTestId("dashboard-header-metrics")).toHaveClass("spark-page-header-metrics");
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

    expect(screen.getByTestId("dashboard-action-bar")).toHaveClass("gemini-action-strip");
    expect(screen.getByTestId("gemini-widget-canvas")).toHaveClass("gemini-widget-canvas");
    expect(screen.getByText("Virtual IoT Simulator Connected")).toBeInTheDocument();
    expect(screen.getByText("Water, pressure, flow models synced with scheduler output")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Edit labels/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Publish Changes/i })).toBeInTheDocument();
  });

  it("keeps KPI and project metric cards inside narrow screens with shared overflow-safe CSS", () => {
    const css = `${readFileSync(resolve(__dirname, "styles/app.css"), "utf8")}\n${readFileSync(resolve(__dirname, "styles/design-system.css"), "utf8")}`;

    expect(css).toContain("--spark-metric-min");
    expect(css).toContain("--spark-compact-metric-min");
    expect(css).toContain(".spark-ui .spark-page-header-grid > .top-actions");
    expect(css).toContain("display: contents");
    expect(css).toContain("--spark-metric-min: 7.25rem");
    expect(css).toContain("--spark-compact-metric-min: 4.75rem");
    expect(css).toContain("--spark-header-metric-max: 39rem");
    expect(css).toContain("--spark-title-xl: clamp(1.55rem, 1.8vw, 2.05rem)");
    expect(css).toContain('"primary"');
    expect(css).toContain('"selector"');
    expect(css).toContain('"metrics"');
    expect(css).toContain('"primary selector metrics"');
    expect(css).toContain("box-sizing: border-box");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, var(--spark-metric-min)), 1fr))");
    expect(css).toContain("grid-template-columns: repeat(3, minmax(0, 1fr))");
    expect(css).toContain(".spark-ui .project-grid");
    expect(css).toContain("grid-template-columns: repeat(auto-fit, minmax(min(100%, 15.5rem), 1fr))");
    expect(css).toContain("overflow: clip");
    expect(css).toContain(".spark-ui .dashboard-header-grid.spark-page-header-grid");
    expect(css).toContain(".spark-ui .spark-page-header-primary h1");
    expect(css).toContain(".spark-ui .project-stat-row span > *");
    expect(css).toContain(".spark-ui.dashboard-shell .cockpit-metrics span > svg");
    expect(css).toContain("grid-row: 1 / span 2");
    expect(css).toContain(".spark-ui.dashboard-shell .cockpit-metrics strong");
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

    expect(screen.getByText("Template library")).toBeInTheDocument();
    expect(screen.getByText("3/3 templates used")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Create template/i })).toBeDisabled();

    const energyTemplateCard = screen.getByRole("article", { name: /Energy Monitor template/i });
    fireEvent.click(within(energyTemplateCard).getByRole("button", { name: /Open studio/i }));

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
    expect(screen.getByText("Project command center")).toBeInTheDocument();
    expect(screen.getByText("Starter plan capacity")).toBeInTheDocument();
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
    expect(screen.getByTestId("device-provisioning-hero")).toHaveClass("device-system-hero");
    expect(screen.getByTestId("device-provisioning-grid")).toHaveClass("device-system-grid");
    expect(screen.getByText("Provisioning center")).toBeInTheDocument();
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
    expect(screen.getByText("Schedule automation")).toBeInTheDocument();
    expect(screen.getByText("Blynk Timer-style day and time control for boards, pumps, relays and status outputs.")).toBeInTheDocument();
    expect(screen.getByText("Demo-only planner")).toBeInTheDocument();
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

    expect(screen.getByText("Account access")).toBeInTheDocument();
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
