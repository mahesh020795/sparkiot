import { Activity, Edit3, Play, Save } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { api, getSession, realtimeUrl } from "../lib/api";
import type { Dashboard, Device, Telemetry } from "../lib/types";
import { Widget } from "../components/widgets/Widget";

export function DashboardPage({ projectId, devices }: { projectId: string; devices: Device[] }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [latest, setLatest] = useState<Record<string, Telemetry>>({});
  const [edit, setEdit] = useState(false);
  const [connected, setConnected] = useState(false);
  const [draggingId, setDraggingId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setDashboard(null);
    Promise.all([api.dashboard(projectId), api.latest(projectId)])
      .then(([nextDashboard, readings]) => {
        if (!mounted) return;
        setDashboard(nextDashboard);
        setLatest(Object.fromEntries(readings.map((reading) => [`${reading.device_id}:${reading.channel}`, reading])));
      })
      .catch(() => {
        if (mounted) setDashboard({ id: `${projectId}-empty-dashboard`, project_id: projectId, name: "Dashboard", revision: 1, widgets: [] });
      });
    return () => {
      mounted = false;
    };
  }, [projectId]);

  useEffect(() => {
    const token = getSession()?.access_token;
    if (!token || typeof WebSocket === "undefined") return;
    const ws = new WebSocket(realtimeUrl(token));
    ws.onopen = () => setConnected(true);
    ws.onclose = () => setConnected(false);
    ws.onmessage = (event) => {
      const parsed = JSON.parse(event.data);
      if (parsed.type === "telemetry") {
        const reading = parsed.payload as Telemetry;
        setLatest((current) => ({ ...current, [`${reading.device_id}:${reading.channel}`]: reading }));
      }
    };
    return () => ws.close();
  }, [projectId]);

  const sortedWidgets = useMemo(() => [...(dashboard?.widgets ?? [])].sort((a, b) => a.y - b.y || a.x - b.x), [dashboard]);

  if (!dashboard) return <div className="panel">Loading dashboard...</div>;

  async function save() {
    if (!dashboard) return;
    const saved = await api.saveDashboard(dashboard);
    setDashboard(saved);
    setEdit(false);
  }

  function moveWidget(targetId: string) {
    if (!dashboard || !draggingId || draggingId === targetId) return;
    const widgets = [...dashboard.widgets];
    const from = widgets.findIndex((widget) => widget.id === draggingId);
    const to = widgets.findIndex((widget) => widget.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved);
    setDashboard({ ...dashboard, widgets: widgets.map((widget, index) => ({ ...widget, x: (index % 4) * 3, y: Math.floor(index / 4) * 3 })) });
  }

  function updateCommandReading(widget: Dashboard["widgets"][number], value: unknown) {
    const key = `${widget.deviceId}:${widget.channel}`;
    const nextReading: Telemetry = {
      id: latest[key]?.id ?? `command-${widget.deviceId}-${widget.channel}`,
      device_id: widget.deviceId,
      channel: widget.channel,
      value,
      unit: widget.unit,
      observed_at: new Date().toISOString(),
      server_at: new Date().toISOString()
    };
    setLatest((current) => ({ ...current, [key]: nextReading }));
    void api.command(widget.deviceId, widget.channel, value).catch(() => undefined);
  }

  return (
    <section className="overview-page">
      <div className="dashboard-toolbar gemini-action-strip" data-testid="dashboard-action-bar">
        <div className={connected ? "command-status online" : "command-status"}>
          <Activity size={16} />
          <span><strong>{connected ? "Realtime connected" : "Realtime offline"}</strong><small>Live device stream</small></span>
        </div>
        <div className="command-actions">
          <button className={edit ? "action-button active" : "action-button"} onClick={() => setEdit(!edit)}><Edit3 size={16} />{edit ? "Editing enabled" : "Edit labels"}</button>
          <button className="primary action-button" onClick={save}><Save size={16} />Publish Changes</button>
        </div>
      </div>
      <div className={edit ? "layout edit-mode gemini-widget-canvas" : "layout gemini-widget-canvas"} data-testid="gemini-widget-canvas">
        {sortedWidgets.map((widget) => (
          <div
            className="grid-cell"
            draggable={edit}
            onDragStart={() => setDraggingId(widget.id)}
            onDragOver={(event) => edit && event.preventDefault()}
            onDrop={() => moveWidget(widget.id)}
            style={{ gridColumn: `span ${Math.min(widget.w, 12)}`, minHeight: `${widget.h * 92}px` }}
            key={widget.id}
          >
            <Widget config={widget} reading={latest[`${widget.deviceId}:${widget.channel}`]} devices={devices} onCommand={updateCommandReading} />
          </div>
        ))}
      </div>
    </section>
  );
}

