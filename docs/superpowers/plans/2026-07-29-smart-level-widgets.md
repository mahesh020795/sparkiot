# Smart Level Widgets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Spark IoT premium light-mode Tank Level, Flood Level, and Threshold Monitor widgets that work in Template Studio, dashboard rendering, saved widget JSON, demo/live telemetry, and tests.

**Architecture:** Keep the current frontend-first widget JSON architecture. Extend `WidgetConfig` with optional visual metadata, add focused pure helpers for level status calculations, render the three widget components inside `frontend/src/components/widgets/Widget.tsx`, and wire Template Studio’s widget library/add/inspector flow to create and edit them. No backend migration is required because dashboards already persist flexible widget JSON.

**Tech Stack:** React, TypeScript, Vitest, React Testing Library, existing Spark IoT CSS, existing dashboard widget JSON, existing telemetry value resolution.

## Global Constraints

- Follow Spark IoT light SaaS style: white cards, blue accent language, soft borders, consistent typography, clear status badges, and no dark industrial theme.
- Add three widgets: Tank Level, Flood Level, Threshold Monitor.
- Add widgets under Output Widgets in Template Studio.
- Use existing dashboard widget JSON configuration and existing datastream model.
- Do not add billing enforcement by widget group in v1.
- Do not add 3D animated tank, complex flood map overlay, or backend schema migration.
- Status colors: Safe/Normal green, Warning amber, Danger/Critical red, Offline/No data slate.
- Every production behavior change must be covered by tests first.

---

## File Structure

- Modify `frontend/src/lib/types.ts`
  - Add optional widget metadata fields used by the three widgets: `warningThreshold`, `dangerThreshold`, `capacity`, `location`, `statusLabel`.
- Create `frontend/src/components/widgets/levelWidgets.ts`
  - Pure helper functions for numeric extraction, percentage calculation, status classification, and display text.
- Modify `frontend/src/components/widgets/Widget.tsx`
  - Route `tank_level`, `flood_level`, and `threshold_monitor`.
  - Render the three new widgets.
- Modify `frontend/src/components/widgets/Widget.test.tsx`
  - Add focused unit tests for helper behavior and rendered widgets.
- Modify `frontend/src/pages/TemplateStudioPage.tsx`
  - Add the three widget types to Output Widgets.
  - Add default datastream/widget sizing/settings.
  - Add inspector fields for thresholds, capacity, and location.
- Modify `frontend/src/App.test.tsx`
  - Add integration coverage that Template Studio can add the new widgets.
- Modify `frontend/src/styles/app.css`
  - Add Spark IoT light-mode styles for the widgets and inspector fields.
- Modify `docs/SPARK_IOT_HANDOFF.md`
  - Document the new smart widget behavior for future AI/dev handoff.

---

### Task 1: Add level widget types and pure status helpers

**Files:**
- Modify: `frontend/src/lib/types.ts`
- Create: `frontend/src/components/widgets/levelWidgets.ts`
- Test: `frontend/src/components/widgets/Widget.test.tsx`

**Interfaces:**
- Consumes: `WidgetConfig` from `frontend/src/lib/types.ts`
- Produces:
  - `type LevelStatus = "no_data" | "safe" | "warning" | "danger"`
  - `function numericWidgetValue(value: unknown): number | null`
  - `function levelPercent(value: number | null, min: number, max: number): number | null`
  - `function levelStatus(value: number | null, warningThreshold?: number, dangerThreshold?: number): LevelStatus`
  - `function levelStatusLabel(status: LevelStatus): string`

- [ ] **Step 1: Write failing helper tests**

Add to `frontend/src/components/widgets/Widget.test.tsx`:

```ts
import { levelPercent, levelStatus, numericWidgetValue } from "./levelWidgets";

it("normalizes level values and classifies safe warning and danger states", () => {
  expect(numericWidgetValue({ raw: 72 })).toBe(72);
  expect(numericWidgetValue("0.85")).toBe(0.85);
  expect(numericWidgetValue("offline")).toBeNull();

  expect(levelPercent(72, 0, 100)).toBe(72);
  expect(levelPercent(120, 0, 100)).toBe(100);
  expect(levelPercent(-10, 0, 100)).toBe(0);
  expect(levelPercent(null, 0, 100)).toBeNull();

  expect(levelStatus(0.85, 1.5, 2)).toBe("safe");
  expect(levelStatus(1.6, 1.5, 2)).toBe("warning");
  expect(levelStatus(2.1, 1.5, 2)).toBe("danger");
  expect(levelStatus(null, 1.5, 2)).toBe("no_data");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "normalizes level values"
```

