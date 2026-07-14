import { Download } from "lucide-react";
import type { Device } from "../lib/types";

export function HistoryPage({ devices }: { devices: Device[] }) {
  return <section className="panel data-history-panel"><span className="section-kicker">Data vault</span><h2>30-day data history</h2><p>Telemetry, GPS trails and chart data are retained for the Starter plan window.</p><table><thead><tr><th>Device</th><th>Board</th><th>Export</th></tr></thead><tbody>{devices.map((device) => <tr key={device.id}><td>{device.name}</td><td>{device.board}</td><td><button><Download size={16} />CSV</button></td></tr>)}</tbody></table></section>;
}
