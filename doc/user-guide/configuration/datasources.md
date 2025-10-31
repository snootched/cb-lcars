# DataSources Configuration Guide

> **Real-time data processing from Home Assistant to your overlays**
> DataSources transform entity states into processed, aggregated values that power dynamic dashboards.

---

## 🎯 Quick Start

### Simple Entity Source

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temperature
```

Use in overlays:
```yaml
overlays:
  - id: temp_display
    type: text
    content: "{temperature.value}°C"
```

That's it! The datasource subscribes to the entity and provides real-time updates.

---

## 📋 Table of Contents

1. [Overview](#overview)
2. [DataSource Types](#datasource-types)
3. [Basic Configuration](#basic-configuration)
4. [Nested Attribute Paths](#nested-attribute-paths) ⭐ **NEW**
5. [DataSource Metadata](#datasource-metadata)
6. [Transformations](#transformations)
7. [Aggregations](#aggregations)
8. [Computed Sources](#computed-sources)
9. [Using DataSources](#using-datasources)
10. [Performance Tuning](#performance-tuning)
11. [Troubleshooting](#troubleshooting)

---

## 🌟 Overview

**DataSources are the heart of CB-LCARS.** They connect Home Assistant entities to your overlays with powerful processing capabilities:

- ✅ **Real-time subscriptions** - Instant updates when entity states change
- ✅ **Historical preload** - Load hours of history for time-series analysis
- ✅ **Transformations** - 50+ unit conversions, scaling, smoothing, expressions
- ✅ **Aggregations** - Moving averages, rates, trends, statistics
- ✅ **Computed values** - Calculate from multiple sources
- ✅ **Memory efficient** - Runtime processing, no persistent storage
- ✅ **Performance optimized** - Coalescing, throttling, smart buffering

### Data Flow

```mermaid
graph TD
    HA[Home Assistant Entity<br/>sensor.temperature] --> Sub[Real-time Subscription<br/>Auto-connects on card load]
    Sub --> Buffer[Time-Windowed Buffer<br/>Stores recent history]
    Buffer --> Trans{Transformations?}

    Trans -->|Yes| Transform[Transformation Pipeline<br/>Unit conversion, scaling, etc.]
    Trans -->|No| Agg{Aggregations?}

    Transform --> Agg
    Agg -->|Yes| Aggregate[Aggregation Processors<br/>Moving avg, min/max, trends]
    Agg -->|No| Output

    Aggregate --> Output[Available to Overlays<br/>Multiple processed values]
    Output --> Text[Text Overlay]
    Output --> Chart[ApexChart Overlay]
    Output --> Button[Button Overlay]

    style HA fill:#4d94ff,stroke:#0066cc,color:#fff
    style Buffer fill:#ff9933,stroke:#cc6600,color:#fff
    style Transform fill:#ff9933,stroke:#cc6600,color:#fff
    style Aggregate fill:#ff9933,stroke:#cc6600,color:#fff
    style Output fill:#00cc66,stroke:#009944,color:#fff
```

**Key Concepts:**
- 🔄 **Real-time** - Updates flow instantly from HA to overlays
- 🕐 **Buffered** - Recent history available for time-series analysis
- ⚙️ **Processed** - Data transformed through multiple stages
- 📊 **Multi-output** - One source can provide many processed values

### DataSource Lifecycle

```mermaid
sequenceDiagram
    participant Card as CB-LCARS Card
    participant DSM as DataSource Manager
    participant DS as DataSource Instance
    participant HA as Home Assistant
    participant Overlay as Overlays

    Card->>DSM: Card loads with datasources config
    DSM->>DS: Create DataSource instances
    DS->>HA: Subscribe to entity changes
    HA-->>DS: Send current state

    opt Historical Data Enabled
        DS->>HA: Request history (6 hours)
        HA-->>DS: Historical data array
        DS->>DS: Pre-fill buffer with history
    end

    DS->>DS: Apply transformations
    DS->>DS: Calculate aggregations
    DS->>Overlay: Emit initial values
    Overlay-->>Card: Render with data

    loop Real-time Updates
        HA->>DS: Entity state changed
        DS->>DS: Add to buffer (time-windowed)
        DS->>DS: Process transformations
        DS->>DS: Recalculate aggregations
        DS->>Overlay: Emit updated values
        Overlay-->>Card: Re-render affected overlays
    end

    Card->>DSM: Card unloaded
    DSM->>DS: Destroy instances
    DS->>HA: Unsubscribe from entities
```

**Lifecycle Stages:**
1. **Initialization** - DataSources created when card loads
2. **Subscription** - Auto-connect to HA entities
3. **History Preload** - Optional historical data for charts
4. **Processing** - Initial transformation and aggregation
5. **Real-time Updates** - Continuous monitoring and processing
6. **Cleanup** - Unsubscribe when card unloads

---

## 📦 DataSource Types

```mermaid
graph LR
    Start([Choose DataSource Type]) --> Question{What data<br/>do you need?}

    Question -->|Single HA entity| Entity[Entity Source<br/>Direct entity connection]
    Question -->|Calculate from<br/>multiple sources| Computed[Computed Source<br/>Multi-source formula]
    Question -->|Statistical<br/>analysis| Aggregated[Aggregated Source<br/>Time-series stats]

    Entity --> Use1[✅ Simple displays<br/>✅ Unit conversion<br/>✅ Real-time monitoring]
    Computed --> Use2[✅ Math calculations<br/>✅ Derived metrics<br/>✅ Complex formulas]
    Aggregated --> Use3[✅ Trends<br/>✅ Moving averages<br/>✅ Min/max tracking]

    style Entity fill:#00cc66,stroke:#009944,color:#fff
    style Computed fill:#4d94ff,stroke:#0066cc,color:#fff
    style Aggregated fill:#ff9933,stroke:#cc6600,color:#fff
```

### 1. Entity Sources

Subscribe to Home Assistant entities with optional processing.

```yaml
data_sources:
  power_monitor:
    type: entity
    entity: sensor.power_consumption
    transformations:
      - type: unit_conversion
        from: "W"
        to: "kW"
        key: "kilowatts"
    aggregations:
      - type: moving_average
        window: "5m"
        key: "avg_5m"
