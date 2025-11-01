# Base SVG Filters

Apply visual filters to the base SVG layer to make overlays more prominent while keeping overlays crisp and clear.

## Quick Start

**Apply a preset**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed
```

**Custom filters**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filters:
    opacity: 0.5
    blur: "3px"
```

**Combine preset with overrides**:
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed
  filters:
    opacity: 0.3  # Override preset's 0.5
```

---

## Filter Types

### Opacity
Controls transparency of base SVG (0.0 = invisible, 1.0 = fully opaque).

```yaml
filters:
  opacity: 0.5  # 50% transparent
```

**Use cases**: Dim background artwork to emphasize overlays.

### Blur
Applies Gaussian blur (softens focus).

```yaml
filters:
  blur: "3px"  # Moderate blur
```

**Use cases**: Create depth, de-emphasize background detail.

### Brightness
Adjusts brightness level (1.0 = normal, <1.0 = darker, >1.0 = brighter).

```yaml
filters:
  brightness: 0.7  # 30% darker
```

**Use cases**: Darken background, adjust visibility.

### Contrast
Adjusts contrast (1.0 = normal, <1.0 = lower contrast, >1.0 = higher contrast).

```yaml
filters:
  contrast: 0.8  # Reduce contrast
```

**Use cases**: Soften harsh edges, mute colors.

### Grayscale
Converts to grayscale (0.0 = full color, 1.0 = completely gray).

```yaml
filters:
  grayscale: 0.5  # 50% desaturated
```

**Use cases**: Monochrome displays, reduced visual weight.

### Sepia
Applies sepia tone (warm brown tint).

```yaml
filters:
  sepia: 0.3  # Slight warmth
```

**Use cases**: Vintage aesthetic, warm backgrounds.

### Hue Rotate
Rotates colors around the color wheel (in degrees).

```yaml
filters:
  hue_rotate: 45  # Shift hues by 45 degrees
```

**Use cases**: Color theme adjustments, alert states.

### Saturate
Adjusts color saturation (1.0 = normal, <1.0 = less saturated, >1.0 = more saturated).

```yaml
filters:
  saturate: 0.6  # Reduce saturation
```

**Use cases**: Mute vibrant colors, adjust visual intensity.

### Invert
Inverts colors (0.0 = normal, 1.0 = fully inverted).

```yaml
filters:
  invert: 0.2  # Slight inversion
```

**Use cases**: High-contrast themes, special effects.

---

## Built-in Presets

### `none`
Clear all filters (remove filtering).

```yaml
# No filters applied
filter_preset: none
```

**Best for**: Removing filters, returning to unfiltered state.

### `dimmed`
Reduces opacity and brightness for subtle background.

```yaml
# Equivalent to:
filters:
  opacity: 0.5
  brightness: 0.8
```

**Best for**: General use, balanced visibility.

### `subtle`
Light dimming with slight blur and desaturation.

```yaml
# Equivalent to:
filters:
  opacity: 0.6
  blur: "1px"
  grayscale: 0.2
```

**Best for**: Maintaining detail while reducing emphasis.

### `backdrop`
Heavy dimming with blur for strong overlay emphasis.

```yaml
# Equivalent to:
filters:
  opacity: 0.3
  blur: "3px"
  brightness: 0.6
```

**Best for**: Data-heavy displays, prominent overlays.

### `faded`
Desaturated and dimmed for muted background.

```yaml
# Equivalent to:
filters:
  opacity: 0.4
  grayscale: 0.5
  contrast: 0.7
```

**Best for**: Minimal aesthetic, reduced visual clutter.

### `red-alert`
Brightened with warm hue shift for alert state.

```yaml
# Equivalent to:
filters:
  opacity: 0.7
  brightness: 1.2
  hue_rotate: -30
  saturate: 1.5
```

**Best for**: Alert states, emergency displays.

### `monochrome`
Full grayscale with enhanced contrast.

```yaml
# Equivalent to:
filters:
  grayscale: 1.0
  contrast: 1.2
  brightness: 0.9
