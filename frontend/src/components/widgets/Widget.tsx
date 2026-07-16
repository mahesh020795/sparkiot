import * as echarts from "echarts";
import { Battery, CalendarDays, Camera, Circle, Clock, Droplets, Gauge, MapPinned, PlugZap, Power, Radio, Send, Shield, Signal, SlidersHorizontal, Sparkles, Thermometer, ToggleLeft, Zap } from "lucide-react";
import type React from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import { api } from "../../lib/api";
import type { Device, Telemetry, WidgetConfig } from "../../lib/types";

const WEEK_DAYS = [
  { key: "monday", short: "M", label: "Monday" },
  { key: "tuesday", short: "T", label: "Tuesday" },
  { key: "wednesday", short: "W", label: "Wednesday" },
  { key: "thursday", short: "T", label: "Thursday" },
  { key: "friday", short: "F", label: "Friday" },
  { key: "saturday", short: "S", label: "Saturday" },
  { key: "sunday", short: "S", label: "Sunday" }
];

export function Widget({ config, reading, devices, onCommand }: { config: WidgetConfig; reading?: Telemetry; devices: Device[]; onCommand?: (config: WidgetConfig, value: unknown) => void }) {
  const value = reading?.value as any;
  const raw = typeof value === "object" && value !== null && "raw" in value ? value.raw : value;
  const device = devices.find((item) => item.id === config.deviceId);
  if (config.type === "gauge" || config.type === "meter") return <GaugeWidget config={config} value={Number(raw ?? 0)} />;
  if (config.type === "chart") return <ChartWidget config={config} value={Number(raw ?? 0)} />;
  if (config.type === "gps") return <MapWidget config={config} value={value} />;
  if (config.type === "camera") return <CameraWidget config={config} value={value} />;
  if (config.type === "schedule") return <ScheduleWidget config={config} value={value} onCommand={onCommand} />;
  if (config.type === "power_hub") return <PowerHubWidget config={config} value={Number(raw ?? 12.4)} />;
  if (config.type === "event_monitor") return <EventMonitorWidget config={config} value={String(raw ?? "")} />;
  if (config.type === "switch") return <ControlWidget icon={<ToggleLeft />} config={config} device={device} value={Boolean(raw)} onCommand={onCommand} />;
  if (config.type === "push_button") return <ControlWidget icon={<Send />} config={config} device={device} value={false} onCommand={onCommand} />;
  if (config.type === "led") return <ValuePanel icon={<Circle />} config={config} value={raw ? "ON" : "OFF"} accent={raw ? "green" : "grey"} />;
  if (config.type === "serial_lcd") return <ValuePanel icon={<Radio />} config={config} value={String(raw ?? "Waiting for serial data")} mono />;
  if (config.type === "battery") return <ValuePanel icon={<Battery />} config={config} value={`${raw ?? 87}%`} />;
  if (config.type === "signal") return <ValuePanel icon={<Radio />} config={config} value={`${raw ?? -64} dBm`} />;
  if (config.type === "date" || config.type === "time" || config.type === "day") return <InputWidget config={config} value={raw} onCommand={onCommand} />;
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

  const isPressure = config.title.toLowerCase().includes("pressure");
  return <article className={`widget spark-widget-card widget-${config.type}`}><WidgetHeader config={config} /><div className="widget-live-value"><span>Live value</span><strong>{value}{config.unit ?? ""}</strong></div><div className="chart gauge-chart" ref={ref} /><WidgetFooter config={config} value={isPressure ? "PRESSURE OPTIMAL & SYSTEM NOMINAL" : `${config.min ?? 0} - ${config.max ?? 100}${config.unit ? ` ${config.unit}` : ""}`} /></article>;
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

  return <article className="widget spark-widget-card widget-chart"><WidgetHeader config={config} /><div className="widget-live-value compact"><span>Trend</span><strong>{value}{config.unit ?? ""}</strong></div><div className="chart" ref={ref} /><WidgetFooter config={config} value="5-point demo history" /></article>;
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

  return <article className="widget spark-widget-card widget-gps cockpit-media-widget"><WidgetHeader config={config} icon={<MapPinned size={16} />} /><div className="media-frame"><div className="map" ref={ref} /></div><WidgetFooter config={config} value="Click on map nodes to override solenoid output" label="SPATIAL MAP" /></article>;
}

