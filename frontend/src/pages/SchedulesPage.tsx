import { CalendarClock, Repeat2 } from "lucide-react";
import { useState } from "react";
import type { Device, Project, ScheduleCreate, ScheduleItem } from "../lib/types";

type Props = {
  accountMode: boolean;
  projects: Project[];
  devices: Device[];
  schedules: ScheduleItem[];
  selectedProjectId: string;
  onCreateSchedule: (schedule: ScheduleCreate) => Promise<ScheduleItem>;
};

const demoSchedules: ScheduleItem[] = [
  {
    id: "demo-irrigation-morning",
    project_id: "project-irrigation",
    device_id: "device-irrigation",
    channel: "V3",
    value: true,
    time_of_day: "06:00",
    recurrence: "mon,wed,fri",
    timezone: "Asia/Kuala_Lumpur",
    is_active: true
  },
  {
    id: "demo-irrigation-evening-off",
    project_id: "project-irrigation",
    device_id: "device-irrigation",
    channel: "V3",
    value: false,
    time_of_day: "18:30",
    recurrence: "daily",
    timezone: "Asia/Kuala_Lumpur",
    is_active: true
  }
];

export function SchedulesPage({ accountMode, projects, devices, schedules, selectedProjectId, onCreateSchedule }: Props) {
  const firstProject = projects.find((project) => project.id === selectedProjectId) ?? projects[0];
  const availableDevices = devices.filter((device) => !firstProject || device.project_id === firstProject.id);
  const firstDevice = availableDevices[0] ?? devices[0];
  const visibleSchedules = accountMode ? schedules : demoSchedules;
  const [localDemoSchedules, setLocalDemoSchedules] = useState<ScheduleItem[]>(demoSchedules);
  const [deviceId, setDeviceId] = useState(firstDevice?.id ?? "");
  const [channel, setChannel] = useState("V3");
  const [commandValue, setCommandValue] = useState("true");
  const [timeOfDay, setTimeOfDay] = useState("06:00");
  const [recurrence, setRecurrence] = useState("mon,wed,fri");
  const [timezone, setTimezone] = useState("Asia/Kuala_Lumpur");
  const [createState, setCreateState] = useState<"idle" | "saving" | "saved" | "error">("idle");

  const currentDevice = devices.find((device) => device.id === deviceId) ?? firstDevice;
  const currentProject = projects.find((project) => project.id === currentDevice?.project_id) ?? firstProject;
  const renderedSchedules = accountMode ? visibleSchedules : localDemoSchedules;

  async function handleCreate() {
    const nextSchedule: ScheduleCreate = {
      project_id: currentProject?.id ?? selectedProjectId,
      device_id: currentDevice?.id ?? deviceId,
      channel: channel.trim() || "V3",
      value: parseCommandValue(commandValue),
      time_of_day: timeOfDay,
      recurrence,
      timezone,
      is_active: true
    };
    if (!accountMode) {
      setLocalDemoSchedules((current) => [
        { ...nextSchedule, id: `demo-schedule-${Date.now()}` },
        ...current
      ]);
      setCreateState("saved");
      return;
    }
    setCreateState("saving");
    try {
      await onCreateSchedule(nextSchedule);
      setCreateState("saved");
    } catch {
      setCreateState("error");
    }
  }

  return (
    <section className="support-page schedule-system-page" data-testid="schedules-page">
      <section className="schedule-workbench schedule-workbench-single" data-testid="schedule-workbench">
        <article className="panel schedule-form-card">
          <div className="panel-title">
            <CalendarClock size={18} />
            <h2>Create board timer</h2>
          </div>
          <p>Pick the device, virtual pin, command value, day pattern and local time. The worker publishes the command to the device topic when due.</p>
          <div className="schedule-form-grid">
            <label>
              <span>Device</span>
              <select aria-label="Device" value={deviceId} onChange={(event) => setDeviceId(event.target.value)}>
                {(availableDevices.length ? availableDevices : devices).map((device) => <option key={device.id} value={device.id}>{device.name}</option>)}
              </select>
            </label>
            <label>
              <span>Virtual pin</span>
              <input aria-label="Virtual pin" value={channel} onChange={(event) => setChannel(event.target.value.toUpperCase())} />
            </label>
            <label>
              <span>Command value</span>
              <select aria-label="Command value" value={commandValue} onChange={(event) => setCommandValue(event.target.value)}>
                <option value="true">true</option>
                <option value="false">false</option>
                <option value="1">1</option>
                <option value="0">0</option>
              </select>
            </label>
            <label>
              <span>Run time</span>
              <input aria-label="Run time" type="time" value={timeOfDay} onChange={(event) => setTimeOfDay(event.target.value)} />
            </label>
            <label>
              <span>Repeat</span>
              <select aria-label="Repeat" value={recurrence} onChange={(event) => setRecurrence(event.target.value)}>
                <option value="daily">Daily</option>
                <option value="weekdays">Weekdays</option>
                <option value="weekends">Weekends</option>
                <option value="mon,wed,fri">Mon, Wed, Fri</option>
                <option value="tue,thu,sat">Tue, Thu, Sat</option>
              </select>
            </label>
            <label>
              <span>Timezone</span>
              <input aria-label="Timezone" value={timezone} onChange={(event) => setTimezone(event.target.value)} />
            </label>
          </div>
          <div className="schedule-topic-preview">
            <span>Command topic</span>
            <code>{(currentDevice?.command_topic ?? "spark/v1/demo-tenant/device-irrigation/command/{channel}").replace("{channel}", channel || "V3")}</code>
          </div>
          <button className="primary schedule-create-button" type="button" onClick={handleCreate} disabled={createState === "saving"}>
            <Repeat2 size={16} />
            {accountMode ? "Create live schedule" : "Add demo schedule"}
          </button>
          <span className={`schedule-create-state ${createState}`}>{formatCreateState(createState, accountMode)}</span>
        </article>

      </section>

      <section className="schedule-list-grid">
        {renderedSchedules.length ? renderedSchedules.map((schedule) => (
          <ScheduleCard
            key={schedule.id}
            schedule={schedule}
            project={projects.find((project) => project.id === schedule.project_id)}
            device={devices.find((device) => device.id === schedule.device_id)}
          />
        )) : (
          <article className="panel empty-state">
            <strong>No schedules yet</strong>
            <p>Create a timer to automate a relay, pump, LED, fan or virtual status output.</p>
          </article>
        )}
      </section>
    </section>
  );
}

