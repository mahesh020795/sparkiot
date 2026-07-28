import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetConfig } from "../../lib/types";
import { levelPercent, levelStatus, numericWidgetValue } from "./levelWidgets";
import { Widget } from "./Widget";

const scheduleConfig: WidgetConfig = {
  id: "schedule-widget",
  type: "schedule",
  title: "Irrigation Schedule",
  x: 0,
  y: 0,
  w: 3,
  h: 4,
  deviceId: "device-irrigation",
  channel: "V12",
  unit: "AUTO"
};

afterEach(() => cleanup());

describe("Smart level widget helpers", () => {
  it("normalizes level values and classifies safe warning and danger states", () => {
    expect(numericWidgetValue({ raw: 72 })).toBe(72);
    expect(numericWidgetValue("0.85")).toBe(0.85);
    expect(numericWidgetValue("offline")).toBeNull();

    expect(levelPercent(72, 0, 100)).toBe(72);
    expect(levelPercent(120, 0, 100)).toBe(100);
    expect(levelPercent(-10, 0, 100)).toBe(0);
    expect(levelPercent(null, 0, 100)).toBeNull();

    expect(levelStatus(0.85, 1.5, 2)).toBe("safe");
    expect(levelStatus(1.6, 1.5, 2)).toBe("warning");
    expect(levelStatus(2.1, 1.5, 2)).toBe("danger");
    expect(levelStatus(null, 1.5, 2)).toBe("no_data");
  });
});

describe("Smart level dashboard widgets", () => {
  it("renders a Tank Level smart widget with fill, capacity and status", () => {
    const config: WidgetConfig = {
      id: "tank-widget",
      type: "tank_level",
      title: "Water Tank Level",
      x: 0,
      y: 0,
      w: 3,
      h: 3,
      deviceId: "device-1",
      channel: "V20",
      unit: "%",
      min: 0,
      max: 100,
      capacity: 1000,
      warningThreshold: 25,
      dangerThreshold: 10
    };

    render(<Widget config={config} reading={{ id: "t1", device_id: "device-1", channel: "V20", value: 72, unit: "%", observed_at: "2026-07-29T00:00:00Z", server_at: "2026-07-29T00:00:00Z" }} devices={[]} />);

    expect(screen.getByText("Water Tank Level")).toBeInTheDocument();
    expect(screen.getByText("72%")).toBeInTheDocument();
    expect(screen.getByText("720 / 1000 L")).toBeInTheDocument();
    expect(screen.getByText("Normal")).toBeInTheDocument();
  });

  it("renders a Flood Level smart widget with thresholds and location", () => {
    const config: WidgetConfig = {
      id: "flood-widget",
      type: "flood_level",
      title: "Flood Monitoring",
      x: 0,
      y: 0,
      w: 6,
      h: 3,
      deviceId: "device-1",
      channel: "V21",
      unit: "m",
      min: 0,
      max: 2.5,
      warningThreshold: 1.5,
      dangerThreshold: 2,
      location: "Riverside Area"
    };

    render(<Widget config={config} reading={{ id: "f1", device_id: "device-1", channel: "V21", value: 0.85, unit: "m", observed_at: "2026-07-29T03:00:00Z", server_at: "2026-07-29T03:00:00Z" }} devices={[]} />);

    expect(screen.getByText("Flood Monitoring")).toBeInTheDocument();
    expect(screen.getByText("0.85 m")).toBeInTheDocument();
    expect(screen.getByText("Riverside Area")).toBeInTheDocument();
    expect(screen.getByText("Danger 2 m")).toBeInTheDocument();
    expect(screen.getByText("Warning 1.5 m")).toBeInTheDocument();
  });

  it("renders a generic Threshold Monitor with warning and danger status", () => {
    const config: WidgetConfig = {
      id: "threshold-widget",
      type: "threshold_monitor",
      title: "Gas Level",
      x: 0,
      y: 0,
      w: 4,
      h: 3,
      deviceId: "device-1",
      channel: "V22",
      unit: "ppm",
      min: 0,
      max: 1000,
      warningThreshold: 600,
      dangerThreshold: 800
    };

    render(<Widget config={config} reading={{ id: "th1", device_id: "device-1", channel: "V22", value: 850, unit: "ppm", observed_at: "2026-07-29T03:00:00Z", server_at: "2026-07-29T03:00:00Z" }} devices={[]} />);

    expect(screen.getByText("Gas Level")).toBeInTheDocument();
    expect(screen.getByText("850 ppm")).toBeInTheDocument();
    expect(screen.getByText("Danger")).toBeInTheDocument();
    expect(screen.getByText("Warning at 600 ppm")).toBeInTheDocument();
  });
});