```

**Use Cases:**
- Simple entity display
- Unit conversions
- Statistical analysis
- Trend monitoring

### 2. Computed Sources

Calculate values from other datasources.

```mermaid
graph TD
    Solar[solar_production<br/>DataSource] --> Deps[Dependencies]
    Consumption[home_consumption<br/>DataSource] --> Deps

    Deps --> Formula[Expression:<br/>solar - consumption]
    Formula --> Result[net_power<br/>Computed Result]

    Result --> Display1[Display on overlay:<br/>-500W using power]
    Result --> Display2[Or: +2000W<br/>generating excess]

    style Solar fill:#4d94ff,stroke:#0066cc,color:#fff
    style Consumption fill:#4d94ff,stroke:#0066cc,color:#fff
    style Formula fill:#ff9933,stroke:#cc6600,color:#fff
    style Result fill:#00cc66,stroke:#009944,color:#fff
```

```yaml
data_sources:
  # Source datasources
  solar_production:
    type: entity
    entity: sensor.solar_power

  home_consumption:
    type: entity
    entity: sensor.home_power

  # Computed net power
  net_power:
    type: computed
    expression: "solar - consumption"
    dependencies:
      solar: solar_production
      consumption: home_consumption
```

**Use Cases:**
- Multi-sensor calculations
- Derived metrics
- Complex formulas

### 3. Aggregated Sources

Focus on statistical analysis over time.

```yaml
data_sources:
  temperature_stats:
    type: entity
    entity: sensor.temperature
    windowSeconds: 3600  # 1 hour buffer
    aggregations:
      - type: moving_average
        window: "30m"
        key: "avg_30m"
      - type: min_max
        window: "1h"
        key: "hourly_range"
      - type: rate_of_change
        unit: "per_minute"
        key: "trend"
```

**Use Cases:**
- Trend analysis
- Range tracking
- Rate calculations
- Long-term statistics

---

## ⚙️ Basic Configuration

### Minimal Configuration

```yaml
data_sources:
  sensor_name:
    type: entity
    entity: sensor.entity_id
```

### Complete Configuration

```yaml
data_sources:
  detailed_sensor:
    type: entity
    entity: sensor.entity_id
    attribute: null              # Use specific attribute instead of state

    # Buffer configuration
    windowSeconds: 3600          # Time window for data buffer (default: 60)

    # Performance tuning
    minEmitMs: 100              # Min time between updates (default: 100)
    coalesceMs: 50              # Batch rapid updates (default: auto)
    maxDelayMs: 500             # Max delay before forced emit (default: auto)
    emitOnSameValue: true       # Emit even if value unchanged (default: true)

    # Historical data
    history:
      enabled: true             # Preload history (default: true)
      hours: 6                  # Hours to preload (default: 6, max: 168)

    # Processing pipelines
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

    aggregations:
      - type: moving_average
        window: "5m"
        key: "avg"
```

### Configuration Properties

| Property | Type | Default | Description |
|----------|------|---------|-------------|
| `type` | string | required | `entity`, `computed` |
| `entity` | string | required | Home Assistant entity ID |
| `attribute` | string | `null` | Use specific attribute instead of state |
| `windowSeconds` | number | `60` | Data buffer size in seconds |
| `minEmitMs` | number | `100` | Minimum milliseconds between emissions |
| `coalesceMs` | number | auto | Milliseconds to batch rapid updates |
| `maxDelayMs` | number | auto | Maximum delay before forced emission |
| `emitOnSameValue` | boolean | `true` | Emit updates even if value unchanged |
| `history.enabled` | boolean | `true` | Enable historical data preload |
| `history.hours` | number | `6` | Hours of history to preload (max 168) |
| `transformations` | array | `[]` | Transformation pipeline |
| `aggregations` | array | `[]` | Aggregation processors |

### Understanding the Buffer System

The `windowSeconds` parameter controls how much historical data is kept in memory for aggregations and time-series analysis.

```mermaid
graph TD
    subgraph "windowSeconds: 60 (1 minute buffer)"
        Now1[Now] --> Min1[60 seconds ago]
        Min1 -.->|Older data discarded| Old1[X]

        Data1[Recent 60 seconds<br/>of entity states] --> Agg1[Available for<br/>aggregations]
    end

    subgraph "windowSeconds: 3600 (1 hour buffer)"
        Now2[Now] --> Hour[3600 seconds ago<br/>1 hour]
        Hour -.->|Older data discarded| Old2[X]

        Data2[Recent 1 hour<br/>of entity states] --> Agg2[Available for<br/>moving averages,<br/>trends, charts]
    end

    style Now1 fill:#00cc66,stroke:#009944,color:#fff
    style Now2 fill:#00cc66,stroke:#009944,color:#fff
    style Old1 fill:#ff3333,stroke:#cc0000,color:#fff
    style Old2 fill:#ff3333,stroke:#cc0000,color:#fff
    style Agg1 fill:#4d94ff,stroke:#0066cc,color:#fff
    style Agg2 fill:#4d94ff,stroke:#0066cc,color:#fff
```

**Buffer Behavior:**
- 📊 **Sliding Window** - Always keeps most recent N seconds
- 🗑️ **Auto-cleanup** - Automatically discards older data
- 💾 **Memory Efficient** - Only stores what you need
- ⏱️ **Aggregation Range** - Must be ≤ windowSeconds

**Sizing Guidelines:**
- **60s** - Real-time display, no historical analysis
- **300s** (5min) - Short-term moving averages
- **3600s** (1h) - Hourly trends and statistics
- **86400s** (24h) - Daily analysis (use sparingly)

---

## 🔍 Nested Attribute Paths ⭐ **NEW**

**Access nested data within entity attributes using dot notation and array indices.** Many Home Assistant entities have complex attribute structures—weather forecasts, multi-zone systems, array data—and CB-LCARS can navigate deep into these structures to extract exactly the data you need.

### What are Nested Attribute Paths?

When you configure a datasource with the `attribute` property, you're telling it which entity attribute to read. But what if that attribute contains nested objects or arrays? That's where `attribute_path` comes in.

```mermaid
graph TD
    Entity[Entity: weather.home<br/>state: sunny] --> Attrs[Attributes Object]

    Attrs --> Temp[temperature: 72]
    Attrs --> Forecast[forecast: Array]

    Forecast --> F0[0: Object]
    Forecast --> F1[1: Object]
    Forecast --> F2[2: Object]

    F0 --> F0_Temp[temperature: 68]
    F0 --> F0_Cond[condition: partly-cloudy]
    F0 --> F0_Time[datetime: 2025-10-31T12:00]

    F1 --> F1_Temp[temperature: 75]
    F1 --> F1_Cond[condition: sunny]

    F2 --> F2_Temp[temperature: 71]
    F2 --> F2_Cond[condition: rainy]

    Path1[attribute_path:<br/>forecast.0.temperature] -.-> F0_Temp
    Path2[attribute_path:<br/>forecast[1].condition] -.-> F1_Cond

    style Entity fill:#4d94ff,stroke:#0066cc,color:#fff
    style Forecast fill:#ff9933,stroke:#cc6600,color:#fff
    style F0_Temp fill:#00cc66,stroke:#009944,color:#fff
    style F1_Cond fill:#00cc66,stroke:#009944,color:#fff
    style Path1 fill:#cc99ff,stroke:#9966cc,color:#fff
    style Path2 fill:#cc99ff,stroke:#9966cc,color:#fff