function ScheduleCard({ schedule, project, device }: { schedule: ScheduleItem; project?: Project; device?: Device }) {
  return (
    <article className="panel schedule-card">
      <div className="schedule-card-head">
        <span className="schedule-icon"><CalendarClock size={18} /></span>
        <div>
          <h2>{scheduleTitle(schedule, project)}</h2>
          <small>{device?.name ?? schedule.device_id}</small>
        </div>
        <span className={schedule.is_active ? "pill online-pill" : "pill"}>{schedule.is_active ? "Active" : "Paused"}</span>
      </div>
      <div className="schedule-time-row">
        <strong>{schedule.time_of_day}</strong>
        <span>{schedule.recurrence}</span>
      </div>
      <div className="schedule-command-row">
        <span><small>Pin</small><strong>{schedule.channel}</strong></span>
        <span><small>Value</small><strong>{String(schedule.value)}</strong></span>
        <span><small>Timezone</small><strong>{schedule.timezone}</strong></span>
      </div>
      <code>{(device?.command_topic ?? "spark/v1/demo-tenant/device/command/{channel}").replace("{channel}", schedule.channel)}</code>
      <small className="schedule-id">{schedule.id}</small>
    </article>
  );
}

function scheduleTitle(schedule: ScheduleItem, project?: Project) {
  if (schedule.id === "demo-irrigation-morning") return "Irrigation morning run";
  if (schedule.id === "demo-irrigation-evening-off") return "Irrigation evening stop";
  const base = project?.name ?? "Device";
  const noun = schedule.channel === "V4" ? "fan" : schedule.channel === "V3" ? "pump" : "timer";
  return `${base} ${noun}`;
}

function parseCommandValue(value: string) {
  if (value === "true") return true;
  if (value === "false") return false;
  const numeric = Number(value);
  return Number.isNaN(numeric) ? value : numeric;
}

function formatCreateState(state: "idle" | "saving" | "saved" | "error", accountMode: boolean) {
  if (state === "saving") return "Saving schedule...";
  if (state === "saved") return accountMode ? "Live schedule created" : "Demo schedule added";
  if (state === "error") return "Schedule creation failed";
  return accountMode ? "Ready to create a protected schedule" : "Demo mode does not touch the backend";
}
