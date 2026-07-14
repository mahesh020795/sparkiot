export type Project = { id: string; name: string; description: string; is_active: boolean };
export type Device = { id: string; project_id: string; name: string; board: string; is_online: boolean; last_seen_at?: string | null; token?: string | null; telemetry_topic: string; command_topic: string };
export type Dashboard = { id: string; project_id: string; name: string; revision: number; widgets: WidgetConfig[] };
export type Telemetry = { id: string; device_id: string; channel: string; value: unknown; unit?: string | null; observed_at: string; server_at: string };
export type NotificationItem = { id: string; title: string; body: string; read: boolean; created_at: string };
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
};