function CameraWidget({ config, value }: { config: WidgetConfig; value: any }) {
  return <article className="widget spark-widget-card widget-camera cockpit-media-widget"><WidgetHeader config={config} icon={<Camera size={16} />} /><div className="media-frame camera-frame"><img className="camera" src={value?.url ?? "https://placehold.co/640x360?text=ESP32-CAM"} alt="Camera snapshot" /><span className="camera-live-badge">Video out</span></div><WidgetFooter config={config} value="Use PTZ overlays to shift simulated camera horizon" label="VIDEO OUT" /></article>;
}

function ScheduleWidget({ config, value, onCommand }: { config: WidgetConfig; value: any; onCommand?: (config: WidgetConfig, value: unknown) => void }) {
  const defaultDays = useMemo(() => normalizeScheduleDays(value?.days), [value?.days]);
  const defaultTimes = useMemo(() => normalizeScheduleTimes(value?.times), [value?.times]);
  const [selectedDays, setSelectedDays] = useState<Set<string>>(() => new Set(defaultDays));
  const [times, setTimes] = useState<string[]>(defaultTimes);
  const [selectedTimeIndex, setSelectedTimeIndex] = useState(0);

  useEffect(() => {
    setSelectedDays(new Set(defaultDays));
    setTimes(defaultTimes);
  }, [defaultDays, defaultTimes]);

  function commitSchedule(nextDays: Set<string>, nextTimes: string[]) {
    onCommand?.(config, { days: Array.from(nextDays), times: nextTimes });
  }

  function toggleDay(day: string) {
    setSelectedDays((current) => {
      const next = new Set(current);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      commitSchedule(next, times);
      return next;
    });
  }

  function updateSelectedTime(nextTime: string) {
    setTimes((current) => {
      const next = current.map((time, index) => index === selectedTimeIndex ? nextTime : time);
      commitSchedule(selectedDays, next);
      return next;
    });
  }

  return (
    <article className="widget spark-widget-card widget-schedule">
      <WidgetHeader config={config} icon={<CalendarDays size={16} />} />
      <div className="schedule-body">
        <label>1. Selected days</label>
        <div className="schedule-days">
          {WEEK_DAYS.map((day) => {
            const scheduleKey = day.key.slice(0, 3);
            const active = selectedDays.has(scheduleKey);
            return (
              <button
                type="button"
                className={active ? "active" : ""}
                aria-pressed={active}
                aria-label={`${active ? "Disable" : "Enable"} ${day.label}`}
                key={day.key}
                onClick={() => toggleDay(scheduleKey)}
              >
                {day.short}
              </button>
            );
          })}
        </div>
        <label>2. Daily time cycles</label>
        <div className="schedule-times">
          {times.map((time, index) => (
            <button
              type="button"
              className={selectedTimeIndex === index ? "active" : ""}
              aria-pressed={selectedTimeIndex === index}
              aria-label={`Edit ${formatScheduleTime(time)} cycle`}
              key={`${time}-${index}`}
              onClick={() => setSelectedTimeIndex(index)}
            >
              {formatScheduleTime(time)}
            </button>
          ))}
        </div>
        <input
          aria-label="Selected cycle time"
          className="schedule-time-input"
          type="time"
          value={times[selectedTimeIndex] ?? "06:00"}
          onChange={(event) => updateSelectedTime(event.target.value)}
        />
      </div>
      <WidgetFooter config={config} value="bypasses schedule on rain" label="SMART TRIGGER" />
    </article>
  );
}

function normalizeScheduleDays(days: unknown): string[] {
  if (!Array.isArray(days)) return ["mon", "wed", "fri"];
  const aliases: Record<string, string> = {
    M: "mon",
    MON: "mon",
    MONDAY: "mon",
    TUE: "tue",
    TUESDAY: "tue",
    W: "wed",
    WED: "wed",
    WEDNESDAY: "wed",
    THU: "thu",
    THURSDAY: "thu",
    F: "fri",
    FRI: "fri",
    FRIDAY: "fri",
    SAT: "sat",
    SATURDAY: "sat",
    SUN: "sun",
    SUNDAY: "sun"
  };
  const normalized = days
    .map((day) => aliases[String(day).trim().toUpperCase()] ?? String(day).trim().toLowerCase())
    .filter((day) => ["mon", "tue", "wed", "thu", "fri", "sat", "sun"].includes(day));
  return normalized.length ? Array.from(new Set(normalized)) : ["mon", "wed", "fri"];
}

function normalizeScheduleTimes(times: unknown): string[] {
  if (!Array.isArray(times)) return ["06:00", "12:00", "18:00"];
  const normalized = times.map((time) => parseScheduleTime(String(time))).filter(Boolean);
  return normalized.length ? normalized.slice(0, 4) : ["06:00", "12:00", "18:00"];
}