```

**Best for**: Professional displays, reduced color distraction.

---

## Overlay-Only Mode

Create cards without any base SVG (pure overlay displays).

```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1920, 1200]  # REQUIRED when source is "none"

overlays:
  - type: status_grid
    id: main_grid
    # ... overlay config
```

**Requirements**:
- `view_box` must be explicitly defined (4-element array)
- No anchor extraction (all overlays need explicit coordinates)

**Use cases**:
- Pure data displays
- Custom overlay compositions
- ApexCharts-only cards
- Testing/prototyping

---

## Theme Overrides

Themes can define custom filter presets.

**Theme YAML**:
```yaml
lcars-custom:
  name: "LCARS Custom"
  msd:
    filter_presets:
      dimmed:
        opacity: 0.3  # Override built-in 0.5
        blur: "2px"   # Add blur

      custom-preset:
        opacity: 0.4
        grayscale: 0.8
        contrast: 1.1
```

**Card Config**:
```yaml
theme: lcars-custom
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed  # Uses theme override
```

**Priority**: Theme presets override built-in presets, explicit filters override everything.

---

## Dynamic Filters with Rules

Change filters dynamically based on entity states, time, or conditions using the Rules Engine.

### Basic Rule-Based Filter

Apply filters when conditions are met:

```yaml
msd:
  version: 1
  base_svg:
    source: builtin:ncc-1701-d
    filters:
      opacity: 0.6  # Default filter

  rules:
    - id: night_dimming
      when:
        entity: sensor.time
        time:
          after: "22:00"
          before: "06:00"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.2
              brightness: 0.5
            transition: 2000  # 2-second smooth transition
```

**How It Works**:
1. Rules are evaluated when entity states change
2. When conditions match, the `update_base_svg_filter` action applies new filters
3. Filters transition smoothly (default: 1000ms)
4. Filters persist until another rule changes them

### Using Filter Presets in Rules

Use named presets for quick style changes:

```yaml
rules:
  - id: alert_mode
    when:
      entity: binary_sensor.critical_alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
          transition: 500  # Fast transition for urgency
```

### Combining Presets and Custom Filters

Start with a preset and override/add specific filters:

```yaml
rules:
  - id: away_mode
    when:
      entity: input_boolean.away_mode
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "dimmed"    # Start with preset
          filters:
            blur: "2px"              # Add blur
            grayscale: 0.5           # Add grayscale
          transition: 1500
```

**Priority**: Explicit `filters` override matching properties in `filter_preset`.

### Multiple Rules with Priority

Use priority to handle multiple states:

```yaml
rules:
  # Highest priority - critical alert
  - id: critical_alert
    priority: 100
    when:
      entity: sensor.cpu_temp
      above: 80
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
    stop: true  # Don't evaluate other rules

  # Medium priority - warning
  - id: warning_alert
    priority: 50
    when:
      entity: sensor.cpu_temp
      above: 70
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.5
            hue_rotate: "30deg"

  # Low priority - normal state
  - id: normal_mode
    priority: 10
    when:
      entity: sensor.cpu_temp
      below: 70
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.6
            brightness: 0.9
```

### Complete Example: Time-Based Auto-Dimming

```yaml
msd:
  version: 1

  base_svg:
    source: builtin:ncc-1701-d
    filters:
      opacity: 0.6  # Default daytime setting

  overlays:
    - id: mode_indicator
      type: text
      text: "Day Mode"
      position: [100, 50]

  rules:
    # Night mode (10pm - 6am)
    - id: night_mode
      priority: 100
      when:
        all:
          - entity: sensor.time  # Required for time-based triggers
          - time:
              after: "22:00"
              before: "06:00"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.2
              brightness: 0.5
              blur: "1px"
            transition: 2000
        overlays:
          - id: mode_indicator
            style:
              text: "Night Mode"

    # Day mode (6am - 10pm)
    - id: day_mode
      priority: 90
      when:
        all:
          - entity: sensor.time
          - time:
              after: "06:00"
              before: "22:00"
      apply:
        actions:
          - type: update_base_svg_filter
            filters:
              opacity: 0.6
              brightness: 0.9
            transition: 2000
        overlays:
          - id: mode_indicator
            style:
              text: "Day Mode"