```

### Basic Usage

#### Accessing Nested Objects (Dot Notation)

```yaml
data_sources:
  # Entity with nested attributes
  climate_zone1:
    type: entity
    entity: climate.hvac_system
    attribute_path: "zones.living_room.temperature"
    # Navigates: entity.attributes.zones.living_room.temperature

overlays:
  - type: text
    content: "Living Room: {climate_zone1.v}°F"
```

**Entity Structure:**
```json
{
  "state": "heat",
  "attributes": {
    "zones": {
      "living_room": {
        "temperature": 72,
        "humidity": 45
      },
      "bedroom": {
        "temperature": 68,
        "humidity": 50
      }
    }
  }
}
```

#### Accessing Array Elements

CB-LCARS supports **two array index syntaxes**—use whichever you prefer:

##### Syntax 1: Bracket Notation `[index]`

```yaml
data_sources:
  tomorrow_temp:
    type: entity
    entity: weather.home
    attribute_path: "forecast[1].temperature"
    # Gets: entity.attributes.forecast[1].temperature
```

##### Syntax 2: Dot Notation `.index`

```yaml
data_sources:
  tomorrow_temp:
    type: entity
    entity: weather.home
    attribute_path: "forecast.1.temperature"
    # Same as above—internally converted to [1]
```

**Both syntaxes are equivalent.** CB-LCARS automatically normalizes `forecast.1.temperature` → `forecast[1].temperature`.

### Real-World Examples

#### Example 1: Weather Forecast

Extract tomorrow's forecast from a weather entity:

```yaml
data_sources:
  # Today's forecast (index 0)
  today_high:
    type: entity
    entity: weather.home
    attribute_path: "forecast[0].temperature"

  today_condition:
    type: entity
    entity: weather.home
    attribute_path: "forecast[0].condition"

  # Tomorrow's forecast (index 1)
  tomorrow_high:
    type: entity
    entity: weather.home
    attribute_path: "forecast[1].temperature"

  tomorrow_condition:
    type: entity
    entity: weather.home
    attribute_path: "forecast[1].condition"

overlays:
  - type: text
    id: today
    content: "Today: {today_condition.v}, High {today_high.v}°F"
    position: [100, 100]

  - type: text
    id: tomorrow
    content: "Tomorrow: {tomorrow_condition.v}, High {tomorrow_high.v}°F"
    position: [100, 140]
```

**Entity Structure:**
```json
{
  "state": "sunny",
  "attributes": {
    "forecast": [
      {
        "datetime": "2025-10-31T12:00:00",
        "temperature": 75,
        "condition": "sunny",
        "precipitation_probability": 10
      },
      {
        "datetime": "2025-11-01T12:00:00",
        "temperature": 68,
        "condition": "partly-cloudy",
        "precipitation_probability": 30
      }
    ]
  }
}
```

#### Example 2: Multi-Zone HVAC System

Access individual zones in a multi-zone climate system:

```yaml
data_sources:
  living_room_temp:
    type: entity
    entity: climate.hvac_system
    attribute_path: "zones.living_room.current_temperature"

  living_room_target:
    type: entity
    entity: climate.hvac_system
    attribute_path: "zones.living_room.target_temperature"

  bedroom_temp:
    type: entity
    entity: climate.hvac_system
    attribute_path: "zones.bedroom.current_temperature"

overlays:
  - type: text
    content: "Living Room: {living_room_temp.v}°F → {living_room_target.v}°F"
    position: [100, 100]

  - type: text
    content: "Bedroom: {bedroom_temp.v}°F"
    position: [100, 140]
```

#### Example 3: Device with Multiple Sensors

Extract specific sensor readings from a device with many sensors:

```yaml
data_sources:
  # Multi-sensor device
  air_quality_pm25:
    type: entity
    entity: sensor.air_quality_monitor
    attribute_path: "sensors.particulate_matter.pm2_5"

  air_quality_pm10:
    type: entity
    entity: sensor.air_quality_monitor
    attribute_path: "sensors.particulate_matter.pm10"

  air_quality_voc:
    type: entity
    entity: sensor.air_quality_monitor
    attribute_path: "sensors.volatile_organic_compounds"

overlays:
  - type: text
    content: "PM2.5: {air_quality_pm25.v} µg/m³"
    position: [100, 100]

  - type: text
    content: "VOC: {air_quality_voc.v} ppb"
    position: [100, 180]
```

#### Example 4: Deeply Nested Structures

Navigate multiple levels deep:

```yaml
data_sources:
  battery_voltage:
    type: entity
    entity: sensor.smart_device
    attribute_path: "device_info.power.battery.voltage"
    # Navigates 4 levels deep!

  battery_health:
    type: entity
    entity: sensor.smart_device
    attribute_path: "device_info.power.battery.health_percentage"

overlays:
  - type: text
    content: "Battery: {battery_voltage.v}V ({battery_health.v}%)"
    position: [100, 100]
