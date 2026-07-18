import "@testing-library/jest-dom/vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SchedulesPage } from "./SchedulesPage";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("SchedulesPage timezone selector", () => {
  it("uses a styled dropdown with common global time zones", () => {
    render(
      <SchedulesPage
        accountMode={false}
        projects={[{ id: "project-1", name: "Smart Irrigation", description: "", is_active: true }]}
        devices={[{
          id: "device-1",
          project_id: "project-1",
          name: "ESP32 Irrigation Node",
          board: "ESP32",
          is_online: true,
          telemetry_topic: "spark/v1/demo-tenant/device-1/telemetry/{channel}",
          command_topic: "spark/v1/demo-tenant/device-1/command/{channel}",
        }]}
        schedules={[]}
        selectedProjectId="project-1"
        onCreateSchedule={vi.fn()}
        onDeleteSchedule={vi.fn()}
      />
    );

    const timezoneSelect = screen.getByRole("button", { name: /Timezone menu/i });
    expect(timezoneSelect).toHaveTextContent("Asia/Kuala_Lumpur");
    expect(screen.getByText("UTC")).toBeInTheDocument();
    expect(screen.getByText("Asia/Singapore")).toBeInTheDocument();
    expect(screen.getByText("Europe/London")).toBeInTheDocument();
    expect(screen.getByText("America/New_York")).toBeInTheDocument();
  });
});