```

### Clearing Filters with Rules

Remove all filtering by using the `none` preset or empty filters:

```yaml
rules:
  # Apply filter when alert is active
  - id: alert_active
    priority: 100
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
          transition: 500

  # Clear filter when alert clears
  - id: alert_clear
    priority: 90
    when:
      entity: binary_sensor.alert
      state: "off"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "none"  # Clear all filters
          transition: 1000

# Alternative: use empty filters object
rules:
  - id: normal_mode
    when:
      entity: input_boolean.normal_mode
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filters: {}  # Clear all filters
          transition: 1000
```

**See also**: [Rules Documentation](rules.md) for complete rules syntax and examples.

---

## Technical Details

### Filter Isolation

Filters apply **only to base SVG content**, not to overlays. This is achieved by wrapping base SVG content in an internal group:

```html
<svg viewBox="0 0 1920 1200">
  <g id="__msd-base-content" style="filter: blur(3px)">
    <!-- Base SVG ship template - FILTERED -->
  </g>
  <g id="msd-overlay-container">
    <!-- Overlays - NOT filtered, remain crisp -->
  </g>
</svg>
```

**Result**: Base artwork is filtered while overlays, status grids, buttons, and text remain sharp and clear.

### Reserved IDs

IDs starting with `__` (double underscore) or `msd-internal-` are reserved for internal MSD use:
- `__msd-base-content` - Base SVG content wrapper (for filter isolation)
- Not extracted as anchors
- Not validated as user anchors
- Invisible to anchor system

**User anchors**: Can use any ID except those starting with `__` or `msd-internal-`.

### Performance

- **GPU-accelerated**: CSS filters use hardware acceleration
- **Single application**: Filters applied once after initial render
- **No overhead**: No ongoing performance impact
- **Optional transitions**: CSS-based animations available

### Time-Based Rules (Important)

The RulesEngine is **reactive**, not proactive - rules only evaluate when entity states change. For time-based filter changes, you must use an entity that updates regularly.

**Recommended Approach**: Use `sensor.time` (updates every minute)

```yaml
# Ensure sensor.time exists in Home Assistant configuration.yaml:
sensor:
  - platform: time_date
    display_options:
      - 'time'
```

**Why This Works**:
1. `sensor.time` updates every minute
2. Rules referencing `sensor.time` are marked "dirty" and evaluated
3. Rules **not** referencing `sensor.time` are skipped (no overhead)
4. The `time_between` condition is checked during evaluation

**Performance Impact**: Minimal (~2-5ms per time-based rule per minute)
- The RulesEngine uses dependency tracking
- Only rules that reference `sensor.time` are evaluated
- All other rules remain idle
- Safe to have 5-10 time-based rules with no noticeable performance impact

**Example**:
```yaml
rules:
  - id: night_mode_auto
    when:
      all:
        - entity: sensor.time           # Triggers evaluation every minute
        - time_between: "22:00-06:00"   # Checked when rule evaluates
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.3
```

See Example 4 in the Examples section for a complete time-based night mode implementation.

---

## Examples

### Example 1: Subtle Background with Sharp Data

```yaml
base_svg:
  source: builtin:enterprise-d-shuttlecraft15-anomaly
  filter_preset: subtle

overlays:
  - type: status_grid
    id: systems
    cells:
      - label: "Warp Core"
        value: "[[state.sensor.warp_temp]]°K"
      - label: "Shields"
        value: "[[state.sensor.shield_percent]]%"
```

**Effect**: Ship schematic subtly faded, system status grid prominently visible.

### Example 2: Heavy Blur for Data Focus

```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filters:
    opacity: 0.3
    blur: "5px"
    brightness: 0.5

overlays:
  - type: apexchart
    id: main_chart
    width: 800
    height: 600
    # Chart data configuration...
```

**Effect**: Ship heavily blurred in background, chart data is primary focus.

### Example 3: Alert State with Color Shift

```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: "[[state.binary_sensor.alert == 'on' ? 'red-alert' : 'dimmed']]"

