import type { Datastream, Device, DeviceTemplate, NotificationItem, Project, Telemetry, WidgetConfig } from "./types";

export const demoProjects: Project[] = [
  { id: "project-irrigation", name: "Smart Irrigation", description: "GPS, camera and pump controls", is_active: true },
  { id: "project-home", name: "Smart Home", description: "Switches, LED and meter dashboard", is_active: true },
  { id: "project-energy", name: "Energy Monitor", description: "Charts and numeric panels", is_active: true }
];

export const demoDevices: Device[] = [
  { id: "device-irrigation", project_id: "project-irrigation", name: "ESP32 Irrigation Node", board: "ESP32", is_online: true, token: "spk_dev_irrigation_demo_9f3a", telemetry_topic: "spark/v1/demo-tenant/device-irrigation/telemetry/{channel}", command_topic: "spark/v1/demo-tenant/device-irrigation/command/{channel}" },
  { id: "device-home", project_id: "project-home", name: "ESP8266 Home Node", board: "ESP8266", is_online: true, token: "spk_dev_home_demo_2c8b", telemetry_topic: "spark/v1/demo-tenant/device-home/telemetry/{channel}", command_topic: "spark/v1/demo-tenant/device-home/command/{channel}" },
  { id: "device-energy", project_id: "project-energy", name: "ESP32 Energy Node", board: "ESP32", is_online: false, token: "spk_dev_energy_demo_4d1e", telemetry_topic: "spark/v1/demo-tenant/device-energy/telemetry/{channel}", command_topic: "spark/v1/demo-tenant/device-energy/command/{channel}" }
];

export const demoTemplates: DeviceTemplate[] = [
  template("template-irrigation", "Smart Irrigation", "ESP32", "project-irrigation", "device-irrigation", [
    stream("ds-temp", "Temperature", "V0", "float", "C", 0, 100, "#2563eb"),
    stream("ds-humidity", "Humidity", "V1", "integer", "%", 0, 100, "#2563eb"),
    stream("ds-soil", "Soil Moisture", "V2", "integer", "%", 0, 100, "#16a34a"),
    stream("ds-pump", "Pump Control", "V3", "boolean", "", 0, 1, "#7c3aed"),
    stream("ds-led", "Pump LED", "V4", "boolean", "", 0, 1, "#12b76a"),
    stream("ds-gps", "GPS Location", "V5", "gps", "", undefined, undefined, "#0891b2"),
    stream("ds-camera", "ESP32-CAM Snapshot", "V6", "image", "", undefined, undefined, "#475569"),
    stream("ds-serial", "Serial LCD", "V7", "string", "", undefined, undefined, "#334155")
  ], [
    widget("w-temp", "gauge", "ds-temp", 0, 0, 4, 3),
    widget("w-humidity", "meter", "ds-humidity", 4, 0, 4, 3),
    widget("w-soil", "value", "ds-soil", 8, 0, 4, 3),
    widget("w-chart", "chart", "ds-temp", 0, 3, 6, 3),
    widget("w-gps", "gps", "ds-gps", 6, 3, 3, 3),
    widget("w-camera", "camera", "ds-camera", 9, 3, 3, 3),
    widget("w-pump", "switch", "ds-pump", 0, 6, 3, 2),
    widget("w-led", "led", "ds-led", 3, 6, 3, 2),
    widget("w-serial", "serial_lcd", "ds-serial", 6, 6, 6, 2)
  ]),
  template("template-home", "Smart Home", "ESP8266", "project-home", "device-home", [
    stream("ds-relay", "Relay Switch", "V0", "boolean", "", 0, 1, "#2563eb"),
    stream("ds-light", "Room Light", "V1", "integer", "%", 0, 100, "#eab308"),
    stream("ds-door", "Door Status", "V2", "string", "", undefined, undefined, "#2563eb")
  ], [
    widget("w-relay", "switch", "ds-relay", 0, 0, 3, 2),
    widget("w-light", "gauge", "ds-light", 3, 0, 3, 3),
    widget("w-door", "value", "ds-door", 6, 0, 3, 2)
  ]),
  template("template-energy", "Energy Monitor", "ESP32", "project-energy", "device-energy", [
    stream("ds-voltage", "Voltage", "V0", "float", "V", 0, 260, "#2563eb"),
    stream("ds-current", "Current", "V1", "float", "A", 0, 30, "#2563eb"),
    stream("ds-power", "Power", "V2", "float", "W", 0, 5000, "#7c3aed")
  ], [
    widget("w-voltage", "meter", "ds-voltage", 0, 0, 3, 3),
    widget("w-current", "gauge", "ds-current", 3, 0, 3, 3),
    widget("w-power", "chart", "ds-power", 0, 3, 6, 3)
  ])
];

