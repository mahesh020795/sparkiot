import * as echarts from "echarts";
import { Battery, Camera, Circle, Clock, MapPinned, Power, Radio, Send, Sparkles, ToggleLeft } from "lucide-react";
import type React from "react";
import { useEffect, useRef } from "react";
import L from "leaflet";
import { api } from "../../lib/api";
import type { Device, Telemetry, WidgetConfig } from "../../lib/types";

export function Widget({ config, reading, devices, onCommand }: { config: WidgetConfig; reading?: Telemetry; devices: Device[]; onCommand?: (config: WidgetConfig, value: unknown) => void }) {
  const value = reading?.value as any;
  const raw = typeof value === "object" && value !== null && "raw" in value ? value.raw : value;
  const device = devices.find((item) => item.id === config.deviceId);
  if (config.type === "gauge" || config.type === "meter") return <GaugeWidget config={config} value={Number(raw ?? 0)} />;
  if (config.type === "chart") return <ChartWidget config={config} value={Number(raw ?? 0)} />;
  if (config.type === "gps") return <MapWidget config={config} value={value} />;
  if (config.type === "camera") return <CameraWidget config={config} value={value} />;
  if (config.type === "switch") return <ControlWidget icon={<ToggleLeft />} config={config} device={device} value={Boolean(raw)} onCommand={onCommand} />;
  if (config.type === "push_button") return <ControlWidget icon={<Send />} config={config} device={device} value={false} onCommand={onCommand} />;
  if (config.type === "led") return <ValuePanel icon={<Circle />} config={config} value={raw ? "ON" : "OFF"} accent={raw ? "green" : "grey"} />;
  if (config.type === "serial_lcd") return <ValuePanel icon={<Radio />} config={config} value={String(raw ?? "Waiting for serial data")} mono />;
  if (config.type === "battery") return <ValuePanel icon={<Battery />} config={config} value={`${raw ?? 87}%`} />;
  if (config.type === "signal") return <ValuePanel icon={<Radio />} config={config} value={`${raw ?? -64} dBm`} />;
  if (config.type === "date") return <ValuePanel icon={<Clock />} config={config} value={new Date().toLocaleDateString()} />;
  if (config.type === "time") return <ValuePanel icon={<Clock />} config={config} value={new Date().toLocaleTimeString()} />;
  if (config.type === "day") return <ValuePanel icon={<Clock />} config={config} value={new Date().toLocaleDateString(undefined, { weekday: "long" })} />;
  return <ValuePanel icon={<Power />} config={config} value={`${raw ?? "--"} ${config.unit ?? ""}`} />;
}

function GaugeWidget({ config, value }: { config: WidgetConfig; value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    const min = config.min ?? 0;
    const max = config.max ?? 100;
    const accent = config.color ?? "#2563eb";
    chartRef.current?.setOption({
      backgroundColor: "transparent",
      series: [{
        type: "gauge",
        min,
        max,
        startAngle: 215,
        endAngle: -35,
        radius: "96%",
        center: ["50%", "58%"],
        progress: { show: true, width: 18, roundCap: true, itemStyle: { color: accent } },
        axisLine: { roundCap: true, lineStyle: { width: 18, color: [[1, "#edf1f7"]] } },
        axisTick: { distance: -26, length: 5, lineStyle: { color: "#c9d3e2", width: 1 } },
        splitLine: { distance: -30, length: 12, lineStyle: { color: "#9aa6b8", width: 2 } },
        axisLabel: { distance: -8, color: "#667085", fontSize: 10, fontWeight: 800 },
        pointer: { show: true, length: "58%", width: 5, itemStyle: { color: "#111827" } },
        anchor: { show: true, size: 12, itemStyle: { color: "#111827", borderColor: "#ffffff", borderWidth: 3 } },
        detail: { formatter: `{value}${config.unit ?? ""}`, offsetCenter: [0, "42%"], color: "#111827", fontSize: 28, fontWeight: 900 },
        title: { show: false },
        data: [{ value }]
      }]
    });
  }, [config.max, config.min, config.unit, value]);

  useResizeSignal(ref, () => chartRef.current?.resize?.());

  return <article className={`widget widget-${config.type}`}><WidgetHeader config={config} /><div className="widget-live-value"><span>Live value</span><strong>{value}{config.unit ?? ""}</strong></div><div className="chart gauge-chart" ref={ref} /><WidgetFooter config={config} value={`${config.min ?? 0} - ${config.max ?? 100}${config.unit ? ` ${config.unit}` : ""}`} /></article>;
}

