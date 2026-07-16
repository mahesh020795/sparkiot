import "@testing-library/jest-dom/vitest";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it } from "vitest";
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
  it("lets users edit days, time cycles and duration inside the dashboard card", () => {
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

    const duration = within(widget).getByLabelText("Cycle duration minutes");
    fireEvent.change(duration, { target: { value: "40" } });
    expect(within(widget).getByText("40 min")).toBeInTheDocument();
  });
});