function parseScheduleTime(time: string): string {
  const trimmed = time.trim();
  const direct = trimmed.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
  if (direct) return trimmed;
  const twelveHour = trimmed.match(/^(\d{1,2}):([0-5]\d)\s*(AM|PM)$/i);
  if (!twelveHour) return "";
  let hour = Number(twelveHour[1]);
  const minute = twelveHour[2];
  const meridiem = twelveHour[3].toUpperCase();
  if (meridiem === "PM" && hour < 12) hour += 12;
  if (meridiem === "AM" && hour === 12) hour = 0;
  return `${String(hour).padStart(2, "0")}:${minute}`;
}

function formatScheduleTime(time: string): string {
  const [hourText, minute = "00"] = parseScheduleTime(time).split(":");
  const hour = Number(hourText);
  const displayHour = hour % 12 || 12;
  const meridiem = hour >= 12 ? "PM" : "AM";
  return `${String(displayHour).padStart(2, "0")}:${minute} ${meridiem}`;
}

function PowerHubWidget({ config, value }: { config: WidgetConfig; value: number }) {
  return (
    <article className="widget spark-widget-card widget-power-hub">
      <WidgetHeader config={config} icon={<PlugZap size={16} />} />
      <div className="power-hub-body">
        <div><span>Capacity</span><strong>88%</strong></div>
        <div className="capacity-bar"><span style={{ width: "88%" }} /></div>
        <div><span>Terminal Output</span><strong>{value.toFixed(1)} V</strong></div>
      </div>
      <WidgetFooter config={config} value="telemetry stack nominal" label="POWER BUS" />
    </article>
  );
}

function EventMonitorWidget({ config, value }: { config: WidgetConfig; value: string }) {
  const lines = value.split("\n").filter(Boolean);
  return (
    <article className="widget spark-widget-card widget-event-monitor">
      <WidgetHeader config={config} icon={<Shield size={16} />} />
      <div className="event-console">
        {lines.map((line) => <span className={line.includes("WARN") ? "warn" : line.includes("INFO") ? "info" : "ok"} key={line}>{line}</span>)}
      </div>
      <WidgetFooter config={config} value="systemlog" label="SYSLOG V8" />
    </article>
  );
}

function InputWidget({ config, value, onCommand }: { config: WidgetConfig; value: unknown; onCommand?: (config: WidgetConfig, value: unknown) => void }) {
  const fallback = config.type === "date" ? new Date().toISOString().slice(0, 10) : config.type === "time" ? "06:00" : "monday";
  const currentValue = normalizeInputValue(config.type, value, fallback);
  function updateValue(nextValue: string) {
    onCommand?.(config, nextValue);
  }
  if (config.type === "day") {
    return (
      <article className="widget spark-widget-card widget-schedule widget-day">
        <WidgetHeader config={config} icon={<CalendarDays size={16} />} />
        <div className="schedule-body">
          <label>1. Selected day</label>
          <div className="schedule-days">
            {WEEK_DAYS.map((day) => {
              const active = currentValue === day.key;
              return (
                <button
                  type="button"
                  className={active ? "active" : ""}
                  aria-pressed={active}
                  aria-label={`Select ${day.label}`}
                  key={day.key}
                  onClick={() => updateValue(day.key)}
                >
                  {day.short}
                </button>
              );
            })}
          </div>
        </div>
        <WidgetFooter config={config} value="Saved dashboard input" label="COMMAND DAY" />
      </article>
    );
  }

  if (config.type === "time") {
    const presets = ["06:00", "12:00", "18:00"];
    return (
      <article className="widget spark-widget-card widget-schedule widget-time">
        <WidgetHeader config={config} icon={<Clock size={16} />} />
        <div className="schedule-body">
          <label>1. Command time</label>
          <div className="schedule-times">
            {presets.map((time) => (
              <button
                type="button"
                className={currentValue === time ? "active" : ""}
                aria-pressed={currentValue === time}
                aria-label={`Set ${formatScheduleTime(time)} command time`}
                key={time}
                onClick={() => updateValue(time)}
              >
                {formatScheduleTime(time)}
              </button>
            ))}
          </div>
          <input
            aria-label="Selected command time"
            className="schedule-time-input"
            type="time"
            value={currentValue}
            onChange={(event) => updateValue(event.target.value)}
          />
        </div>
        <WidgetFooter config={config} value="Saved dashboard input" label="COMMAND TIME" />
      </article>
    );
  }

  return (
    <article className="widget spark-widget-card widget-schedule widget-date">
      <WidgetHeader config={config} icon={<CalendarDays size={16} />} />
      <div className="schedule-body">
        <label>1. Command date</label>
        <input
          aria-label="Selected command date"
          className="schedule-time-input"
          type="date"
          value={currentValue}
          onChange={(event) => updateValue(event.target.value)}
        />
      </div>
      <WidgetFooter config={config} value="Saved dashboard input" label="COMMAND DATE" />
    </article>
  );
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
  const solenoid = config.title.toLowerCase().includes("solenoid");
  return <article className={`widget spark-widget-card control widget-${config.type}`}><WidgetHeader config={config} icon={solenoid ? <SlidersHorizontal /> : icon} /><div className="command-surface-label">{solenoid ? "Valve status" : "Command surface"}</div><button className={value ? "toggle on" : "toggle"} onClick={sendCommand}><span className="toggle-track"><span className="toggle-dot" /></span><span className="toggle-copy"><strong>{isPush ? "SEND" : value ? solenoid ? "OPEN (FLOW ENABLED)" : "ON" : solenoid ? "CLOSED (BLOCKED)" : "OFF"}</strong><small>{value ? "Command active" : "Ready to send"}</small></span></button><WidgetFooter config={config} value={solenoid ? "manual override" : device?.name ?? "Demo device"} /></article>;
}

