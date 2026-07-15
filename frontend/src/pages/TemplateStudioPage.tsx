import BaseGridLayout, { type Layout, WidthProvider } from "react-grid-layout/legacy";
import "react-grid-layout/css/styles.css";
import {
  Bell,
  Camera,
  CheckCircle2,
  ClipboardCopy,
  Copy,
  Cpu,
  Database,
  Download,
  Expand,
  Grid2X2Plus,
  LayoutDashboard,
  MapPinned,
  Play,
  Plus,
  Save,
  SlidersHorizontal,
  Sparkles,
  TerminalSquare,
  Trash2,
  Wand2
} from "lucide-react";
import { useMemo, useState } from "react";
import type React from "react";
import type { Datastream, Device, DeviceTemplate, TemplateNotification, WidgetConfig } from "../lib/types";
import { Widget } from "../components/widgets/Widget";
import type { Telemetry } from "../lib/types";

const GridLayout = WidthProvider(BaseGridLayout);
const widgetTypes = ["gauge", "meter", "value", "switch", "push_button", "led", "chart", "gps", "camera", "serial_lcd", "time", "date", "day", "battery", "signal"];
const dataTypes: Datastream["dataType"][] = ["integer", "float", "string", "boolean", "gps", "image", "time", "date"];
const boards: DeviceTemplate["board"][] = ["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"];
const stepConfig = [
  { id: "Setup", label: "Setup", caption: "Product model", icon: SlidersHorizontal },
  { id: "Migrate", label: "Migrate", caption: "Blynk import", icon: Wand2 },
  { id: "Datastreams", label: "Datastreams", caption: "Virtual pins", icon: Database },
  { id: "Dashboard", label: "Dashboard", caption: "Canvas builder", icon: LayoutDashboard },
  { id: "Notifications", label: "Notifications", caption: "Alert logic", icon: Bell },
  { id: "Code", label: "Code", caption: "Arduino sketch", icon: TerminalSquare },
  { id: "Simulator", label: "Simulator", caption: "Demo payloads", icon: Play }
] as const;
type StudioStep = (typeof stepConfig)[number]["id"];