overlays:
  - type: text
    id: alert_status
    content: "[[state.binary_sensor.alert == 'on' ? 'RED ALERT' : 'Normal Operations']]"
```

**Effect**: Dynamic filter changes based on alert state.

### Example 4: Time-Based Night Mode

For time-based rules, the RulesEngine is reactive (only evaluates when entities change). To trigger rules based purely on time, use Home Assistant's `sensor.time` which updates every minute:

```yaml
# First, ensure sensor.time exists in Home Assistant
# It's usually available by default, or add to configuration.yaml:
# sensor:
#   - platform: time_date
#     display_options:
#       - 'time'

# Then use it in rules to trigger time-based filter changes:
rules:
  - id: dim_at_night
    priority: 100
    when:
      all:
        - entity: sensor.time        # Updates every minute, triggers rule evaluation
        - time_between: "22:00-06:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.3
            brightness: 0.6

  - id: normal_during_day
    priority: 90
    when:
      all:
        - entity: sensor.time
        - time_between: "06:00-22:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.5
            brightness: 0.8
```

**Effect**: Base SVG automatically dims at night (10pm-6am) and returns to normal during the day. The `sensor.time` entity ensures rules are evaluated every minute, with minimal overhead (only time-based rules are evaluated, others are skipped).

**Performance Note**: Using `sensor.time` is efficient - the RulesEngine uses dependency tracking to only evaluate rules that reference `sensor.time`, skipping all other rules (typically <5ms overhead per minute).

### Example 5: Pure Overlay Display

```yaml
base_svg:
  source: "none"
view_box: [0, 0, 1200, 800]

overlays:
  - type: apexchart
    id: performance_chart
    x: 0
    y: 0
    width: 1200
    height: 800
    # Full-screen chart, no background artwork
```

**Effect**: Clean data visualization without base SVG artwork.

---

## Best Practices

### 1. Start with Presets
Use built-in presets as starting points, then customize as needed:

```yaml
base_svg:
  filter_preset: dimmed
  filters:
    opacity: 0.3  # Adjust to taste
```

### 2. Test Readability
Ensure overlay text and data remain readable:
- Avoid excessive blur (>5px) if overlays contain small text
- Maintain sufficient contrast between base and overlays
- Test on target display device

### 3. Consider Theme
Coordinate with LCARS theme colors:
- `grayscale` works well with monochrome themes
- `hue_rotate` can align with theme accent colors
- Test with multiple themes if supporting theme switching

### 4. Performance
- Use CSS filters (not SVG filter defs) for best performance
- Avoid unnecessary filter changes during runtime
- Keep blur values reasonable (<10px)

### 5. Accessibility
- Don't rely solely on color filters for information
- Maintain readable contrast ratios
- Test with colorblind simulation tools

---

## Troubleshooting

**Filters affect overlays**:
- Should not happen with proper implementation
- Verify you're using latest version (v2025.10.1-msd.13.69+)
- Check browser console for errors

**Preset not working**:
- Verify preset name matches built-in or theme preset
- Check theme is loaded correctly
- Use explicit `filters` to test if preset resolution is issue

**Performance issues**:
- Reduce blur amount (<3px recommended)
- Avoid excessive filter changes
- Check GPU acceleration is enabled in browser

**Filters not visible**:
- Verify base_svg has content to filter
- Check filter values are in valid ranges
- Inspect element in DevTools to see computed styles

---

## Migration from Unfiltered Cards

No migration needed - filters are opt-in:

**Before** (still works):
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
# No filters
```

**After** (with filters):
```yaml
base_svg:
  source: builtin:ncc-1701-a-blue
  filter_preset: dimmed  # Add filters when ready
```

---

## See Also

- [Theme Creation Tutorial](../advanced/theme_creation_tutorial.md) - Creating custom filter presets
- [MSD Schema](../../architecture/MSD_SCHEMA_V1_Ratified.yaml) - Complete base_svg configuration
- [BASE_SVG_ENHANCEMENTS Implementation](../../proposals/done/BASE_SVG_ENHANCEMENTS_IMPLEMENTATION.md) - Technical details