function normalizeInputValue(type: string, value: unknown, fallback: string) {
  if (typeof value !== "string" || !value.trim()) return fallback;
  if (type === "date") {
    const direct = value.match(/^\d{4}-\d{2}-\d{2}$/);
    if (direct) return value;
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? fallback : parsed.toISOString().slice(0, 10);
  }
  if (type === "time") {
    const direct = value.match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (direct) return value;
    return parseScheduleTime(value) || fallback;
  }
  if (type === "day") return normalizeDayValue(value) || fallback;
  return value;
}

function normalizeDayValue(value: unknown) {
  const normalized = String(value ?? "").trim().toLowerCase();
  const aliases: Record<string, string> = {
    m: "monday",
    mon: "monday",
    monday: "monday",
    tue: "tuesday",
    tuesday: "tuesday",
    w: "wednesday",
    wed: "wednesday",
    wednesday: "wednesday",
    thu: "thursday",
    thursday: "thursday",
    f: "friday",
    fri: "friday",
    friday: "friday",
    sat: "saturday",
    saturday: "saturday",
    sun: "sunday",
    sunday: "sunday"
  };
  return aliases[normalized] ?? "";
}

function ValuePanel({ config, value, icon, mono, accent }: { config: WidgetConfig; value: string; icon: React.ReactNode; mono?: boolean; accent?: string }) {
  return <article className={`widget spark-widget-card value-widget widget-${config.type} ${accent ?? ""}`} style={{ ["--widget-accent" as string]: config.color ?? "#e3e8f0", textAlign: config.align ?? "left" }}><WidgetHeader config={config} icon={icon} /><div className="value-display"><span>Live value</span><strong className={mono ? "mono" : ""}>{value}</strong></div><WidgetFooter config={config} value="Latest telemetry" /></article>;
}

function WidgetHeader({ config, icon }: { config: WidgetConfig; icon?: React.ReactNode }) {
  const typeLabel = config.type.replace(/_/g, " ");
  return (
    <header className="widget-header">
      <span className="widget-icon">{icon ?? iconForWidget(config)}</span>
      <span className="widget-title-wrap">
        <span>{config.title}</span>
        <small>{typeLabel}</small>
      </span>
      <span className="channel-badge">{config.channel}{config.unit ? ` / ${config.unit}` : ""}</span>
    </header>
  );
}

function WidgetFooter({ config, value, label }: { config: WidgetConfig; value: string; label?: string }) {
  return <footer className="widget-footer"><span>{label ?? config.channel}</span><small>{value}</small></footer>;
}

function iconForWidget(config: WidgetConfig) {
  const title = config.title.toLowerCase();
  if (title.includes("temp")) return <Thermometer size={16} />;
  if (title.includes("humidity") || title.includes("moisture") || title.includes("water")) return <Droplets size={16} />;
  if (title.includes("pressure") || title.includes("flow")) return <Gauge size={16} />;
  if (title.includes("schedule")) return <CalendarDays size={16} />;
  if (title.includes("solenoid")) return <SlidersHorizontal size={16} />;
  if (title.includes("event")) return <Shield size={16} />;
  if (title.includes("voltage") || title.includes("power") || title.includes("current")) return <Zap size={16} />;
  if (config.type === "meter" || config.type === "gauge") return <Gauge size={16} />;
  if (config.type === "battery") return <Battery size={16} />;
  if (config.type === "signal") return <Signal size={16} />;
  return <Sparkles size={16} />;
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
