import { CheckCircle2, Clipboard, Copy, KeyRound, Lock, Plus, RadioTower, Router, ShieldCheck, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import type { BoardType, Device, DeviceCreate, DeviceTemplate, Project } from "../lib/types";

type Props = {
  devices: Device[];
  templates: DeviceTemplate[];
  projects?: Project[];
  accountMode?: boolean;
  onCreateDevice?: (device: DeviceCreate) => Promise<Device>;
  onRegenerateToken?: (deviceId: string) => Promise<Device>;
};

const boardOptions: BoardType[] = ["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"];

export function DevicesPage({ devices, templates, projects = [], accountMode = false, onCreateDevice, onRegenerateToken }: Props) {
  const deviceLimit = 3;
  const isAtLimit = devices.length >= deviceLimit;
  const onlineCount = devices.filter((device) => device.is_online).length;
  const [tokenStates, setTokenStates] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionState, setProvisionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [provisionMessage, setProvisionMessage] = useState("");
  const [newDevice, setNewDevice] = useState<DeviceCreate>({
    project_id: projects[0]?.id ?? templates[0]?.dashboard.project_id ?? "",
    name: "",
    board: "ESP32"
  });

  async function regenerateToken(deviceId: string) {
    if (!onRegenerateToken) return;
    setTokenStates((current) => ({ ...current, [deviceId]: "saving" }));
    try {
      await onRegenerateToken(deviceId);
      setTokenStates((current) => ({ ...current, [deviceId]: "saved" }));
    } catch {
      setTokenStates((current) => ({ ...current, [deviceId]: "error" }));
    }
  }

  async function createDevice() {
    if (!onCreateDevice || isAtLimit) return;
    const projectId = newDevice.project_id || projects[0]?.id || templates[0]?.dashboard.project_id || "";
    const name = newDevice.name.trim();
    if (!projectId || name.length < 2) {
      setProvisionState("error");
      setProvisionMessage("Choose a project and enter a device name with at least 2 characters.");
      return;
    }
    setProvisionState("saving");
    setProvisionMessage("");
    try {
      await onCreateDevice({ project_id: projectId, name, board: newDevice.board });
      setProvisionState("saved");
      setProvisionMessage("New device token shown once. Copy it before leaving this page.");
      setNewDevice((current) => ({ ...current, name: "" }));
      setProvisionOpen(false);
    } catch {
      setProvisionState("error");
      setProvisionMessage("Device provisioning failed. Check starter limits and API session.");
    }
  }

  return (
    <section className="support-page device-provisioning-page device-system-page" data-testid="devices-page">
      <div className="support-hero device-provisioning-hero device-system-hero" data-testid="device-provisioning-hero">
        <div>
          <span className="section-kicker">Provisioning center</span>
          <h2>Bind boards to templates and ship firmware-ready credentials</h2>
          <p>Each device receives a one-time token, MQTT topic namespace and Arduino binding block that matches its template virtual pins.</p>
        </div>
        <div className="support-metrics">
          <span><strong>{devices.length}/3</strong><small>Devices</small></span>
          <span><strong>{onlineCount}</strong><small>Online</small></span>
          <span><strong>{templates.length}</strong><small>Templates</small></span>
        </div>
      </div>

      <div className="library-toolbar provisioning-toolbar">
        <div>
          <strong>{devices.length}/3 devices used</strong>
          <span>Starter plan supports three active boards across three projects.</span>
        </div>
        <button
          className="primary"
          disabled={isAtLimit || !onCreateDevice}
          aria-disabled={isAtLimit || !onCreateDevice}
          title={isAtLimit ? "Starter plan device limit reached" : accountMode ? "Provision device" : "Sign in to provision real devices"}
          onClick={() => setProvisionOpen((current) => !current)}
        >
          {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
          Provision device
        </button>
      </div>

      {provisionOpen && (
        <article className="panel provisioning-create-card" data-testid="device-create-form">
          <div>
            <span className="section-kicker">New board credential</span>
            <h2>Provision a device</h2>
            <p>Create the backend device, reveal the one-time token, then paste it into the Arduino sketch before refreshing.</p>
          </div>
          <div className="device-create-grid">
            <label>
              Project
              <select
                aria-label="Project"
                value={newDevice.project_id}
                onChange={(event) => setNewDevice((current) => ({ ...current, project_id: event.target.value }))}
              >
                {(projects.length ? projects : templates.map((template) => ({ id: template.dashboard.project_id, name: template.name }))).map((project) => (
                  <option key={project.id} value={project.id}>{project.name}</option>
                ))}
              </select>
            </label>
            <label>
              Device name
              <input
                aria-label="Device name"
                value={newDevice.name}
                placeholder="Greenhouse Node 2"
                onChange={(event) => setNewDevice((current) => ({ ...current, name: event.target.value }))}
              />
            </label>
            <label>
              Board type
              <select
                aria-label="Board type"
                value={newDevice.board}
                onChange={(event) => setNewDevice((current) => ({ ...current, board: event.target.value as BoardType }))}
              >
                {boardOptions.map((board) => <option key={board} value={board}>{board}</option>)}
              </select>
            </label>
          </div>
          <div className="provisioning-actions">
            <button className="primary" type="button" onClick={() => void createDevice()} disabled={provisionState === "saving"}>
              <Plus size={16} />{provisionState === "saving" ? "Creating..." : "Create device"}
            </button>
            <button type="button" onClick={() => setProvisionOpen(false)}>Cancel</button>
          </div>
        </article>
      )}

      {provisionMessage && <span className={`device-create-state ${provisionState}`}>{provisionMessage}</span>}

      <section className="device-provisioning-grid device-system-grid" data-testid="device-provisioning-grid">
        {devices.map((device) => {
          const template = templates.find((item) => item.dashboard.project_id === device.project_id);
          const firstWritable = template?.datastreams.find((stream) => stream.dataType === "boolean") ?? template?.datastreams[0];
          const tokenValue = device.token ?? (accountMode ? "Token hidden after first issue" : "spk_dev_demo_pending");
          const tokenState = tokenStates[device.id] ?? "idle";
          return (
            <article className="panel provisioning-card device-system-card" key={device.id} aria-label={`${device.name} provisioning card`}>
              <div className="provisioning-card-head">
                <span className="device-icon"><Router size={20} /></span>
                <div>
                  <h2>{device.name}</h2>
                  <p>{template?.name ?? "Unassigned template"}</p>
                </div>
                <span className={device.is_online ? "pill online-pill" : "pill"}>{device.is_online ? "Online" : "Offline"}</span>
              </div>

              <div className="provisioning-meta-row">
                <span><strong>{device.board}</strong><small>Board</small></span>
                <span><strong>{template?.datastreams.length ?? 0}</strong><small>V pins</small></span>
                <span><strong>{template?.dashboard.widgets.length ?? 0}</strong><small>Widgets</small></span>
              </div>

              <ProvisioningSecret label="Device token" value={tokenValue} icon={<KeyRound size={15} />} />
              <ProvisioningSecret label="Telemetry topic" value={device.telemetry_topic} icon={<RadioTower size={15} />} />
              <ProvisioningSecret label="Command topic" value={device.command_topic} icon={<TerminalSquare size={15} />} />

              <div className="arduino-bind-card">
                <div><Clipboard size={16} /><strong>Arduino bind</strong></div>
                <code>
                  {`#define SPARK_DEVICE_ID "${device.id}"\n#define SPARK_TOKEN "${device.token ?? (accountMode ? "ROTATE_TOKEN_TO_REVEAL_ONCE" : "spk_dev_demo_pending")}"\nSparkIoT.bind("${firstWritable?.pin ?? "V0"}", on${firstWritable?.name.replace(/\W+/g, "") ?? "Data"});`}
                </code>
              </div>

              <div className="provisioning-actions">
                <button onClick={() => navigator.clipboard?.writeText(device.telemetry_topic)}><Copy size={16} />Copy telemetry</button>
                <button onClick={() => navigator.clipboard?.writeText(device.token ?? "")} disabled={!device.token}><KeyRound size={16} />Copy token</button>
                <button onClick={() => void regenerateToken(device.id)} disabled={!onRegenerateToken || tokenState === "saving"}>
                  <KeyRound size={16} />{tokenState === "saving" ? "Rotating..." : "Regenerate token"}
                </button>
              </div>
              <span className={`token-rotation-state ${tokenState}`}>{formatTokenState(tokenState, accountMode)}</span>
            </article>
          );
        })}
      </section>

      <article className="panel provisioning-safety-card">
        <ShieldCheck size={18} />
        <div>
          <strong>Production rule</strong>
          <p>The backend shows the raw device token only once, stores only a hash, and regenerates credentials when a board is lost or shared.</p>
        </div>
        <CheckCircle2 size={18} />
      </article>
    </section>
  );
}

function formatTokenState(state: "idle" | "saving" | "saved" | "error", accountMode: boolean) {
  if (!accountMode) return "Sign in to rotate real device credentials";
  if (state === "saving") return "Rotating token...";
  if (state === "saved") return "New token shown once. Copy it into the Arduino sketch now.";
  if (state === "error") return "Token rotation failed. Check the API session and try again.";
  return "Rotate token to reveal a new one-time credential";
}

function ProvisioningSecret({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="provisioning-secret">
      <span>{icon}{label}</span>
      <code>{value}</code>
    </div>
  );
}