```

**Entity Structure:**
```json
{
  "state": "online",
  "attributes": {
    "device_info": {
      "power": {
        "battery": {
          "voltage": 3.7,
          "health_percentage": 95,
          "cycles": 42
        }
      }
    }
  }
}
```

### Path Syntax Reference

| Pattern | Example | Accesses |
|---------|---------|----------|
| `property` | `"temperature"` | `attributes.temperature` |
| `nested.property` | `"zones.living_room"` | `attributes.zones.living_room` |
| `array[index]` | `"forecast[0]"` | `attributes.forecast[0]` |
| `array.index` | `"forecast.1"` | `attributes.forecast[1]` (normalized to [1]) |
| `nested.array[index].property` | `"data.readings[2].value"` | `attributes.data.readings[2].value` |
| `deep.nested.path` | `"a.b.c.d.e"` | `attributes.a.b.c.d.e` |

### Combining with Aggregations and Transformations

Nested attribute paths work seamlessly with processing pipelines:

```yaml
data_sources:
  # Extract forecast temperature and process it
  tomorrow_temp:
    type: entity
    entity: weather.home
    attribute_path: "forecast[1].temperature"

    # Convert from Fahrenheit to Celsius
    transformations:
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

    # Track rolling average
    aggregations:
      - type: moving_average
        window: "1h"
        key: "avg"

overlays:
  - type: text
    content: "Tomorrow: {tomorrow_temp.celsius:.1f}°C (avg: {tomorrow_temp.avg:.1f}°C)"
```

### Error Handling

**What happens if the path doesn't exist?**

CB-LCARS handles missing paths gracefully:

1. **Path not found** → Datasource returns `null`
2. **Array index out of bounds** → Returns `null`
3. **Type mismatch** (accessing property on non-object) → Returns `null`

**Example:**
```yaml
data_sources:
  # If forecast only has 2 items, this returns null
  day_3_temp:
    type: entity
    entity: weather.home
    attribute_path: "forecast[3].temperature"  # Out of bounds
```

**Best practice:** Check for null in templates or use fallback values:

```yaml
overlays:
  - type: text
    # Will show "N/A" if path is invalid
    content: "Temp: {day_3_temp.v if day_3_temp.v is not none else 'N/A'}"
```

### Troubleshooting

**Problem: "AttributeError: 'NoneType' object has no attribute..."**

**Cause:** The attribute path is invalid or the nested structure doesn't match expectations.

**Solution:**
1. Check the entity's attributes in Home Assistant Developer Tools → States
2. Verify the structure matches your `attribute_path`
3. Use brackets for array indices: `forecast[0]` not `forecast.0` (or vice versa)
4. Check for typos in property names (case-sensitive!)

**Problem: "Datasource returns null but attribute exists"**

**Cause:** You may be using `attribute` instead of `attribute_path`, or the wrong syntax.

**Solution:**
```yaml
# ❌ WRONG - attribute only gets top-level attribute
data_sources:
  temp:
    type: entity
    entity: weather.home
    attribute: "forecast[0].temperature"  # This tries to find an attribute literally named "forecast[0].temperature"

# ✅ CORRECT - attribute_path navigates nested structure
data_sources:
  temp:
    type: entity
    entity: weather.home
    attribute_path: "forecast[0].temperature"  # This navigates into forecast array
```

**Problem: "Syntax with dots vs brackets?"**

**Both work!** CB-LCARS normalizes `forecast.0.temperature` → `forecast[0].temperature` automatically. Use whichever is more readable to you:

```yaml
# These are equivalent:
attribute_path: "forecast[0].temperature"   # Explicit bracket syntax
attribute_path: "forecast.0.temperature"    # Dot syntax (auto-converted)
```

---

## � DataSource Metadata

**Every datasource automatically captures and provides metadata from Home Assistant entities.** This metadata gives you access to entity attributes like units, friendly names, device information, and more.

### What is Metadata?

When a datasource connects to a Home Assistant entity, it automatically extracts useful information about that entity and makes it available to your overlays. This means you don't have to manually configure display names, units, or other entity properties—CB-LCARS captures them for you.

```mermaid
graph LR
    Entity[Home Assistant Entity<br/>sensor.living_room_temperature] --> Extract[Auto-Extract Metadata]

    Extract --> UOM[unit_of_measurement<br/>"°C"]
    Extract --> Name[friendly_name<br/>"Living Room Temperature"]
    Extract --> Device[device_class<br/>"temperature"]
    Extract --> Icon[icon<br/>"mdi:thermometer"]
    Extract --> More[+ more...]

    UOM --> DS[DataSource<br/>Metadata Object]
    Name --> DS
    Device --> DS
    Icon --> DS
    More --> DS

    DS --> Available[Available to Overlays<br/>via templates]

    style Entity fill:#4d94ff,stroke:#0066cc,color:#fff
    style Extract fill:#ff9933,stroke:#cc6600,color:#fff
    style DS fill:#00cc66,stroke:#009944,color:#fff
    style Available fill:#00cc66,stroke:#009944,color:#fff
```

### Available Metadata Properties

| Property | Description | Example Value |
|----------|-------------|---------------|
| `unit_of_measurement` | Entity's unit of measure | `"°C"`, `"kWh"`, `"%"`, `"lux"` |
| `friendly_name` | Human-readable name | `"Living Room Temperature"` |
| `device_class` | Type of device/sensor | `"temperature"`, `"power"`, `"humidity"` |
| `state_class` | How state behaves | `"measurement"`, `"total"`, `"total_increasing"` |
| `icon` | Entity's icon | `"mdi:thermometer"`, `"mdi:lightbulb"` |
| `entity_id` | Entity identifier | `"sensor.living_room_temperature"` |
| `device_id` | Device identifier | `"abc123..."` |
| `area` | Area/room assignment | `"living_room"`, `"bedroom"` |
| `last_changed` | Last state change timestamp | ISO 8601 timestamp |
| `last_updated` | Last update timestamp | ISO 8601 timestamp |

### Accessing Metadata in Templates

Use the `metadata` property to access entity information in your overlays:

#### Basic Usage

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.living_room_temperature

overlays:
  # Display friendly name
  - type: text
    id: temp_label
    content: "{temperature.metadata.friendly_name}"
    position: [100, 100]

  # Display value with unit
  - type: text
    id: temp_value
    content: "{temperature.v:.1f}{temperature.metadata.unit_of_measurement}"
    position: [100, 140]
```

**Result:**
```
Living Room Temperature
23.5°C
```

#### Complete Example with Multiple Metadata Properties