describe("Schedule dashboard widget", () => {
  it("lets users edit days and time cycles inside the dashboard card", () => {
    const onCommand = vi.fn();
    render(<Widget config={scheduleConfig} devices={[]} onCommand={onCommand} />);

    const widget = screen.getByText("Irrigation Schedule").closest("article")!;
    const tuesday = within(widget).getByRole("button", { name: "Enable Tuesday" });
    fireEvent.click(tuesday);
    expect(tuesday).toHaveClass("active");
    expect(tuesday).toHaveAttribute("aria-pressed", "true");

    fireEvent.click(within(widget).getByRole("button", { name: /Edit 06:00 AM cycle/i }));
    const timeInput = within(widget).getByLabelText("Selected cycle time");
    expect(timeInput).toHaveValue("06:00");
    fireEvent.change(timeInput, { target: { value: "07:15" } });
    expect(within(widget).getByRole("button", { name: /Edit 07:15 AM cycle/i })).toBeInTheDocument();
    expect(onCommand).toHaveBeenCalledWith(scheduleConfig, { days: ["mon", "wed", "fri", "tue"], timeSlots: ["06:00", "12:00", "18:00"], times: ["06:00", "12:00", "18:00"] });
    expect(onCommand).toHaveBeenCalledWith(scheduleConfig, { days: ["mon", "wed", "fri", "tue"], timeSlots: ["07:15", "12:00", "18:00"], times: ["07:15", "12:00", "18:00"] });

    expect(within(widget).queryByLabelText("Cycle duration minutes")).not.toBeInTheDocument();
    expect(within(widget).queryByText(/Cycle duration/i)).not.toBeInTheDocument();
  });
});

describe("Dashboard input widgets", () => {
  it("sends time-only input changes as widget commands", () => {
    const onCommand = vi.fn();
    const timeConfig: WidgetConfig = { ...scheduleConfig, id: "time-widget", type: "time", title: "Pump Time", channel: "V10", unit: "" };

    render(
      <Widget config={timeConfig} reading={{ id: "time", device_id: "device-irrigation", channel: "V10", value: "06:00", observed_at: "", server_at: "" }} devices={[]} onCommand={onCommand} />
    );

    fireEvent.change(screen.getByLabelText("Selected command time"), { target: { value: "18:30" } });

    expect(onCommand).toHaveBeenCalledWith(timeConfig, "18:30");
  });

  it("renders the time-only input with the same premium schedule-style control language", () => {
    const onCommand = vi.fn();
    const timeConfig: WidgetConfig = { ...scheduleConfig, id: "time-widget", type: "time", title: "Pump Time", channel: "V10", unit: "" };

    render(
      <Widget config={timeConfig} reading={{ id: "time", device_id: "device-irrigation", channel: "V10", value: "06:00", observed_at: "", server_at: "" }} devices={[]} onCommand={onCommand} />
    );

    const timeTitles = screen.getAllByText("Pump Time");
    const timeWidget = timeTitles[timeTitles.length - 1].closest("article")!;

    expect(timeWidget).toHaveClass("widget-schedule");
    expect(within(timeWidget).getByLabelText("Selected command time")).toHaveClass("schedule-time-input");
    expect(within(timeWidget).queryByLabelText("Selected command date")).not.toBeInTheDocument();
    expect(within(timeWidget).queryByRole("button", { name: "Select Friday" })).not.toBeInTheDocument();
  });
});