Expected: FAIL because `./levelWidgets` does not exist.

- [ ] **Step 3: Extend `WidgetConfig`**

In `frontend/src/lib/types.ts`, add optional fields:

```ts
  warningThreshold?: number;
  dangerThreshold?: number;
  capacity?: number;
  location?: string;
  statusLabel?: string;
```

- [ ] **Step 4: Create helper implementation**

Create `frontend/src/components/widgets/levelWidgets.ts`:

```ts
export type LevelStatus = "no_data" | "safe" | "warning" | "danger";

export function numericWidgetValue(value: unknown): number | null {
  const raw = typeof value === "object" && value !== null && "raw" in value ? (value as { raw: unknown }).raw : value;
  const numeric = typeof raw === "number" ? raw : Number(raw);
  return Number.isFinite(numeric) ? numeric : null;
}

export function levelPercent(value: number | null, min: number, max: number): number | null {
  if (value === null) return null;
  if (max <= min) return 0;
  const percent = ((value - min) / (max - min)) * 100;
  return Math.max(0, Math.min(100, Math.round(percent)));
}

export function levelStatus(value: number | null, warningThreshold?: number, dangerThreshold?: number): LevelStatus {
  if (value === null) return "no_data";
  if (typeof dangerThreshold === "number" && value >= dangerThreshold) return "danger";
  if (typeof warningThreshold === "number" && value >= warningThreshold) return "warning";
  return "safe";
}

export function levelStatusLabel(status: LevelStatus): string {
  if (status === "danger") return "Danger";
  if (status === "warning") return "Warning";
  if (status === "safe") return "Normal";
  return "No data";
}
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "normalizes level values"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/types.ts frontend/src/components/widgets/levelWidgets.ts frontend/src/components/widgets/Widget.test.tsx
git commit -m "feat: add level widget helpers"
```

---

### Task 2: Render Tank Level widget

**Files:**
- Modify: `frontend/src/components/widgets/Widget.tsx`
- Modify: `frontend/src/components/widgets/Widget.test.tsx`
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: `numericWidgetValue`, `levelPercent`, `levelStatus`, `levelStatusLabel`
- Produces: `tank_level` widget rendering path in `Widget`

- [ ] **Step 1: Write failing render test**

Add to `frontend/src/components/widgets/Widget.test.tsx`:

```ts
it("renders a Tank Level smart widget with fill, capacity and status", () => {
  const config: WidgetConfig = {
    id: "tank-widget",
    type: "tank_level",
    title: "Water Tank Level",
    x: 0,
    y: 0,
    w: 3,
    h: 3,
    deviceId: "device-1",
    channel: "V20",
    unit: "%",
    min: 0,
    max: 100,
    capacity: 1000,
    warningThreshold: 25,
    dangerThreshold: 10
  };

  render(<Widget config={config} reading={{ id: "t1", device_id: "device-1", channel: "V20", value: 72, unit: "%", observed_at: "2026-07-29T00:00:00Z", server_at: "2026-07-29T00:00:00Z" }} devices={[]} />);

  expect(screen.getByText("Water Tank Level")).toBeInTheDocument();
  expect(screen.getByText("72%")).toBeInTheDocument();
  expect(screen.getByText("720 / 1000 L")).toBeInTheDocument();
  expect(screen.getByText("Normal")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "Tank Level"
```

Expected: FAIL because `tank_level` falls through to the generic value widget.

- [ ] **Step 3: Implement `TankLevelWidget`**

In `Widget.tsx`:

```ts
import { levelPercent, levelStatus, levelStatusLabel, numericWidgetValue } from "./levelWidgets";
```

Route near the top of `Widget`:

```ts
if (config.type === "tank_level") return <TankLevelWidget config={config} value={numericWidgetValue(value)} />;
```

Add component:

