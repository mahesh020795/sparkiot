import { Clipboard, Copy, KeyRound, Lock, Pencil, Plus, RadioTower, Router, TerminalSquare, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useState } from "react";
import { ConfirmDialog } from "../components/ConfirmDialog";
import { SparkSelect } from "../components/SparkSelect";
import { copyText } from "../lib/clipboard";
import type { BoardType, Device, DeviceCreate, DeviceTemplate, DeviceUpdate, Project } from "../lib/types";

type Props = {
  devices: Device[];
  templates: DeviceTemplate[];
  projects?: Project[];
  accountMode?: boolean;
  onCreateDevice?: (device: DeviceCreate) => Promise<Device>;
  onRegenerateToken?: (deviceId: string) => Promise<Device>;
  onUpdateDevice: (deviceId: string, device: DeviceUpdate) => Promise<Device>;
  onDeleteDevice: (deviceId: string) => Promise<void>;
};

const boardOptions: BoardType[] = ["ESP32", "ESP8266", "Arduino", "Raspberry Pi Pico", "STM32"];

export function DevicesPage({ devices, templates, projects = [], accountMode = false, onCreateDevice, onRegenerateToken, onUpdateDevice, onDeleteDevice }: Props) {
  const deviceLimit = 10;
  const isAtLimit = devices.length >= deviceLimit;
  const [tokenStates, setTokenStates] = useState<Record<string, "idle" | "saving" | "saved" | "error">>({});
  const [provisionOpen, setProvisionOpen] = useState(false);
  const [provisionState, setProvisionState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [provisionMessage, setProvisionMessage] = useState("");
  const [newDevice, setNewDevice] = useState<DeviceCreate>({
    project_id: projects[0]?.id ?? templates[0]?.dashboard.project_id ?? "",
    name: "",
    board: "ESP32"
  });
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [editDeviceDraft, setEditDeviceDraft] = useState<DeviceUpdate>({ project_id: "", name: "", board: "ESP32" });
  const [deleteDeviceDraft, setDeleteDeviceDraft] = useState<Device | null>(null);
  const [copyStates, setCopyStates] = useState<Record<string, "idle" | "copied" | "error">>({});

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
    if (!onCreateDevice || (accountMode && isAtLimit)) return;
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

  async function saveDeviceEdit(deviceId: string) {
    const name = editDeviceDraft.name.trim();
    if (!editDeviceDraft.project_id || name.length < 2) return;
    await onUpdateDevice(deviceId, { ...editDeviceDraft, name });
    setEditingDeviceId(null);
  }

  async function copyDeviceValue(key: string, value: string) {
    const copied = await copyText(value);
    setCopyStates((current) => ({ ...current, [key]: copied ? "copied" : "error" }));
    window.setTimeout(() => {
      setCopyStates((current) => ({ ...current, [key]: "idle" }));
    }, 1600);
  }

  return (
    <section className="support-page device-provisioning-page device-system-page" data-testid="devices-page">
      <div className="library-toolbar provisioning-toolbar">
        <div>
          <strong>{devices.length}/10 devices used</strong>
          <span>Pro access supports ten active boards across customer projects.</span>
        </div>
        <button
          className="primary"
          disabled={(accountMode && isAtLimit) || !onCreateDevice}
          aria-disabled={(accountMode && isAtLimit) || !onCreateDevice}
          title={isAtLimit ? "Pro plan device limit reached" : accountMode ? "Provision device" : "Sign in to provision real devices"}
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
              <SparkSelect
                ariaLabel="Project"
                value={newDevice.project_id}
                onChange={(value) => setNewDevice((current) => ({ ...current, project_id: value }))}
                options={(projects.length ? projects : templates.map((template) => ({ id: template.dashboard.project_id, name: template.name }))).map((project) => ({ value: project.id, label: project.name }))}
              />
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
              <SparkSelect
                ariaLabel="Board type"
                value={newDevice.board}
                onChange={(value) => setNewDevice((current) => ({ ...current, board: value as BoardType }))}
                options={boardOptions.map((board) => ({ value: board, label: board }))}
              />
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
          const telemetryCopyKey = `${device.id}:telemetry`;
          const tokenCopyKey = `${device.id}:token`;
          return (
            <article className="panel provisioning-card device-system-card" key={device.id} aria-label={`${device.name} provisioning card`}>
              <div className="provisioning-card-head">
                <span className="device-icon"><Router size={20} /></span>
                <div>
                  {editingDeviceId === device.id ? (
                    <div className="entity-edit-form">
                      <label>
                        Device name
                        <input aria-label="Edit device name" value={editDeviceDraft.name} onChange={(event) => setEditDeviceDraft((current) => ({ ...current, name: event.target.value }))} />
                      </label>
                      <label>
                        Project
                        <SparkSelect
                          ariaLabel="Edit device project"
                          value={editDeviceDraft.project_id}
                          onChange={(value) => setEditDeviceDraft((current) => ({ ...current, project_id: value }))}
                          options={(projects.length ? projects : templates.map((item) => ({ id: item.dashboard.project_id, name: item.name }))).map((project) => ({ value: project.id, label: project.name }))}
                        />
                      </label>
                      <label>
                        Board
                        <SparkSelect
                          ariaLabel="Edit device board"
                          value={editDeviceDraft.board ?? "ESP32"}
                          onChange={(value) => setEditDeviceDraft((current) => ({ ...current, board: value as BoardType }))}
                          options={boardOptions.map((board) => ({ value: board, label: board }))}
                        />
                      </label>
                    </div>
                  ) : (
                    <>
                      <h2>{device.name}</h2>
                      <p>{template?.name ?? "Unassigned template"}</p>
                    </>
                  )}
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
                <button onClick={() => void copyDeviceValue(telemetryCopyKey, device.telemetry_topic)}><Copy size={16} />{formatCopyLabel(copyStates[telemetryCopyKey], "Copy telemetry")}</button>
                <button onClick={() => void copyDeviceValue(tokenCopyKey, device.token ?? "")} disabled={!device.token}><KeyRound size={16} />{formatCopyLabel(copyStates[tokenCopyKey], "Copy token")}</button>
                <button onClick={() => void regenerateToken(device.id)} disabled={!onRegenerateToken || tokenState === "saving"}>
                  <KeyRound size={16} />{tokenState === "saving" ? "Rotating..." : "Regenerate token"}
                </button>
              </div>
              <div className="entity-card-actions">
                {editingDeviceId === device.id ? (
                  <>
                    <button className="entity-edit-button" type="button" onClick={() => void saveDeviceEdit(device.id)}>Save device</button>
                    <button type="button" onClick={() => setEditingDeviceId(null)}>Cancel</button>
                  </>
                ) : (
                  <>
                    <button className="entity-edit-button" type="button" aria-label={`Edit device ${device.name}`} onClick={() => { setEditingDeviceId(device.id); setEditDeviceDraft({ project_id: device.project_id, name: device.name, board: device.board as BoardType }); }}><Pencil size={16} />Edit device</button>
                    <button className="entity-delete-button" type="button" aria-label={`Delete device ${device.name}`} onClick={() => setDeleteDeviceDraft(device)}><Trash2 size={16} />Delete device</button>
                  </>
                )}
              </div>
              <span className={`token-rotation-state ${tokenState}`}>{formatTokenState(tokenState, accountMode)}</span>
            </article>
          );
        })}
      </section>

      <ConfirmDialog
        open={Boolean(deleteDeviceDraft)}
        title="Delete device?"
        body={`This will remove "${deleteDeviceDraft?.name ?? "this device"}" from the workspace. The board token will no longer be valid for new connections.`}
        confirmLabel="Delete device"
        onCancel={() => setDeleteDeviceDraft(null)}
        onConfirm={() => {
          const deviceId = deleteDeviceDraft?.id;
          setDeleteDeviceDraft(null);
          if (deviceId) void onDeleteDevice(deviceId);
        }}
      />
    </section>
  );
}

function formatTokenState(state: "idle" | "saving" | "saved" | "error", accountMode: boolean) {
  if (!accountMode) {
    if (state === "saving") return "Rotating demo token...";
    if (state === "saved") return "Demo token rotated locally. Copy it into your test sketch.";
    if (state === "error") return "Demo token rotation failed. Try again.";
    return "Demo mode rotates a local test token";
  }
  if (state === "saving") return "Rotating token...";
  if (state === "saved") return "New token shown once. Copy it into the Arduino sketch now.";
  if (state === "error") return "Token rotation failed. Check the API session and try again.";
  return "Rotate token to reveal a new one-time credential";
}

function formatCopyLabel(state: "idle" | "copied" | "error" | undefined, fallback: string) {
  if (state === "copied") return "Copied";
  if (state === "error") return "Copy failed";
  return fallback;
}

function ProvisioningSecret({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="provisioning-secret">
      <span>{icon}{label}</span>
      <code>{value}</code>
    </div>
  );
}
