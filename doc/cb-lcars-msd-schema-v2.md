# LCARS MSD Card Schema v2

## Introduction

The **LCARS MSD Card** enables you to create interactive, animated, and highly customizable Master Systems Display (MSD) overlays in Home Assistant, inspired by Star Trek's iconic LCARS interface. This documentation covers all available options, customization, overloading/merging logic, and provides clear YAML examples for each feature.

---

## What is MSD?

**MSD** (Master Systems Display) is a schematic SVG-based visualization, overlaid with dynamic "callouts" (labels, lines, animations) that reflect the state of your Home Assistant entities. Each callout can be styled, animated, and made interactive, with deep support for state-based customization and reusable presets.

---

## Quick Start Example

```yaml
type: custom:cb-lcars-msd-card
variables:
  msd:
    base_svg: /local/lcars/defiant.svg  # Path to your SVG file
    x_offset: 8                         # Default horizontal offset for line-to-text attachment
    y_offset: -4                        # Default vertical offset for line-to-text attachment
    text_width_multiplier: 0.3          # Used for smart line attachment to text
    slots:
      warp_core:
        callout:
          entity: sensor.warp_core_temp
          text:
            value: |
              [[[ return `Core Temp: ${entity.state}°C`; ]]]
            position: warp_core_label   # Anchor id from SVG
            font_size: 18px
            align: left
            text_transform: uppercase     # 'uppercase', 'lowercase', 'capitalize'
            color: var(--primary-text-color)
          anchor: warp_core            # Anchor id from SVG
          line:
            width: 2
            rounded: true
            stroke_dasharray: "1,6"    # Dotted line: 1px dot, 6px gap
            stroke_linecap: "round"
            animation:
              type: march
              duration: 2s
          visible: |
            [[[ return entity.state > 0; ]]]
```

> **[IMAGE PLACEHOLDER: Example MSD overlay with callouts, lines, and animated dots]**

---

## MSD Schema Overview

### Top-Level Structure

| Key         | Type   | Description                                  |
|-------------|--------|----------------------------------------------|
| base_svg    | string | Path or built-in key for the base SVG        |
| x_offset    | number | Default x offset for line-to-text attachment |
| y_offset    | number | Default y offset for line-to-text attachment |
| text_width_multiplier | number | Estimate text width for smart line attachment |
| presets     | object | Built-in style/behavior presets              |
| custom_presets | object | User-defined/overriding presets           |
| state_resolver | object | Global state-based style resolver         |
| slots       | object | Named overlays, each with a `callout`        |
| callouts    | array  | List of overlays by coordinates              |

---

## SVG Anchors

Define anchor points in your SVG using `<circle>` or `<text>` elements with unique `id` attributes. These are used for precise overlay attachment.

```xml
<circle id="warp_core" cx="90" cy="90" r="4" opacity="0"/>
<text id="life_support_label" x="320" y="85" font-size="14" opacity="0">LSA</text>
```

- Use `opacity="0"` for invisible anchors.
- Only `<circle>` and `<text>` with `id` are supported as anchors.

> **[IMAGE PLACEHOLDER: SVG with anchor points highlighted]**

---

## Callouts: Anatomy & Customization

Each callout is a deeply customizable overlay, defined either in `slots` (named) or `callouts` (array).

### Callout Structure

| Key          | Type    | Description                                                       |
|--------------|---------|-------------------------------------------------------------------|
| entity       | string  | Home Assistant entity_id (used when using simple state matching)                               |
| *attribute    | string  | Optional attribute to use instead of state                        |
| preset       | string  | Name of preset to use (optional)                                  |
| text         | object  | Label text and styling (see below)                                           |
| anchor       | [x, y] or string | Where the line terminates (coordinates or anchor id)      |
| line         | object  | Line geometry and style (see below)                                          |
| visible      | bool/string/template | Show/hide callout (JS template allowed)               |
| animation    | object  | Animation for callout (see below)                                 |
| state_resolver | object | Per-callout state-based style resolver (see below)                          |

#### Example: Verbose Callout

