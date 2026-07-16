export type Project = { id: string; name: string; description: string; is_active: boolean };
export type ProjectCreate = { name: string; description: string };
export type ProjectUpdate = ProjectCreate;
export type Device = { id: string; project_id: string; name: string; board: string; is_online: boolean; last_seen_at?: string | null; token?: string | null; telemetry_topic: string; command_topic: string };
export type DeviceCreate = { project_id: string; name: string; board: BoardType };
export type DeviceUpdate = DeviceCreate;
export type Dashboard = { id: string; project_id: string; name: string; revision: number; widgets: WidgetConfig[] };
export type Telemetry = { id: string; project_id?: string; device_id: string; channel: string; value: unknown; unit?: string | null; observed_at: string; server_at: string };
export type NotificationItem = { id: string; title: string; body: string; read: boolean; created_at: string };
export type CommandLogItem = { id: string; device_id: string; channel: string; value: unknown; status: string; created_at: string };
export type ScheduleItem = { id: string; project_id: string; device_id: string; channel: string; value: unknown; time_of_day: string; recurrence: string; timezone: string; is_active: boolean };
export type ScheduleCreate = Omit<ScheduleItem, "id">;
export type LiveBoardTestPayload = {
  tenant_id: string;
  project_id: string;
  mqtt: { host: string; port: number; protocol: string };
  devices: Array<Pick<Device, "id" | "name" | "board" | "is_online" | "last_seen_at" | "telemetry_topic" | "command_topic">>;
  latest: Record<string, Telemetry>;
};
export type DataType = "integer" | "float" | "string" | "boolean" | "gps" | "image" | "time" | "date";
export type BoardType = "ESP32" | "ESP8266" | "Arduino" | "Raspberry Pi Pico" | "STM32";
export type Datastream = {
  id: string;
  name: string;
  pin: `V${number}`;
  dataType: DataType;
  unit?: string;
  min?: number;
  max?: number;
  color: string;
};
export type TemplateNotification = {
  id: string;
  name: string;
  datastreamId: string;
  operator: ">" | ">=" | "<" | "<=" | "==" | "changes";
  threshold?: number;
  channel: "push" | "in_app" | "email";
  cooldownMinutes: number;
};
export type DeviceTemplate = {
  id: string;
  name: string;
  board: BoardType;
  description: string;
  revision: number;
  datastreams: Datastream[];
  notifications: TemplateNotification[];
  dashboard: Dashboard;
};
export type WidgetConfig = {
  id: string;
  type: string;
  title: string;
  x: number;
  y: number;
  w: number;
  h: number;
  deviceId: string;
  channel: string;
  datastreamId?: string;
  unit?: string;
  min?: number;
  max?: number;
  color?: string;
  align?: "left" | "center" | "right";
  days?: string[];
  timeSlots?: string[];
  maxTimeSlots?: number;
};

export type UserProfile = {
  id?: string;
  tenant_id: string;
  email: string;
  full_name: string;
  plan_code: string;
  email_verified: boolean;
  onboarding_step: string;
};

export type UsageSummary = {
  plan_code: string;
  plan_name: string;
  monthly_price_rm: number | null;
  users: number;
  max_users: number;
  devices: number;
  max_devices: number;
  projects: number;
  max_projects: number;
  max_widgets: number;
  retention_days: number;
  features: string[];
};

export type OnboardingState = {
  current_step: string;
  completed_steps: string[];
  demo_viewed: boolean;
  first_project_id?: string | null;
};

export type StatusResponse = {
  status: string;
  message: string;
  reset_token?: string;
  verification_token?: string;
};
