import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { App } from "./App";

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

afterEach(() => cleanup());

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
