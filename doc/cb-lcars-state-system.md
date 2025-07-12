# CB-LCARS State System

CB-LCARS cards provide a flexible state system for controlling the appearance and behavior of your cards based on entity state, attribute values, or simple custom logic.

- **Built-in state matching**: Predefined states like `on`, `off`, `unavailable`, etc.
- **Custom state matching (`state_custom`)**:
  - Designed for quick, simple styling customizations.
  - Supports a single condition per matcher (no AND/OR or complex logic).
  - Not a replacement for full button-card state templates.
  - For advanced logic (multiple conditions, AND/OR, expressions), use the standard button-card `state:` template system.

---

## Overview

Each CB-LCARS card can respond to the state of its assigned entity and apply different styles depending on the current state. This is achieved through a set of **state matchers**, each of which can match on specific values, ranges, or patterns.

There are two main types of state matchers:

- **Built-in State Matchers**: Predefined states such as `on`, `off`, `unavailable`, `zero`, etc.
- **Custom State Matchers (`state_custom`)**: User-defined matchers that allow for advanced matching logic (e.g., value ranges, regex, attribute-based, multi-entity, etc.).

---

## Built-in State Matchers

The following built-in states are available.  The styles are controlled via the card's variables structure (see below):

| State ID             | Matches Entity State Value(s)         | Variable Name   |
|----------------------|---------------------------------------|-----------------|
| `state_default`      | No entity assigned                    | `default:`      |
| `state_on`           | `on`, `open`, `locked`                | `active:`       |
| `state_off`          | `off`, `closed`, `unlocked`           | `inactive:`     |
| `state_zero`         | Numeric value exactly `0`             | `zero:`         |
| `state_nonzero`      | Numeric value not `0`                 | `non_zero:`     |
| `state_heat`         | `heat` (HVAC/climate)                 | `hvac_heat:`    |
| `state_cool`         | `cool` (HVAC/climate)                 | `hvac_cool:`    |
| `state_unavailable`  | `unavailable`, `unknown`              | `unavailable:`  |

If no entity is defined (no state), `default` will be used.  If the entity is unavailable or unknown, then `unavailable` will be used.

Each of these is configurable in the UI editor for the cards.

State styles can be applied to various components such as:
- Borders
- Backgrounds
- Text
- etc.
> **Tip**
> When using Light entities, you can choose to have your colour
> match the light's current colour.  You can choose this from
> the colour picker list, or by using the variables `var(--button-card-light-color)` or `var(--button-card-light-color-no-temperature)`

Example of configuration (editable via UI):
```yaml
variables:
  text:
    label:
      color:
        default: var(--primary-text-color)
        active: var(--lcars-ui-secondary)
        inactive: var(--lcars-ui-tertiary)
        zero: var(--lcars-green)
        non_zero: var(--lcars-blue)
        hvac_heat: var(--lcars-orange)
        hvac_cool: var(--lcars-blue)
        unavailable: var(--lcars-card-button-unavailable)
  card:
    color:
      default: var(--lcars-card-top-color, var(--picard-dark-gray))
      active: var(--lcars-ui-secondary)
      inactive: var(--lcars-ui-tertiary)
      zero: var(--lcars-green)
      non_zero: var(--lcars-blue)
      hvac_heat: var(--lcars-orange)
      hvac_cool: var(--lcars-blue)
      unavailable: var(--lcars-card-button-unavailable)
      background:
        default: var(--lcars-card-top-color, var(--picard-dark-gray))
        active: var(--lcars-ui-secondary)
        inactive: var(--lcars-ui-tertiary)
        zero: var(--lcars-green)
        non_zero: var(--lcars-blue)
        hvac_heat: var(--lcars-orange)
        hvac_cool: var(--lcars-blue)
        unavailable: var(--lcars-card-button-unavailable)
```

---

## Custom State Matchers (`state_custom`)

CB-LCARS contains a **simple custom state matching** system, allowing you to define a list of your own matchers using a variety of operators for conditional styling.

This system enables your cards to dynamically update their appearance at runtime based on the current state or attribute values of entities—no reloads or manual updates required.

> **How to enable:**
> To use custom state matchers, set `enabled: true` under `variables.custom_states`.
> - When `enabled` is true, `state_custom` logic is used for state matching first.
> - For properties not customized via the custom matcher, or if a match is not found, the `default` value is used.


It provides a quick and accessible way to achieve dynamic custom styling for most common cases, without needing to write full button-card state templates.

