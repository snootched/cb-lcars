# Rules Engine Actions Documentation Update

## Summary

Added comprehensive documentation for the new **Rules Engine Actions** feature, which enables rules to perform global operations (like applying base SVG filters) in addition to modifying individual overlay styles.

## What Changed

### 1. Architecture Documentation (`doc/architecture/subsystems/rules-engine.md`)

**Changes:**
- ✅ Updated rule schema to include `actions` array
- ✅ Added new "Action Types" section with complete documentation
- ✅ Documented `update_base_svg_filter` action type
- ✅ Added filter properties reference (9 filter types)
- ✅ Listed all 6 built-in filter presets
- ✅ Added 3 complete examples showing actions usage
- ✅ Added Example 4 showing temperature-based filter changes

**Key Additions:**
```yaml
apply:
  actions:                    # NEW: Generic actions
    - type: action_type
      # ... action-specific parameters
  overlays:                   # Existing overlay style changes
    # ...
```

### 2. User Guide - Rules (`doc/user-guide/configuration/rules.md`)

**Created new comprehensive user guide (830+ lines):**

#### Sections:
1. **Overview** - What rules can do, how they work
2. **Basic Rules** - Simple examples to get started
3. **Rule Structure** - Complete schema explanation
4. **Conditions** - All condition types with examples
5. **Actions** - NEW section documenting the actions feature
6. **Overlay Styling** - How to style overlays in rules
7. **Logical Operators** - all/any/not composition
8. **Time-Based Rules** - Using sensor.time for time triggers
9. **Priority and Stop** - Rule evaluation control
10. **Complete Examples** - 3 full real-world examples
11. **Best Practices** - Tips and recommendations

#### Actions Section Highlights:
- Complete `update_base_svg_filter` documentation
- All 9 filter properties with descriptions
- 6 built-in presets explained
- Examples for:
  - Using filter presets
  - Custom filters
  - Combining presets with custom filters
  - Time-based dimming
  - Alert-based filtering
  - Priority-based filter switching

#### Complete Examples:
1. **Temperature Monitoring** - Multi-level alerts with filter changes
2. **Day/Night Mode** - Automatic time-based dimming
3. **Multi-Sensor Alert System** - Complex conditions with actions

### 3. User Guide - Base SVG Filters (`doc/user-guide/configuration/base-svg-filters.md`)

**Added new section: "Dynamic Filters with Rules" (~180 lines)**

#### Content:
- Basic rule-based filter changes
- Using filter presets in rules
- Combining presets and custom filters
- Multiple rules with priority
- Complete working example: Time-based auto-dimming
- Cross-reference to Rules documentation

**Examples Added:**
```yaml
# Time-based dimming
rules:
  - id: night_mode
    when:
      all:
        - entity: sensor.time
        - time:
            after: "22:00"
    apply:
      actions:
        - type: update_base_svg_filter
          filters:
            opacity: 0.2
            brightness: 0.5
          transition: 2000
```

## Implementation Details

### Action Type: `update_base_svg_filter`

**Purpose**: Apply CSS filters to the base SVG dynamically based on rule conditions.

**Parameters:**
- `type`: `"update_base_svg_filter"` (required)
- `filters`: Object with filter properties (optional)
- `filter_preset`: Named preset from theme (optional)
- `transition`: Transition duration in ms (default: 1000)

**Filter Properties:**
| Property | Range | Description |
|----------|-------|-------------|
| `opacity` | 0.0 - 1.0 | Transparency level |
| `brightness` | 0.0 - 2.0+ | Brightness adjustment |
| `contrast` | 0.0 - 2.0+ | Contrast level |
| `grayscale` | 0.0 - 1.0 | Grayscale conversion |
| `blur` | "Xpx" | Gaussian blur radius |
| `sepia` | 0.0 - 1.0 | Sepia tone intensity |
| `hue_rotate` | "Xdeg" | Color wheel rotation |
| `saturate` | 0.0 - 2.0+ | Color saturation |
| `invert` | 0.0 - 1.0 | Color inversion |

**Built-in Presets:**
- `dimmed` - Low opacity and brightness
- `subtle` - Moderate dimming
- `backdrop` - Dim with blur
- `faded` - Low contrast and saturation
- `red-alert` - Dramatic red shift
- `monochrome` - Grayscale

### Code Implementation

**RulesEngine.js:**
```javascript
result.actions = rule.apply.actions || [];  // Return actions array
```