export function TemplateStudioPage({
  templates,
  selectedTemplateId,
  device,
  latest,
  saveState,
  saveError,
  onSave,
  onChange
}: {
  templates: DeviceTemplate[];
  selectedTemplateId: string;
  device?: Device;
  latest: Record<string, Telemetry>;
  saveState: "saved" | "unsaved" | "saving" | "error";
  saveError?: string;
  onSave: () => void;
  onChange: (template: DeviceTemplate) => void;
}) {
  const template = templates.find((item) => item.id === selectedTemplateId) ?? templates[0];
  const [activeStep, setActiveStep] = useState<StudioStep>("Setup");
  const [selectedWidgetId, setSelectedWidgetId] = useState(template.dashboard.widgets[0]?.id ?? "");
  const [fullBuilder, setFullBuilder] = useState(false);
  const [migrationText, setMigrationText] = useState("V0 Temperature float C 0 100\nV1 Humidity integer % 0 100\nV2 Pump boolean\nV3 GPS gps\nV4 Camera image");
  const selectedWidget = template.dashboard.widgets.find((widget) => widget.id === selectedWidgetId);
  const selectedDatastream = template.datastreams.find((stream) => stream.id === selectedWidget?.datastreamId);
  const layout = useMemo(() => template.dashboard.widgets.map((widget) => ({ i: widget.id, x: widget.x, y: widget.y, w: widget.w, h: widget.h, minW: 2, minH: 2 })), [template.dashboard.widgets]);
  const code = useMemo(() => buildArduinoSketch(template, device), [template, device]);
  const sketchFileName = useMemo(() => `${sanitizeSketchName(template.name)}_SparkIoT.ino`, [template.name]);
  const [copyState, setCopyState] = useState<"idle" | "copied">("idle");
  const saveLabel = saveState === "saving" ? "Saving..." : saveState === "saved" ? "Saved" : saveState === "error" ? "Save failed" : "Unsaved changes";
  const tokenLabel = device ? (device.token ?? "Token hidden after first issue") : "YOUR_DEVICE_TOKEN";
  const unboundWidgetCount = device ? template.dashboard.widgets.filter((widget) => widget.deviceId !== device.id).length : template.dashboard.widgets.length;
  const isDeviceBound = Boolean(device && unboundWidgetCount === 0);

  function patchTemplate(patch: Partial<DeviceTemplate>) {
    onChange({ ...template, ...patch });
  }

  function bindDashboardToDevice() {
    if (!device) return;
    const widgets = template.dashboard.widgets.map((widget) => ({ ...widget, deviceId: device.id }));
    onChange({ ...template, dashboard: { ...template.dashboard, widgets } });
  }

  function updateDatastream(id: string, patch: Partial<Datastream>) {
    const datastreams = template.datastreams.map((stream) => stream.id === id ? { ...stream, ...patch } : stream);
    const widgets = template.dashboard.widgets.map((widget) => {
      const stream = datastreams.find((item) => item.id === widget.datastreamId);
      return stream ? { ...widget, title: stream.name, channel: stream.pin, unit: stream.unit, min: stream.min, max: stream.max, color: stream.color } : widget;
    });
    onChange({ ...template, datastreams, dashboard: { ...template.dashboard, widgets } });
  }

  function addDatastream(seed?: Partial<Datastream>) {
    const usedPins = new Set(template.datastreams.map((stream) => stream.pin));
    const nextIndex = Array.from({ length: 64 }, (_, index) => index).find((index) => !usedPins.has(`V${index}` as Datastream["pin"])) ?? template.datastreams.length;
    const nextPin = `V${nextIndex}` as Datastream["pin"];
    const stream: Datastream = {
      id: `ds-${crypto.randomUUID()}`,
      name: seed?.name ?? `Datastream ${seed?.pin ?? nextPin}`,
      pin: seed?.pin ?? nextPin,
      dataType: seed?.dataType ?? "float",
      unit: seed?.unit ?? "",
      min: seed?.min ?? 0,
      max: seed?.max ?? 100,
      color: seed?.color ?? "#f26a21"
    };
    onChange({ ...template, datastreams: [...template.datastreams, stream] });
  }

  function applyMigration() {
    const imported = parseMigration(migrationText);
    if (!imported.length) return;
    const datastreams = imported.map((item) => ({ ...item, id: `ds-${crypto.randomUUID()}`, color: item.color ?? colorForType(item.dataType) }));
    const widgets = datastreams.slice(0, 10).map((stream, index) => {
      const type = widgetForType(stream.dataType);
      const isWide = type === "gps" || type === "camera";
      return hydrateWidget({ id: `w-${crypto.randomUUID()}`, type, title: stream.name, datastreamId: stream.id, x: (index % 4) * 3, y: Math.floor(index / 4) * 3, w: isWide ? 6 : 3, h: isWide ? 3 : 2, deviceId: "", channel: "" }, stream, device);
    });
    onChange({ ...template, datastreams, dashboard: { ...template.dashboard, widgets } });
    setActiveStep("Dashboard");
  }

  function autoGenerateFromPrompt() {
    const lower = `${template.name} ${template.description}`.toLowerCase();
    const generated = lower.includes("camera") || lower.includes("gps") || lower.includes("irrigation")
      ? "V0 Temperature float C 0 100\nV1 Soil_Moisture integer % 0 100\nV2 Pump boolean\nV3 GPS gps\nV4 Camera image\nV5 Serial string"
      : "V0 Sensor_Value float unit 0 100\nV1 Relay boolean\nV2 Status string\nV3 Battery integer % 0 100";
    setMigrationText(generated);
    setActiveStep("Migrate");
  }

  function addWidget(type: string, datastreamId = template.datastreams[0]?.id) {
    const stream = template.datastreams.find((item) => item.id === datastreamId);
    if (!stream) return;
    const widget = hydrateWidget({ id: `w-${crypto.randomUUID()}`, type, title: stream.name, x: 0, y: Infinity, w: type === "chart" || type === "gps" || type === "camera" ? 6 : 3, h: type === "chart" || type === "gps" || type === "camera" ? 3 : 2, deviceId: "", channel: "" }, stream, device);
    onChange({ ...template, dashboard: { ...template.dashboard, widgets: [...template.dashboard.widgets, widget] } });
    setSelectedWidgetId(widget.id);
  }

  function updateWidget(id: string, patch: Partial<WidgetConfig>) {
    const widgets = template.dashboard.widgets.map((widget) => widget.id === id ? { ...widget, ...patch } : widget);
    onChange({ ...template, dashboard: { ...template.dashboard, widgets } });
  }

  function duplicateWidget() {
    if (!selectedWidget) return;
    const copy = { ...selectedWidget, id: `w-${crypto.randomUUID()}`, x: selectedWidget.x + 1, y: selectedWidget.y + 1, title: `${selectedWidget.title} Copy` };
    onChange({ ...template, dashboard: { ...template.dashboard, widgets: [...template.dashboard.widgets, copy] } });
    setSelectedWidgetId(copy.id);
  }

  function deleteWidget() {
    if (!selectedWidget) return;
    const widgets = template.dashboard.widgets.filter((widget) => widget.id !== selectedWidget.id);
    onChange({ ...template, dashboard: { ...template.dashboard, widgets } });
    setSelectedWidgetId(widgets[0]?.id ?? "");
  }

  function applyLayout(nextLayout: Layout) {
    const widgets = template.dashboard.widgets.map((widget) => {
      const item = nextLayout.find((layoutItem) => layoutItem.i === widget.id);
      return item ? { ...widget, x: item.x, y: item.y, w: item.w, h: item.h } : widget;
    });
    onChange({ ...template, dashboard: { ...template.dashboard, widgets } });
  }

  function addNotification(seed?: Partial<TemplateNotification>) {
    const stream = template.datastreams.find((item) => item.id === seed?.datastreamId) ?? template.datastreams[0];
    if (!stream) return;
    const notification: TemplateNotification = {
      id: `rule-${crypto.randomUUID()}`,
      name: seed?.name ?? `${stream.name} Alert`,
      datastreamId: stream.id,
      operator: seed?.operator ?? ">",
      threshold: seed?.threshold ?? stream.max ?? 1,
      channel: seed?.channel ?? "push",
      cooldownMinutes: seed?.cooldownMinutes ?? 15
    };
    onChange({ ...template, notifications: [...template.notifications, notification] });
  }

  function updateNotification(id: string, patch: Partial<TemplateNotification>) {
    onChange({ ...template, notifications: template.notifications.map((rule) => rule.id === id ? { ...rule, ...patch } : rule) });
  }

  async function copySketch() {
    await navigator.clipboard?.writeText(code);
    setCopyState("copied");
    window.setTimeout(() => setCopyState("idle"), 1600);
  }

  function downloadSketch() {
    const blob = new Blob([code], { type: "text/x-arduino;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = sketchFileName;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  return (
    <section className={fullBuilder ? "studio spark-studio studio-fullscreen" : "studio spark-studio"} data-testid="template-studio">
      <header className="wizard-header studio-system-header" data-testid="template-studio-header">
        <div className="wizard-title">
          <div className="studio-mark"><Cpu size={24} /></div>
          <div>
            <span className="eyebrow">Spark IoT Template Studio</span>
            <h2>{template.name}</h2>
            <p>Professional device template, datastream, dashboard and firmware builder for fast Blynk migration.</p>
          </div>
        </div>
        <div className="wizard-stats">
          <span className={`save-state ${saveState}`}>{saveLabel}</span>
          <span><strong>{template.datastreams.length}</strong> virtual pins</span>
          <span><strong>{template.dashboard.widgets.length}</strong> widgets</span>
          <span><strong>{template.notifications.length}</strong> alerts</span>
          <button className="primary small" onClick={onSave} disabled={saveState === "saving"}><Save size={16} />{saveState === "saving" ? "Saving" : "Save"}</button>
          <button className="primary small" onClick={() => setFullBuilder((value) => !value)}><Expand size={16} />{fullBuilder ? "Exit full builder" : "Full builder"}</button>
        </div>
      </header>
      {saveState === "error" && saveError && <div className="save-error-banner">{saveError}</div>}

      <section className={`device-binding-panel ${isDeviceBound ? "bound" : "needs-binding"}`} data-testid="template-device-binding">
        <Cpu size={18} />
        <div>
          <span className="section-kicker">Device binding</span>
          <strong>{device ? (isDeviceBound ? `Dashboard bound to ${device.name}` : "Dashboard needs device binding") : "No device provisioned for this project"}</strong>
          <p>
            {device
              ? isDeviceBound
                ? `${template.dashboard.widgets.length} widgets are mapped to ${device.id}. Code, telemetry and dashboard channels now point to the same board.`
                : `${unboundWidgetCount} widget${unboundWidgetCount === 1 ? "" : "s"} still need to be mapped to ${device.name} before testing with hardware.`
              : "Create a device first so Spark IoT can generate exact MQTT topics, widget bindings and Arduino credentials."}
          </p>
        </div>
        {device && !isDeviceBound && (
          <button className="primary small" type="button" onClick={bindDashboardToDevice}>
            Bind dashboard to {device.name}
          </button>
        )}
      </section>

      <nav className="wizard-steps studio-system-steps" aria-label="Template setup steps">
        {stepConfig.map((step, index) => {
          const Icon = step.icon;
          const activeIndex = stepConfig.findIndex((item) => item.id === activeStep);
          const state = index < activeIndex ? "complete" : index === activeIndex ? "active" : "pending";
          return (
            <button key={step.id} className={`wizard-step ${state}`} onClick={() => setActiveStep(step.id)}>
              <span className="step-icon"><Icon size={17} /></span>
              <span className="step-copy"><strong>{step.label}</strong><small>{step.caption}</small></span>
            </button>
          );
        })}
      </nav>

      {activeStep === "Setup" && (
        <section className="studio-panel template-setup">
          <div className="setup-hero">
            <div>
              <span className="section-kicker">Product model studio</span>
              <h3>Start with the device your customer actually owns</h3>
              <p>Name the template, choose the board, then use accelerators to generate common Spark IoT project structures faster than a manual Blynk setup.</p>
            </div>
            <div className="setup-metrics">
              <span><strong>{template.board}</strong><small>Board</small></span>
              <span><strong>3</strong><small>Starter projects</small></span>
              <span><strong>30d</strong><small>Data retention</small></span>
            </div>
          </div>
          <div className="studio-section">
            <div className="section-title"><h2>Template setup</h2><button onClick={autoGenerateFromPrompt}><Sparkles size={16} />AI suggest pins</button></div>
            <div className="template-fields">
              <label>Name<input aria-label="Template name" value={template.name} onChange={(event) => patchTemplate({ name: event.target.value })} /></label>
              <label>Board<select value={template.board} onChange={(event) => patchTemplate({ board: event.target.value as DeviceTemplate["board"] })}>{boards.map((board) => <option key={board}>{board}</option>)}</select></label>
            </div>
            <label>Description<input value={template.description} onChange={(event) => patchTemplate({ description: event.target.value })} /></label>
          </div>
          <div className="section-title quick-template-title">
            <div>
              <span className="section-kicker">Template accelerators</span>
              <h2>Fast-start project types</h2>
            </div>
          </div>
          <div className="quick-template-grid">
            {["Smart Irrigation", "GPS Tracker", "ESP32-CAM Security", "Energy Monitor"].map((name) => <button className="quick-template-card" key={name} onClick={() => { patchTemplate({ name, description: `${name} starter template for ${template.board}` }); setActiveStep("Migrate"); }}><Wand2 size={16} /><span>{name}</span><small>Generate pins and dashboard starter</small></button>)}
          </div>
        </section>
      )}

      {activeStep === "Migrate" && (
        <section className="studio-panel two-column-panel">
          <div className="studio-section">
            <div className="migration-hero">
              <span className="section-kicker">Blynk import command center</span>
              <h3>Virtual pin parser</h3>
              <p>Paste existing Blynk virtual pins and Spark IoT will preserve V0, V1, V2 mapping for easier firmware migration.</p>
            </div>
            <div className="section-title"><h2>Blynk migration helper</h2><button className="primary small" onClick={applyMigration}><Wand2 size={16} />Build from pins</button></div>
            <p className="format-guide">Format: <strong>pin name type unit min max</strong>. Example: <code>V0 Temperature float C 0 100</code></p>
            <textarea className="migration-textarea" value={migrationText} onChange={(event) => setMigrationText(event.target.value)} />
          </div>
          <div className="studio-section">
            <h2>Migration preview</h2>
            <div className="migration-preview">
              {parseMigration(migrationText).map((stream) => <div key={stream.pin}><strong>{stream.pin}</strong><span>{stream.name}</span><small>{stream.dataType}{stream.unit ? ` / ${stream.unit}` : ""}</small></div>)}
            </div>
          </div>
        </section>
      )}

      {activeStep === "Datastreams" && (
        <section className="studio-panel">
          <div className="section-title pro-section-title">
            <div>
              <span className="section-kicker">Device schema</span>
              <h2>Datastreams / Virtual Pins</h2>
              <p>Define the data contract your firmware, dashboard widgets and alerts will use.</p>
            </div>
            <button className="primary small" title="Add datastream" onClick={() => addDatastream()}><Plus size={16} />Add V pin</button>
          </div>
          <div className="datastream-registry-hero">
            <div>
              <span className="section-kicker">Virtual pin registry</span>
              <h3>Firmware-safe channel map</h3>
              <p>Each row becomes a stable Spark IoT channel used by Arduino code, MQTT topics, dashboard widgets and notification rules.</p>
            </div>
            <div className="registry-metrics">
              <span><strong>{template.datastreams.length}/64</strong><small>Virtual pins</small></span>
              <span><strong>{new Set(template.datastreams.map((stream) => stream.dataType)).size}</strong><small>Data types</small></span>
              <span><strong>{template.datastreams.filter((stream) => stream.unit).length}</strong><small>With units</small></span>
            </div>
          </div>
          <DatastreamEditor streams={template.datastreams} onChange={updateDatastream} />
        </section>
      )}

      {activeStep === "Dashboard" && (
        <DashboardBuilder
          template={template}
          device={device}
          latest={latest}
          layout={layout}
          selectedWidgetId={selectedWidgetId}
          selectedWidget={selectedWidget}
          selectedDatastream={selectedDatastream}
          onSelect={setSelectedWidgetId}
          onLayout={applyLayout}
          onAddWidget={addWidget}
          onUpdateWidget={updateWidget}
          onDuplicate={duplicateWidget}
          onDelete={deleteWidget}
          saveState={saveState}
          onSave={onSave}
        />
      )}

      {activeStep === "Notifications" && (
        <section className="studio-panel">
          <div className="section-title pro-section-title">
            <div>
              <span className="section-kicker">Automation</span>
              <h2>Notification builder</h2>
              <p>Create event rules that feel simple for students but are structured like a real IoT operations tool.</p>
            </div>
            <button className="primary small" onClick={() => addNotification()}><Plus size={16} />Add rule</button>
          </div>
          <div className="alert-center-hero">
            <div>
              <span className="section-kicker">Alert operations center</span>
              <h3>Push-safe rule engine</h3>
              <p>Build Blynk-style push notifications with production controls: clear trigger logic, delivery channel, cooldown and rule status.</p>
            </div>
            <div className="alert-metrics">
              <span><strong>{template.notifications.length}</strong><small>Rules</small></span>
              <span><strong>{template.notifications.filter((rule) => rule.channel === "push").length}</strong><small>Push alerts</small></span>
              <span><strong>{template.notifications.length ? Math.min(...template.notifications.map((rule) => rule.cooldownMinutes)) : 0}m</strong><small>Fastest cooldown</small></span>
            </div>
          </div>
          <div className="notification-builder studio-system-rules" data-testid="notification-builder">
            {template.notifications.map((rule) => <NotificationRule key={rule.id} rule={rule} streams={template.datastreams} onChange={updateNotification} />)}
          </div>
        </section>
      )}

      {activeStep === "Code" && (
        <section className="studio-panel two-column-panel">
          <div className="studio-section">
            <div className="code-hero">
              <span className="section-kicker">Firmware command center</span>
              <h3>Arduino-ready sketch</h3>
              <p>Generate firmware that preserves Blynk-style virtual pins while publishing to Spark IoT topics.</p>
            </div>
            <div className="firmware-export-panel firmware-system-panel" data-testid="firmware-export-panel">
              <div>
                <span className="section-kicker">Firmware export package</span>
                <h2>{sketchFileName}</h2>
                <p>Generated from <strong>{template.name}</strong>, bound to <strong>{device?.name ?? "selected device"}</strong> and ready for Arduino IDE after WiFi credentials are filled in.</p>
              </div>
              <div className="firmware-export-actions">
                <button onClick={copySketch}>{copyState === "copied" ? <CheckCircle2 size={16} /> : <ClipboardCopy size={16} />}{copyState === "copied" ? "Copied" : "Copy sketch"}</button>
                <button className="primary" onClick={downloadSketch}><Download size={16} />Download .ino</button>
              </div>
              <div className="firmware-metadata-grid">
                <span><small>Board</small><strong>{template.board}</strong></span>
                <span><small>Device ID</small><strong>{device?.id ?? "YOUR_DEVICE_ID"}</strong></span>
                <span><small>Token</small><strong>{tokenLabel}</strong></span>
                <span><small>Broker</small><strong>34.73.29.12:1883</strong></span>
              </div>
            </div>
            <div className="section-title"><h2>Arduino IDE code generator</h2><button onClick={copySketch}><ClipboardCopy size={16} />Copy</button></div>
            <pre className="code-block">{code}</pre>
          </div>
          <div className="studio-section protocol-panel">
            <span className="section-kicker">Protocol</span>
            <h2>Protocol summary</h2>
            <div className="firmware-install-card">
              <span className="section-kicker">Board setup checklist</span>
              <h3>Install SparkIoT library</h3>
              <ol>
                <li><strong>Copy folder to Documents/Arduino/libraries/SparkIoT</strong><span>Use the repo folder at arduino/SparkIoT.</span></li>
                <li><strong>Install PubSubClient</strong><span>Arduino IDE Library Manager, Nick O'Leary package.</span></li>
                <li><strong>Set WiFi and broker</strong><span>Do not use localhost from ESP32/ESP8266.</span></li>
                <li><strong>Upload and watch Live Test</strong><span>Confirm telemetry, switch command and ACK loop.</span></li>
              </ol>
            </div>
            <div className="protocol-card">
              <strong>Telemetry topic</strong>
              <code>{device?.telemetry_topic ?? "spark/v1/{tenant_id}/{device_id}/telemetry/{channel}"}</code>
            </div>
            <div className="protocol-card">
              <strong>Command topic</strong>
              <code>{device?.command_topic ?? "spark/v1/{tenant_id}/{device_id}/command/{channel}"}</code>
            </div>
            <p className="muted-text">The generated sketch keeps virtual pins so Blynk users can migrate with minimal firmware changes.</p>
          </div>
        </section>
      )}

      {activeStep === "Simulator" && (
        <section className="studio-panel two-column-panel">
          <div className="studio-section">
            <div className="simulator-hero">
              <span className="section-kicker">Live payload simulator</span>
              <h3>Test every virtual pin before hardware arrives</h3>
              <p>Use demo payloads to validate dashboard widgets, GPS traces, camera URLs and alert rules.</p>
            </div>
            <div className="section-title"><h2>Device simulator</h2><button className="primary small"><Play size={16} />Run demo event</button></div>
            <div className="simulator-grid">
              {template.datastreams.map((stream) => <article key={stream.id}><strong>{stream.pin}</strong><span>{stream.name}</span><small>{sampleValue(stream)}</small></article>)}
            </div>
          </div>
          <div className="studio-section media-plan">
            <span className="section-kicker">GPS and camera cost control</span>
            <h2>Paid-feature migration plan</h2>
            <div className="media-card"><MapPinned size={18} /><div><strong>GPS included</strong><p>30-day trail, geofence, trip replay and CSV export.</p></div></div>
            <div className="media-card"><Camera size={18} /><div><strong>Camera cost-safe MVP</strong><p>Snapshot/direct stream URL first; paid relay/video recording later.</p></div></div>
          </div>
        </section>
      )}
    </section>
  );
}

function DashboardBuilder({ template, device, latest, layout, selectedWidgetId, selectedWidget, selectedDatastream, onSelect, onLayout, onAddWidget, onUpdateWidget, onDuplicate, onDelete, saveState, onSave }: {
  template: DeviceTemplate;
  device?: Device;
  latest: Record<string, Telemetry>;
  layout: Layout;
  selectedWidgetId: string;
  selectedWidget?: WidgetConfig;
  selectedDatastream?: Datastream;
  onSelect: (id: string) => void;
  onLayout: (layout: Layout) => void;
  onAddWidget: (type: string, datastreamId?: string) => void;
  onUpdateWidget: (id: string, patch: Partial<WidgetConfig>) => void;
  onDuplicate: () => void;
  onDelete: () => void;
  saveState: "saved" | "unsaved" | "saving" | "error";
  onSave: () => void;
}) {
  return (
    <div className="studio-workbench studio-system-workbench" data-testid="dashboard-builder-workbench">
      <div className="studio-canvas">
        <div className="builder-hero">
          <div>
            <span className="section-kicker">Dashboard layout lab</span>
            <h3>Professional widget canvas</h3>
            <p>Design the exact dashboard your customer will use: drag widgets, resize from the edges, bind each card to a virtual pin, then save it as the project template.</p>
          </div>
          <div className="builder-metrics">
            <span><strong>12</strong><small>Columns</small></span>
            <span><strong>{template.dashboard.widgets.length}</strong><small>Widgets</small></span>
            <span><strong>{template.datastreams.length}</strong><small>V pins</small></span>
          </div>
        </div>
        <div className="builder-toolbar">
          <span className="pill online-pill">Actual dashboard canvas</span>
          <span className="pill">12-column grid</span>
          <span className="pill">{template.dashboard.widgets.length} widgets</span>
          <span className="muted-text">Drag from widget header. Resize from orange edges/corner.</span>
          <button className="primary small" onClick={onSave} disabled={saveState === "saving"}><Save size={16} />{saveState === "saving" ? "Saving" : "Save Template"}</button>
        </div>
        <GridLayout className="rgl-layout" layout={layout} cols={12} rowHeight={72} margin={[14, 14]} isDraggable isResizable resizeHandles={["se", "e", "s", "n"]} draggableHandle=".widget-header" compactType={null} preventCollision={false} onLayoutChange={onLayout} onResizeStop={onLayout}>
          {template.dashboard.widgets.map((widget) => (
            <div key={widget.id} className={selectedWidgetId === widget.id ? "builder-cell selected" : "builder-cell"} onClick={() => onSelect(widget.id)}>
              <Widget config={widget} reading={latest[`${device?.id}:${widget.channel}`]} devices={device ? [device] : []} />
            </div>
          ))}
        </GridLayout>
      </div>

      <aside className="studio-panel inspector">
        <div className="studio-section">
          <div className="section-title">
            <div>
              <span className="section-kicker">Components</span>
              <h2>Widget Library</h2>
            </div>
          </div>
          <div className="widget-library">{widgetTypes.map((type) => <button className="widget-tile" key={type} onClick={() => onAddWidget(type)}><Grid2X2Plus size={15} /><span>{type.replace("_", " ")}</span><small>Bind to V pin</small></button>)}</div>
        </div>
        <div className="studio-section">
          <div className="section-title"><div><span className="section-kicker">Properties</span><h2>Inspector</h2></div><SlidersHorizontal size={18} /></div>
          {selectedWidget ? (
            <>
              <div className="selected-widget-card">
                <strong>{selectedWidget.title}</strong>
                <span>{selectedWidget.type.replace("_", " ")} · {selectedWidget.channel}</span>
              </div>
              <label>Widget title<input value={selectedWidget.title} onChange={(event) => onUpdateWidget(selectedWidget.id, { title: event.target.value })} /></label>
              <label>Datastream<select value={selectedWidget.datastreamId} onChange={(event) => {
                const stream = template.datastreams.find((item) => item.id === event.target.value);
                if (stream) onUpdateWidget(selectedWidget.id, { datastreamId: stream.id, title: stream.name, channel: stream.pin, unit: stream.unit, min: stream.min, max: stream.max, color: stream.color });
              }}>{template.datastreams.map((stream) => <option key={stream.id} value={stream.id}>{stream.pin} - {stream.name}</option>)}</select></label>
              <label>Colour<input type="color" value={selectedWidget.color ?? selectedDatastream?.color ?? "#f26a21"} onChange={(event) => onUpdateWidget(selectedWidget.id, { color: event.target.value })} /></label>
              <label>Align<select value={selectedWidget.align ?? "center"} onChange={(event) => onUpdateWidget(selectedWidget.id, { align: event.target.value as WidgetConfig["align"] })}><option>left</option><option>center</option><option>right</option></select></label>
              <div className="inspector-actions"><button onClick={onDuplicate}><Copy size={16} />Duplicate</button><button onClick={onDelete}><Trash2 size={16} />Delete</button></div>
            </>
          ) : <p>Select a widget to edit its binding, colour and alignment.</p>}
        </div>
      </aside>
    </div>
  );
}

function DatastreamEditor({ streams, onChange }: { streams: Datastream[]; onChange: (id: string, patch: Partial<Datastream>) => void }) {
  return (
    <div className="datastream-editor studio-system-datastreams" data-testid="datastream-editor">
      {streams.map((stream) => (
        <article className="datastream-card" key={stream.id} style={{ "--stream-color": stream.color } as React.CSSProperties}>
          <div className="stream-identity">
            <span className="stream-pin">{stream.pin}</span>
            <div>
              <input className="stream-name-input" aria-label={`${stream.pin} name`} value={stream.name} onChange={(event) => onChange(stream.id, { name: event.target.value })} />
              <div className="stream-meta">
                <span>MQTT telemetry/{stream.pin}</span>
                <span>{stream.min ?? "—"} to {stream.max ?? "—"}</span>
              </div>
              <small>{stream.dataType} datastream{stream.unit ? ` · ${stream.unit}` : ""}</small>
            </div>
          </div>
          <div className="stream-fields">
            <label>Pin<select aria-label={`${stream.pin} pin`} value={stream.pin} onChange={(event) => onChange(stream.id, { pin: event.target.value as Datastream["pin"] })}>{Array.from({ length: 64 }, (_, index) => <option key={index}>V{index}</option>)}</select></label>
            <label>Type<select aria-label={`${stream.pin} type`} value={stream.dataType} onChange={(event) => onChange(stream.id, { dataType: event.target.value as Datastream["dataType"] })}>{dataTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
            <label>Unit<input aria-label={`${stream.pin} unit`} value={stream.unit ?? ""} placeholder="Unit" onChange={(event) => onChange(stream.id, { unit: event.target.value })} /></label>
            <label>Min<input aria-label={`${stream.pin} min`} type="number" value={stream.min ?? ""} placeholder="Min" onChange={(event) => onChange(stream.id, { min: Number(event.target.value) })} /></label>
            <label>Max<input aria-label={`${stream.pin} max`} type="number" value={stream.max ?? ""} placeholder="Max" onChange={(event) => onChange(stream.id, { max: Number(event.target.value) })} /></label>
          </div>
        </article>
      ))}
    </div>
  );
}

function NotificationRule({ rule, streams, onChange }: { rule: TemplateNotification; streams: Datastream[]; onChange: (id: string, patch: Partial<TemplateNotification>) => void }) {
  const stream = streams.find((item) => item.id === rule.datastreamId);
  return (
    <article className="rule-editor">
      <div className="rule-summary">
        <div className="rule-icon"><Bell size={18} /></div>
        <div>
          <input className="rule-name-input" value={rule.name} onChange={(event) => onChange(rule.id, { name: event.target.value })} />
          <small>If {stream?.pin ?? "V?"} {rule.operator} {rule.threshold ?? "value"} then send {rule.channel.replace("_", " ")}</small>
          <div className="rule-badges">
            <span>{stream?.pin ?? "V?"} · {stream?.name ?? "No datastream"}</span>
            <span>{rule.channel.replace("_", " ")}</span>
            <span>{rule.cooldownMinutes} min cooldown</span>
          </div>
        </div>
      </div>
      <div className="rule-flow">
        <label><span>IF datastream</span><select value={rule.datastreamId} onChange={(event) => onChange(rule.id, { datastreamId: event.target.value })}>{streams.map((stream) => <option key={stream.id} value={stream.id}>{stream.pin} - {stream.name}</option>)}</select></label>
        <label><span>Condition</span><select value={rule.operator} onChange={(event) => onChange(rule.id, { operator: event.target.value as TemplateNotification["operator"] })}><option>&gt;</option><option>&gt;=</option><option>&lt;</option><option>&lt;=</option><option>==</option><option>changes</option></select></label>
        <label><span>Value</span><input type="number" value={rule.threshold ?? ""} onChange={(event) => onChange(rule.id, { threshold: Number(event.target.value) })} /></label>
        <label><span>THEN notify</span><select value={rule.channel} onChange={(event) => onChange(rule.id, { channel: event.target.value as TemplateNotification["channel"] })}><option>push</option><option>in_app</option><option>email</option></select></label>
        <label><span>Cooldown</span><input type="number" value={rule.cooldownMinutes} onChange={(event) => onChange(rule.id, { cooldownMinutes: Number(event.target.value) })} /></label>
      </div>
    </article>
  );
}

function parseMigration(text: string): Array<Omit<Datastream, "id" | "color"> & { color?: string }> {
  return text.split(/\n+/).map((line) => line.trim()).filter(Boolean).map((line, index) => {
    const [pinRaw, nameRaw, typeRaw, unitRaw, minRaw, maxRaw] = line.split(/[,\s]+/);
    const dataType = dataTypes.includes(typeRaw as Datastream["dataType"]) ? typeRaw as Datastream["dataType"] : "float";
    return {
      name: (nameRaw || `Datastream ${index}`).replace(/_/g, " "),
      pin: (/^V\d+$/.test(pinRaw) ? pinRaw : `V${index}`) as Datastream["pin"],
      dataType,
      unit: unitRaw && !["undefined", "-"].includes(unitRaw) ? unitRaw : "",
      min: Number.isFinite(Number(minRaw)) ? Number(minRaw) : undefined,
      max: Number.isFinite(Number(maxRaw)) ? Number(maxRaw) : undefined
    };
  });
}

function hydrateWidget(widget: WidgetConfig, stream: Datastream, device?: Device): WidgetConfig {
  return { ...widget, title: widget.title || stream.name, deviceId: device?.id ?? "", channel: stream.pin, datastreamId: stream.id, unit: stream.unit, min: stream.min, max: stream.max, color: stream.color, align: "center" };
}

function widgetForType(type: Datastream["dataType"]) {
  if (type === "boolean") return "switch";
  if (type === "gps") return "gps";
  if (type === "image") return "camera";
  if (type === "string") return "serial_lcd";
  return "gauge";
}

function colorForType(type: Datastream["dataType"]) {
  if (type === "boolean") return "#7c3aed";
  if (type === "gps") return "#0891b2";
  if (type === "image") return "#475569";
  if (type === "string") return "#334155";
  return "#f26a21";
}

function sanitizeSketchName(name: string) {
  return name.trim().replace(/[^a-zA-Z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "SparkIoT_Template";
}

function buildArduinoSketch(template: DeviceTemplate, device?: Device) {
  const board = template.board;
  const deviceId = device?.id ?? "YOUR_DEVICE_ID";
  const token = device ? (device.token ?? "ROTATE_TOKEN_TO_REVEAL_ONCE") : "YOUR_DEVICE_TOKEN";
  const tenantId = extractTenantId(device?.telemetry_topic) ?? "demo-tenant";
  const telemetryLines = template.datastreams.map((stream) => libraryPublishLine(stream)).join("\n");
  const commandHandlers = template.datastreams.filter((stream) => stream.dataType === "boolean").map((stream) => `void on${stream.pin}Command(const char* channel, bool state, const char* payload) {
  Serial.print("Command ${stream.pin} -> ");
  Serial.println(state ? "ON" : "OFF");
  digitalWrite(LED_BUILTIN, state ? LOW : HIGH);
  SparkIoT.virtualWrite("${stream.pin}", state);
  SparkIoT.ack("${stream.pin}", state, "${stream.pin} command applied");
}`).join("\n\n");
  const commandBindings = template.datastreams.filter((stream) => stream.dataType === "boolean").map((stream) => `  SparkIoT.onCommand("${stream.pin}", on${stream.pin}Command);`).join("\n");

  return `#include <SparkIoT.h>

// Spark IoT generated sketch for ${template.name} (${board})
// Install Arduino IDE libraries:
// - SparkIoT from arduino/SparkIoT in this repository
// - PubSubClient by Nick O'Leary
// IMPORTANT: For local Docker, BROKER_HOST must be your PC LAN IP, not 127.0.0.1.
// For the current Google Cloud VPS test, use 34.73.29.12.

const char* WIFI_SSID = "YOUR_WIFI_NAME";
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";
const char* BROKER_HOST = "34.73.29.12";
const int BROKER_PORT = 1883;

const char* SPARK_TENANT_ID = "${tenantId}";
const char* SPARK_DEVICE_ID = "${deviceId}";
const char* SPARK_DEVICE_TOKEN = "${token}";

unsigned long lastPublishMs = 0;

${commandHandlers || "// Add command callbacks here for writable boolean V pins."}

void publishTelemetry() {
${telemetryLines}
}

void setup() {
  Serial.begin(115200);
  pinMode(LED_BUILTIN, OUTPUT);
  digitalWrite(LED_BUILTIN, HIGH);

  SparkIoT.begin(WIFI_SSID, WIFI_PASSWORD, BROKER_HOST, BROKER_PORT, SPARK_TENANT_ID, SPARK_DEVICE_ID, SPARK_DEVICE_TOKEN);
${commandBindings || "  // No writable boolean V pins detected for command binding."}
}

void loop() {
  SparkIoT.run();

  if (millis() - lastPublishMs > 5000) {
    lastPublishMs = millis();
    publishTelemetry();
  }
}
`;
}

function extractTenantId(topic?: string) {
  const parts = topic?.split("/") ?? [];
  return parts.length >= 4 && parts[0] === "spark" && parts[1] === "v1" ? parts[2] : undefined;
}

function libraryPublishLine(stream: Datastream) {
  if (stream.dataType === "boolean") return `  SparkIoT.virtualWrite("${stream.pin}", false);`;
  if (stream.dataType === "gps") return `  SparkIoT.setLocation("${stream.pin}", 3.139, 101.6869, 14, 8);`;
  if (stream.dataType === "image") return `  SparkIoT.setCameraUrl("${stream.pin}", "http://device.local/snapshot.jpg");`;
  if (stream.dataType === "string") return `  SparkIoT.virtualWrite("${stream.pin}", "Boot OK");`;
  const value = Math.round(((stream.min ?? 0) + (stream.max ?? 100)) / 2);
  return `  SparkIoT.virtualWrite("${stream.pin}", ${value}, "${stream.unit ?? ""}");`;
}

function sampleValue(stream: Datastream) {
  if (stream.dataType === "boolean") return "true / false";
  if (stream.dataType === "gps") return "lat: 3.139, lng: 101.6869";
  if (stream.dataType === "image") return "snapshot URL";
  if (stream.dataType === "string") return "Boot OK";
  return `${Math.round(((stream.min ?? 0) + (stream.max ?? 100)) / 2)} ${stream.unit ?? ""}`;
}
