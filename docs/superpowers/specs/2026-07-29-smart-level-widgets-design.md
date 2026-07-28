# Spark IoT Smart Level Widgets Design

Date: 2026-07-29

## Goal

Add three premium Spark IoT smart widgets that make common IoT level-monitoring use cases clearer than a generic gauge:

1. Tank Level
2. Flood Level
3. Threshold Monitor

The widgets must follow the existing Spark IoT light SaaS style: clean white cards, blue accent language, soft borders, consistent typography, clear status badges, and no dark industrial theme.

## Why these widgets are separate

### Tank Level

Tank Level is a container/capacity widget. It is for systems where the user cares about how full something is.

Examples:

- Water tank
- Chemical tank
- Fertilizer tank
- Oil tank
- Storage bin

The widget should show:

- Fill percentage
- Current volume
- Total capacity
- Status
- Last updated time
- Optional low/high threshold hints

Default datastream mapping:

- Main value: percentage, normally `0-100`
- Optional volume: litres or custom unit
- Optional status: normal, low, critical, overflow

### Flood Level

Flood Level is a water-safety widget. It is for outdoor or drainage monitoring where a measured level should be compared against fixed flood thresholds.

Examples:

- Drain level
- River level
- Canal level
- Road flood sensor
- Sump/pit water level

The widget should show:

- Current level in `cm` or `m`
- Safe, warning, and danger thresholds
- Visual water channel/cross-section
- Mini trend line
- Location label
- Last updated time
- Status badge

Default datastream mapping:

- Main value: water level
- Unit: `cm` or `m`
- Optional location string
- Optional status

### Threshold Monitor

Threshold Monitor is a generic numeric health widget. It is not water-specific.

Examples:

- Temperature danger limit
- Gas level
- Air quality
- Battery voltage
- Pressure
- Soil moisture
- Vibration
- Current overload

The widget should show:

- Current numeric value
- Unit
- Safe/warning/danger bands
- Status
- Mini trend line
- Optional alert rule summary

Default datastream mapping:

- Main value: number
- Unit: custom
- Min/max: custom
- Warning/danger thresholds: configurable

## Template Studio behavior

These widgets should appear under Output Widgets:

- Tank Level
- Flood Level
- Threshold Monitor

When added from Template Studio, each should create or map to a datastream:

- Tank Level: numeric datastream, default unit `%`, min `0`, max `100`
- Flood Level: numeric datastream, default unit `m`, min `0`, max `2`
- Threshold Monitor: numeric datastream, default unit blank, min `0`, max `100`

Inspector settings should remain simple:

- Title
- Datastream
- Unit
- Min
- Max
- Warning threshold
- Danger threshold
- Capacity, only for Tank Level
- Location, only for Flood Level

Advanced visual options can come later. Version 1 should not overload the user.

## Dashboard behavior

All three widgets should:

- Render from live telemetry using the existing widget value resolution path.
- Work with MQTT, HTTP telemetry, and demo simulator values.
- Preserve dashboard layout save behavior.
- Support drag, drop, and resize like existing widgets.
- Show a useful empty state when no telemetry exists.

Tank Level should be medium/tall by default.

Flood Level should be wide by default.

Threshold Monitor should work as a normal medium card.

## Visual direction

Use Spark IoT light style:

- White cards
- Soft blue borders
- Subtle grid/card background only where helpful
- Blue water visuals
- Status colors:
  - Safe/Normal: green
  - Warning: amber
  - Danger/Critical: red
  - Offline/No data: slate

Avoid:

- Dark dashboard skin
- Heavy gradients
- Cartoonish illustrations
- Overcrowded metrics
- Raw HTML controls

## Testing

Frontend tests should cover:

- Widget library includes the three new widget types.
- Each widget renders its title, value, unit, and status.
- Tank Level renders percentage and capacity text.
- Flood Level renders thresholds and location.
- Threshold Monitor renders safe/warning/danger state based on value.
- Template Studio can add each widget.

## Out of scope for v1

- Billing enforcement by widget group.
- AI prediction.
- Historical report generator.
- 3D animated tank.
- Complex flood map overlay.
- Backend schema migration for widget-specific metadata.

The v1 should use the existing dashboard widget JSON configuration and existing datastream model.
