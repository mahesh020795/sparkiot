import "@testing-library/jest-dom/vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SettingsPage } from "./SettingsPage";
import { api } from "../lib/api";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
  localStorage.clear();
});

describe("SettingsPage SaaS account model", () => {
  it("shows the official Spark IoT plan ladder and account usage copy", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Mahesh Rajagopal",
      email: "mahesh@example.com",
      tenant_id: "tenant-1",
      plan_code: "pro",
      email_verified: true,
      onboarding_step: "dashboard",
    });
    vi.spyOn(api, "usage").mockResolvedValue({
      plan_code: "pro",
      plan_name: "Pro",
      monthly_price_rm: 49,
      users: 1,
      max_users: 1,
      devices: 2,
      max_devices: 10,
      projects: 3,
      max_projects: 10,
      max_widgets: 30,
      retention_days: 90,
      message_quota_monthly: 10_000_000,
      automation_limit: 20,
      features: ["Advanced widgets", "Full API access", "Priority support"],
    });

    render(<SettingsPage />);

    expect(await screen.findByText("Mahesh Rajagopal")).toBeInTheDocument();
    expect(screen.getByText("Spark IoT Pro")).toBeInTheDocument();
    expect(screen.getAllByText("RM49/month").length).toBeGreaterThan(0);
    expect(screen.getByText("10,000,000 messages/month")).toBeInTheDocument();
    expect(screen.getByText("20 automations")).toBeInTheDocument();
    expect(screen.getByText("Max")).toBeInTheDocument();
    expect(screen.getByText("RM99/month")).toBeInTheDocument();
    expect(screen.queryByText(/Tenant scoped/i)).not.toBeInTheDocument();
  });

  it("explains that browser push needs HTTPS instead of incorrectly blaming Chrome", async () => {
    localStorage.setItem("spark_iot_session", JSON.stringify({ access_token: "token", refresh_token: "refresh" }));
    vi.spyOn(api, "me").mockResolvedValue({
      full_name: "Mahesh Rajagopal",
      email: "mahesh@example.com",
      tenant_id: "tenant-1",
      plan_code: "pro",
      email_verified: true,
      onboarding_step: "dashboard",
    });
    vi.spyOn(api, "usage").mockResolvedValue({
      plan_code: "pro",
      plan_name: "Pro",
      monthly_price_rm: 49,
      users: 1,
      max_users: 1,
      devices: 0,
      max_devices: 10,
      projects: 0,
      max_projects: 10,
      max_widgets: 30,
      retention_days: 90,
      message_quota_monthly: 10_000_000,
      automation_limit: 20,
      features: [],
    });
    vi.stubGlobal("isSecureContext", false);
    vi.stubGlobal("Notification", { permission: "default", requestPermission: vi.fn() });
    vi.stubGlobal("PushManager", function PushManager() {});

    render(<SettingsPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Enable browser push/i }));

    expect(await screen.findByText("HTTPS required")).toBeInTheDocument();
    expect(screen.getByText(/Browser push needs HTTPS or localhost/i)).toBeInTheDocument();
  });
});