```tsx
function TankLevelWidget({ config, value }: { config: WidgetConfig; value: number | null }) {
  const min = config.min ?? 0;
  const max = config.max ?? 100;
  const percent = levelPercent(value, min, max);
  const capacity = config.capacity ?? 1000;
  const currentVolume = percent === null ? null : Math.round((percent / 100) * capacity);
  const status = levelStatus(value, config.warningThreshold, config.dangerThreshold);
  const fill = percent ?? 0;

  return (
    <article className="widget spark-widget-card widget-tank-level">
      <WidgetHeader config={config} />
      <div className="tank-level-body">
        <div className="tank-visual" aria-label={`Tank fill ${percent ?? 0}%`}>
          <span className="tank-water" style={{ height: `${fill}%` }} />
        </div>
        <div className="tank-level-copy">
          <strong>{percent === null ? "--" : `${percent}%`}</strong>
          <span>{currentVolume === null ? "Waiting for level" : `${currentVolume} / ${capacity} L`}</span>
          <em className={`level-status level-status-${status}`}>{levelStatusLabel(status)}</em>
        </div>
      </div>
      <WidgetFooter config={config} value={`Capacity ${capacity} L`} />
    </article>
  );
}
```

- [ ] **Step 4: Add CSS**

In `frontend/src/styles/app.css` add:

```css
.widget-tank-level .tank-level-body {
  display: grid;
  grid-template-columns: 112px 1fr;
  gap: 24px;
  align-items: center;
  min-height: 220px;
}
.tank-visual {
  position: relative;
  width: 88px;
  height: 190px;
  margin: 0 auto;
  overflow: hidden;
  border: 2px solid #cbd5e1;
  border-radius: 26px;
  background: linear-gradient(180deg, #f8fbff, #eef5ff);
  box-shadow: inset 0 0 0 8px rgba(255,255,255,0.8), 0 18px 34px rgba(15,23,42,0.08);
}
.tank-water {
  position: absolute;
  left: 10px;
  right: 10px;
  bottom: 10px;
  border-radius: 18px 18px 22px 22px;
  background: linear-gradient(180deg, #60a5fa, #2563eb);
  box-shadow: inset 0 14px 22px rgba(255,255,255,0.22);
}
.tank-level-copy {
  display: grid;
  gap: 8px;
}
.tank-level-copy strong {
  color: #0f172a;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}
.tank-level-copy span {
  color: #64748b;
  font-weight: 850;
}
.level-status {
  width: fit-content;
  border-radius: 999px;
  padding: 7px 11px;
  font-size: 0.72rem;
  font-style: normal;
  font-weight: 900;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.level-status-safe { color: #047857; background: #ecfdf5; border: 1px solid #a7f3d0; }
.level-status-warning { color: #b45309; background: #fffbeb; border: 1px solid #fde68a; }
.level-status-danger { color: #be123c; background: #fff1f2; border: 1px solid #fecdd3; }
.level-status-no_data { color: #64748b; background: #f1f5f9; border: 1px solid #e2e8f0; }
```

- [ ] **Step 5: Run test to verify it passes**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "Tank Level"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/widgets/Widget.tsx frontend/src/components/widgets/Widget.test.tsx frontend/src/styles/app.css
git commit -m "feat: render tank level widget"
```

---

### Task 3: Render Flood Level and Threshold Monitor widgets

**Files:**
- Modify: `frontend/src/components/widgets/Widget.tsx`
- Modify: `frontend/src/components/widgets/Widget.test.tsx`
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: helpers from Task 1 and `WidgetFooter`, `WidgetHeader`
- Produces: `flood_level` and `threshold_monitor` widget rendering paths

- [ ] **Step 1: Write failing render tests**

Add to `Widget.test.tsx`:

```ts
it("renders a Flood Level smart widget with thresholds and location", () => {
  const config: WidgetConfig = {
    id: "flood-widget",
    type: "flood_level",
    title: "Flood Monitoring",
    x: 0,
    y: 0,
    w: 6,
    h: 3,
    deviceId: "device-1",
    channel: "V21",
    unit: "m",
    min: 0,
    max: 2.5,
    warningThreshold: 1.5,
    dangerThreshold: 2,
    location: "Riverside Area"
  };

  render(<Widget config={config} reading={{ id: "f1", device_id: "device-1", channel: "V21", value: 0.85, unit: "m", observed_at: "2026-07-29T03:00:00Z", server_at: "2026-07-29T03:00:00Z" }} devices={[]} />);

  expect(screen.getByText("Flood Monitoring")).toBeInTheDocument();
  expect(screen.getByText("0.85 m")).toBeInTheDocument();
  expect(screen.getByText("Riverside Area")).toBeInTheDocument();
  expect(screen.getByText("Danger 2 m")).toBeInTheDocument();
  expect(screen.getByText("Warning 1.5 m")).toBeInTheDocument();
});

