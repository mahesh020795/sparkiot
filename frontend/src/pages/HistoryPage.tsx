import { Download, History, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api, getSession } from "../lib/api";
import type { Device, Telemetry } from "../lib/types";

function formatValue(value: unknown) {
  if (value === null || value === undefined) return "--";
  if (typeof value === "object") return JSON.stringify(value);
  return String(value);
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

export function HistoryPage({ devices, initialLatest, accountMode = false }: { devices: Device[]; initialLatest: Record<string, Telemetry>; accountMode?: boolean }) {
  const [selectedDeviceId, setSelectedDeviceId] = useState(devices[0]?.id ?? "");
  const [selectedChannel, setSelectedChannel] = useState("all");
  const [historyByDevice, setHistoryByDevice] = useState<Record<string, Telemetry[]>>({});
  const [status, setStatus] = useState<"loading" | "live" | "fallback">("loading");

  const selectedDevice = devices.find((device) => device.id === selectedDeviceId) ?? devices[0];
  const fallbackRows = useMemo(
    () => Object.values(initialLatest).filter((reading) => reading.device_id === selectedDevice?.id),
    [initialLatest, selectedDevice?.id]
  );
  const rows = historyByDevice[selectedDevice?.id ?? ""] ?? fallbackRows;
  const channels = Array.from(new Set([...fallbackRows, ...rows].map((reading) => reading.channel))).sort();
  const filteredRows = selectedChannel === "all" ? rows : rows.filter((reading) => reading.channel === selectedChannel);
  const historyChannel = selectedChannel === "all" ? undefined : selectedChannel;

  async function exportCsv(deviceOverride = selectedDevice, channelOverride = selectedChannel) {
    if (!deviceOverride) return;
    const exportChannel = channelOverride === "all" ? undefined : channelOverride;
    const csvUrl = accountMode ? api.historyCsvUrl(deviceOverride.id, exportChannel) : api.demoHistoryCsvUrl(deviceOverride.id, exportChannel);
    const session = getSession();
    const response = await fetch(csvUrl, {
      headers: accountMode && session ? { Authorization: `Bearer ${session.access_token}` } : undefined
    });
    if (!response.ok) throw new Error(await response.text());
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `spark-iot-${deviceOverride.id}-${channelOverride}-history.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  }

  useEffect(() => {
    if (!selectedDevice) return;
    let mounted = true;
    setStatus("loading");
    const historyRequest = accountMode ? api.history(selectedDevice.id, historyChannel) : api.demoHistory(selectedDevice.id, historyChannel);
    historyRequest
      .then((historyRows) => {
        if (!mounted) return;
        setHistoryByDevice((current) => ({ ...current, [selectedDevice.id]: historyRows.length ? historyRows : fallbackRows }));
        setStatus("live");
      })
      .catch(() => {
        if (!mounted) return;
        setHistoryByDevice((current) => ({ ...current, [selectedDevice.id]: fallbackRows }));
        setStatus("fallback");
      });
    return () => {
      mounted = false;
    };
  }, [accountMode, selectedDevice?.id, selectedChannel]);

  return (
    <section className="panel data-history-panel" data-testid="data-history-page">
      <div className="history-hero">
        <div>
          <span className="section-kicker">Data vault</span>
          <h2>30-day data history</h2>
          <p>Telemetry, GPS trails and chart data are retained for the Starter plan window and can be exported for reports or board debugging.</p>
        </div>
        <div className="history-status-card">
          <History size={18} />
          <strong>{filteredRows.length}</strong>
          <span>readings ready</span>
        </div>
      </div>

      <div className="history-controls" aria-label="History filters">
        <label>Device<select value={selectedDevice?.id ?? ""} onChange={(event) => { setSelectedDeviceId(event.target.value); setSelectedChannel("all"); }}>{devices.map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}</select></label>
        <label>Datastream<select value={selectedChannel} onChange={(event) => setSelectedChannel(event.target.value)}><option value="all">All channels</option>{channels.map((channel) => <option key={channel} value={channel}>{channel}</option>)}</select></label>
        <button className="action-button primary" type="button" onClick={() => void exportCsv()}><Download size={16} />Export CSV</button>
      </div>

      <div className="history-summary-grid">
        {devices.map((device) => {
          const deviceRows = historyByDevice[device.id] ?? Object.values(initialLatest).filter((reading) => reading.device_id === device.id);
          return <article key={device.id} className="history-device-card"><span className="status-dot" /><strong>{device.name}</strong><small>{device.board}</small><b>{deviceRows.length}</b><span>latest readings</span><button type="button" onClick={() => { setSelectedDeviceId(device.id); setSelectedChannel("all"); void exportCsv(device, "all"); }}>CSV</button></article>;
        })}
      </div>

      <div className="history-table-wrap">
        <table>
          <thead><tr><th>Time</th><th>Device</th><th>Channel</th><th>Value</th><th>Unit</th></tr></thead>
          <tbody>
            {filteredRows.map((reading) => <tr key={reading.id}><td>{formatTime(reading.observed_at)}</td><td>{selectedDevice?.name}</td><td>{reading.channel}</td><td>{formatValue(reading.value)}</td><td>{reading.unit ?? "--"}</td></tr>)}
            {!filteredRows.length && <tr><td colSpan={5}><RefreshCw size={16} /> No history yet. Publish MQTT telemetry from your board, then refresh this page.</td></tr>}
          </tbody>
        </table>
      </div>
      <p className="history-footnote">Status: {status === "live" ? "backend history loaded" : status === "fallback" ? "showing local demo latest while API is offline" : "loading history"}</p>
    </section>
  );
}