```yaml
callout:
  entity: sensor.hull_integrity  # Used by state_resolver as a default
  attribute: null                # Use state by default
  preset: warning                # Use the 'warning' preset for styling
  text:
    value: |
      [[[ return `Hull: ${entity.state}%`; ]]]  # JS template for label
    position: [88%, 12%]          # Absolute or percent coordinates, or anchor id
    font_size: 16px
    font_weight: bold
    font_family: 'Antonio'
    align: left                   # Align text to the left in the box
    text_transform: uppercase     # 'uppercase', 'lowercase', 'capitalize'
    color: blue
    line_attach: right
    x_offset: 8
    y_offset: 0
  anchor: [90%, 15%]              # Where the line ends (can be anchor id)
  line:
    points: [[88%, 12%], [90%, 15%]]  # Optional - more than 2 sets creates a polyline
    width: 2
    rounded: true
    corner_radius: 12
    color: blue
    stroke_dasharray: "5,5"       # Dashed line: 5px dash, 5px gap
    stroke_linecap: "round"
    stroke_linejoin: "round"
    opacity: 1
    animation:
      type: march
      duration: 2s
  visible: true
  animation:
    type: pulse
    duration: 1s
    color: blue
```

---

### Text Object

| Key         | Type      | Description                          |
|-------------|-----------|--------------------------------------|
| value       | string    | Label text (JS template supported)   |
| position    | [x, y] or string | Text coordinates or anchor id  |
| font_size   | string    | Font size (e.g., `16px`)             |
| font_weight | string    | Font weight                          |
| font_family | string    | Font family                          |
| color       | string    | Text color. For state-based colors, use `state_resolver`.                |
| align       | string    | `left`, `right`, `center`, `start`, `end`, `middle` |
| text_transform | string | CSS `text-transform` property (`uppercase`, `lowercase`, etc.). Note: Do not use `transform`, which is for geometric operations. |
| line_attach | string    | Where line meets text: `left`, `right`, `center`, etc. |
| x_offset    | number    | Additional x offset for line attachment |
| y_offset    | number    | Additional y offset for line attachment |
| animation   | object    | Animation for text label (see below)            |

#### Example: Text with Smart Line Attachment

```yaml
text:
  value: "Warp Core"
  position: warp_core_label
  font_size: 18px
  align: left
  line_attach: right
  x_offset: 8
  color: var(--primary-text-color)
```

---

### Line Object

| Key              | Type    | Description                                   |
|------------------|---------|-----------------------------------------------|
| points           | array   | Optional - Array of [x, y] points for the callout path (>2 creates a polyline)  |
| width            | number  | Line width (px)                               |
| rounded          | bool    | Rounded elbows/corners (default: true)        |
| corner_radius    | number  | Radius for rounded corners                    |
| smooth_tension   | number  | Tension for smoothed polyline curves (0-1, default 0.5) |
| color            | string  | Line color. For state-based colors, use `state_resolver`.              |
| stroke_dasharray | string  | SVG dash/gap pattern (e.g. `"5,5"` for dashed, `"1,6"` for dotted, `"none"` for solid) |
| stroke_linecap   | string  | `"butt"`, `"round"`, `"square"`               |
| stroke_linejoin  | string  | `"miter"`, `"round"`, `"bevel"`               |
| corner_style     | string  | `"round"`, `"bevel"`, `"miter"`, `"sharp"`    |
| opacity          | number  | Line opacity (0.0 to 1.0)                     |
| animation        | object  | Animation for the line                        |

**Note on the `color` property:**

- The `color` property is a string representing a valid CSS color.
- All state-based color changes must be handled by the `state_resolver`. The `state_resolver` can override the `color` value based on entity state.

This applies to both `text.color` and `line.color`.

#### Example: Animated Dotted Line

```yaml
line:
  width: 3
  stroke_dasharray: "1,6"   # 1px dot, 6px gap
  stroke_linecap: "round"
  color: orange
  animation:
    type: march
    duration: 2s
```

> **Tip:** Always use `state_resolver` for any dynamic styling, including color changes based on an entity's state.

---

### Animation Object

The `animation` object allows you to bring your MSD overlays to life. Animations can be applied to both `line` and `text` objects within a callout.

#### Common Animation Properties

All animation types share these common optional properties:

| Key       | Type          | Description                                                              |
|-----------|---------------|--------------------------------------------------------------------------|
| `duration`  | string/number | The length of the animation (e.g., `2000` for ms, or `'2s'`). Default: `1000`. |
| `delay`     | string/number | A delay before the animation starts (e.g., `500`).                       |
| `easing`    | string        | The animation timing function (e.g., `'linear'`, `'easeInOutQuad'`).      |
| `loop`      | boolean       | Set to `true` to make the animation repeat indefinitely.                 |
| `direction` | string        | Can be `'reverse'` or `'alternate'`.                                     |

---

#### Supported Animation Types

##### 1. `draw`
*   **Description:** Animates the stroke of a solid line, making it appear as if it's being drawn on the screen.
*   **Applies to:** Lines.
*   **Example:**
    ```yaml
    line:
      animation:
        type: draw
        duration: 3000
        # To "undraw" the line, use direction: 'reverse'
    ```

##### 2. `march`
*   **Description:** Creates the classic "marching ants" effect for dashed or dotted lines.
*   **Applies to:** Lines with a `stroke_dasharray` defined.
*   **Example:**
    ```yaml
    line:
      stroke_dasharray: "10,5" # A 10px dash followed by a 5px gap
      animation:
        type: march
        duration: 2000
        easing: 'linear' # Recommended for a smooth, continuous effect
    ```

##### 3. `blink`
*   **Description:** Causes an element to smoothly fade between two opacity values.
*   **Applies to:** Lines and text.
*   **Specific Options:**
    *   `min_opacity`: The lowest opacity value (defaults to `0.3`).
    *   `max_opacity`: The highest opacity value (defaults to `1`).
*   **Example:**
    ```yaml
    text:
      animation:
        type: blink
        duration: 1500
        min_opacity: 0.2
    ```

##### 4. `fade`
*   **Description:** A simple fade-in animation, from fully transparent to fully opaque.
*   **Applies to:** Lines and text.
*   **Example:**
    ```yaml
    text:
      animation:
        type: fade
        duration: 1000
        delay: 500
        # To fade out, use direction: 'reverse'
    ```

##### 5. `motionPath`
*   **Description:** Moves a "tracer" element along the callout's line path.
*   **Applies to:** The `line` object's animation.
*   **Required Option:**
    *   `tracer`: An object that defines the tracer's appearance.
*   **Tracer Options:**
    *   `shape`: `'circle'` (default) or `'rect'`.
    *   `size`: For `rect`, the width and height.
    *   `r`: For `circle`, the radius.
    *   Any other valid SVG attributes (`fill`, `stroke`, `stroke_width`, etc.).
*   **Example:**
    ```yaml
    line:
      # The line itself is just a path for the tracer to follow
      color: var(--lcars-gray)
      animation:
        type: motionpath
        duration: 5000
        loop: true
        tracer:
          shape: circle
          r: 5
          fill: var(--lcars-red)
    ```