```yaml
data_sources:
  power_usage:
    type: entity
    entity: sensor.home_power

overlays:
  # Panel title using friendly name
  - type: text
    id: title
    content: "{power_usage.metadata.friendly_name}"
    position: [100, 50]
    style:
      font_size: 24
      color: var(--lcars-orange)

  # Current value with automatic unit
  - type: text
    id: current
    content: "Current: {power_usage.v:.2f} {power_usage.metadata.unit_of_measurement}"
    position: [100, 100]

  # Show device class
  - type: text
    id: device_info
    content: "Type: {power_usage.metadata.device_class}"
    position: [100, 140]

  # Entity ID for reference
  - type: text
    id: entity
    content: "Entity: {power_usage.metadata.entity_id}"
    position: [100, 180]
    style:
      font_size: 12
      color: var(--lcars-gray)
```

### Automatic Unit Formatting

**The `unit_of_measurement` is automatically used when formatting numbers** in text overlays with the number format specifier:

```yaml
overlays:
  # Manual unit specification
  - type: text
    content: "{temperature.v:.1f}°C"  # You write: "23.5°C"

  # Automatic unit from metadata (BETTER!)
  - type: text
    content: "{temperature.v:.1f}{temperature.metadata.unit_of_measurement}"
    # Automatically uses entity's unit: "23.5°C"
```

**Benefits of Automatic Units:**
- ✅ No hardcoding units in config
- ✅ Automatically adapts if entity changes
- ✅ Correct units for multi-unit sensors
- ✅ Works with transformed values

### Using Metadata with Computed Sources

Computed datasources **don't have entities**, so they don't automatically capture metadata. However, you can **manually specify metadata** using the `metadata` configuration option:

#### Option 1: Manual Metadata Override (Recommended)

```yaml
data_sources:
  # Base sources have metadata
  solar:
    type: entity
    entity: sensor.solar_power
    # Metadata auto-captured: unit_of_measurement: "W"

  consumption:
    type: entity
    entity: sensor.home_power
    # Metadata auto-captured: unit_of_measurement: "W"

  # Computed source with manual metadata
  net_power:
    type: computed
    expression: "solar - consumption"
    dependencies:
      solar: solar
      consumption: consumption
    # ✅ NEW: Manual metadata specification
    metadata:
      unit_of_measurement: "W"
      friendly_name: "Net Power Flow"
      device_class: "power"
      icon: "mdi:transmission-tower"

overlays:
  # Now net_power has metadata! ✅
  - type: text
    content: "{net_power.metadata.friendly_name}: {net_power.v:.1f}{net_power.metadata.unit_of_measurement}"
    # Output: "Net Power Flow: 500.0W" ✅
```

#### Option 2: Reference Dependency Metadata

If you don't want to specify metadata manually, reference a dependency's metadata:

```yaml
overlays:
  # Reference solar's metadata
  - type: text
    content: "Net: {net_power.v:.1f}{solar.metadata.unit_of_measurement}"
    # Output: "Net: 500.0W" ✅
```

### Overriding Auto-Captured Metadata ⭐ **ENHANCED**

**User-specified metadata always takes precedence over auto-captured metadata.** CB-LCARS uses a merge strategy where your config overrides specific properties while preserving others from the entity.

#### How Metadata Merging Works

```mermaid
graph LR
    Entity[Entity Metadata<br/>Auto-Captured] --> Merge{Merge Strategy}
    Config[Config Metadata<br/>User-Specified] --> Merge

    Merge --> Priority[Priority Rules]

    Priority --> Rule1[1. Config overrides<br/>matching properties]
    Priority --> Rule2[2. Entity provides<br/>unspecified properties]
    Priority --> Rule3[3. Result = merged<br/>metadata object]

    Rule3 --> Result[Final Metadata<br/>Available to Overlays]

    style Entity fill:#4d94ff,stroke:#0066cc,color:#fff
    style Config fill:#ff9933,stroke:#cc6600,color:#fff
    style Result fill:#00cc66,stroke:#009944,color:#fff
    style Priority fill:#cc99ff,stroke:#9966cc,color:#fff
```

**Merge Priority:**
1. **User config** (highest) - Properties specified in `metadata:` config
2. **Entity attributes** (fallback) - Properties auto-extracted from Home Assistant
3. **Default values** (if neither above) - System defaults (rare)

#### When to Override Metadata

