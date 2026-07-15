import type { CommandLogItem, Dashboard, Device, DeviceCreate, DeviceTemplate, LiveBoardTestPayload, NotificationItem, Project, ProjectCreate, ScheduleCreate, ScheduleItem, Telemetry } from "./types";

function defaultApiBase() {
  return "/api/v1";
}

const API_BASE = import.meta.env.VITE_API_BASE ?? defaultApiBase();

export function apiUrl(path: string) {
  return `${API_BASE}${path}`;
}

export type Session = { access_token: string; refresh_token: string };

export function getSession(): Session | null {
  const raw = localStorage.getItem("spark_iot_session");
  return raw ? JSON.parse(raw) : null;
}

export function saveSession(session: Session) {
  localStorage.setItem("spark_iot_session", JSON.stringify(session));
}

export function clearSession() {
  localStorage.removeItem("spark_iot_session");
}

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const session = getSession();
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(session ? { Authorization: `Bearer ${session.access_token}` } : {}),
      ...(options.headers ?? {})
    }
  });
  if (!response.ok) throw new Error(await response.text());
  return response.json();
}

export const api = {
  login: (email: string, password: string) => request<Session>("/auth/login", { method: "POST", body: JSON.stringify({ email, password }) }),
  me: () => request<{ full_name: string; email: string; tenant_id: string; plan_code: string }>("/auth/me"),
  usage: () => request<{ users: number; max_users: number; devices: number; max_devices: number; projects: number; max_projects: number; retention_days: number }>("/tenant/usage"),
  projects: () => request<Project[]>("/projects"),
  createProject: (project: ProjectCreate) => request<Project>("/projects", { method: "POST", body: JSON.stringify(project) }),
  devices: () => request<Device[]>("/devices"),
  createDevice: (device: DeviceCreate) => request<Device>("/devices", { method: "POST", body: JSON.stringify(device) }),
  dashboard: (projectId: string) => request<Dashboard>(`/dashboards/project/${projectId}`),
  saveDashboard: (dashboard: Dashboard) => request<Dashboard>(`/dashboards/${dashboard.id}`, { method: "PUT", body: JSON.stringify({ revision: dashboard.revision, widgets: dashboard.widgets }) }),
  latest: (projectId: string) => request<Telemetry[]>(`/telemetry/projects/${projectId}/latest`),
  demoLatest: (projectId: string) => request<Record<string, Telemetry>>(`/demo/projects/${projectId}/latest`),
  demoBoardTest: (projectId: string) => request<LiveBoardTestPayload>(`/demo/projects/${projectId}/board-test`),
  demoTemplates: () => request<DeviceTemplate[]>("/demo/templates"),
  demoTemplate: (templateId: string) => request<DeviceTemplate>(`/demo/templates/${templateId}`),
  saveDemoTemplate: (template: DeviceTemplate) => request<DeviceTemplate>(`/demo/templates/${template.id}`, { method: "PUT", body: JSON.stringify(template) }),
  templates: () => request<DeviceTemplate[]>("/templates"),
  createTemplate: (template: DeviceTemplate) => request<DeviceTemplate>("/templates", { method: "POST", body: JSON.stringify(template) }),
  saveTemplate: (template: DeviceTemplate) => request<DeviceTemplate>(`/templates/${template.id}`, { method: "PUT", body: JSON.stringify(template) }),
  demoCommand: (deviceId: string, channel: string, value: unknown) => request<{ status: string; topic: string; payload: { value: unknown } }>(`/demo/devices/${deviceId}/commands`, { method: "POST", body: JSON.stringify({ channel, value }) }),
  demoCommandLogs: (deviceId: string) => request<CommandLogItem[]>(`/demo/devices/${deviceId}/command-logs`),
  commandLogs: (deviceId: string) => request<CommandLogItem[]>(`/devices/${deviceId}/command-logs`),
  demoHistory: (deviceId: string, channel?: string) => request<Telemetry[]>(`/demo/devices/${deviceId}/history${channel ? `?channel=${encodeURIComponent(channel)}` : ""}`),
  demoHistoryCsvUrl: (deviceId: string, channel?: string) => apiUrl(`/demo/devices/${deviceId}/history.csv${channel ? `?channel=${encodeURIComponent(channel)}` : ""}`),
  history: (deviceId: string, channel?: string) => request<Telemetry[]>(`/telemetry/devices/${deviceId}/history${channel ? `?channel=${encodeURIComponent(channel)}` : ""}`),
  historyCsvUrl: (deviceId: string, channel?: string) => apiUrl(`/telemetry/devices/${deviceId}/history.csv${channel ? `?channel=${encodeURIComponent(channel)}` : ""}`),
  command: (deviceId: string, channel: string, value: unknown) => request(`/devices/${deviceId}/commands`, { method: "POST", body: JSON.stringify({ channel, value }) }),
  regenerateDeviceToken: (deviceId: string) => request<Device>(`/devices/${deviceId}/regenerate-token`, { method: "POST" }),
  notifications: () => request<NotificationItem[]>("/notifications"),
  createNotification: (title: string, body: string) => request<NotificationItem>("/notifications", { method: "POST", body: JSON.stringify({ title, body }) }),
  markNotificationRead: (notificationId: string) => request<NotificationItem>(`/notifications/${notificationId}/read`, { method: "PATCH" }),
  schedules: () => request<ScheduleItem[]>("/schedules"),
  createSchedule: (schedule: ScheduleCreate) => request<ScheduleItem>("/schedules", { method: "POST", body: JSON.stringify(schedule) }),
  pushPublicKey: () => request<{ public_key: string }>("/notifications/push-public-key"),
  savePushSubscription: (subscription: PushSubscriptionJSON) => request<{ status: string }>("/notifications/push-subscriptions", { method: "POST", body: JSON.stringify(subscription) }),
  removePushSubscription: (subscription: PushSubscriptionJSON) => request<void>("/notifications/push-subscriptions", { method: "DELETE", body: JSON.stringify(subscription) })
};

export function realtimeUrl(token: string, projectId: string) {
  const absoluteBase = API_BASE.startsWith("http")
    ? API_BASE
    : `${window.location.origin}${API_BASE.startsWith("/") ? "" : "/"}${API_BASE}`;
  const base = absoluteBase.replace("http://", "ws://").replace("https://", "wss://");
  return `${base}/realtime/ws?token=${encodeURIComponent(token)}&project_id=${encodeURIComponent(projectId)}`;
}
