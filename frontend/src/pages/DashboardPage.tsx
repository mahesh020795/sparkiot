import type React from "react";
import { useEffect, useMemo, useState } from "react";
import { api, getSession, realtimeUrl } from "../lib/api";
import type { Dashboard, Device, Telemetry } from "../lib/types";
import { Widget } from "../components/widgets/Widget";

export function DashboardPage({ projectId, devices }: { projectId: string; devices: Device[] }) {
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [latest, setLatest] = useState<Record<string, Telemetry>>({});
  const edit = false;
  const [draggingId, setDraggingId] = useState<string>("");

  useEffect(() => {
    let mounted = true;
    setDashboard(null);
    Promise.all([api.dashboard(projectId), api.latest(projectId)])
      .then(([nextDashboard, readings]) => {
        if (!mounted) return;
        setDashboard(nextDashboard);
        setLatest({ ...Object.fromEntries(readings.map((reading) => [`${reading.device_id}:${reading.channel}`, reading])), ...readPersistedDashboardInputs(projectId) });
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
    const ws = new WebSocket(realtimeUrl(token, projectId));
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
    persistDashboardInput(projectId, nextReading);
    void api.command(widget.deviceId, widget.channel, value).catch(() => undefined);
  }

  return (
    <section className="overview-page">
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
  const edit = false;
  const [draggingId, setDraggingId] = useState("");
  const sortedWidgets = useMemo(() => [...dashboard.widgets].sort((a, b) => a.y - b.y || a.x - b.x), [dashboard]);

  useEffect(() => {
    setDashboard(initialDashboard);
    setLatest({ ...initialLatest, ...readPersistedDashboardInputs(projectId) });
  }, [initialDashboard, initialLatest, projectId]);

  useEffect(() => {
    let mounted = true;
    async function loadLatest() {
      try {
        const readings = await api.demoLatest(projectId);
        if (mounted) setLatest((current) => ({ ...current, ...readings, ...readPersistedDashboardInputs(projectId) }));
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
    persistDashboardInput(projectId, {
      id: latest[key]?.id ?? `local-command-${widget.deviceId}-${widget.channel}`,
      device_id: widget.deviceId,
      channel: widget.channel,
      value,
      unit: widget.unit,
      observed_at: new Date().toISOString(),
      server_at: new Date().toISOString()
    });
    void api.demoCommand(widget.deviceId, widget.channel, value).catch(() => undefined);
  }

  return (
    <section className="overview-page">
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

function dashboardInputStorageKey(projectId: string) {
  return `spark_iot_dashboard_inputs:${projectId}`;
}

function readPersistedDashboardInputs(projectId: string): Record<string, Telemetry> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(dashboardInputStorageKey(projectId));
    if (!raw) return {};
    const parsed = JSON.parse(raw) as Record<string, Telemetry>;
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function persistDashboardInput(projectId: string, reading: Telemetry) {
  if (typeof window === "undefined") return;
  const key = `${reading.device_id}:${reading.channel}`;
  const current = readPersistedDashboardInputs(projectId);
  window.localStorage.setItem(dashboardInputStorageKey(projectId), JSON.stringify({ ...current, [key]: reading }));
}