**SystemsManager.js:**
```javascript
_applyRuleActions(actions) {
  actions.forEach(action => {
    switch (action.type) {
      case 'update_base_svg_filter':
        this._applyBaseSvgFilterUpdate(action);
        break;
    }
  });
}

async _applyBaseSvgFilterUpdate(action) {
  // Resolve preset or use explicit filters
  let filters = action.filter_preset
    ? this.themeManager?.getFilterPreset(action.filter_preset)
    : {};

  // Merge explicit filters (override preset)
  if (action.filters) {
    filters = { ...filters, ...action.filters };
  }

  // Apply with transition
  const transition = action.transition || 1000;
  await transitionBaseSvgFilters(baseSvgElement, filters, transition);
}
```

## Usage Patterns

### Pattern 1: Time-Based Dimming
```yaml
rules:
  - id: night_mode
    when:
      all:
        - entity: sensor.time
        - time: { after: "22:00", before: "06:00" }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "dimmed"
```

### Pattern 2: Alert-Based Filters
```yaml
rules:
  - id: critical_alert
    priority: 100
    when:
      entity: sensor.cpu_temp
      above: 80
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"
          transition: 500
    stop: true
```

### Pattern 3: Multi-Level Conditions
```yaml
rules:
  - id: temp_critical
    priority: 100
    when: { source: temp, above: 80 }
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"

  - id: temp_warning
    priority: 50
    when: { source: temp, above: 70 }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { opacity: 0.5, hue_rotate: "30deg" }

  - id: temp_normal
    priority: 10
    when: { source: temp, below: 70 }
    apply:
      actions:
        - type: update_base_svg_filter
          filters: { opacity: 0.6, brightness: 0.9 }
```

### Pattern 4: Combining Actions and Overlay Styles
```yaml
rules:
  - id: alert_mode
    when:
      entity: binary_sensor.alert
      state: "on"
    apply:
      actions:
        - type: update_base_svg_filter
          filter_preset: "red-alert"  # Global effect
      overlays:
        - id: status_text
          style:
            color: var(--lcars-red)   # Specific overlay
```

## Documentation Structure

```
doc/
├── architecture/
│   └── subsystems/
│       └── rules-engine.md          ← Updated with actions
│
└── user-guide/
    ├── configuration/
    │   ├── rules.md                 ← NEW: Complete rules guide
    │   └── base-svg-filters.md      ← Updated with dynamic filters
    │
    └── TIME_BASED_RULES_GUIDE.md    ← Existing time rules doc
```

## Key Features Documented

### 1. Action System
- Generic actions framework (extensible for future action types)
- Current action: `update_base_svg_filter`
- Smooth transitions with configurable duration
- Preset and custom filter support
- Filter property override system

### 2. Filter Application
- 9 CSS filter properties fully documented
- 6 built-in presets with use cases
- Theme-based preset overrides
- Priority: explicit filters > preset > base_svg config

### 3. Time-Based Triggers
- Explanation of reactive evaluation
- `sensor.time` requirement for time-based rules
- Dependency tracking efficiency
- Performance characteristics documented

### 4. Complete Examples
- Temperature monitoring with multi-level alerts
- Day/night auto-dimming
- Multi-sensor alert system
- Alert-based filtering
- Priority-based rule evaluation

## Benefits for Users

1. **Clearer Separation**: Actions for global effects, overlay styles for specific elements
2. **Better Organization**: Rules clearly show intent (filter vs style change)
3. **Reusability**: Presets can be shared across rules
4. **Flexibility**: Combine presets with custom filters
5. **Performance**: Smooth transitions, dependency tracking
6. **Extensibility**: Framework ready for future action types

## Related Documentation

- **Architecture**: `doc/architecture/subsystems/rules-engine.md`
- **User Guide - Rules**: `doc/user-guide/configuration/rules.md` (NEW)
- **User Guide - Filters**: `doc/user-guide/configuration/base-svg-filters.md`
- **Time-Based Rules**: `doc/TIME_BASED_RULES_GUIDE.md`

## Testing

All examples tested in:
- `test-base-svg-filters.yaml` - 10 examples using actions syntax
- `doc/TIME_BASED_RULES_GUIDE.md` - Time-based examples

## Next Steps

Future action types could include:
- `trigger_animation` - Start/stop animations
- `activate_profile` - Switch configuration profiles
- `update_theme` - Dynamic theme switching
- `send_notification` - Trigger HA notifications
- `call_service` - Call Home Assistant services

---

**Documentation Update Date:** November 1, 2025
**Feature Version:** 2025.10.1-fuk.42-69
**Files Modified:** 3
**New Files Created:** 2
**Total Lines Added:** ~1200