export function LocalDashboardPage({
  projectId,
  initialDashboard,
  initialLatest,
  devices
}: {
  projectId: string;
  initialDashboard: Dashboard;
  initialLatest: Record<string, Telemetry>;
  devices: Device[];
}) {
  const [dashboard, setDashboard] = useState<Dashboard>(initialDashboard);
  const [latest, setLatest] = useState<Record<string, Telemetry>>(initialLatest);
  const [edit, setEdit] = useState(false);
  const [draggingId, setDraggingId] = useState("");
  const sortedWidgets = useMemo(() => [...dashboard.widgets].sort((a, b) => a.y - b.y || a.x - b.x), [dashboard]);

  useEffect(() => {
    setDashboard(initialDashboard);
    setLatest(initialLatest);
  }, [initialDashboard, initialLatest]);

  useEffect(() => {
    let mounted = true;
    async function loadLatest() {
      try {
        const readings = await api.demoLatest(projectId);
        if (mounted) setLatest((current) => ({ ...current, ...readings }));
      } catch {
        // Keep simulator data available when the backend is not running yet.
      }
    }
    void loadLatest();
    const id = window.setInterval(loadLatest, 3000);
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, [projectId]);

  function moveWidget(targetId: string) {
    if (!draggingId || draggingId === targetId) return;
    const widgets = [...dashboard.widgets];
    const from = widgets.findIndex((widget) => widget.id === draggingId);
    const to = widgets.findIndex((widget) => widget.id === targetId);
    if (from < 0 || to < 0) return;
    const [moved] = widgets.splice(from, 1);
    widgets.splice(to, 0, moved);
    setDashboard({ ...dashboard, widgets: widgets.map((widget, index) => ({ ...widget, x: (index % 4) * 3, y: Math.floor(index / 4) * 3 })) });
  }

  function simulateTelemetry() {
    const next = 24 + Math.round(Math.random() * 120) / 10;
    setLatest((current) => ({
      ...current,
      "device-irrigation:temperature": {
        ...current["device-irrigation:temperature"],
        value: next,
        observed_at: new Date().toISOString(),
        server_at: new Date().toISOString()
      }
    }));
  }

  function updateLocalCommandReading(widget: Dashboard["widgets"][number], value: unknown) {
    const key = `${widget.deviceId}:${widget.channel}`;
    setLatest((current) => ({
      ...current,
      [key]: {
        id: current[key]?.id ?? `local-command-${widget.deviceId}-${widget.channel}`,
        device_id: widget.deviceId,
        channel: widget.channel,
        value,
        unit: widget.unit,
        observed_at: new Date().toISOString(),
        server_at: new Date().toISOString()
      }
    }));
    void api.demoCommand(widget.deviceId, widget.channel, value).catch(() => undefined);
  }

  return (
    <section className="overview-page">
      <div className="dashboard-toolbar gemini-action-strip" data-testid="dashboard-action-bar">
        <div className="command-status online">
          <Activity size={16} />
          <span><strong>Virtual IoT Simulator Connected</strong><small>Water, pressure, flow models synced with scheduler output</small></span>
        </div>
        <div className="command-actions">
          <button className="action-button" onClick={simulateTelemetry}><Play size={16} />Simulate data</button>
          <button className={edit ? "action-button active" : "action-button"} onClick={() => setEdit(!edit)}><Edit3 size={16} />{edit ? "Editing enabled" : "Edit labels"}</button>
          <button className="primary action-button" onClick={() => setEdit(false)}><Save size={16} />Publish Changes</button>
        </div>
      </div>
      <div className={edit ? "layout edit-mode gemini-widget-canvas" : "layout gemini-widget-canvas"} data-testid="gemini-widget-canvas">
        {sortedWidgets.map((widget) => (
          <div
            className="grid-cell"
            draggable={edit}
            onDragStart={() => setDraggingId(widget.id)}
            onDragOver={(event) => edit && event.preventDefault()}
            onDrop={() => moveWidget(widget.id)}
            style={{ gridColumn: `span ${Math.min(widget.w, 12)}`, minHeight: `${widget.h * 92}px` }}
            key={widget.id}
          >
            <Widget config={widget} reading={latest[`${widget.deviceId}:${widget.channel}`]} devices={devices} onCommand={updateLocalCommandReading} />
          </div>
        ))}
      </div>
    </section>
  );
}