> **Note:**
> `state_custom` is **not** a replacement for button-card's full state template functionality. If you require more complex logic (such as multiple conditions, AND/OR logic, or advanced expressions), you should use the standard button-card `state:` template system instead as you can write full javascript code blocks for value expressions.


### How It Works

- Enable custom state matchers - set `variables.custom_states.enabled` to `true`.
- Custom matchers are defined in the `variables.custom_states.states` array.
- Each matcher in the `variables.custom_states.states` array supports **a single condition/operator per entry**.
-  The logic will test each matcher entry in order of the operators defined below. **As soon as a match is found, processing stops and that matcher is used.**
- You cannot combine multiple conditions (e.g., AND/OR) within a single matcher entry.
- If you need to match on multiple conditions, use the button-card `state:` template system.

- Each matcher can specify:
  - Which entity and/or attribute to match (defaults to the card's main entity/attribute if omitted)  Any entity can be used here - it need not be the entity tied to the main card.
  - The operator and value(s) to match (e.g., `equals`, `from`/`to`, `regex`, `in`, `not_in`, etc.)
  - The style variable overrides to apply when matched.

When a match from the list occurs, the card will:
- Set the matched state configuration config into the card's main config at `cblcars_custom_match`
- Apply any style overrides defined in the matcher.
- Use the `state_custom` style block for rendering.


> **Technical Limitation:**
> Only the _styling_ variables for the `card` and `text` (including `label`,`name`,`state`) variable blocks are available for override in `state_custom`. The entire variables structure is **not** mirrored here, due to limitations in button-card. Since variables are only evaluated on first load and cannot be updated dynamically during state evaluation - we can only dynamically alter CSS styles.

> **What are "styling variables"?**<br>
> Styling variables are variables that directly control the CSS properties of the card's appearance. These variables are used to set things like colors, font sizes, padding, borders, and other visual aspects in the card's style blocks. Only these variables can be overridden dynamically by `state_custom` matchers. Other variables (such as those used for logic, actions, or non-style configuration) are **not** supported for override.

**Supported Styling Variable Paths for Override**

The following variable paths can be overridden in a `state_custom` matcher (non-exhaustive list):

| Variable Path                        | Description                        |
|-------------------------------------- |------------------------------------|
| `card.color.background.default`       | Card background color              |
| `card.border.top.size`                | Card top border size               |
| `card.border.top.left_radius`         | Card top left border radius        |
| `text.label.color.default`            | Label text color                   |
| `text.label.font_size`                | Label font size                    |
| `text.label.font_family`              | Label font family                  |
| `text.state.color.default`            | State text color                   |
| `text.name.font_family`               | Name font family                   |
| `icon.color.default`                  | Icon color                         |
| ... *(add more as needed)*            |                                    |

> **Note:** Only the above (and similar) variables that map directly to CSS properties in the card's style blocks are supported for override. If you attempt to override a variable not used for styling, it will have no effect.

### Supported Operators and Evaluation Order

Each matcher can use one of the following operators (evaluated in this order):

1. `equals`      — Matches if value equals specified value (string or number)
2. `not_equals`  — Matches if value does NOT equal specified value
3. `from`/`to`   — Matches if value is within (inclusive) numeric range
4. `in`          — Matches if value is in provided array
5. `not_in`      — Matches if value is NOT in provided array
6. `regex`       — Matches if value matches provided regular expression (string)

> **Order matters:**
> The first operator present in a matcher entry is the only one evaluated for that entry. If a match is found, no further matchers are checked.

### Attribute and Entity Selection

- By default, the matcher will use the card's main entity and attribute.
- You can override this per matcher using the `entity` and/or `attribute` fields.

### Example: Custom State Matchers

#### Example 1: Match a Specific Attribute Value of the main Entity

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - attribute: "brightness"
        from: 1
        to: 50
        settings:
          card:
            color:
              background:
                default: var(--lcars-orange)
          text:
            state:
              color:
                default: var(--lcars-orange)
```

#### Example 2: Match State on a Different Entity

```yaml
variables:
  entity: light.porch
  custom_states:
    enabled: true
    states:
      - entity: "sensor.outdoor_temperature"
        from: -10
        to: 0
        settings:
          card:
            color:
              background:
                default: var(--lcars-blue)
```

#### Example 3: Regex Match

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - attribute: "alarm_state"
        regex: "^armed_.*$"
        settings:
          card:
            color:
              background:
                default: var(--lcars-orange)
```

#### Example 4: In/Not In

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - in: [ "paused", "idle" ]
        settings:
          card:
            color:
              background:
                default: var(--lcars-yellow)
      - not_in: [ "off", "unavailable" ]
        settings:
          card:
            color:
              background:
                default: var(--lcars-green)
```

> **Important:**
> Each matcher entry supports only a single condition/operator. If you specify multiple operators in one entry, **only the first one (in the order above) will be evaluated**.

> **First Match Wins**
> Custom state matchers are evaluated in the order they appear in your configuration. As soon as a matcher matches, its settings are applied and no further matchers are checked. Make sure to order your matchers from most specific to most general.

---

## Troubleshooting & FAQ

**Q: Why isn't my custom state matcher working?**<br>
A: Check that:
- `variables.custom_states.enabled` is set to `true`.
- Your matcher is the first one that matches (remember, only the first match is used).
- The variable you are trying to override is a supported styling variable (see the table above).
- The entity and attribute you reference exist and have the expected value.

**Q: Can I override icon color or other style properties?**<br>
A: Yes, you can override supported styling variables for `card`, `text`, and `icon` (see the table above). Other variables or logic are not supported.

**Q: What happens if no matcher matches?**<br>
A: If no custom matcher matches, the card's `default` state values will be used.

**Q: Can I use multiple conditions (AND/OR) in a matcher?**<br>
A: No, each matcher supports only a single condition/operator. For more complex logic, use the standard button-card `state:` template system.

---

## Advanced Examples

Here are some more advanced use cases to help you get the most out of custom state matchers:

### Example: Override Multiple Style Properties

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - equals: "maintenance"
        settings:
          card:
            color:
              background:
                default: var(--lcars-yellow)
            border:
              top:
                size: 8px
                color: var(--lcars-orange)
          text:
            label:
              color:
                default: var(--lcars-orange)
              font_size: 28
              font_family: "cb-lcars_millenium"
```

### Example: Use a Different Entity and Attribute

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - entity: "sensor.weather"
        attribute: "condition"
        equals: "rainy"
        settings:
          card:
            color:
              background:
                default: var(--lcars-blue)
          text:
            state:
              color:
                default: var(--lcars-blue)
```

### Example: Override Icon Color

```yaml
variables:
  custom_states:
    enabled: true
    states:
      - equals: "alert"
        settings:
          icon:
            color:
              default: var(--lcars-red)
```

---

> **Limitation:**
> Only variables that directly affect card, text, or icon styling can be overridden dynamically. Attempting to override other variables will have no effect.
> If no custom matcher matches, the card will use the "default" styling variables (such as `variables.card.color.background.default`). Other built-in state styles (like `state_on`, `state_off`, etc.) are not evaluated when `state_custom` is enabled.

---

## Advanced: Overriding _Built-in_ State Styles

You can override the `value:` expressions and styles of any built-in state by providing a `state:` block in your card configuration with the appropriate `id:`.

**Best practice:**
- Use the main variables (in the `variables:` section) to control styles for each state whenever possible.
- If you need to modify a property that is not available via the main variables, you can use the `styles` override here.
- In the `styles` override, you must specify the CSS property directly (e.g., `background-color`), not by redefining variables.
  For example, to change the card background, use `background-color: var(--lcars-orange)` instead of trying to set a variable.

This is a standard [custom-button-card](https://github.com/custom-cards/button-card#state) feature and works seamlessly with CB-LCARS.

Each `state:` entry can match a value (or use an operator) and apply additional styles or variable overrides when that state is active. This is useful if you want to treat a specific value as "active", or apply custom styles for a particular state.

**Example: Override the "active" state for a specific value**

```yaml
type: custom:cb-lcars-button-card
entity: alarm_control_panel.home_alarm
state:
  - value: "armed_home"
    operator: "=="
    id: state_on  # Use the 'active' style block
    styles:       # Style overrides (advanced, for non-variable properties)
      card:
        - background-color: var(--lcars-orange)  # Specify CSS property directly
```

You can also override styles for any built-in state by matching its value and specifying the `id` field to link to the desired style block (`state_on`, `state_off`, etc.).

**Example: Override "off" state styling**

```yaml
type: custom:cb-lcars-button-card
entity: light.kitchen
state:
  - value: "off"
    id: state_off
    styles:
      card:
        - background-color: var(--lcars-blue)
```

> **Tip:**
> The `id` field determines which style block is to be customized. You can use this to map custom values to built-in state styles, or to apply your own overrides.

---

## See Also

- [custom-button-card documentation: State Matching](https://github.com/custom-cards/button-card?tab=readme-ov-file#available-operators)
- [CB-LCARS README: States Overview](../README.md#states)

---