Override auto-captured metadata when:
- ✅ You want a **custom display name** (shorter, more descriptive)
- ✅ You need to **change unit representation** (display kW instead of W)
- ✅ You're **mixing sensor types** and need consistent units
- ✅ Entity has **missing metadata** (some integrations don't provide full metadata)
- ✅ You want **custom iconography** for your dashboard theme

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.outdoor_temperature
    # Entity has:
    #   unit_of_measurement: "°C"
    #   friendly_name: "Outdoor Temperature Sensor Model XYZ123"
    #   device_class: "temperature"
    #   icon: "mdi:thermometer"

    # Override with custom metadata
    metadata:
      friendly_name: "Outside Temp"  # ✅ Override: Shorter name
      icon: "mdi:weather-sunny"      # ✅ Override: Custom icon
      # unit_of_measurement: "°C" ← NOT overridden, preserved from entity
      # device_class: "temperature" ← NOT overridden, preserved from entity

overlays:
  - type: text
    content: "{temperature.metadata.friendly_name}: {temperature.v:.1f}{temperature.metadata.unit_of_measurement}"
    # Output: "Outside Temp: 23.5°C"
    # ↑ Uses custom name from config
    #                              ↑ Uses unit from entity (not overridden)
```

#### Complete Override Example

Override multiple properties while keeping others:

```yaml
data_sources:
  power_sensor:
    type: entity
    entity: sensor.home_power_meter
    # Entity auto-metadata:
    #   unit_of_measurement: "W"
    #   friendly_name: "Acme Power Meter Device 12345"
    #   device_class: "power"
    #   icon: "mdi:flash"
    #   entity_id: "sensor.home_power_meter"
    #   device_id: "abc123xyz"

    # Partial override - specify only what you want to change
    metadata:
      friendly_name: "House Power"      # Override
      icon: "mdi:home-lightning-bolt"   # Override
      unit_of_measurement: "kW"         # Override
      # device_class, entity_id, device_id preserved from entity

    # Also convert values to match new unit
    transformations:
      - type: expression
        expression: "v / 1000"  # Convert W to kW
        key: "value"

overlays:
  - type: text
    content: "{power_sensor.metadata.friendly_name}: {power_sensor.value:.2f} {power_sensor.metadata.unit_of_measurement}"
    # Output: "House Power: 2.45 kW"
    # ↑ custom name        ↑ transformed value  ↑ custom unit
```

#### Overriding for Computed Sources

Computed sources **require manual metadata** since they don't have entities:

```yaml
data_sources:
  # Entity sources with auto-metadata
  solar:
    type: entity
    entity: sensor.solar_power
    # Auto: unit_of_measurement: "W", friendly_name: "Solar Power", etc.

  consumption:
    type: entity
    entity: sensor.home_power
    # Auto: unit_of_measurement: "W", friendly_name: "Home Power", etc.

  # Computed source - NO auto-metadata
  net_power:
    type: computed
    expression: "solar - consumption"
    dependencies:
      solar: solar
      consumption: consumption

    # ✅ REQUIRED: Computed sources need metadata config
    metadata:
      unit_of_measurement: "W"
      friendly_name: "Net Power Flow"
      device_class: "power"
      icon: "mdi:transmission-tower"
      # Without this, net_power.metadata would be empty!

overlays:
  # Now metadata is available for all sources
  - type: text
    content: "{solar.metadata.friendly_name}: {solar.v:.0f}{solar.metadata.unit_of_measurement}"

  - type: text
    content: "{net_power.metadata.friendly_name}: {net_power.v:.0f}{net_power.metadata.unit_of_measurement}"
    # Works because we provided metadata! ✅
```

### Metadata Configuration Reference

**Supported Metadata Properties:**

| Property | Type | Description | Example |
|----------|------|-------------|---------|
| `unit_of_measurement` | string | Unit of measure | `"°C"`, `"kWh"`, `"%"`, `"W"` |
| `friendly_name` | string | Display name | `"Living Room Temperature"` |
| `device_class` | string | Device type | `"temperature"`, `"power"`, `"humidity"` |
| `state_class` | string | State behavior | `"measurement"`, `"total"` |
| `icon` | string | MDI icon name | `"mdi:thermometer"`, `"mdi:flash"` |
| `area` | string | Room/area | `"living_room"`, `"bedroom"` |
| `device_id` | string | Device ID | Custom identifier |

**Configuration Syntax:**

```yaml
data_sources:
  my_source:
    type: entity  # or computed
    entity: sensor.example  # (if entity type)

    # Optional metadata overrides
    metadata:
      unit_of_measurement: "kW"
      friendly_name: "Custom Display Name"
      device_class: "power"
      icon: "mdi:flash"
```

### Complete Example: Mixed Unit Computed Source

When computing from sensors with different units, specify the result unit:

```yaml
data_sources:
  # Temperature in Celsius
  indoor_temp:
    type: entity
    entity: sensor.indoor_temperature
    # Has: unit_of_measurement: "°C"

  # Temperature in Fahrenheit
  outdoor_temp:
    type: entity
    entity: sensor.outdoor_temperature
    # Has: unit_of_measurement: "°F"

  # Computed average (converted to Celsius)
  avg_temp:
    type: computed
    expression: "(indoor + (outdoor - 32) * 5/9) / 2"
    dependencies:
      indoor: indoor_temp
      outdoor: outdoor_temp
    # Specify result metadata
    metadata:
      unit_of_measurement: "°C"
      friendly_name: "Average Temperature"
      device_class: "temperature"
      icon: "mdi:thermometer"

overlays:
  - type: text
    content: "{avg_temp.metadata.friendly_name}: {avg_temp.v:.1f}{avg_temp.metadata.unit_of_measurement}"
    # Output: "Average Temperature: 22.5°C" ✅
```

### Metadata Flow Diagram

```mermaid
sequenceDiagram
    participant HA as Home Assistant
    participant DS as DataSource
    participant Meta as Metadata Object
    participant Overlay as Text Overlay

    HA->>DS: Entity state update
    Note over HA,DS: attributes.unit_of_measurement: "°C"<br/>attributes.friendly_name: "Living Room"

    DS->>Meta: Extract metadata
    Note over Meta: Store in metadata object

    DS->>Overlay: Emit data with metadata
    Note over DS,Overlay: data = { v: 23.5, metadata: {...} }

    Overlay->>Overlay: Process template
    Note over Overlay: "{temperature.v:.1f}{temperature.metadata.unit_of_measurement}"

    Overlay->>Overlay: Render
    Note over Overlay: Display: "23.5°C"
```

### Helper Method: getDisplayName()

DataSources provide a convenience method for getting the friendly name:

```javascript
// In browser console or custom expressions
const source = window.cblcars.debug.msd.systems.dataSourceManager.getSource('temperature');
console.log(source.getDisplayName());
// Output: "Living Room Temperature" or entity_id if no friendly_name
```

### Common Patterns

#### Pattern 1: Labeled Value with Units

```yaml
overlays:
  - type: text
    content: "{temp.metadata.friendly_name}: {temp.v:.1f}{temp.metadata.unit_of_measurement}"
    # Output: "Living Room Temperature: 23.5°C"
```

#### Pattern 2: Multi-Sensor Dashboard

```yaml
data_sources:
  temp:
    type: entity
    entity: sensor.temperature
  humidity:
    type: entity
    entity: sensor.humidity
  pressure:
    type: entity
    entity: sensor.pressure

overlays:
  # Temperature
  - type: text
    content: "{temp.metadata.friendly_name}"
    position: [100, 100]
  - type: text
    content: "{temp.v:.1f}{temp.metadata.unit_of_measurement}"
    position: [100, 140]

  # Humidity
  - type: text
    content: "{humidity.metadata.friendly_name}"
    position: [400, 100]
  - type: text
    content: "{humidity.v:.0f}{humidity.metadata.unit_of_measurement}"
    position: [400, 140]

  # Pressure
  - type: text
    content: "{pressure.metadata.friendly_name}"
    position: [700, 100]
  - type: text
    content: "{pressure.v:.1f}{pressure.metadata.unit_of_measurement}"
    position: [700, 140]
```

#### Pattern 3: Dynamic Titles

```yaml
# Page title from entity name
- type: text
  id: page_title
  content: "{sensor.metadata.friendly_name} Monitor"
  position: [100, 50]
  style:
    font_size: 32
    color: var(--lcars-blue)
```

### Best Practices

✅ **Do:**
- Use `metadata.unit_of_measurement` for automatic units
- Use `metadata.friendly_name` for display labels
- Reference dependency metadata for computed sources
- Test with entities that may not have all metadata properties

❌ **Don't:**
- Hardcode units when metadata provides them
- Assume all entities have all metadata properties
- Forget that computed sources don't auto-capture metadata

### Troubleshooting Metadata

**Metadata is null or missing:**
```javascript
// Check if datasource is connected
const source = window.cblcars.debug.msd.systems.dataSourceManager.getSource('my_source');
console.log('Metadata:', source.metadata);
console.log('Entity:', source.cfg.entity);
```

**Entity doesn't have unit_of_measurement:**
- Some entities (like binary sensors, text sensors) don't have units
- Check in Home Assistant Developer Tools → States
- Use conditional templates: `{temp.metadata.unit_of_measurement || ""}`

**Friendly name shows entity_id:**
- Entity might not have `friendly_name` attribute set
- CB-LCARS falls back to `entity_id` automatically
- Set friendly name in Home Assistant entity customization

---

## �🔄 Transformations

Transformations process data as it flows through the datasource. They can be chained for complex processing.

```mermaid
graph LR
    Raw[Raw Value<br/>75.2°F] --> Conv[Unit Conversion<br/>°F → °C]
    Conv --> Value1[24°C]

    Value1 --> Scale[Scale<br/>0-40°C → 0-100%]
    Scale --> Value2[60%]

    Value2 --> Smooth[Exponential<br/>Smoothing]
    Smooth --> Final[58.5%<br/>smoothed]

    Final --> Overlay[Available to<br/>Overlays]

    style Raw fill:#4d94ff,stroke:#0066cc,color:#fff
    style Conv fill:#ff9933,stroke:#cc6600,color:#fff
    style Scale fill:#ff9933,stroke:#cc6600,color:#fff
    style Smooth fill:#ff9933,stroke:#cc6600,color:#fff
    style Final fill:#00cc66,stroke:#009944,color:#fff
```

### Transformation Pipeline Flow

Each transformation:
1. Takes input value (raw or from previous transformation)
2. Processes it according to its type
3. Outputs result with a **key** for access
4. Passes to next transformation in chain

### Quick Examples

**Unit Conversion:**
```yaml
transformations:
  - type: unit_conversion
    from: "°F"
    to: "°C"
    key: "celsius"
```

**Scaling:**
```yaml
transformations:
  - type: scale
    input_range: [0, 100]
    output_range: [0, 255]
    key: "rgb_value"
```

**Smoothing:**
```yaml
transformations:
  - type: smooth
    method: "exponential"
    alpha: 0.3
    key: "smoothed"
```

**Expressions:**
```yaml
transformations:
  - type: expression
    expression: "value * 1.1 + 5"
    key: "adjusted"
```

### Transformation Pipeline

Transformations are applied in order, with results available by key:

```yaml
data_sources:
  complex_sensor:
    type: entity
    entity: sensor.raw_value
    transformations:
      # Step 1: Convert units
      - type: unit_conversion
        from: "°F"
        to: "°C"
        key: "celsius"

      # Step 2: Scale to percentage
      - type: scale
        input_range: [-10, 40]
        output_range: [0, 100]
        key: "percentage"

      # Step 3: Smooth the result
      - type: smooth
        method: "exponential"
        alpha: 0.3
        key: "smoothed"
```

Access results:
```yaml
overlays:
  - content: "Raw: {complex_sensor.value}°F"
  - content: "Celsius: {complex_sensor.transformations.celsius}°C"
  - content: "Percent: {complex_sensor.transformations.percentage}%"
  - content: "Smooth: {complex_sensor.transformations.smoothed}%"
```

**See:** [Transformation Reference](datasource-transformations.md) for complete transformation documentation.

---

## 📊 Aggregations

Aggregations calculate statistics over time-windowed data.

### Quick Examples

**Moving Average:**
```yaml
aggregations:
  - type: moving_average
    window: "5m"
    key: "avg_5m"
```

**Min/Max Tracking:**
```yaml
aggregations:
  - type: min_max
    window: "1h"
    key: "hourly_range"
```

**Rate of Change:**
```yaml
aggregations:
  - type: rate_of_change
    unit: "per_minute"
    key: "rate"
```

**Trend Detection:**
```yaml
aggregations:
  - type: recent_trend
    samples: 10
    threshold: 0.01
    key: "trend"
```

### Multiple Aggregations

Combine aggregations for comprehensive analysis:

```yaml
data_sources:
  temperature_analysis:
    type: entity
    entity: sensor.temperature
    windowSeconds: 3600  # 1 hour buffer
    aggregations:
      - type: moving_average
        window: "10m"
        key: "avg_10m"

      - type: moving_average
        window: "30m"
        key: "avg_30m"

      - type: min_max
        window: "1h"
        key: "hourly"

      - type: rate_of_change
        unit: "per_minute"
        key: "rate"

      - type: recent_trend
        samples: 12
        key: "trend"
```

Access results:
```yaml
overlays:
  - content: "10m avg: {temperature_analysis.aggregates.avg_10m}"
  - content: "30m avg: {temperature_analysis.aggregates.avg_30m}"
  - content: "Hourly min: {temperature_analysis.aggregates.hourly.min}"
  - content: "Rate: {temperature_analysis.aggregates.rate}"
  - content: "Trend: {temperature_analysis.aggregates.trend.direction}"
```

**See:** [Aggregation Reference](datasource-aggregations.md) for complete aggregation documentation.

---

## 🧮 Computed Sources

Computed sources derive values from other datasources using JavaScript expressions.

### Simple Calculation

```yaml
data_sources:
  temp_fahrenheit:
    type: entity
    entity: sensor.temperature_f

  temp_celsius:
    type: computed
    expression: "(temp - 32) * 5/9"
    dependencies:
      temp: temp_fahrenheit
```

### Multi-Source Calculation

```yaml
data_sources:
  solar_power:
    type: entity
    entity: sensor.solar_production

  home_power:
    type: entity
    entity: sensor.home_consumption

  battery_power:
    type: entity
    entity: sensor.battery_power

  net_power:
    type: computed
    expression: "solar - home + battery"
    dependencies:
      solar: solar_power
      home: home_power
      battery: battery_power
```

### Using Math Functions

```yaml
data_sources:
  wind_speed:
    type: entity
    entity: sensor.wind_speed

  wind_force:
    type: computed
    expression: "0.5 * 1.225 * Math.pow(speed, 2)"
    dependencies:
      speed: wind_speed
```

### Conditional Logic

```yaml
data_sources:
  temperature:
    type: entity
    entity: sensor.temperature

  comfort_level:
    type: computed
    expression: >
      temp < 18 ? 'cold' :
      temp < 22 ? 'comfortable' :
      temp < 26 ? 'warm' : 'hot'
    dependencies:
      temp: temperature
```

**See:** [Computed Sources Guide](computed-sources.md) for detailed examples.

---

## 📖 Using DataSources

### In Templates

Access datasource values in overlay content:

```yaml
overlays:
  - id: simple_value
    type: text
    content: "{temperature.value}°C"

  - id: transformation
    type: text
    content: "{temperature.transformations.fahrenheit}°F"

  - id: aggregation
    type: text
    content: "Avg: {temperature.aggregates.avg}°C"
```

### Dot Notation Access

DataSources expose values through dot notation:

- `.value` - Current processed value
- `.raw` - Original entity state
- `.timestamp` - Last update time (milliseconds)
- `.available` - Data availability (boolean)
- `.transformations.<key>` - Transformation result
- `.aggregates.<key>` - Aggregation result

### In Rules Engine

Use datasource values in conditional rendering:

```yaml
data_sources:
  cpu_temp:
    type: entity
    entity: sensor.cpu_temperature
    aggregations:
      - type: moving_average
        window: "5m"
        key: "avg"

overlays:
  - id: cpu_warning
    type: text
    content: "CPU Hot!"
    rules:
      - conditions:
          - datasource: cpu_temp.aggregates.avg
            operator: ">"
            value: 70
        properties:
          style:
            fill: var(--lcars-red)
```

### Multi-Line Content

Display multiple datasource values:

```yaml
overlays:
  - id: stats_display
    type: text
    content: |
      Current: {temperature.value}°C
      Average: {temperature.aggregates.avg}°C
      Trend: {temperature.aggregates.trend.direction}
      Min/Max: {temperature.aggregates.range.min} / {temperature.aggregates.range.max}
```

---

## ⚡ Performance Tuning

### Buffer Size

Control memory usage with `windowSeconds`:

```yaml
data_sources:
  fast_sensor:
    windowSeconds: 60      # Small buffer for recent data only

  analysis_sensor:
    windowSeconds: 3600    # Large buffer for long-term analysis
```

**Guideline:** Use smallest window that meets your aggregation requirements.

### Update Throttling

Control update frequency:

```yaml
data_sources:
  high_frequency_sensor:
    minEmitMs: 1000        # Update at most once per second
    coalesceMs: 100        # Batch updates within 100ms
    maxDelayMs: 2000       # Force update after 2 seconds max
```

**Use Cases:**
- High-frequency sensors (updating many times per second)
- Rate-limited APIs
- Reducing overlay re-renders

### Historical Preload

Control history loading:

```yaml
data_sources:
  # Don't preload if not needed
  simple_sensor:
    history:
      enabled: false

  # Minimal history for recent trends
  recent_sensor:
    history:
      enabled: true
      hours: 1

  # Extended history for daily patterns
  pattern_sensor:
    history:
      enabled: true
      hours: 24
```

**Guideline:** Only preload history if using aggregations that need it.

---

## 🐛 Troubleshooting

### DataSource Not Updating

**Problem:** Overlay shows old/no data.

**Checklist:**
1. Verify entity exists in Home Assistant
2. Check entity ID spelling
3. Ensure entity has a valid state
4. Check browser console for errors
5. Verify datasource name in template

**Debug:**
```yaml
data_sources:
  debug_sensor:
    type: entity
    entity: sensor.test
    emitOnSameValue: true  # Force updates even if value same
```

### Transformation Not Applied

**Problem:** Transformation result is undefined.

**Checklist:**
1. Verify `key` property is set
2. Check transformation type spelling
3. Verify input parameters (from/to units, ranges, etc.)
4. Check browser console for transformation errors

**Access:**
```yaml
# Wrong:
content: "{sensor.celsius}"

# Correct:
content: "{sensor.transformations.celsius}"
```

### Aggregation Shows No Data

**Problem:** Aggregation result is undefined or null.

**Checklist:**
1. Verify `windowSeconds` is large enough for aggregation window
2. Ensure sufficient data in buffer (check `history.hours`)
3. Wait for data to accumulate (moving averages need samples)
4. Verify aggregation `key` spelling

**Example:**
```yaml
data_sources:
  temp_avg:
    windowSeconds: 600     # 10 minutes
    aggregations:
      - type: moving_average
        window: "5m"        # Window must fit in buffer
        key: "avg"
```

### High Memory Usage

**Problem:** Card using too much memory.

**Solutions:**
1. Reduce `windowSeconds` for datasources
2. Reduce `history.hours` preload
3. Limit number of datasources
4. Use smaller aggregation windows

### Computed Source Returns NaN

**Problem:** Computed expression returns NaN.

**Causes:**
1. Dependency datasource not ready
2. Division by zero
3. Invalid mathematical operation
4. Missing dependency

**Solution:**
```yaml
# Add validation in expression
expression: "temp > 0 ? (other / temp) : 0"
```

---

## 📚 Related Documentation

### Architecture
- [DataSource System Architecture](../../architecture/subsystems/datasource-system.md)
- [Data Flow](../../architecture/overview.md#data-flow-pipeline)

### Configuration References
- [Transformation Reference](datasource-transformations.md) - Complete transformation documentation
- [Aggregation Reference](datasource-aggregations.md) - Complete aggregation documentation (includes rolling statistics)
- [Computed Sources Guide](computed-sources.md) - Detailed computed source examples

### Examples
- [DataSource Examples](../examples/datasource-examples.md) - Comprehensive examples
- [ApexCharts Integration](../examples/apexcharts-examples.md) - Chart examples with rolling statistics

### New Features
- ⭐ **Nested Attribute Paths** - Access complex entity structures with dot notation
- ⭐ **Metadata Overrides** - Customize display properties and units
- ⭐ **Rolling Statistics** - Multi-value aggregations for advanced charts

---

**Last Updated:** October 31, 2025
**Version:** 2025.10.1-fuk.42-69