export const demoNotifications: NotificationItem[] = [
  { id: "n1", title: "Template rule ready", body: "Temperature alert is configured from the Smart Irrigation template.", read: false, created_at: new Date().toISOString() },
  { id: "n2", title: "GPS tracking active", body: "GPS datastream V5 is bound to the map widget.", read: false, created_at: new Date().toISOString() }
];

export const demoLatest: Record<string, Telemetry> = {
  "device-irrigation:V0": reading("device-irrigation", "V0", 29.4, "C"),
  "device-irrigation:V1": reading("device-irrigation", "V1", 63, "%"),
  "device-irrigation:V2": reading("device-irrigation", "V2", 71, "%"),
  "device-irrigation:V3": reading("device-irrigation", "V3", false),
  "device-irrigation:V4": reading("device-irrigation", "V4", true),
  "device-irrigation:V5": reading("device-irrigation", "V5", { lat: 3.139, lng: 101.6869, speed: 14, accuracy: 8 }),
  "device-irrigation:V6": reading("device-irrigation", "V6", { url: "https://placehold.co/640x360/eef3f8/1f2a3d?text=ESP32-CAM+Snapshot" }),
  "device-irrigation:V7": reading("device-irrigation", "V7", "Boot OK\nWiFi connected\nMQTT connected\nGPS locked"),
  "device-home:V0": reading("device-home", "V0", true),
  "device-home:V1": reading("device-home", "V1", 82, "%"),
  "device-home:V2": reading("device-home", "V2", "Closed"),
  "device-energy:V0": reading("device-energy", "V0", 228.5, "V"),
  "device-energy:V1": reading("device-energy", "V1", 4.2, "A"),
  "device-energy:V2": reading("device-energy", "V2", 961, "W")
};

function template(id: string, name: string, board: DeviceTemplate["board"], projectId: string, deviceId: string, datastreams: Datastream[], widgets: WidgetConfig[]): DeviceTemplate {
  return {
    id,
    name,
    board,
    description: `${name} template for ${board}`,
    revision: 1,
    datastreams,
    notifications: [
      { id: `${id}-alert`, name: `${datastreams[0].name} Alert`, datastreamId: datastreams[0].id, operator: ">", threshold: datastreams[0].max ? Math.round(datastreams[0].max * 0.8) : 1, channel: "push", cooldownMinutes: 15 }
    ],
    dashboard: { id: `${id}-dashboard`, project_id: projectId, name: `${name} Dashboard`, revision: 1, widgets: hydrateWidgets(widgets, datastreams, deviceId) }
  };
}

function stream(id: string, name: string, pin: Datastream["pin"], dataType: Datastream["dataType"], unit: string, min: number | undefined, max: number | undefined, color: string): Datastream {
  return { id, name, pin, dataType, unit, min, max, color };
}

function widget(id: string, type: string, datastreamId: string, x: number, y: number, w: number, h: number): WidgetConfig {
  return { id, type, title: "", x, y, w, h, deviceId: "", channel: "", datastreamId };
}

function hydrateWidgets(widgets: WidgetConfig[], datastreams: Datastream[], deviceId: string): WidgetConfig[] {
  return widgets.map((item) => {
    const datastream = datastreams.find((streamItem) => streamItem.id === item.datastreamId)!;
    return { ...item, title: item.title || datastream.name, deviceId, channel: datastream.pin, unit: datastream.unit, min: datastream.min, max: datastream.max, color: datastream.color };
  });
}

function reading(deviceId: string, channel: string, value: unknown, unit?: string): Telemetry {
  return { id: `reading-${deviceId}-${channel}`, device_id: deviceId, channel, value, unit, observed_at: new Date().toISOString(), server_at: new Date().toISOString() };
}
