import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { DashboardPage } from "./DashboardPage";
import { api } from "../lib/api";
import type { Dashboard, Device, Telemetry } from "../lib/types";

vi.mock("echarts", () => ({
  init: () => ({ setOption: vi.fn(), dispose: vi.fn(), resize: vi.fn() })
}));

vi.mock("leaflet", () => ({
  default: {
    map: () => ({ setView: vi.fn().mockReturnThis(), remove: vi.fn(), invalidateSize: vi.fn() }),
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

describe("DashboardPage account input persistence", () => {
  it("shows a guided empty dashboard state when no widgets exist", async () => {
    vi.stubGlobal("WebSocket", undefined);
    const dashboard: Dashboard = {
      id: "dashboard-empty",
      project_id: "project-empty",
      name: "Empty Dashboard",
      revision: 1,
      widgets: [],
    };
    vi.spyOn(api, "dashboard").mockResolvedValue(dashboard);
    vi.spyOn(api, "latest").mockResolvedValue([]);
    const createDashboard = vi.fn();
    const previewDemo = vi.fn();

    render(<DashboardPage projectId="project-empty" devices={[]} onCreateDashboard={createDashboard} onPreviewDemo={previewDemo} />);

    expect(await screen.findByRole("heading", { name: /Create your first dashboard/i })).toBeInTheDocument();
    expect(screen.getByText(/Start with a template, create a project/i)).toBeInTheDocument();
    expect(screen.getByTestId("dashboard-empty-card")).toHaveClass("dashboard-empty-card");
    expect(screen.getByText("Template").closest(".dashboard-empty-flow-step")).toBeTruthy();
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("Template");
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("Board model and V pins");
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("Device code");
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("ESP32 / ESP8266 sketch");
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("Live dashboard");
    expect(screen.getByLabelText("Dashboard creation flow")).toHaveTextContent("MQTT widgets online");
    fireEvent.click(screen.getByRole("button", { name: /Create dashboard/i }));
    fireEvent.click(screen.getByRole("button", { name: /View demo dashboard/i }));

    expect(createDashboard).toHaveBeenCalledTimes(1);
    expect(previewDemo).toHaveBeenCalledTimes(1);
  });

  it("reloads saved time-only input values from protected latest telemetry after refresh", async () => {
    vi.stubGlobal("WebSocket", undefined);
    const device: Device = {
      id: "device-account",
      project_id: "project-account",
      name: "ESP32 Account Node",
      board: "ESP32",
      is_online: true,
      telemetry_topic: "spark/v1/tenant-account/device-account/telemetry/{channel}",
      command_topic: "spark/v1/tenant-account/device-account/command/{channel}",
    };
    const dashboard: Dashboard = {
      id: "dashboard-account",
      project_id: "project-account",
      name: "Account Dashboard",
      revision: 1,
      widgets: [
        {
          id: "widget-time",
          type: "time",
          title: "Pump Time",
          x: 0,
          y: 0,
          w: 3,
          h: 3,
          deviceId: "device-account",
          channel: "V12",
        }
      ],
    };
    const firstLatest: Telemetry[] = [
      {
        id: "reading-original",
        project_id: "project-account",
        device_id: "device-account",
        channel: "V12",
        value: "06:00",
        observed_at: "2026-07-17T00:00:00Z",
        server_at: "2026-07-17T00:00:00Z",
      }
    ];
    const savedLatest: Telemetry[] = [
      {
        id: "reading-saved",
        project_id: "project-account",
        device_id: "device-account",
        channel: "V12",
        value: "18:30",
        observed_at: "2026-07-17T00:01:00Z",
        server_at: "2026-07-17T00:01:00Z",
      }
    ];
    vi.spyOn(api, "dashboard").mockResolvedValue(dashboard);
    const latest = vi.spyOn(api, "latest").mockResolvedValueOnce(firstLatest).mockResolvedValueOnce(savedLatest);
    const command = vi.spyOn(api, "command").mockResolvedValue({ status: "published" });

    const first = render(<DashboardPage projectId="project-account" devices={[device]} />);
    expect(await screen.findByDisplayValue("06:00")).toBeInTheDocument();
    fireEvent.change(screen.getByLabelText("Selected command time"), { target: { value: "18:30" } });
    expect(command).toHaveBeenCalledWith("device-account", "V12", "18:30");
    first.unmount();
    localStorage.clear();

    render(<DashboardPage projectId="project-account" devices={[device]} />);

    expect(await screen.findByDisplayValue("18:30")).toBeInTheDocument();
    expect(latest).toHaveBeenCalledTimes(2);
  });
});
