import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { WidgetConfig } from "../../lib/types";
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
