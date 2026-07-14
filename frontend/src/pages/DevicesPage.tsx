import { CheckCircle2, Clipboard, Copy, KeyRound, Lock, Plus, RadioTower, Router, ShieldCheck, TerminalSquare } from "lucide-react";
import type { ReactNode } from "react";
import type { Device, DeviceTemplate } from "../lib/types";

export function DevicesPage({ devices, templates }: { devices: Device[]; templates: DeviceTemplate[] }) {
  const deviceLimit = 3;
  const isAtLimit = devices.length >= deviceLimit;
  const onlineCount = devices.filter((device) => device.is_online).length;

  return (
    <section className="support-page device-provisioning-page">
      <div className="support-hero device-provisioning-hero">
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
        <button className="primary" disabled={isAtLimit} aria-disabled={isAtLimit} title={isAtLimit ? "Starter plan device limit reached" : "Provision device"}>
          {isAtLimit ? <Lock size={16} /> : <Plus size={16} />}
          Provision device
        </button>
      </div>

      <section className="device-provisioning-grid">
        {devices.map((device) => {
          const template = templates.find((item) => item.dashboard.project_id === device.project_id);
          const firstWritable = template?.datastreams.find((stream) => stream.dataType === "boolean") ?? template?.datastreams[0];
          return (
            <article className="panel provisioning-card" key={device.id} aria-label={`${device.name} provisioning card`}>
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

              <ProvisioningSecret label="Device token" value={device.token ?? "spk_dev_demo_pending"} icon={<KeyRound size={15} />} />
              <ProvisioningSecret label="Telemetry topic" value={device.telemetry_topic} icon={<RadioTower size={15} />} />
              <ProvisioningSecret label="Command topic" value={device.command_topic} icon={<TerminalSquare size={15} />} />

              <div className="arduino-bind-card">
                <div><Clipboard size={16} /><strong>Arduino bind</strong></div>
                <code>
                  {`#define SPARK_DEVICE_ID "${device.id}"\n#define SPARK_TOKEN "${device.token ?? "spk_dev_demo_pending"}"\nSparkIoT.bind("${firstWritable?.pin ?? "V0"}", on${firstWritable?.name.replace(/\W+/g, "") ?? "Data"});`}
                </code>
              </div>

              <div className="provisioning-actions">
                <button onClick={() => navigator.clipboard?.writeText(device.telemetry_topic)}><Copy size={16} />Copy telemetry</button>
                <button onClick={() => navigator.clipboard?.writeText(device.token ?? "")}><KeyRound size={16} />Copy token</button>
              </div>
            </article>
          );
        })}
      </section>

      <article className="panel provisioning-safety-card">
        <ShieldCheck size={18} />
        <div>
          <strong>Production rule</strong>
          <p>Real backend should show the raw device token only once, store only a hash, and allow regeneration with old-token revocation.</p>
        </div>
        <CheckCircle2 size={18} />
      </article>
    </section>
  );
}

function ProvisioningSecret({ label, value, icon }: { label: string; value: string; icon: ReactNode }) {
  return (
    <div className="provisioning-secret">
      <span>{icon}{label}</span>
      <code>{value}</code>
    </div>
  );
}