##### 6. `morph`
*   **Description:** Transforms the shape of one line path into the shape of another.
*   **Applies to:** Lines.
*   **Required Option:**
    *   `morph_to_selector`: A CSS selector (e.g., `'#target-shape-id'`) that points to the destination `<path>` shape. The target path must exist in the SVG (it can be another callout's line).
*   **Specific Options:**
    *   `precision`: A number that defines the number of points for both paths, ensuring a smoother animation. Higher numbers are more precise but can be less performant. A value around `10` is a good starting point.
*   **Example:**
    ```yaml
    # This line will morph into the shape of the line with id="msd_line_1"
    line:
      animation:
        type: morph
        morph_to_selector: '#msd_line_1'
        precision: 10
        duration: 2000
        direction: alternate # Morphs back and forth
        loop: true
    ```

---

## Presets & Overloading

### Presets

Presets are reusable style/behavior definitions for callouts. They are merged in this order:

1. `default` preset (always applied)
2. Named preset (if specified via `preset`)
3. Callout's own properties
4. State-based overrides (from `state_resolver`)

#### Example: Defining and Using Presets

```yaml
presets:
  default:
    text:
      font_size: 16
      color: var(--primary-text-color)
      text_transform: uppercase
    line:
      width: 2
      color: var(--lcars-orange)
  warning:
    text:
      color: orange
    line:
      color: orange

# Usage in callout:
callout:
  entity: sensor.warp_core_temp
  preset: warning
  text:
    value: "Warning!"
    position: [50%, 50%]
```

#### Overriding Presets

You can override any preset property per callout, or define your own in `custom_presets`.

---

## State Resolver: Dynamic State-Based Styling

The **state_resolver** system allows you to style callouts based on the state or attribute of any entity, using flexible matchers. This enables highly flexible, context-aware styling for your MSD overlays.

### What is the State Resolver?

The state resolver lets you define a list of matchers (rules) for each callout (or globally), which can:
- Match on the state or attribute of any entity (not just the callout's main entity)
- Use operators like `equals`, `from`/`to` (range), `in`, `not_in`, `regex`
- Dynamically switch the callout's preset or override any style property when a match occurs

This system is inspired by the `custom_states` logic in `cb-lcars-base.yaml` and allows you to style any callout based on the state or attribute of any entity in Home Assistant.

### How It Works

- Each callout can define a `state_resolver` block (or inherit a global one).
- The `state_resolver` contains an array of `states` matchers.
- Each matcher can specify:
  - `entity`: The entity to match (optional, defaults to callout's `entity`)
  - `attribute`: The attribute to match (optional, defaults to callout's `attribute` if set, otherwise state)
  - Operator: `equals`, `not_equals`, `from`, `to`, `in`, `not_in`, `regex`
  - `preset`: Name of a preset to use if matched (optional)
  - `settings`: Style overrides to apply if matched (optional)
- The first matcher that matches is used. If no matcher matches, the default preset/callout config is used.

#### Callout `entity` and `attribute` as Defaults

- You can specify both `entity` and `attribute` at the callout level.
- If a matcher in `states` does **not** specify `entity` or `attribute`, it will use the callout's `entity` and `attribute` as defaults.
- This makes your config more concise and DRY.

#### Example: State-Based Styling

```yaml
state_resolver:
  enabled: true
  states:
    - entity: light.tv
      attribute: brightness
      from: 0
      to: 50
      preset: default
    - entity: light.tv
      attribute: brightness
      from: 51
      to: 100
      preset: warning
    - entity: sensor.alarm
      attribute: alarm_state
      regex: "^armed_.*$"
      settings:
        line:
          color: var(--lcars-orange)
```

- The first matching rule is applied.
- You can use `preset` or `settings` (deep-merged).

### Supported Operators

Each matcher can use one of the following operators (evaluated in this order):

1. **equals**
   Matches if value equals specified value (string or number).
   ```yaml
   - equals: "on"
     preset: warning
   ```
2. **not_equals**
   Matches if value does NOT equal specified value.
   ```yaml
   - not_equals: "off"
     settings:
       text:
         color: red
   ```
3. **from** / **to**
   Matches if value is within (inclusive) numeric range.
   ```yaml
   - from: 0
     to: 50
     preset: default
   ```
   You can use only `from` or only `to` for open-ended ranges.
4. **in**
   Matches if value is in provided array.
   ```yaml
   - in: ["idle", "paused"]
     preset: info
   ```
5. **not_in**
   Matches if value is NOT in provided array.
   ```yaml
   - not_in: ["unavailable", "unknown"]
     settings:
       line:
         color: green
   ```
6. **regex**
   Matches if value matches provided regular expression (string).
   ```yaml
   - regex: "^armed_.*$"
     preset: warning
   ```

> **First match wins:** Only the first matching rule is applied.

#### Attribute and Entity Selection

- By default, the matcher will use the callout's `entity` and `attribute` (if set), or just the entity's state.
- You can override this per matcher using the `entity` and/or `attribute` fields.
- For example, you can style a callout based on the brightness of a different light entity.

#### Example: Per-Callout State Resolver

```yaml
callout:
  entity: sensor.warp_core_temp
  state_resolver:
    enabled: true
    states:
      - from: 0
        to: 300
        preset: default
      - from: 301
        to: 1000
        preset: warning
```

#### Example: Advanced State-Based Styling

```yaml
state_resolver:
  enabled: true
  states:
    - entity: light.kitchen
      attribute: brightness
      from: 0
      to: 50
      settings:
        text:
          color: var(--lcars-blue)
    - entity: sensor.outdoor_temp
      from: 80
      to: 100
      preset: warning
    - entity: sensor.alarm
      attribute: alarm_state
      regex: "^armed_.*$"
      settings:
        line:
          color: var(--lcars-orange)
```

### Benefits

- **Dynamic:** Style overlays based on any entity or attribute in your Home Assistant instance.
- **Flexible:** Switch presets or override any style property per state.
- **Consistent:** Uses the same logic and operators as the CB-LCARS base card's `custom_states`.
- **DRY:** Use callout-level `entity` and `attribute` as defaults for all state matchers.

---

## Overloading & Merging Logic

- **Presets**: `default` → named preset → callout → state_resolver `settings`
- **Slots**: Named overlays, merged with anchor name as fallback
- **callouts**: Array-based overlays, merged by order
- **custom_presets**: User-defined, merged over built-in presets

---

## Advanced Examples

### 1. Smart Line Attachment with Offsets

```yaml
text:
  value: "Impulse Engines"
  position: engines_label
  align: right
  line_attach: left
  x_offset: -12
  y_offset: 4
```

### 2. Animated Marching Dots

```yaml
line:
  width: 2
  stroke_dasharray: "1,6"
  stroke_linecap: "round"
  animation:
    type: march
    duration: 1.5s
```

### 3. State-Based Color and Animation

```yaml
state_resolver:
  enabled: true
  states:
    - from: 0
      to: 299
      preset: default
    - from: 300
      to: 1000
      settings:
        text:
          color: red
        line:
          animation:
            type: blink
            duration: 0.5s
```

---

## Tips & Best Practices

- Use SVG anchors for precise overlay placement.
- Use presets for DRY, consistent styling.
- Use `state_resolver` for dynamic, context-aware overlays.
- Prefer `slots` for named overlays, `callouts` for coordinate-based overlays.
- Use `custom_presets` to override or extend built-in presets.

---

## Migration Notes

- All v1 features are supported, but `state_resolver` is now the preferred way to handle state-based styling.
- The `conditions` array is no longer supported or documented; use `state_resolver` for all dynamic styling.
- The simple state-to-color mapping (e.g., `color: { on: 'red' }`) is removed. All state-based color changes must use `state_resolver`.
- Preset merging order is now explicit and supports user overrides.

---

## Placeholders for Images

- [IMAGE: Example MSD overlay with callouts, lines, and animated dots]
- [IMAGE: SVG with anchor points highlighted]
- [IMAGE: State-based color/animation change]

---

## Full Example: Complete MSD Schema

Below is a comprehensive YAML example showing all major options and features in a single configuration. Inline comments explain each section.

```yaml
type: custom:cb-lcars-msd-card
variables:
  msd:
    base_svg: /local/lcars/defiant.svg         # Path to your SVG schematic
    x_offset: 8                                # Default x offset for line-to-text attachment (can be overridden per callout/text)
    y_offset: -4                               # Default y offset for line-to-text attachment
    text_width_multiplier: 0.3                 # Used for smart line attachment to text
    presets:
      default:
        text:
          font_size: 16
          color: var(--primary-text-color)
          text_transform: uppercase
        line:
          width: 2
          color: var(--lcars-orange)
      warning:
        text:
          color: orange
        line:
          color: orange
          stroke_dasharray: "5,5"
          animation:
            type: march
            duration: 1.5s
    custom_presets:
      info:
        text:
          color: var(--lcars-blue)
        line:
          color: var(--lcars-blue)
    state_resolver:
      enabled: true
      states:
        - entity: sensor.ship_status
          equals: "red_alert"
          preset: warning
        - entity: sensor.ship_status
          equals: "normal"
          preset: default
    slots:
      warp_core:
        callout:
          entity: sensor.warp_core_temp
          preset: default
          text:
            value: |
              [[[ return `Core Temp: ${entity.state}°C`; ]]]
            position: warp_core_label
            font_size: 18px
            align: left
            text_transform: uppercase
            color: var(--primary-text-color)
            line_attach: right
            x_offset: 8
          anchor: warp_core
          line:
            width: 3
            rounded: true
            corner_radius: 16
            color: green
            visible: true
            stroke_dasharray: "5,5"
            stroke_linecap: "round"
            stroke_linejoin: "round"
            opacity: 1
            animation:
              type: march
              duration: 2s
          visible: |
            [[[ return entity.state > 0; ]]]
          tap_action:
            action: toggle
            entity: switch.warp_core
          hold_action:
            action: more-info
            entity: sensor.warp_core_temp
          double_tap_action:
            action: call-service
            service: script.alert_core
          state_resolver:
            enabled: true
            states:
              - from: 0
                to: 300
                preset: default
              - from: 301
                to: 1000
                preset: warning
      life_support:
        callout:
          entity: switch.life_support
          preset: default
          text:
            value: |
              [[[ return entity.state === 'on'
                ? "Life Support: ENGAGED"
                : "Life Support: OFFLINE"; ]]]
            position: life_support_label
            font_family: LCARS
            color: green
            align: left
            line_attach: left
          anchor: life_support_anchor
          line:
            width: 3
            rounded: true
            corner_radius: 16
            color: green
            visible: true
            stroke_dasharray: "1,4"
            stroke_linecap: "round"
            stroke_linejoin: "round"
            opacity: 1
            animation:
              type: pulse
              duration: 1.5s
          visible: true
    callouts:
      - entity: sensor.hull_integrity
        preset: info
        text:
          value: |
            [[[ return `Hull: ${entity.state}%`; ]]]
          position: [88%, 12%]
          font_family: 'Antonio'
          color: blue
        anchor: [90%, 15%]
        line:
          points: [[88%, 12%], [90%, 15%]]
          width: 2
          rounded: true
          color: blue
        visible: true
        tap_action:
          action: more-info
          entity: sensor.hull_integrity
      - entity: sensor.engines
        text:
          value: |
            [[[ return `Engines: ${entity.state}`; ]]]
          position: [70%, 15%]
          font_family: 'Antonio'
          color: yellow
        anchor: [80%, 25%]
        line:
          points: [[70%, 15%], [76%, 20%], [80%, 25%]]
          width: 2
          rounded: true
          color: yellow
        visible: true
        tap_action:
          action: toggle
          entity: switch.engines
```

This example demonstrates:
- Use of `base_svg`, global offsets, and text width multiplier
- Built-in and custom presets, and how to use them
- Global and per-callout `state_resolver` for dynamic styling
- Named `slots` and array-based `callouts`
- All major options for text, line, animation, and actions

---

# End of LCARS MSD Card Schema v2 Documentation

#### Example: State-Based Color Matching – Simple (color keys) vs. Advanced (state_resolver)

Below are two callout examples demonstrating the difference between basic state value color matching (no `state_resolver`) and advanced state-based styling using `state_resolver`.

```yaml
slots:
  # Example 1: Simple state-based color matching using color keys (no state_resolver)
  airlock:
    callout:
      entity: binary_sensor.airlock
      text:
        value: |
          [[[ return entity.state === 'on' ? "Airlock: OPEN" : "Airlock: CLOSED"; ]]]
        position: airlock_label
        font_size: 16px
        align: left
        color:
          default: gray         # Used if state is not 'on' or 'off'
          on: red               # Used when entity.state === 'on'
          off: green            # Used when entity.state === 'off'
      anchor: airlock_anchor
      line:
        width: 3
        stroke_dasharray: "1,6"
        stroke_linecap: "round"
        color:
          default: orange       # Used if state is not 'on' or 'off'
          on: red               # Used when entity.state === 'on'
          off: green            # Used when entity.state === 'off'
        animation:
          type: march
          duration: 2s
      # No state_resolver: color keys are matched directly to entity.state.
      # This is a shortcut for simple color changes only.
      # No other style or preset logic is affected.

  # Example 2: Advanced state-based styling using state_resolver
  warp_core:
    callout:
      entity: sensor.warp_core_temp
      text:
        value: |
          [[[ return `Core Temp: ${entity.state}°C`; ]]]
        position: warp_core_label
        font_size: 18px
        align: left
        text_transform: uppercase
        color: var(--primary-text-color)  # Base color
      anchor: warp_core
      line:
        width: 3
        stroke_dasharray: "1,6"
        stroke_linecap: "round"
        color: var(--lcars-orange)        # Base color
        animation:
          type: march
          duration: 2s
      state_resolver:
        enabled: true
        states:
          - from: 0
            to: 300
            settings:
              text:
                color: var(--primary-text-color)  # Use default color for normal range
              line:
                color: var(--lcars-orange)
          - from: 301
            to: 1000
            settings:
              text:
                color: red                        # Override color when temp is high
              line:
                color: red
      # When state_resolver is enabled, it can override the base color property.
      # This allows for complex, multi-property, or multi-entity logic.
```

**What this shows:**
- The `airlock` callout demonstrates simple color switching by matching the entity's state directly to keys in the `color` object. No `state_resolver` is needed for this.
- The `warp_core` callout demonstrates advanced state-based styling using `state_resolver`, which allows for more complex logic and can override any style property, but only uses the `default` color key.

> **Tip:** Use direct color keys for fast, simple state-based color changes. Use `state_resolver` for more advanced, multi-property, or multi-entity state logic.
    callout:
      entity: sensor.warp_core_temp
      text:
        value: |
          [[[ return `Core Temp: ${entity.state}°C`; ]]]
        position: warp_core_label
        font_size: 18px
        align: left
        color:
          default: var(--primary-text-color)  # Only 'default' is used when state_resolver is enabled
      anchor: warp_core
      line:
        width: 3
        stroke_dasharray: "1,6"
        stroke_linecap: "round"
        color:
          default: var(--lcars-orange)        # Only 'default' is used when state_resolver is enabled
        animation:
          type: march
          duration: 2s
      state_resolver:
        enabled: true
        states:
          - from: 0
            to: 300
            settings:
              text:
                color:
                  default: var(--primary-text-color)  # Use default color for normal range
              line:
                color:
                  default: var(--lcars-orange)
          - from: 301
            to: 1000
            settings:
              text:
                color:
                  default: red                        # Override color when temp is high
              line:
                color:
                  default: red
      # When state_resolver is enabled, only the 'default' color key is used and can be overridden by state_resolver logic.
      # This allows for complex, multi-property, or multi-entity logic.
```

**What this shows:**
- The `airlock` callout demonstrates simple color switching by matching the entity's state directly to keys in the `color` object. No `state_resolver` is needed for this.
- The `warp_core` callout demonstrates advanced state-based styling using `state_resolver`, which allows for more complex logic and can override any style property, but only uses the `default` color key.

> **Tip:** Use direct color keys for fast, simple state-based color changes. Use `state_resolver` for more advanced, multi-property, or multi-entity state logic.
        align: left
        color:
          default: var(--primary-text-color)  # Only 'default' is used when state_resolver is enabled
      anchor: warp_core
      line:
        width: 3
        stroke_dasharray: "1,6"
        stroke_linecap: "round"
        color:
          default: var(--lcars-orange)        # Only 'default' is used when state_resolver is enabled
        animation:
          type: march
          duration: 2s
      state_resolver:
        enabled: true
        states:
          - from: 0
            to: 300
            settings:
              text:
                color:
                  default: var(--primary-text-color)  # Use default color for normal range
              line:
                color:
                  default: var(--lcars-orange)
          - from: 301
            to: 1000
            settings:
              text:
                color:
                  default: red                        # Override color when temp is high
              line:
                color:
                  default: red
      # When state_resolver is enabled, only the 'default' color key is used and can be overridden by state_resolver logic.
      # This allows for complex, multi-property, or multi-entity logic.
```

**What this shows:**
- The `airlock` callout demonstrates simple color switching by matching the entity's state directly to keys in the `color` object. No `state_resolver` is needed for this.
- The `warp_core` callout demonstrates advanced state-based styling using `state_resolver`, which allows for more complex logic and can override any style property, but only uses the `default` color key.

> **Tip:** Use direct color keys for fast, simple state-based color changes. Use `state_resolver` for more advanced, multi-property, or multi-entity state logic.