it("renders a generic Threshold Monitor with warning and danger status", () => {
  const config: WidgetConfig = {
    id: "threshold-widget",
    type: "threshold_monitor",
    title: "Gas Level",
    x: 0,
    y: 0,
    w: 4,
    h: 3,
    deviceId: "device-1",
    channel: "V22",
    unit: "ppm",
    min: 0,
    max: 1000,
    warningThreshold: 600,
    dangerThreshold: 800
  };

  render(<Widget config={config} reading={{ id: "th1", device_id: "device-1", channel: "V22", value: 850, unit: "ppm", observed_at: "2026-07-29T03:00:00Z", server_at: "2026-07-29T03:00:00Z" }} devices={[]} />);

  expect(screen.getByText("Gas Level")).toBeInTheDocument();
  expect(screen.getByText("850 ppm")).toBeInTheDocument();
  expect(screen.getByText("Danger")).toBeInTheDocument();
  expect(screen.getByText("Warning at 600 ppm")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "Flood Level|Threshold Monitor"
```

Expected: FAIL because render paths do not exist.

- [ ] **Step 3: Implement routes and components**

In `Widget.tsx`, add routes:

```ts
if (config.type === "flood_level") return <FloodLevelWidget config={config} value={numericWidgetValue(value)} />;
if (config.type === "threshold_monitor") return <ThresholdMonitorWidget config={config} value={numericWidgetValue(value)} />;
```

Add components:

```tsx
function FloodLevelWidget({ config, value }: { config: WidgetConfig; value: number | null }) {
  const unit = config.unit ?? "m";
  const status = levelStatus(value, config.warningThreshold, config.dangerThreshold);
  const percent = levelPercent(value, config.min ?? 0, config.max ?? 2.5) ?? 0;
  const displayValue = value === null ? "--" : `${value.toFixed(value < 10 ? 2 : 0)} ${unit}`;

  return (
    <article className="widget spark-widget-card widget-flood-level">
      <WidgetHeader config={config} />
      <div className="flood-level-body">
        <div>
          <strong className="flood-value">{displayValue}</strong>
          <span className={`level-status level-status-${status}`}>{levelStatusLabel(status)}</span>
        </div>
        <div className="flood-channel" aria-label={`Flood level ${displayValue}`}>
          <span className="flood-water" style={{ height: `${Math.max(14, percent)}%` }} />
          <span className="flood-line flood-line-danger">Danger {config.dangerThreshold ?? 2} {unit}</span>
          <span className="flood-line flood-line-warning">Warning {config.warningThreshold ?? 1.5} {unit}</span>
        </div>
        <div className="flood-meta">
          <span><small>Location</small><strong>{config.location ?? "Site location"}</strong></span>
          <span><small>Updated</small><strong>Latest telemetry</strong></span>
        </div>
      </div>
      <WidgetFooter config={config} value="Water level safety monitor" />
    </article>
  );
}

function ThresholdMonitorWidget({ config, value }: { config: WidgetConfig; value: number | null }) {
  const unit = config.unit ?? "";
  const status = levelStatus(value, config.warningThreshold, config.dangerThreshold);
  const percent = levelPercent(value, config.min ?? 0, config.max ?? 100) ?? 0;
  const displayValue = value === null ? "--" : `${value}${unit ? ` ${unit}` : ""}`;

  return (
    <article className="widget spark-widget-card widget-threshold-monitor">
      <WidgetHeader config={config} />
      <div className="threshold-monitor-body">
        <span className={`level-status level-status-${status}`}>{levelStatusLabel(status)}</span>
        <strong>{displayValue}</strong>
        <div className="threshold-track" aria-label={`Threshold level ${percent}%`}>
          <span style={{ width: `${percent}%` }} />
        </div>
        <div className="threshold-copy">
          <span>Warning at {config.warningThreshold ?? 70}{unit ? ` ${unit}` : ""}</span>
          <span>Danger at {config.dangerThreshold ?? 90}{unit ? ` ${unit}` : ""}</span>
        </div>
      </div>
      <WidgetFooter config={config} value="Limit-based sensor health" />
    </article>
  );
}
```

- [ ] **Step 4: Add CSS**

Add focused CSS classes:

```css
.flood-level-body {
  display: grid;
  grid-template-columns: minmax(130px, 0.6fr) minmax(240px, 1.4fr) minmax(120px, 0.6fr);
  gap: 22px;
  align-items: center;
  min-height: 210px;
}
.flood-value {
  display: block;
  margin-bottom: 12px;
  color: #0891b2;
  font-size: clamp(2.2rem, 4vw, 3.8rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}
.flood-channel {
  position: relative;
  min-height: 160px;
  overflow: hidden;
  border: 1px solid #dbeafe;
  border-radius: 24px;
  background: linear-gradient(180deg, #f8fbff, #eef6ff);
}
.flood-water {
  position: absolute;
  left: 0;
  right: 0;
  bottom: 0;
  background: linear-gradient(180deg, rgba(56,189,248,0.7), rgba(37,99,235,0.85));
}
.flood-line {
  position: absolute;
  right: 14px;
  padding-left: 12px;
  border-top: 1px dashed currentColor;
  font-size: 0.72rem;
  font-weight: 900;
}
.flood-line-danger { top: 22%; color: #dc2626; }
.flood-line-warning { top: 42%; color: #d97706; }
.flood-meta {
  display: grid;
  gap: 14px;
  color: #64748b;
}
.flood-meta small,
.threshold-copy span {
  color: #94a3b8;
  font-size: 0.72rem;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.flood-meta strong { display: block; color: #0f172a; font-size: 0.9rem; }
.threshold-monitor-body {
  display: grid;
  gap: 16px;
  min-height: 210px;
  align-content: center;
}
.threshold-monitor-body > strong {
  color: #0f172a;
  font-size: clamp(2.4rem, 5vw, 4rem);
  line-height: 0.95;
  letter-spacing: -0.06em;
}
.threshold-track {
  height: 14px;
  overflow: hidden;
  border-radius: 999px;
  background: #eef2f7;
}
.threshold-track span {
  display: block;
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #22c55e, #f59e0b, #ef4444);
}
.threshold-copy {
  display: flex;
  flex-wrap: wrap;
  gap: 12px;
}
```

- [ ] **Step 5: Run tests to verify they pass**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx -t "Flood Level|Threshold Monitor"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/components/widgets/Widget.tsx frontend/src/components/widgets/Widget.test.tsx frontend/src/styles/app.css
git commit -m "feat: render flood and threshold widgets"
```

---

### Task 4: Wire Template Studio widget library, defaults, and inspector

**Files:**
- Modify: `frontend/src/pages/TemplateStudioPage.tsx`
- Modify: `frontend/src/App.test.tsx`
- Modify: `frontend/src/styles/app.css`

**Interfaces:**
- Consumes: new widget types `tank_level`, `flood_level`, `threshold_monitor`
- Produces: users can add and configure the three widgets in Template Studio

- [ ] **Step 1: Write failing integration test**

Add to `frontend/src/App.test.tsx`:

```ts
it("lets Template Studio add Tank Level, Flood Level and Threshold Monitor widgets", async () => {
  render(<App />);
  fireEvent.click(await screen.findByRole("button", { name: /^Templates$/i }));
  fireEvent.click(await screen.findByRole("button", { name: /Edit Smart Irrigation template/i }));
  fireEvent.click(await screen.findByRole("button", { name: /^Dashboard$/i }));

  fireEvent.click(await screen.findByRole("button", { name: /Add Tank Level/i }));
  expect(await screen.findByText(/Tank Level widget added/i)).toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: /Add Flood Level/i }));
  expect(await screen.findByText(/Flood Level widget added/i)).toBeInTheDocument();

  fireEvent.click(await screen.findByRole("button", { name: /Add Threshold Monitor/i }));
  expect(await screen.findByText(/Threshold Monitor widget added/i)).toBeInTheDocument();
});
```

If exact button names differ, use the accessible names generated by the widget library buttons.

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm test --run src/App.test.tsx -t "Tank Level, Flood Level and Threshold Monitor"
```

Expected: FAIL because buttons do not exist.

- [ ] **Step 3: Add widget types to output library**

In `TemplateStudioPage.tsx`, change Output Widgets types:

```ts
{ title: "Output widgets", kind: "Output", caption: "Display telemetry, media and board status", types: ["gauge", "meter", "value", "tank_level", "flood_level", "threshold_monitor", "led", "chart", "gps", "camera", "serial_lcd", "battery", "signal"] }
```

- [ ] **Step 4: Add widget defaults**

Update `addWidget(type)`:

```ts
const isWideSmartLevel = type === "flood_level";
const isTallSmartLevel = type === "tank_level" || type === "threshold_monitor";
```

Set sizing:

```ts
w: isWideSmartLevel ? 6 : type === "chart" || type === "gps" || type === "camera" ? 6 : 3,
h: isWideSmartLevel || isTallSmartLevel || type === "chart" || type === "gps" || type === "camera" || type === "schedule" ? 3 : 2,
...(type === "tank_level" ? { capacity: 1000, warningThreshold: 25, dangerThreshold: 10 } : {}),
...(type === "flood_level" ? { warningThreshold: 1.5, dangerThreshold: 2, location: "Site location", unit: "m", min: 0, max: 2.5 } : {}),
...(type === "threshold_monitor" ? { warningThreshold: 70, dangerThreshold: 90 } : {})
```

- [ ] **Step 5: Update type helpers**

In `dataTypeForWidgetType(type)`:

```ts
if (type === "tank_level" || type === "flood_level" || type === "threshold_monitor") return "float";
```

In `defaultNameForWidgetType(type)`:

```ts
tank_level: "Tank Level",
flood_level: "Flood Level",
threshold_monitor: "Threshold Monitor",
```

In `widgetForType(dataType)` no change is required because these are explicit widgets, not automatic import defaults.

- [ ] **Step 6: Add inspector fields**

Inside the selected widget inspector section, add fields only when relevant:

```tsx
{["tank_level", "flood_level", "threshold_monitor"].includes(selectedWidget.type) && (
  <div className="inspector-grid">
    <label>Warning threshold<input type="number" value={selectedWidget.warningThreshold ?? ""} onChange={(event) => updateWidget(selectedWidget.id, { warningThreshold: Number(event.target.value) })} /></label>
    <label>Danger threshold<input type="number" value={selectedWidget.dangerThreshold ?? ""} onChange={(event) => updateWidget(selectedWidget.id, { dangerThreshold: Number(event.target.value) })} /></label>
  </div>
)}
{selectedWidget.type === "tank_level" && (
  <label>Capacity<input type="number" value={selectedWidget.capacity ?? 1000} onChange={(event) => updateWidget(selectedWidget.id, { capacity: Number(event.target.value) })} /></label>
)}
{selectedWidget.type === "flood_level" && (
  <label>Location<input value={selectedWidget.location ?? ""} onChange={(event) => updateWidget(selectedWidget.id, { location: event.target.value })} /></label>
)}
```

If the existing inspector uses another field class, use that existing class for consistent styling.

- [ ] **Step 7: Run integration test**

Run:

```bash
cd frontend
pnpm test --run src/App.test.tsx -t "Tank Level, Flood Level and Threshold Monitor"
```

Expected: PASS.

- [ ] **Step 8: Commit**

```bash
git add frontend/src/pages/TemplateStudioPage.tsx frontend/src/App.test.tsx frontend/src/styles/app.css
git commit -m "feat: add smart level widgets to studio"
```

---

### Task 5: Seed demo widgets and document handoff

**Files:**
- Modify: `frontend/src/lib/demoData.ts`
- Modify: `docs/SPARK_IOT_HANDOFF.md`
- Test: `frontend/src/App.test.tsx`

**Interfaces:**
- Consumes: widget types from Tasks 2-4
- Produces: demo Smart Irrigation dashboard visibly includes the new widgets

- [ ] **Step 1: Write failing demo visibility test**

Add to `frontend/src/App.test.tsx`:

```ts
it("shows smart level widgets in the demo dashboard", async () => {
  render(<App />);
  expect(await screen.findByText("Water Tank Level")).toBeInTheDocument();
  expect(await screen.findByText("Flood Monitoring")).toBeInTheDocument();
  expect(await screen.findByText("Threshold Monitor")).toBeInTheDocument();
});
```

- [ ] **Step 2: Run test to verify it fails**

Run:

```bash
cd frontend
pnpm test --run src/App.test.tsx -t "smart level widgets in the demo dashboard"
```

Expected: FAIL until demo data includes these widgets.

- [ ] **Step 3: Add demo datastreams and widgets**

In `frontend/src/lib/demoData.ts`, add Smart Irrigation datastreams:

```ts
stream("ds-tank", "Water Tank Level", "V13", "float", "%", 0, 100, "#2563eb")
stream("ds-flood", "Flood Monitoring", "V14", "float", "m", 0, 2.5, "#0891b2")
stream("ds-threshold", "Threshold Monitor", "V15", "float", "ppm", 0, 1000, "#f59e0b")
```

Add widgets:

```ts
{ ...widget("w-tank", "tank_level", "ds-tank", 6, 9, 3, 3), capacity: 1000, warningThreshold: 25, dangerThreshold: 10 }
{ ...widget("w-flood", "flood_level", "ds-flood", 0, 12, 6, 3), warningThreshold: 1.5, dangerThreshold: 2, location: "Riverside Area" }
{ ...widget("w-threshold", "threshold_monitor", "ds-threshold", 6, 12, 3, 3), warningThreshold: 600, dangerThreshold: 800 }
```

Add demo latest telemetry if the file has matching latest seed values:

```ts
reading("device-irrigation", "V13", 72, "%")
reading("device-irrigation", "V14", 0.85, "m")
reading("device-irrigation", "V15", 420, "ppm")
```

- [ ] **Step 4: Update handoff documentation**

In `docs/SPARK_IOT_HANDOFF.md`, under widget list, add:

```md
- Tank Level: capacity/fill smart widget for tanks and reservoirs.
- Flood Level: water-safety smart widget with warning/danger thresholds and location.
- Threshold Monitor: generic numeric sensor health widget with safe/warning/danger bands.
```

Add a note:

```md
These smart level widgets are frontend-rendered from existing widget JSON metadata. No backend migration is required for v1; widget metadata is stored in dashboard JSON.
```

- [ ] **Step 5: Run demo test**

Run:

```bash
cd frontend
pnpm test --run src/App.test.tsx -t "smart level widgets in the demo dashboard"
```

Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add frontend/src/lib/demoData.ts docs/SPARK_IOT_HANDOFF.md frontend/src/App.test.tsx
git commit -m "feat: seed smart level widgets"
```

---

### Task 6: Final verification and push

**Files:**
- No new files expected

**Interfaces:**
- Consumes: all previous tasks
- Produces: verified branch pushed to `origin/main`

- [ ] **Step 1: Run focused widget tests**

Run:

```bash
cd frontend
pnpm test --run src/components/widgets/Widget.test.tsx
```

Expected: all widget tests pass.

- [ ] **Step 2: Run full frontend tests**

Run:

```bash
cd frontend
pnpm test --run
```

Expected: all frontend tests pass.

- [ ] **Step 3: Run frontend production build**

Run:

```bash
cd frontend
pnpm build
```

Expected: build exits `0`. Existing large chunk warning is acceptable.

- [ ] **Step 4: Run backend tests**

Run:

```bash
python -m pytest backend/tests -q
```

Expected: all backend tests pass. These widgets should not require backend changes.

- [ ] **Step 5: Check diff hygiene**

Run:

```bash
git diff --check
git status --short
```

Expected: no whitespace errors. Status should show only intended committed changes or be clean before push.

- [ ] **Step 6: Push**

Run:

```bash
git push origin main
```

Expected: push succeeds and GitHub Actions starts deploy.

---

## Self-Review

Spec coverage:

- Tank Level widget: Task 2 and Task 5.
- Flood Level widget: Task 3 and Task 5.
- Threshold Monitor widget: Task 3 and Task 5.
- Template Studio library and inspector: Task 4.
- Existing JSON/datastream architecture: Tasks 1 and 4 use optional `WidgetConfig` metadata only.
- Tests: Tasks 1-6.
- Handoff docs: Task 5.

Placeholder scan:

- No `TBD`, unresolved `TODO`, or “implement later” language remains.

Type consistency:

- Widget type strings are consistently `tank_level`, `flood_level`, and `threshold_monitor`.
- Metadata fields are consistently `warningThreshold`, `dangerThreshold`, `capacity`, `location`, and `statusLabel`.