function ChartWidget({ config, value }: { config: WidgetConfig; value: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const chartRef = useRef<echarts.ECharts | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const chart = echarts.init(ref.current);
    chartRef.current = chart;
    return () => {
      chart.dispose();
      chartRef.current = null;
    };
  }, []);

  useEffect(() => {
    chartRef.current?.setOption({
      backgroundColor: "transparent",
      color: [config.color ?? "#2563eb"],
      grid: { top: 20, left: 30, right: 12, bottom: 24 },
      tooltip: { trigger: "axis" },
      xAxis: { type: "category", boundaryGap: false, data: ["-5m", "-4m", "-3m", "-2m", "now"], axisLine: { lineStyle: { color: "#d8e0ec" } }, axisLabel: { color: "#667085", fontWeight: 700 } },
      yAxis: { type: "value", splitLine: { lineStyle: { color: "#eef2f7" } }, axisLabel: { color: "#667085", fontWeight: 700 } },
      series: [{
        type: "line",
        smooth: true,
        symbol: "circle",
        symbolSize: 7,
        lineStyle: { width: 4 },
        areaStyle: { color: { type: "linear", x: 0, y: 0, x2: 0, y2: 1, colorStops: [{ offset: 0, color: "rgba(37,99,235,0.18)" }, { offset: 1, color: "rgba(37,99,235,0.02)" }] } },
        data: [value - 2, value - 1, value, value + 1, value]
      }]
    });
  }, [value]);

  useResizeSignal(ref, () => chartRef.current?.resize?.());

  return <article className="widget widget-chart"><WidgetHeader config={config} /><div className="widget-live-value compact"><span>Trend</span><strong>{value}{config.unit ?? ""}</strong></div><div className="chart" ref={ref} /><WidgetFooter config={config} value="5-point demo history" /></article>;
}

function MapWidget({ config, value }: { config: WidgetConfig; value: any }) {
  const ref = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const lat = Number(value?.lat ?? 3.139);
    const lng = Number(value?.lng ?? 101.6869);
    const map = L.map(ref.current, { zoomControl: false }).setView([lat, lng], 14);
    mapRef.current = map;
    L.tileLayer(import.meta.env.VITE_MAP_TILE_URL ?? "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", { attribution: import.meta.env.VITE_MAP_ATTRIBUTION ?? "OpenStreetMap" }).addTo(map);
    L.marker([lat, lng]).addTo(map);
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, [value]);

  useResizeSignal(ref, () => mapRef.current?.invalidateSize?.());

  return <article className="widget widget-gps"><WidgetHeader config={config} icon={<MapPinned size={16} />} /><div className="media-frame"><div className="map" ref={ref} /></div><WidgetFooter config={config} value="GPS map access included" /></article>;
}

function CameraWidget({ config, value }: { config: WidgetConfig; value: any }) {
  return <article className="widget widget-camera"><WidgetHeader config={config} icon={<Camera size={16} />} /><div className="media-frame camera-frame"><img className="camera" src={value?.url ?? "https://placehold.co/640x360?text=ESP32-CAM"} alt="Camera snapshot" /><span className="camera-live-badge">Snapshot</span></div><WidgetFooter config={config} value="Direct camera URL" /></article>;
}

function ControlWidget({ config, device, value, icon, onCommand }: { config: WidgetConfig; device?: Device; value: boolean; icon: React.ReactNode; onCommand?: (config: WidgetConfig, value: unknown) => void }) {
  const isPush = config.type === "push_button";
  function sendCommand() {
    const nextValue = isPush ? true : !value;
    if (onCommand) {
      onCommand(config, nextValue);
      return;
    }
    if (device) void api.command(device.id, config.channel, nextValue);
  }
  return <article className={`widget control widget-${config.type}`}><WidgetHeader config={config} icon={icon} /><div className="command-surface-label">Command surface</div><button className={value ? "toggle on" : "toggle"} onClick={sendCommand}><span className="toggle-track"><span className="toggle-dot" /></span><span className="toggle-copy"><strong>{isPush ? "SEND" : value ? "ON" : "OFF"}</strong><small>{value ? "Command active" : "Ready to send"}</small></span></button><WidgetFooter config={config} value={device?.name ?? "Demo device"} /></article>;
}

function ValuePanel({ config, value, icon, mono, accent }: { config: WidgetConfig; value: string; icon: React.ReactNode; mono?: boolean; accent?: string }) {
  return <article className={`widget value-widget widget-${config.type} ${accent ?? ""}`} style={{ ["--widget-accent" as string]: config.color ?? "#e3e8f0", textAlign: config.align ?? "left" }}><WidgetHeader config={config} icon={icon} /><div className="value-display"><span>Live value</span><strong className={mono ? "mono" : ""}>{value}</strong></div><WidgetFooter config={config} value="Latest telemetry" /></article>;
}

function WidgetHeader({ config, icon }: { config: WidgetConfig; icon?: React.ReactNode }) {
  const typeLabel = config.type.replace(/_/g, " ");
  return (
    <header className="widget-header">
      <span className="widget-icon">{icon ?? <Sparkles size={16} />}</span>
      <span className="widget-title-wrap">
        <span>{config.title}</span>
        <small>{typeLabel}</small>
      </span>
      <span className="channel-badge">{config.channel}{config.unit ? ` / ${config.unit}` : ""}</span>
    </header>
  );
}

function WidgetFooter({ config, value }: { config: WidgetConfig; value: string }) {
  return <footer className="widget-footer"><span>{config.channel}</span><small>{value}</small></footer>;
}

function useResizeSignal(ref: React.RefObject<HTMLElement | null>, onResize: () => void) {
  useEffect(() => {
    const element = ref.current;
    if (!element || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => {
      if (typeof requestAnimationFrame === "function") {
        requestAnimationFrame(onResize);
      } else {
        onResize();
      }
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [onResize, ref]);
}
