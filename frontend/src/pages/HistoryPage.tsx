import { Download, History, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "../lib/api";
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
  const csvUrl = selectedDevice ? (accountMode ? api.historyCsvUrl(selectedDevice.id, historyChannel) : api.demoHistoryCsvUrl(selectedDevice.id, historyChannel)) : "#";

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
        <a className="action-button primary" href={csvUrl} download><Download size={16} />Export CSV</a>
      </div>

      <div className="history-summary-grid">
        {devices.map((device) => {
          const deviceRows = historyByDevice[device.id] ?? Object.values(initialLatest).filter((reading) => reading.device_id === device.id);
          return <article key={device.id} className="history-device-card"><span className="status-dot" /><strong>{device.name}</strong><small>{device.board}</small><b>{deviceRows.length}</b><span>latest readings</span><a href={accountMode ? api.historyCsvUrl(device.id) : api.demoHistoryCsvUrl(device.id)} download>CSV</a></article>;
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
