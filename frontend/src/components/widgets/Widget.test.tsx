import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
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

describe("Schedule dashboard widget", () => {
  it("lets users edit days and time cycles inside the dashboard card", () => {
    render(<Widget config={scheduleConfig} devices={[]} />);

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

    expect(within(widget).queryByLabelText("Cycle duration minutes")).not.toBeInTheDocument();
    expect(within(widget).queryByText(/Cycle duration/i)).not.toBeInTheDocument();
  });
});

describe("Dashboard input widgets", () => {
  it("sends time and date input changes as widget commands", () => {
    const onCommand = vi.fn();
    const timeConfig: WidgetConfig = { ...scheduleConfig, id: "time-widget", type: "time", title: "Pump Time", channel: "V10", unit: "" };
    const dateConfig: WidgetConfig = { ...scheduleConfig, id: "date-widget", type: "date", title: "Start Date", channel: "V11", unit: "" };

    render(
      <>
        <Widget config={timeConfig} reading={{ id: "time", device_id: "device-irrigation", channel: "V10", value: "06:00", observed_at: "", server_at: "" }} devices={[]} onCommand={onCommand} />
        <Widget config={dateConfig} reading={{ id: "date", device_id: "device-irrigation", channel: "V11", value: "2026-07-16", observed_at: "", server_at: "" }} devices={[]} onCommand={onCommand} />
      </>
    );

    fireEvent.change(screen.getByLabelText("Pump Time input"), { target: { value: "18:30" } });
    fireEvent.change(screen.getByLabelText("Start Date input"), { target: { value: "2026-07-20" } });

    expect(onCommand).toHaveBeenCalledWith(timeConfig, "18:30");
    expect(onCommand).toHaveBeenCalledWith(dateConfig, "2026-07-20");
  });
});
